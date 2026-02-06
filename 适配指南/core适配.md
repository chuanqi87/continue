# Continue Core模块HBuilderX适配文档

## 概述

本文档详细介绍Continue的core模块为适配HBuilderX IDE所做的修改，包括日志增强、平台识别、配置加载、工具实现等方面的适配工作。

## 目录

1. [适配概览](#适配概览)
2. [日志系统增强](#日志系统增强)
3. [平台识别工具](#平台识别工具)
4. [配置加载适配](#配置加载适配)
5. [工具实现增强](#工具实现增强)
6. [LLM系统扩展](#llm系统扩展)
7. [代码索引适配](#代码索引适配)
8. [最佳实践](#最佳实践)

## 适配概览

### 修改文件清单

core模块为HBuilderX适配主要修改了以下文件：

```
core/
├── core.ts                                 # 核心控制器（日志增强）
├── config/
│   ├── load.ts                            # 配置加载（HBuilderX特殊处理）
│   ├── default.ts                         # 默认配置（禁用索引）
│   ├── types.ts                           # 类型定义
│   └── yaml/loadYaml.ts                   # YAML加载
├── data/
│   └── log.ts                             # 日志记录（类型修复）
├── llm/
│   ├── index.ts                           # LLM入口（uni-app消息）
│   └── uniappDefaultSystemMessage.ts      # uni-app系统消息（新增）
├── tools/
│   ├── callTool.ts                        # 工具调用（日志增强）
│   ├── parseArgs.ts                       # 参数解析（安全性）
│   └── implementations/
│       ├── readFile.ts                    # 文件读取（日志增强）
│       ├── readFileLimit.ts               # 文件限制（日志）
│       └── runTerminalCommand.ts          # 终端命令（日志）
├── util/
│   ├── paths.ts                           # 路径工具（HBuilderX支持）
│   ├── platform.ts                        # 平台识别（新增）
│   ├── posthog.ts                         # 遥测（HBuilderX支持）
│   └── treeSitter.ts                      # Tree-sitter（HBuilderX）
└── indexing/
    └── docs/DocsService.ts                # 文档服务（日志）
```

### 适配原则

1. **最小侵入性**：尽量不改变core的核心逻辑
2. **日志增强**：关键操作添加 `[hbuilderx]` 前缀日志
3. **条件判断**：使用 `ideType === "hbuilderx"` 进行特殊处理
4. **向后兼容**：不影响VSCode和IntelliJ的正常运行
5. **错误处理**：完善错误捕获和日志记录

## 日志系统增强

### 1. 核心控制器日志（core.ts）

在 `handleToolCall` 方法中增加详细的日志记录：

```typescript
private async handleToolCall(toolCall: ToolCall) {
  console.log("[hbuilderx] handleToolCall: Starting tool call handling", {
    toolCallId: toolCall.id,
    functionName: toolCall.function.name,
  });

  try {
    const { config } = await this.configHandler.loadConfig();
    if (!config) {
      console.error("[hbuilderx] handleToolCall: Config not loaded");
      throw new Error("Config not loaded");
    }

    const tool = config.tools.find(
      (t) => t.function.name === toolCall.function.name,
    );

    if (!tool) {
      console.error("[hbuilderx] handleToolCall: Tool not found in config", {
        functionName: toolCall.function.name,
        availableTools: config.tools.map((t) => t.function.name),
      });
      throw new Error(`Tool ${toolCall.function.name} not found`);
    }

    if (!config.selectedModelByRole.chat) {
      console.error("[hbuilderx] handleToolCall: No chat model selected");
      throw new Error("No chat model selected");
    }

    console.log(
      "[hbuilderx] handleToolCall: Found tool and model, proceeding with tool call",
      {
        toolName: tool.function.name,
        modelTitle: config.selectedModelByRole.chat.title,
      },
    );

    // 定义流式输出回调
    const onPartialOutput = (params: {
      toolCallId: string;
      contextItems: ContextItem[];
    }) => {
      console.log("[hbuilderx] handleToolCall: Received partial output", {
        toolCallId: params.toolCallId,
        contextItemsCount: params.contextItems.length,
      });
      this.messenger.send("toolCallPartialOutput", params);
    };

    const result = await callTool(tool, toolCall, {
      config,
      ide: this.ide,
      llm: config.selectedModelByRole.chat,
      fetch: (url, init) =>
        fetchwithRequestOptions(url, init, config.requestOptions),
      tool,
      toolCallId: toolCall.id,
      onPartialOutput,
      codeBaseIndexer: this.codeBaseIndexer,
    });

    console.log("[hbuilderx] handleToolCall: Tool call completed", {
      toolCallId: toolCall.id,
      functionName: toolCall.function.name,
      hasError: !!result.errorMessage,
      contextItemsCount: result.contextItems.length,
      resultDetails: {
        errorMessage: result.errorMessage,
        contextItemsDetails: result.contextItems.map((item) => ({
          name: item.name,
          description: item.description,
          contentLength: item.content?.length || 0,
        })),
      },
    });

    return result;
  } catch (error: unknown) {
    console.error("[hbuilderx] handleToolCall: Error occurred", {
      toolCallId: toolCall.id,
      functionName: toolCall.function.name,
      error: error instanceof Error ? error.message : String(error),
      errorStack: error instanceof Error ? error.stack : undefined,
    });
    throw error;
  }
}
```

**日志增强点：**

- 工具调用开始和结束
- 配置加载状态
- 工具查找结果
- 模型选择状态
- 部分输出回调
- 错误详细信息

### 2. 工具调用日志（callTool.ts）

```typescript
export async function callTool(
  tool: Tool,
  toolCall: ToolCall,
  extras: ToolCallExtras,
): Promise<ToolCallState> {
  console.log("[hbuilderx] callTool: Starting tool execution", {
    toolName: tool.function.name,
    toolCallId: extras.toolCallId,
    hasArguments: !!toolCall.function.arguments,
  });

  try {
    // ... 工具执行逻辑

    console.log("[hbuilderx] callTool: Tool execution completed", {
      toolName: tool.function.name,
      toolCallId: extras.toolCallId,
      status: "success",
      contextItemsCount: result.contextItems.length,
    });

    return result;
  } catch (error) {
    console.error("[hbuilderx] callTool: Tool execution failed", {
      toolName: tool.function.name,
      toolCallId: extras.toolCallId,
      error: error instanceof Error ? error.message : String(error),
      errorStack: error instanceof Error ? error.stack : undefined,
    });
    throw error;
  }
}
```

### 3. 文件读取日志（readFile.ts）

```typescript
export const readFileImpl: ToolImpl = async (args, extras) => {
  console.log("[hbuilderx] readFileImpl: Starting read file implementation", {
    args,
    toolCallId: extras.toolCallId,
  });

  try {
    const filepath = getStringArg(args, "filepath");
    const resolvedPath = await resolveInputPath(extras.ide, filepath);

    // ... 文件读取逻辑

    console.log(
      "[hbuilderx] readFileImpl: Read file implementation completed successfully",
      {
        filepath,
        resultCount: result.length,
        resultDetails: result.map((r) => ({
          name: r.name,
          description: r.description,
          contentLength: r.content.length,
          uri: r.uri,
        })),
      },
    );

    return result;
  } catch (error: unknown) {
    console.error("[hbuilderx] readFileImpl: Read file implementation failed", {
      args,
      toolCallId: extras.toolCallId,
      error: error instanceof Error ? error.message : String(error),
      errorStack: error instanceof Error ? error.stack : undefined,
    });
    throw error;
  }
};
```

## 平台识别工具

### 新增platform.ts

创建统一的平台识别工具：

```typescript
import os from "os";

export type Platform = "MAC" | "LINUX" | "WINDOWS" | "UNKNOWN";

export function getPlatform(): Platform {
  const platform = os.platform();
  if (platform === "darwin") {
    return "MAC";
  } else if (platform === "linux") {
    return "LINUX";
  } else if (platform === "win32") {
    return "WINDOWS";
  } else {
    return "UNKNOWN";
  }
}
```

**使用场景：**

- uni-app系统消息中标识当前平台
- 平台特定的配置和行为
- 日志和遥测数据

## 配置加载适配

### 1. 默认禁用索引（load.ts）

HBuilderX环境默认禁用代码索引以提高性能：

```typescript
function loadSerializedConfig(
  config: SerializedContinueConfig,
  ide: IDE,
  ideSettings: IdeSettings,
  workspaceConfigs: ContinueRcJson[],
  writeLog: WriteLog,
  overrideConfigJson: SerializedContinueConfig | undefined,
): ContinueConfig {
  // ... 其他配置加载逻辑

  // Default to indexing disabled if not explicitly set
  if (config.disableIndexing === undefined) {
    config.disableIndexing = true;
  }

  if (os.platform() === "linux" && !isSupportedLanceDbCpuTargetForLinux(ide)) {
    config.disableIndexing = true;
  }

  // ... 继续处理
}
```

**原因：**

- HBuilderX主要用于uni-app开发，代码库通常较小
- 向量数据库索引可能导致性能问题
- 用户可以手动启用索引功能

### 2. Embeddings模型支持（load.ts）

为HBuilderX添加TransformersJS嵌入模型支持：

```typescript
async function intermediateToFinalConfig({
  config,
  llmFromDescription,
  ideInfo,
  readFile,
  writeLog,
}: {
  config: ContinueConfig;
  llmFromDescription: (desc: ModelDescription) => Promise<ILLM>;
  ideInfo: IdeInfo;
  readFile: (filepath: string) => Promise<string>;
  writeLog: WriteLog;
}): Promise<ContinueConfig> {
  // ... 其他逻辑

  // Add transformers JS to the embed models list if not already added
  if (
    (ideInfo.ideType === "vscode" || ideInfo.ideType === "hbuilderx") &&
    !continueConfig.modelsByRole.embed.find(
      (m) => m.providerName === "transformers.js",
    )
  ) {
    const tjs = new TransformersJsEmbeddingsProvider();
    continueConfig.modelsByRole.embed.push(tjs);
  }

  // ... 继续处理
}

function getDefaultEmbeddingsProvider(ideInfo: IdeInfo) {
  if (ideInfo.ideType === "vscode") {
    return new TransformersJsEmbeddingsProvider();
  }
  // HBuilderX可能支持嵌入式模型
  if (ideInfo.ideType === "hbuilderx") {
    return new TransformersJsEmbeddingsProvider();
  }
  return null;
}
```

**关键点：**

- HBuilderX支持TransformersJS嵌入模型
- 用于本地向量化和语义搜索
- 无需外部API调用

## 工具实现增强

### 1. 文件读取增强（readFile.ts）

除了日志增强外，还包括：

```typescript
export const readFileImpl: ToolImpl = async (args, extras) => {
  console.log("[hbuilderx] readFileImpl: Starting read file implementation", {
    args,
    toolCallId: extras.toolCallId,
  });

  try {
    const filepath = getStringArg(args, "filepath");

    // 解析路径
    const resolvedPath = await resolveInputPath(extras.ide, filepath);
    if (!resolvedPath) {
      throw new ContinueError(
        ContinueErrorReason.PathNotFound,
        `No file ${filepath} found in workspace directories`,
      );
    }

    // 检查文件大小
    await throwIfFileExceedsHalfOfContext(
      resolvedPath.uri,
      extras.ide,
      extras.llm,
    );

    // 读取文件内容
    const content = await extras.ide.readFile(resolvedPath.uri);

    const result: ContextItem[] = [
      {
        name: resolvedPath.relPath || resolvedPath.path,
        description: filepath,
        content,
        uri: {
          type: "file",
          value: resolvedPath.uri,
        },
      },
    ];

    console.log(
      "[hbuilderx] readFileImpl: Read file implementation completed successfully",
      {
        filepath,
        resultCount: result.length,
        resultDetails: result.map((r) => ({
          name: r.name,
          description: r.description,
          contentLength: r.content.length,
          uri: r.uri,
        })),
      },
    );

    return result;
  } catch (error: unknown) {
    console.error("[hbuilderx] readFileImpl: Read file implementation failed", {
      args,
      toolCallId: extras.toolCallId,
      error: error instanceof Error ? error.message : String(error),
      errorStack: error instanceof Error ? error.stack : undefined,
    });
    throw error;
  }
};
```

### 2. 参数解析安全性（parseArgs.ts）

增加参数获取的类型检查：

```typescript
export function getStringArg(
  args: Record<string, any> | undefined,
  name: string,
): string {
  if (!args || !(name in args)) {
    throw new Error(`Missing required argument: ${name}`);
  }

  const value = args[name];
  if (typeof value !== "string") {
    throw new Error(`Argument ${name} must be a string, got ${typeof value}`);
  }

  return value;
}

export function getOptionalStringArg(
  args: Record<string, any> | undefined,
  name: string,
  defaultValue?: string,
): string | undefined {
  if (!args || !(name in args)) {
    return defaultValue;
  }

  const value = args[name];
  if (value === null || value === undefined) {
    return defaultValue;
  }

  if (typeof value !== "string") {
    console.warn(
      `[hbuilderx] Argument ${name} should be a string, got ${typeof value}`,
    );
    return String(value);
  }

  return value;
}
```

### 3. 终端命令执行（runTerminalCommand.ts）

```typescript
export const runTerminalCommandImpl: ToolImpl = async (args, extras) => {
  console.log("[hbuilderx] runTerminalCommand: Executing terminal command", {
    command: args.command,
    toolCallId: extras.toolCallId,
  });

  try {
    const command = getStringArg(args, "command");
    const [stdout, stderr] = await extras.ide.subprocess(command);

    console.log(
      "[hbuilderx] runTerminalCommand: Command executed successfully",
      {
        command,
        stdoutLength: stdout.length,
        stderrLength: stderr.length,
      },
    );

    return [
      {
        name: "Terminal Output",
        description: `Output of: ${command}`,
        content: `stdout:\n${stdout}\n\nstderr:\n${stderr}`,
      },
    ];
  } catch (error) {
    console.error("[hbuilderx] runTerminalCommand: Command execution failed", {
      command: args.command,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
};
```

## LLM系统扩展

### uni-app系统消息（uniappDefaultSystemMessage.ts）

为HBuilderX特别定制的uni-app开发系统消息：

```typescript
import { getPlatform } from "../util/platform.js";

export const UNIAPP_OS_ENV_LABEL = getPlatform();

export const UNIAPP_DEFAULT_SYSTEM_MESSAGE = `\
你是一位在HBuilderX（uni-app专属IDE）的AI辅助编程助手，正在Chat模式下运行。
你专精uni-app生态和鸿蒙元服务开发，具备强大的任务规划和分解能力。

## 核心专业领域：
### uni-app跨平台开发
- 熟悉uni-app API (uni.request, uni.navigateTo等)、组件、生命周期
- 熟悉uni-app跨平台适配，对条件编译有深入理解
- Vue.js 3.x + 组合式API
- 熟悉uni-app工程结构和配置文件
- 熟悉rpx单位和响应式设计

### 鸿蒙元服务
- 精通uni-app适配鸿蒙元服务的指南
- 熟悉鸿蒙ASCF元服务开发
- 熟悉元服务的条件编译是MP-HARMONY
- 熟悉元服务在manifest.json的配置

## 代码输出规范
### 文件类型标识符
编写代码块时，始终在信息字符串中包含语言和文件名。
例如：\`\`\`vue src/main.vue

### 代码修改格式
处理代码修改请求时，返回完整代码，不要简写。

## 要求：
- 结构化思考，逻辑清晰，提供完整的解决方案
- 提供的代码要在元服务条件编译场景下可编译和运行
- 使用中文回答，便于理解`;

export const UNIAPP_DEFAULT_AGENT_SYSTEM_MESSAGE = `\
你是一位在HBuilderX（uni-app专属IDE）的AI辅助编程助手，正在Agent模式下运行。
如果必要，尽可能的调用工具来获取更多的上下文。
你当前在${UNIAPP_OS_ENV_LABEL}环境下，优先使用命令行工具。

## ReAct思维框架
在处理复杂任务时，采用ReAct（推理+行动）模式：
- 现有工程评估：识别关键的manifest.json文件
- 条件编译：通过命令行查找代码中ifdef和ifndef的代码
- 制定适配策略：基于以上分析，对哪些文件进行适配

...（其他专业领域和要求同上）`;

export const UNIAPP_DEFAULT_PLAN_SYSTEM_MESSAGE = `\
你是一位在HBuilderX的AI辅助编程助手，正在Plan模式下运行。

## 计划生成
如果开发者要求你指定一个适配计划，你需要分析出详细的步骤和文件列表。
并将计划调用创建文件工具写到根目录的Planning.md文件中。

...（其他内容）`;
```

**应用场景：**

- 聊天模式：提供uni-app开发建议
- Agent模式：自动执行工具调用完成任务
- Plan模式：生成适配计划

### LLM入口适配（llm/index.ts）

```typescript
import {
  UNIAPP_DEFAULT_SYSTEM_MESSAGE,
  UNIAPP_DEFAULT_AGENT_SYSTEM_MESSAGE,
  UNIAPP_DEFAULT_PLAN_SYSTEM_MESSAGE,
} from "./uniappDefaultSystemMessage.js";

export function getSystemMessage(
  ideInfo: IdeInfo,
  mode: "chat" | "agent" | "plan" = "chat",
): string {
  if (ideInfo.ideType === "hbuilderx") {
    switch (mode) {
      case "agent":
        return UNIAPP_DEFAULT_AGENT_SYSTEM_MESSAGE;
      case "plan":
        return UNIAPP_DEFAULT_PLAN_SYSTEM_MESSAGE;
      default:
        return UNIAPP_DEFAULT_SYSTEM_MESSAGE;
    }
  }

  // VSCode和其他IDE使用默认消息
  return DEFAULT_SYSTEM_MESSAGE;
}
```

## 代码索引适配

### 文档服务日志（DocsService.ts）

```typescript
export class DocsService {
  async indexDocs() {
    console.log("[hbuilderx] DocsService: Starting documentation indexing");

    try {
      // ... 索引逻辑

      console.log("[hbuilderx] DocsService: Documentation indexing completed", {
        docsCount: docs.length,
      });
    } catch (error) {
      console.error("[hbuilderx] DocsService: Documentation indexing failed", {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  async searchDocs(query: string, maxResults: number = 10) {
    console.log("[hbuilderx] DocsService: Searching documentation", {
      query,
      maxResults,
    });

    try {
      const results = await this.vectorDb.search(query, maxResults);

      console.log("[hbuilderx] DocsService: Documentation search completed", {
        query,
        resultsCount: results.length,
      });

      return results;
    } catch (error) {
      console.error("[hbuilderx] DocsService: Documentation search failed", {
        query,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }
}
```

## 数据日志适配

### 类型兼容性修复（data/log.ts）

```typescript
// 移除Zod类型依赖以提高兼容性
import { AnyZodObject } from "zod"; // 注释掉

export class DataLogger {
  async logData(
    body: Record<string, any>,
    eventName: string,
    schema: string,
    zodSchema: any, // 从 AnyZodObject 改为 any
  ): Promise<Record<string, any>> {
    const newBody = { ...body };
    const ideSettings = await this.ideSettingsPromise;
    // ... 日志记录逻辑
  }
}
```

**原因：**

- Zod类型在某些环境中可能不兼容
- 使用 `any` 类型提高灵活性
- 不影响核心功能

## 其他适配

### 1. 路径工具（paths.ts）

```typescript
export function getTsConfigPath(): string {
  const ideType = getIdeType();

  if (ideType === "hbuilderx") {
    return path.join(getExtensionPath(), "tsconfig.json");
  }

  return path.join(getExtensionPath(), "tsconfig.json");
}

function getIdeType(): string {
  // 从环境变量或其他方式获取IDE类型
  return process.env.IDE_TYPE || "vscode";
}
```

### 2. 遥测适配（posthog.ts）

```typescript
export class Telemetry {
  static async capture(
    event: string,
    properties: Record<string, any> = {},
    send: boolean = false,
  ) {
    const ideInfo = await getIdeInfo();

    const fullProperties = {
      ...properties,
      ideType: ideInfo.ideType,
      ideVersion: ideInfo.version,
      extensionVersion: ideInfo.extensionVersion,
    };

    if (ideInfo.ideType === "hbuilderx") {
      console.log("[hbuilderx] Telemetry:", event, fullProperties);
    }

    // ... 发送遥测数据
  }
}
```

### 3. Tree-sitter适配（treeSitter.ts）

```typescript
export async function getTreeSitterParser(
  language: string,
  ideType: string,
): Promise<any> {
  console.log("[hbuilderx] Loading tree-sitter parser", { language, ideType });

  try {
    const parser = await loadParser(language);

    console.log("[hbuilderx] Tree-sitter parser loaded", { language });

    return parser;
  } catch (error) {
    console.error("[hbuilderx] Failed to load tree-sitter parser", {
      language,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}
```

## 最佳实践

### 1. 日志规范

所有core模块的HBuilderX相关日志都应该：

```typescript
// 成功操作
console.log("[hbuilderx] 操作描述: 详细说明", {
  关键参数1: value1,
  关键参数2: value2,
});

// 警告
console.warn("[hbuilderx] 警告描述", {
  上下文信息,
});

// 错误
console.error("[hbuilderx] 错误描述", {
  error: error instanceof Error ? error.message : String(error),
  errorStack: error instanceof Error ? error.stack : undefined,
  其他上下文,
});
```

### 2. 条件判断

使用IDE类型进行条件判断：

```typescript
async function doSomething(ideInfo: IdeInfo) {
  if (ideInfo.ideType === "hbuilderx") {
    // HBuilderX特殊处理
    console.log("[hbuilderx] 使用HBuilderX特定实现");
    return hbuilderxSpecificImpl();
  }

  // 默认实现
  return defaultImpl();
}
```

### 3. 错误处理

完善的错误处理和日志：

```typescript
async function riskyOperation() {
  console.log("[hbuilderx] 开始风险操作", { params });

  try {
    const result = await doRiskyThing();

    console.log("[hbuilderx] 风险操作成功", {
      resultSize: result.length,
    });

    return result;
  } catch (error) {
    console.error("[hbuilderx] 风险操作失败", {
      error: error instanceof Error ? error.message : String(error),
      errorStack: error instanceof Error ? error.stack : undefined,
      params,
    });

    // 根据情况决定是重新抛出还是返回默认值
    throw error;
  }
}
```

### 4. 性能优化

- 默认禁用索引功能
- 限制文件读取大小
- 使用缓存减少重复计算
- 延迟加载大型资源

### 5. 向后兼容

确保所有修改不影响VSCode和IntelliJ：

```typescript
// 好的做法
function getConfig(ideType: string) {
  const baseConfig = getBaseConfig();

  if (ideType === "hbuilderx") {
    return { ...baseConfig, disableIndexing: true };
  }

  return baseConfig;
}

// 避免的做法
function getConfig(ideType: string) {
  if (ideType !== "hbuilderx") {
    throw new Error("Only HBuilderX supported");
  }
  return hbuilderxOnlyConfig();
}
```

## 总结

core模块的HBuilderX适配主要包括：

1. **日志增强**：所有关键操作添加 `[hbuilderx]` 前缀日志
2. **平台识别**：新增 `platform.ts` 统一平台识别
3. **配置适配**：默认禁用索引，支持TransformersJS
4. **工具增强**：完善工具实现的日志和错误处理
5. **LLM扩展**：添加uni-app专属系统消息
6. **类型兼容**：修复Zod类型依赖问题
7. **向后兼容**：所有修改不影响其他IDE

这些适配工作确保Continue的core引擎能够在HBuilderX中稳定运行，同时为uni-app和鸿蒙元服务开发提供专业的AI辅助能力。
