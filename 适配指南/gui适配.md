# Continue GUI模块HBuilderX适配文档

## 概述

本文档详细介绍Continue的GUI模块（React应用）为适配HBuilderX IDE所做的修改，包括polyfills、消息通信、存储适配、UI组件调整等方面的工作。

## 目录

1. [适配概览](#适配概览)
2. [Polyfills兼容层](#polyfills兼容层)
3. [消息通信适配](#消息通信适配)
4. [本地存储适配](#本地存储适配)
5. [UI组件调整](#ui组件调整)
6. [工具函数适配](#工具函数适配)
7. [构建和部署](#构建和部署)
8. [最佳实践](#最佳实践)

## 适配概览

### 修改文件清单

GUI模块为HBuilderX适配主要修改了以下文件：

```
gui/
├── src/
│   ├── main.tsx                                # 入口文件（引入polyfills）
│   ├── polyfills.ts                           # Polyfills兼容层（新增）
│   ├── context/
│   │   ├── IdeMessenger.tsx                   # IDE消息传递（HBuilderX适配）
│   │   └── LocalStorage.tsx                   # 本地存储（HBuilderX适配）
│   ├── util/
│   │   ├── index.ts                           # 工具函数（isHBuilderX）
│   │   └── localStorage.ts                    # 存储工具
│   ├── hooks/
│   │   ├── useCopy.tsx                        # 复制Hook（HBuilderX适配）
│   │   ├── useLLMLog.ts                       # LLM日志Hook
│   │   ├── useWebviewListener.ts              # WebView监听器
│   │   └── ParallelListeners.tsx              # 并行监听器
│   ├── components/
│   │   ├── OnboardingCard/hooks/
│   │   │   └── useOnboardingCard.ts           # 引导卡片
│   │   ├── StepContainer/
│   │   │   └── ThinkingIndicator.tsx          # 思考指示器
│   │   └── mainInput/
│   │       ├── Lump/
│   │       │   ├── LumpToolbar/
│   │       │   │   └── StreamingToolbar.tsx   # 流式工具栏
│   │       │   └── sections/tool-policies/    # 工具策略（新增）
│   │       ├── TipTapEditor/utils/
│   │       │   └── keyHandlers.ts             # 键盘处理
│   │       └── util/
│   │           └── handleMetaKeyIssues.ts     # Meta键处理
│   ├── pages/config/
│   │   ├── UserSettingsForm.tsx               # 用户设置表单（新增）
│   │   └── features/keyboard/
│   │       └── KeyboardShortcuts.tsx          # 键盘快捷键
│   ├── redux/
│   │   ├── selectors/
│   │   │   └── selectActiveTools.ts           # 工具选择器
│   │   ├── slices/
│   │   │   └── sessionSlice.ts                # 会话切片
│   │   ├── thunks/
│   │   │   ├── callToolById.ts                # 工具调用
│   │   │   ├── streamResponseAfterToolCall.ts # 流式响应
│   │   │   └── streamThunkWrapper.tsx         # 流式包装器
│   │   └── util/
│   │       └── index.ts                       # Redux工具
│   └── index.css                              # 全局样式
└── dist-hbuilderx/                            # HBuilderX构建产物
```

### 适配原则

1. **向后兼容**：确保VSCode和IntelliJ正常运行
2. **Polyfills优先**：在入口处加载兼容层
3. **条件判断**：使用 `isHBuilderX()` 进行IDE识别
4. **日志统一**：关键操作添加日志
5. **渐进增强**：优先使用标准API，不可用时降级

## Polyfills兼容层

### 新增polyfills.ts

HBuilderX的WebView可能使用较旧的JavaScript引擎，需要polyfills：

```typescript
/**
 * Polyfills for HBuilderX compatibility
 * 为 HBuilderX 兼容性提供的 polyfills
 */

// Object.hasOwn polyfill (ES2022 -> ES2015+)
if (!Object.hasOwn) {
  console.log("[hbuilderx] 添加 Object.hasOwn polyfill");
  Object.defineProperty(Object, "hasOwn", {
    value: function (object: any, key: string | number | symbol): boolean {
      return Object.prototype.hasOwnProperty.call(object, key);
    },
    configurable: true,
    enumerable: false,
    writable: true,
  });
}

// Array.prototype.at polyfill (ES2022 -> ES2015+)
if (!Array.prototype.at) {
  console.log("[hbuilderx] 添加 Array.prototype.at polyfill");
  Array.prototype.at = function (index: number) {
    const len = this.length;
    if (index < 0) {
      index = len + index;
    }
    return this[index];
  };
}

// String.prototype.at polyfill (ES2022 -> ES2015+)
if (!String.prototype.at) {
  console.log("[hbuilderx] 添加 String.prototype.at polyfill");
  String.prototype.at = function (index: number) {
    const len = this.length;
    if (index < 0) {
      index = len + index;
    }
    return this[index];
  };
}

// Promise.allSettled polyfill (ES2020 -> ES2015+)
if (!Promise.allSettled) {
  console.log("[hbuilderx] 添加 Promise.allSettled polyfill");
  Promise.allSettled = function (promises: readonly unknown[]) {
    return Promise.all(
      promises.map((promise) =>
        Promise.resolve(promise)
          .then((value) => ({ status: "fulfilled" as const, value }))
          .catch((reason) => ({ status: "rejected" as const, reason })),
      ),
    );
  };
}

// globalThis polyfill
if (typeof globalThis === "undefined") {
  console.log("[hbuilderx] 添加 globalThis polyfill");
  (function () {
    if (typeof self !== "undefined") {
      (self as any).globalThis = self;
    } else if (typeof window !== "undefined") {
      (window as any).globalThis = window;
    } else if (typeof global !== "undefined") {
      (global as any).globalThis = global;
    } else {
      throw new Error("Unable to locate global object");
    }
  })();
}

console.log("[hbuilderx] Polyfills 加载完成");
```

**Polyfills说明：**

| Polyfill              | 原始版本 | 功能                | 重要性 |
| --------------------- | -------- | ------------------- | ------ |
| `Object.hasOwn`       | ES2022   | 检查对象自有属性    | 高     |
| `Array.prototype.at`  | ES2022   | 数组负索引访问      | 中     |
| `String.prototype.at` | ES2022   | 字符串负索引访问    | 中     |
| `Promise.allSettled`  | ES2020   | 等待所有Promise完成 | 高     |
| `globalThis`          | ES2020   | 全局对象引用        | 高     |

### 在main.tsx中引入

```typescript
// 首先加载 polyfills 以确保兼容性
import "./polyfills";

import React from "react";
import ReactDOM from "react-dom/client";
import { Provider } from "react-redux";
// ... 其他导入
```

**关键点：**

- Polyfills必须在最前面引入
- 使用 `console.log` 跟踪加载状态
- 每个polyfill都有条件检查避免覆盖原生实现

## 消息通信适配

### IdeMessenger适配（IdeMessenger.tsx）

IdeMessenger负责GUI与IDE之间的消息传递：

```typescript
import { isHBuilderX, isJetBrains } from "../util";

declare const vscode: any;
declare const hbuilderx: any;

export class IdeMessenger implements IIdeMessenger {
  // 发送消息
  post<T extends keyof FromWebviewProtocol>(
    messageType: T,
    data: FromWebviewProtocol[T][0],
    messageId?: string,
  ): void {
    if (isJetBrains()) {
      // IntelliJ消息发送
      window.postIntellijMessage?.(messageType, data, messageId);
      return;
    } else if (isHBuilderX()) {
      // HBuilderX消息发送机制
      if (hbuilderx.postMessage === undefined) {
        console.log(
          "[hbuilderx] 无法发送消息: hbuilderx.postMessage",
          messageType,
          data,
        );
        throw new Error("hbuilderx.postMessage is undefined");
      }
      const msg: Message = {
        messageId,
        messageType,
        data,
      };
      hbuilderx.postMessage(msg);
      return;
    } else {
      // VSCode消息发送
      console.log(
        "Unable to send message: vscode is undefined",
        messageType,
        data,
      );
      throw new Error("vscode is undefined");
    }

    // 默认使用VSCode API
    vscode.postMessage({ messageId, messageType, data });
  }

  // 请求-响应模式
  request<T extends keyof FromWebviewProtocol>(
    messageType: T,
    data: FromWebviewProtocol[T][0],
  ): Promise<FromWebviewProtocol[T][1]> {
    const messageId = uuidv4();

    return new Promise((resolve) => {
      if (isHBuilderX()) {
        // HBuilderX使用onDidReceiveMessage监听
        const handler = (msg: any) => {
          if (msg.messageId === messageId) {
            resolve(msg.data as WebviewSingleMessage<T>);
          }
        };

        if (typeof hbuilderx !== "undefined" && hbuilderx.onDidReceiveMessage) {
          hbuilderx.onDidReceiveMessage(handler);
        } else {
          console.log("[前端] hbuilderx.onDidReceiveMessage不可用");
        }
      } else {
        // VSCode和IntelliJ使用window.addEventListener
        const handler = (event: any) => {
          if (event.data.messageId === messageId) {
            window.removeEventListener("message", handler);
            resolve(event.data.data as WebviewSingleMessage<T>);
          }
        };
        window.addEventListener("message", handler);
      }

      this.post(messageType, data, messageId);
    });
  }

  // 流式响应
  streamRequest<T extends keyof FromWebviewProtocol>(
    messageType: T,
    data: FromWebviewProtocol[T][0],
    cancelToken?: AbortSignal,
  ): AsyncGenerator<
    NonNullable<
      WebviewProtocolGeneratorMessage<T>["done"] extends true
        ? WebviewProtocolGeneratorMessage<T>["content"]
        : never
    >
  > {
    const messageId = uuidv4();
    const buffer: any[] = [];
    let done = false;
    let returnVal: any = undefined;
    let error: string | undefined = undefined;

    // 设置消息处理器
    if (isHBuilderX()) {
      // HBuilderX使用onDidReceiveMessage监听流式响应
      const handler = (msg: Message<WebviewProtocolGeneratorMessage<T>>) => {
        if (msg.messageId === messageId) {
          const responseData = msg.data;
          if ("error" in responseData) {
            error = responseData.error;
            return;
          }
          if (responseData.done) {
            done = true;
            returnVal = responseData.content;
          } else {
            buffer.push(responseData.content);
          }
        }
      };

      if (typeof hbuilderx !== "undefined" && hbuilderx.onDidReceiveMessage) {
        hbuilderx.onDidReceiveMessage(handler);
      } else {
        console.log("[前端] hbuilderx.onDidReceiveMessage不可用");
      }
    } else {
      // VSCode和IntelliJ使用window.addEventListener
      const handler = (event: {
        data: Message<WebviewProtocolGeneratorMessage<T>>;
      }) => {
        if (event.data.messageId === messageId) {
          const responseData = event.data.data;
          if ("error" in responseData) {
            error = responseData.error;
            return;
          }
          if (responseData.done) {
            window.removeEventListener("message", handler);
            done = true;
            returnVal = responseData.content;
          } else {
            buffer.push(responseData.content);
          }
        }
      };
      window.addEventListener("message", handler);
    }

    const handleAbort = () => {
      this.post("abort", undefined, messageId);
    };

    if (cancelToken) {
      if (cancelToken.aborted) {
        handleAbort();
      } else {
        cancelToken.addEventListener("abort", handleAbort);
      }
    }

    // 发送请求
    this.post(messageType, data, messageId);

    // 返回异步生成器
    const generator = async function* (this: any) {
      while (!done) {
        if (error) {
          throw new Error(error);
        }
        if (buffer.length > 0) {
          yield buffer.shift();
        } else {
          await new Promise((resolve) => setTimeout(resolve, 50));
        }
      }

      // 清空缓冲区
      while (buffer.length > 0) {
        yield buffer.shift();
      }

      return returnVal;
    }.bind(this);

    return generator();
  }
}
```

**关键差异：**

| 功能     | VSCode                    | HBuilderX                       | 原因         |
| -------- | ------------------------- | ------------------------------- | ------------ |
| 发送消息 | `vscode.postMessage`      | `hbuilderx.postMessage`         | API命名不同  |
| 接收消息 | `window.addEventListener` | `hbuilderx.onDidReceiveMessage` | 事件机制不同 |
| 消息格式 | 相同                      | 相同                            | 统一协议     |
| 错误处理 | 自动                      | 需手动检查                      | API差异      |

### IDE识别工具（util/index.ts）

```typescript
export function isHBuilderX(): boolean {
  return typeof (window as any).hbuilderx !== "undefined";
}

export function isJetBrains(): boolean {
  return typeof (window as any).postIntellijMessage !== "undefined";
}

export function isVSCode(): boolean {
  return !isHBuilderX() && !isJetBrains();
}

export function getIdeType(): "vscode" | "hbuilderx" | "intellij" {
  if (isHBuilderX()) {
    return "hbuilderx";
  } else if (isJetBrains()) {
    return "intellij";
  } else {
    return "vscode";
  }
}
```

## 本地存储适配

### LocalStorage适配（LocalStorage.tsx）

```typescript
import { isHBuilderX } from "../util";

export class LocalStorageManager {
  // 获取存储项
  getItem(key: string): string | null {
    try {
      const value = localStorage.getItem(key);
      if (isHBuilderX()) {
        console.log("[hbuilderx] LocalStorage.getItem", {
          key,
          hasValue: !!value,
        });
      }
      return value;
    } catch (error) {
      console.error("[hbuilderx] LocalStorage.getItem failed", { key, error });
      return null;
    }
  }

  // 设置存储项
  setItem(key: string, value: string): void {
    try {
      localStorage.setItem(key, value);
      if (isHBuilderX()) {
        console.log("[hbuilderx] LocalStorage.setItem", {
          key,
          valueLength: value.length,
        });
      }
    } catch (error) {
      console.error("[hbuilderx] LocalStorage.setItem failed", { key, error });
    }
  }

  // 移除存储项
  removeItem(key: string): void {
    try {
      localStorage.removeItem(key);
      if (isHBuilderX()) {
        console.log("[hbuilderx] LocalStorage.removeItem", { key });
      }
    } catch (error) {
      console.error("[hbuilderx] LocalStorage.removeItem failed", {
        key,
        error,
      });
    }
  }

  // 清空存储
  clear(): void {
    try {
      localStorage.clear();
      if (isHBuilderX()) {
        console.log("[hbuilderx] LocalStorage.clear");
      }
    } catch (error) {
      console.error("[hbuilderx] LocalStorage.clear failed", { error });
    }
  }
}

export const localStorageManager = new LocalStorageManager();
```

### 存储工具（localStorage.ts）

```typescript
import { isHBuilderX } from "./index";

// 带前缀的存储键
export function getPrefixedKey(key: string): string {
  const ideType = isHBuilderX() ? "hbuilderx" : "vscode";
  return `continue_${ideType}_${key}`;
}

// 安全的JSON解析
export function safeJsonParse<T>(value: string | null, defaultValue: T): T {
  if (!value) {
    return defaultValue;
  }

  try {
    return JSON.parse(value) as T;
  } catch (error) {
    console.error("[hbuilderx] JSON parse failed", { error });
    return defaultValue;
  }
}

// 安全的JSON序列化
export function safeJsonStringify(value: any): string | null {
  try {
    return JSON.stringify(value);
  } catch (error) {
    console.error("[hbuilderx] JSON stringify failed", { error });
    return null;
  }
}
```

## UI组件调整

### 复制功能适配（useCopy.tsx）

```typescript
import { isHBuilderX } from "../util";

export function useCopy() {
  const copy = useCallback((text: string) => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        // 现代API
        navigator.clipboard.writeText(text);
        if (isHBuilderX()) {
          console.log("[hbuilderx] 使用Clipboard API复制", {
            length: text.length,
          });
        }
      } else {
        // 降级方案
        const textArea = document.createElement("textarea");
        textArea.value = text;
        textArea.style.position = "fixed";
        textArea.style.left = "-999999px";
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand("copy");
        document.body.removeChild(textArea);

        if (isHBuilderX()) {
          console.log("[hbuilderx] 使用execCommand复制", {
            length: text.length,
          });
        }
      }
    } catch (error) {
      console.error("[hbuilderx] 复制失败", { error });
    }
  }, []);

  return { copy };
}
```

### 键盘快捷键处理（keyHandlers.ts）

```typescript
import { isHBuilderX } from "../../../util";

export function handleKeyDown(event: KeyboardEvent) {
  const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0;
  const isHBX = isHBuilderX();

  // Command/Ctrl + Enter: 发送消息
  if ((isMac ? event.metaKey : event.ctrlKey) && event.key === "Enter") {
    if (isHBX) {
      console.log("[hbuilderx] 触发发送消息快捷键");
    }
    event.preventDefault();
    sendMessage();
    return;
  }

  // Escape: 取消
  if (event.key === "Escape") {
    if (isHBX) {
      console.log("[hbuilderx] 触发取消快捷键");
    }
    event.preventDefault();
    cancel();
    return;
  }

  // 其他快捷键...
}
```

### Meta键处理（handleMetaKeyIssues.ts）

```typescript
import { isHBuilderX } from "../../util";

/**
 * 处理HBuilderX中Meta键（Command/Windows键）的兼容性问题
 */
export function handleMetaKeyIssues(event: KeyboardEvent): KeyboardEvent {
  if (!isHBuilderX()) {
    return event;
  }

  // HBuilderX可能不正确处理metaKey
  // 需要根据平台手动修正
  const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0;

  if (isMac && event.keyCode === 91) {
    // Command键
    (event as any).metaKey = true;
  } else if (!isMac && event.keyCode === 91) {
    // Windows键
    (event as any).metaKey = true;
  }

  return event;
}
```

## Redux状态管理适配

### 工具调用（callToolById.ts）

```typescript
import { isHBuilderX } from "../../util";

export const callToolById = createAsyncThunk(
  "session/callToolById",
  async (payload: { toolCallId: string; toolName: string }, { getState }) => {
    if (isHBuilderX()) {
      console.log("[hbuilderx] Redux: 调用工具", payload);
    }

    try {
      const result = await ideMessenger.request("tools/call", payload);

      if (isHBuilderX()) {
        console.log("[hbuilderx] Redux: 工具调用成功", {
          toolCallId: payload.toolCallId,
          hasResult: !!result,
        });
      }

      return result;
    } catch (error) {
      console.error("[hbuilderx] Redux: 工具调用失败", {
        toolCallId: payload.toolCallId,
        error,
      });
      throw error;
    }
  },
);
```

### 流式响应（streamResponseAfterToolCall.ts）

```typescript
import { isHBuilderX } from "../../util";

export const streamResponseAfterToolCall = createAsyncThunk(
  "session/streamResponseAfterToolCall",
  async (payload: StreamPayload, { dispatch, getState }) => {
    if (isHBuilderX()) {
      console.log("[hbuilderx] Redux: 开始流式响应", {
        messageId: payload.messageId,
      });
    }

    try {
      const generator = ideMessenger.streamRequest(
        "llm/streamChat",
        payload,
        payload.cancelToken,
      );

      for await (const chunk of generator) {
        dispatch(addStreamChunk(chunk));

        if (isHBuilderX()) {
          console.log("[hbuilderx] Redux: 收到流式数据块", {
            chunkLength: chunk.length,
          });
        }
      }

      if (isHBuilderX()) {
        console.log("[hbuilderx] Redux: 流式响应完成");
      }
    } catch (error) {
      console.error("[hbuilderx] Redux: 流式响应失败", { error });
      throw error;
    }
  },
);
```

## WebView监听器适配

### useWebviewListener（useWebviewListener.ts）

```typescript
import { isHBuilderX } from "../util";

export function useWebviewListener<T extends keyof ToWebviewProtocol>(
  messageType: T,
  handler: (data: ToWebviewProtocol[T][0]) => void,
) {
  useEffect(() => {
    if (isHBuilderX()) {
      // HBuilderX使用hbuilderx.onDidReceiveMessage
      const listener = (msg: any) => {
        if (msg.messageType === messageType) {
          console.log("[hbuilderx] WebView收到消息", { messageType });
          handler(msg.data);
        }
      };

      if (typeof hbuilderx !== "undefined" && hbuilderx.onDidReceiveMessage) {
        hbuilderx.onDidReceiveMessage(listener);
      }

      return () => {
        // HBuilderX可能不支持移除监听器
        // 需要使用标志位控制
      };
    } else {
      // VSCode使用window.addEventListener
      const listener = (event: MessageEvent) => {
        if (event.data.messageType === messageType) {
          handler(event.data.data);
        }
      };

      window.addEventListener("message", listener);

      return () => {
        window.removeEventListener("message", listener);
      };
    }
  }, [messageType, handler]);
}
```

### 并行监听器（ParallelListeners.tsx）

```typescript
import { isHBuilderX } from "../util";

export function ParallelListeners() {
  useEffect(() => {
    if (isHBuilderX()) {
      console.log("[hbuilderx] 初始化并行监听器");

      // 设置全局消息路由
      if (typeof hbuilderx !== "undefined" && hbuilderx.onDidReceiveMessage) {
        hbuilderx.onDidReceiveMessage((msg: any) => {
          // 路由消息到对应的处理器
          window.dispatchEvent(
            new CustomEvent("hbuilderx-message", {
              detail: msg,
            }),
          );
        });
      }
    }

    return () => {
      if (isHBuilderX()) {
        console.log("[hbuilderx] 清理并行监听器");
      }
    };
  }, []);

  return null;
}
```

## 新增组件

### 工具策略组件（tool-policies/）

```typescript
// ToolPoliciesSection.tsx
export function ToolPoliciesSection() {
  const ideType = getIdeType();

  if (ideType === "hbuilderx") {
    console.log("[hbuilderx] 渲染工具策略面板");
  }

  return (
    <div className="tool-policies-section">
      {/* 工具策略配置UI */}
    </div>
  );
}

// ToolPolicyItem.tsx
export function ToolPolicyItem({ policy }: { policy: ToolPolicy }) {
  const handleToggle = useCallback(() => {
    if (isHBuilderX()) {
      console.log("[hbuilderx] 切换工具策略", { policyId: policy.id });
    }
    // 切换逻辑
  }, [policy]);

  return (
    <div className="tool-policy-item">
      {/* 策略项UI */}
    </div>
  );
}
```

### 用户设置表单（UserSettingsForm.tsx）

```typescript
export function UserSettingsForm() {
  const [settings, setSettings] = useState(getDefaultSettings());

  useEffect(() => {
    if (isHBuilderX()) {
      console.log("[hbuilderx] 加载用户设置");
    }

    // 加载设置
    ideMessenger.request("config/getUserSettings", {}).then((result) => {
      setSettings(result);

      if (isHBuilderX()) {
        console.log("[hbuilderx] 用户设置已加载", { settings: result });
      }
    });
  }, []);

  const handleSave = useCallback(() => {
    if (isHBuilderX()) {
      console.log("[hbuilderx] 保存用户设置", { settings });
    }

    ideMessenger.post("config/saveUserSettings", settings);
  }, [settings]);

  return (
    <form onSubmit={handleSave}>
      {/* 设置表单UI */}
    </form>
  );
}
```

## 构建和部署

### 构建配置（vite.config.ts）

```typescript
export default defineConfig({
  build: {
    // HBuilderX特殊配置
    outDir: process.env.HBUILDERX_BUILD ? "dist-hbuilderx" : "dist",
    target: "es2015", // 降低目标以支持旧版浏览器
    minify: "terser",
    terserOptions: {
      compress: {
        drop_console: false, // 保留console.log用于调试
      },
    },
  },
  define: {
    // 注入IDE类型
    __IDE_TYPE__: JSON.stringify(process.env.IDE_TYPE || "vscode"),
  },
});
```

### 构建脚本（build-gui.sh）

```bash
#!/bin/bash

echo "Building GUI for HBuilderX..."

# 设置环境变量
export HBUILDERX_BUILD=true
export IDE_TYPE=hbuilderx

# 安装依赖
npm install

# 构建
npm run build

# 复制到插件目录
cp -r dist-hbuilderx ../extensions/hbuilderx/gui

echo "GUI build completed!"
```

### package.json脚本

```json
{
  "scripts": {
    "build": "vite build",
    "build:hbuilderx": "HBUILDERX_BUILD=true IDE_TYPE=hbuilderx vite build --outDir dist-hbuilderx",
    "dev": "vite",
    "dev:hbuilderx": "HBUILDERX_BUILD=true IDE_TYPE=hbuilderx vite --port 3000"
  }
}
```

## 最佳实践

### 1. 条件编译

使用IDE类型进行条件判断：

```typescript
if (isHBuilderX()) {
  // HBuilderX特定代码
  console.log("[hbuilderx] HBuilderX特定逻辑");
  executeHBuilderXCode();
} else if (isJetBrains()) {
  // IntelliJ特定代码
  executeIntelliJCode();
} else {
  // VSCode通用代码
  executeVSCodeCode();
}
```

### 2. 降级策略

优先使用现代API，不可用时降级：

```typescript
function copyToClipboard(text: string) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    // 现代API
    return navigator.clipboard.writeText(text);
  } else {
    // 降级方案
    return fallbackCopy(text);
  }
}
```

### 3. 错误处理

完善的错误捕获和日志：

```typescript
try {
  await ideMessenger.request("someAction", data);
  if (isHBuilderX()) {
    console.log("[hbuilderx] 操作成功");
  }
} catch (error) {
  console.error("[hbuilderx] 操作失败", {
    error: error instanceof Error ? error.message : String(error),
  });
  // 显示错误提示给用户
  showErrorToast(error);
}
```

### 4. 性能优化

- 避免不必要的re-render
- 使用useMemo和useCallback
- 延迟加载大型组件
- 虚拟化长列表

### 5. 样式兼容

```css
/* 针对HBuilderX的样式调整 */
.hbuilderx-specific {
  /* HBuilderX可能不支持某些CSS特性 */
  display: flex;
  flex-direction: column;
  /* 避免使用grid等较新的特性 */
}
```

## 调试技巧

### 1. 控制台日志

在HBuilderX开发者工具中查看日志：

```typescript
// 使用统一前缀便于过滤
console.log("[hbuilderx] 操作描述", { 详细信息 });
```

### 2. React DevTools

在HBuilderX WebView中使用React DevTools：

```typescript
// 在开发模式下启用
if (process.env.NODE_ENV === "development" && isHBuilderX()) {
  const script = document.createElement("script");
  script.src = "http://localhost:8097";
  document.head.appendChild(script);
}
```

### 3. 消息追踪

追踪所有IDE消息：

```typescript
if (isHBuilderX() && process.env.NODE_ENV === "development") {
  // 拦截所有消息
  const originalPost = ideMessenger.post.bind(ideMessenger);
  ideMessenger.post = function (...args) {
    console.log("[hbuilderx] 发送消息:", args);
    return originalPost(...args);
  };
}
```

## 总结

GUI模块的HBuilderX适配主要包括：

1. **Polyfills兼容层**：支持ES2015+语法
2. **消息通信适配**：使用hbuilderx API
3. **本地存储适配**：安全的存储操作
4. **UI组件调整**：键盘、复制等功能适配
5. **Redux状态管理**：工具调用和流式响应
6. **新增组件**：工具策略、用户设置
7. **构建部署**：专门的构建配置和脚本
8. **最佳实践**：条件编译、降级策略、错误处理

这些适配工作确保Continue的React GUI在HBuilderX WebView中能够流畅运行，提供与VSCode版本一致的用户体验。
