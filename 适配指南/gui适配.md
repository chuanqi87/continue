# GUI目录适配HBuilderX详细分析

> 此文档分析了gui目录中需要适配HBuilderX的所有代码修改点，并提供详细的实现方案。

## 概述

通过深度分析gui目录的代码，发现该项目采用了灵活的IDE适配架构，主要通过`isJetBrains()`函数判断当前IDE环境并执行不同的逻辑。为了支持HBuilderX，需要在现有的双IDE架构基础上扩展为三IDE架构。

## 核心修改清单

### 1. IDE识别系统修改

#### 1.1 类型定义更新

**文件**: `gui/src/util/localStorage.ts`
**修改内容**:

```typescript
// 原代码
ide: "vscode" | "jetbrains";

// 修改后
ide: "vscode" | "jetbrains" | "hbuilderx";
```

#### 1.2 IDE判断函数扩展

**文件**: `gui/src/util/index.ts`
**修改内容**:

```typescript
// 新增HBuilderX判断函数
export function isHBuilderX() {
  return getLocalStorage("ide") === "hbuilderx";
}

// 修改字体大小逻辑，为HBuilderX适配
export function getFontSize(): number {
  const ide = getLocalStorage("ide");
  if (ide === "hbuilderx") {
    return getLocalStorage("fontSize") ?? 16; // HBuilderX默认字体稍大
  }
  return getLocalStorage("fontSize") ?? (isJetBrains() ? 15 : 14);
}
```

### 2. 主题系统适配

#### 2.1 主题变量映射

**文件**: `gui/src/styles/theme.ts`
**修改内容**:

```typescript
// 在THEME_COLORS中为每个颜色添加HBuilderX变量映射
export const THEME_COLORS = {
  background: {
    vars: [
      "--vscode-sideBar-background",
      "--vscode-editor-background",
      "--vscode-panel-background",
      "--hx-sideBar-background", // 新增
      "--hx-editor-background", // 新增
      "--hx-panel-background", // 新增
    ],
    default: "#1e1e1e",
  },
  // ... 为每个颜色定义添加对应的hx变量
};
```

#### 2.2 主题处理逻辑

**文件**: `gui/src/hooks/ParallelListeners.tsx`
**修改内容**:

```typescript
// 在useEffect中添加HBuilderX主题处理
useEffect(() => {
  // ... 现有代码 ...

  if (jetbrains) {
    // ... JetBrains逻辑 ...
  } else if (isHBuilderX()) {
    // HBuilderX主题处理
    void ideMessenger
      .request("hbuilderx/getColors", undefined)
      .then((result) => {
        if (result.status === "success") {
          setDocumentStylesFromTheme(result.content);
        }
      });

    // 通知HBuilderX webview已准备就绪
    void ideMessenger.request("hbuilderx/onLoad", undefined).then((result) => {
      if (result.status === "error") {
        return;
      }
      // 设置HBuilderX特定的窗口属性
      const msg = result.content;
      (window as any).windowId = msg.windowId;
      (window as any).serverUrl = msg.serverUrl;
      (window as any).workspacePaths = msg.workspacePaths;
    });
  }
}, []);

// 添加HBuilderX颜色变更监听
useWebviewListener(
  "hbuilderx/setColors",
  async (data) => {
    setDocumentStylesFromTheme(data);
  },
  [],
);
```

### 3. 快捷键系统适配

#### 3.1 快捷键配置

**文件**: `gui/src/pages/config/KeyboardShortcuts.tsx`
**修改内容**:

```typescript
// 新增HBuilderX快捷键配置
const hbuilderxShortcuts: Omit<KeyboardShortcutProps, "isEven">[] = [
  {
    shortcut: "ctrl '",
    description: "切换选中模型",
  },
  {
    shortcut: "ctrl I",
    description: "编辑高亮代码",
  },
  {
    shortcut: "ctrl shift I",
    description: "切换行内编辑焦点",
  },
  {
    shortcut: "ctrl backspace",
    description: "取消响应",
  },
  {
    shortcut: "ctrl shift backspace",
    description: "拒绝差异",
  },
  {
    shortcut: "ctrl shift enter",
    description: "接受差异",
  },
  // ... 更多HBuilderX特定快捷键
];

// 修改快捷键选择逻辑
function KeyboardShortcuts() {
  const shortcuts = useMemo(() => {
    if (isJetBrains()) return jetbrainsShortcuts;
    if (isHBuilderX()) return hbuilderxShortcuts;
    return vscodeShortcuts;
  }, []);
  // ... 其余代码
}
```

### 4. 编辑器功能适配

#### 4.1 按键处理

**文件**: `gui/src/components/mainInput/TipTapEditor/utils/keyHandlers.ts`
**修改内容**:

```typescript
// 扩展按键处理逻辑
export const handleEnterPress = (
  e: KeyboardEvent,
  editor: Editor,
  onEnter: Function,
) => {
  if (isJetBrains()) {
    handleJetBrainsOSRMetaKeyIssues(e, editor);
  } else if (isHBuilderX()) {
    handleHBuilderXKeyIssues(e, editor); // 新增函数
  } else if (!isJetBrains()) {
    // VSCode逻辑
  }
};

// 新增HBuilderX按键处理函数
export const handleHBuilderXKeyIssues = (e: KeyboardEvent, editor: Editor) => {
  // HBuilderX特定的按键处理逻辑
  // 比如特殊的快捷键组合、中文输入法支持等
};
```

#### 4.2 编辑器配置

**文件**: `gui/src/components/mainInput/TipTapEditor/utils/editorConfig.ts`
**修改内容**:

```typescript
// 在编辑器配置中添加HBuilderX支持
Escape: () => {
  if (inDropdownRef.current) {
    return false;
  }

  if (isJetBrains()) {
    ideMessenger.post("closeSidebar", undefined);
    return true;
  } else if (isHBuilderX()) {
    // HBuilderX特定的侧边栏关闭逻辑
    ideMessenger.post("hbuilderx/closeSidebar", undefined);
    return true;
  }

  // ... 其余逻辑
};
```

### 5. UI组件适配

#### 5.1 模型选择器

**文件**: `gui/src/components/mainInput/Lump/sections/ModelsSection.tsx`
**修改内容**:

```typescript
// 扩展模型选择器显示逻辑
const showModelSelector = useMemo(() => {
  if (isJetBrains()) return false;  // JetBrains有内联选择器
  if (isHBuilderX()) return true;   // HBuilderX显示完整选择器
  return true; // VSCode默认
}, []);

return (
  <div>
    {/* HBuilderX和VSCode显示模型选择器 */}
    {showModelSelector && (
      <ModelSelect />
    )}
  </div>
);
```

#### 5.2 工具栏按钮

**文件**: `gui/src/components/mainInput/Lump/LumpToolbar/*.tsx`
**修改内容**:

```typescript
// 在所有工具栏组件中适配HBuilderX快捷键显示
const getKeyLabel = () => {
  if (isJetBrains()) return getAltKeyLabel();
  if (isHBuilderX()) return "Ctrl"; // HBuilderX主要使用Ctrl
  return getMetaKeyLabel();
};

// 在取消按钮中
{getKeyLabel()} ⌫ 取消
```

### 6. 功能模块适配

#### 6.1 剪贴板操作

**文件**: `gui/src/hooks/useCopy.tsx`
**修改内容**:

```typescript
const copyText = useCallback(() => {
  const textVal = typeof text === "string" ? text : text();

  if (isJetBrains()) {
    ideMessenger.post("copyText", { text: textVal });
  } else if (isHBuilderX()) {
    // HBuilderX剪贴板API
    ideMessenger.post("hbuilderx/copyText", { text: textVal });
  } else {
    navigator.clipboard.writeText(textVal);
  }

  setCopied(true);
  setTimeout(() => setCopied(false), 2000);
}, [text, ideMessenger]);
```

#### 6.2 终端执行

**文件**: `gui/src/components/StyledMarkdownPreview/StepContainerPreToolbar/RunInTerminalButton.tsx`
**修改内容**:

```typescript
if (isJetBrains()) {
  // JetBrains插件目前没有在终端运行命令的方式
  return;
} else if (isHBuilderX()) {
  // HBuilderX终端执行（如果支持）
  ideMessenger.post("hbuilderx/runInTerminal", { command });
  return;
}
```

#### 6.3 文件操作

**文件**: `gui/src/components/mainInput/belowMainInput/ContextItemsPeek.tsx`
**修改内容**:

```typescript
function openContextItem() {
  const { uri, name, content } = contextItem;

  if (isUrl) {
    if (uri?.value) {
      if (isHBuilderX()) {
        ideMessenger.post("hbuilderx/openUrl", uri.value);
      } else {
        ideMessenger.post("openUrl", uri.value);
      }
    }
  } else if (uri) {
    const isRangeInFile = name.includes(" (") && name.endsWith(")");

    if (isRangeInFile) {
      const rif = ctxItemToRifWithContents(contextItem, true);
      if (isHBuilderX()) {
        // HBuilderX显示代码行
        ideMessenger.post("hbuilderx/showLines", {
          filepath: rif.filepath,
          startLine: rif.range.start.line,
          endLine: rif.range.end.line,
        });
      } else {
        ideMessenger.ide.showLines(
          rif.filepath,
          rif.range.start.line,
          rif.range.end.line,
        );
      }
    }
  }
}
```

### 7. 网络消息处理

#### 7.1 IDE消息发送

**文件**: `gui/src/context/IdeMessenger.tsx`
**修改内容**:

```typescript
private _postToIde(
  messageType: string,
  data: any,
  messageId: string = uuidv4(),
) {
  if (typeof vscode === "undefined") {
    if (isJetBrains()) {
      if (window.postIntellijMessage === undefined) {
        console.log("[hbuilderx] 无法发送消息: postIntellijMessage未定义");
        throw new Error("postIntellijMessage is undefined");
      }
      window.postIntellijMessage?.(messageType, data, messageId);
      return;
    } else if (isHBuilderX()) {
      // HBuilderX消息发送机制
      if (window.postHBuilderXMessage === undefined) {
        console.log("[hbuilderx] 无法发送消息: postHBuilderXMessage未定义");
        throw new Error("postHBuilderXMessage is undefined");
      }
      window.postHBuilderXMessage?.(messageType, data, messageId);
      return;
    } else {
      console.log("[hbuilderx] 无法发送消息: vscode未定义", messageType, data);
      return;
    }
  }

  const msg: Message = {
    messageId,
    messageType,
    data,
  };

  vscode.postMessage(msg);
}
```

### 8. 配置和初始化

#### 8.1 本地存储初始化

**文件**: `gui/src/context/LocalStorage.tsx`
**修改内容**:

```typescript
useEffect(() => {
  const ide = getLocalStorage("ide");
  let fontSize: number;

  switch (ide) {
    case "jetbrains":
      fontSize = getLocalStorage("fontSize") ?? 15;
      break;
    case "hbuilderx":
      fontSize = getLocalStorage("fontSize") ?? 16; // HBuilderX默认更大字体
      break;
    default: // vscode
      fontSize = getLocalStorage("fontSize") ?? 14;
      break;
  }

  setValues({ fontSize });
}, []);
```

#### 8.2 调试页面

**新建文件**: `gui/public/hbuilderx_index.html`

```html
<!--用于HBuilderX热重载调试-->
<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/icon.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Continue - HBuilderX</title>
    <script type="module" crossorigin src="/src/main.tsx"></script>
    <link rel="stylesheet" crossorigin href="/src/index.css" />
  </head>
  <body>
    <div id="root"></div>
    <script>
      // 设置HBuilderX环境
      localStorage.setItem("ide", '"hbuilderx"');

      // HBuilderX特定的全局变量和方法
      window.postHBuilderXMessage = (messageType, data, messageId) => {
        console.log("[hbuilderx] 发送消息:", messageType, data, messageId);
        // 这里应该调用HBuilderX的实际API
      };
    </script>
  </body>
</html>
```

### 9. WebView事件监听

#### 9.1 HBuilderX特定事件

**文件**: `gui/src/hooks/ParallelListeners.tsx`
**修改内容**:

```typescript
// 添加HBuilderX特定的WebView监听器
useWebviewListener(
  "hbuilderx/editorInsetRefresh",
  async () => {
    // HBuilderX编辑器插入刷新
    console.log("[hbuilderx] 编辑器插入刷新");
  },
  [],
);

useWebviewListener(
  "hbuilderx/workspaceChanged",
  async (workspacePath) => {
    // 工作区变更处理
    console.log("[hbuilderx] 工作区变更:", workspacePath);
  },
  [],
);
```

#### 9.2 主编辑器监听

**文件**: `gui/src/components/mainInput/TipTapEditor/useMainEditorWebviewListeners.ts`
**修改内容**:

```typescript
// 添加HBuilderX编辑器监听
useWebviewListener("hbuilderx/editorInsetRefresh", async () => {
  console.log("[hbuilderx] 编辑器插入刷新");
  // HBuilderX特定的刷新逻辑
});
```

### 10. OSR和辅助功能

#### 10.1 OSR支持检测

**文件**: `gui/src/hooks/useIsOSREnabled.ts`
**修改内容**:

```typescript
export default function useIsOSREnabled() {
  const [isOSREnabled, setIsOSREnabled] = useState(false);
  const ideMessenger = useContext(IdeMessengerContext);

  useEffect(() => {
    if (isJetBrains()) {
      // JetBrains OSR检测
      (async () => {
        await ideMessenger
          .request("jetbrains/isOSREnabled", undefined)
          .then((result) => {
            if (result.status === "success") {
              setIsOSREnabled(result.content);
            }
          });
      })();
    } else if (isHBuilderX()) {
      // HBuilderX暂不支持OSR
      setIsOSREnabled(false);
    }
  }, [ideMessenger]);

  return isOSREnabled;
}
```

## 需要新增的类型定义

### Window对象扩展

```typescript
// 在全局类型文件中添加
declare global {
  interface Window {
    postHBuilderXMessage?: (
      messageType: string,
      data: any,
      messageId: string,
    ) => void;
  }
}
```

## CSS样式适配

### 1. HBuilderX特定样式变量

```css
/* 在gui/src/index.css中添加HBuilderX样式 */
.hbuilderx-theme {
  --hx-editor-background: #1e1e1e;
  --hx-editor-foreground: #d4d4d4;
  --hx-panel-background: #252526;
  --hx-panel-border: #2d2d30;
  /* ... 更多HBuilderX主题变量 */
}
```

### 2. 字体适配

```css
/* HBuilderX字体配置 */
.hbuilderx-editor {
  font-family: "Microsoft YaHei", "PingFang SC", "Helvetica Neue", Arial,
    sans-serif;
  font-size: 16px;
  line-height: 1.6;
}
```

## 协议消息扩展

### 1. HBuilderX特定消息类型

需要在核心协议中定义HBuilderX专用的消息类型：

```typescript
// 核心协议扩展
interface HBuilderXProtocol {
  "hbuilderx/getColors": [undefined, Record<string, string>];
  "hbuilderx/setColors": [Record<string, string>, undefined];
  "hbuilderx/onLoad": [
    undefined,
    { windowId: string; serverUrl: string; workspacePaths: string[] },
  ];
  "hbuilderx/closeSidebar": [undefined, undefined];
  "hbuilderx/copyText": [{ text: string }, undefined];
  "hbuilderx/openUrl": [string, undefined];
  "hbuilderx/showLines": [
    { filepath: string; startLine: number; endLine: number },
    undefined,
  ];
  "hbuilderx/runInTerminal": [{ command: string }, undefined];
  "hbuilderx/workspaceChanged": [string, undefined];
  "hbuilderx/editorInsetRefresh": [undefined, undefined];
}
```

## 测试和验证

### 1. 功能测试清单

- [ ] IDE识别正确
- [ ] 主题变量加载
- [ ] 快捷键响应
- [ ] 剪贴板操作
- [ ] 文件打开/显示
- [ ] 消息通信
- [ ] 字体大小适配
- [ ] UI组件显示

### 2. 兼容性测试

- [ ] 不影响VSCode功能
- [ ] 不影响JetBrains功能
- [ ] 三种IDE可以正常切换

## 实施优先级

### 高优先级 (P0)

1. IDE识别系统 (`util/index.ts`, `util/localStorage.ts`)
2. 消息通信机制 (`context/IdeMessenger.tsx`)
3. 基础UI显示 (主题、字体)

### 中优先级 (P1)

1. 快捷键系统
2. 编辑器功能
3. 文件操作

### 低优先级 (P2)

1. 终端集成
2. OSR功能
3. 高级UI特性

## 风险评估

**技术风险**: 🟡 中等

- HBuilderX API兼容性未知
- 消息通信机制需要验证
- 主题系统适配复杂度较高

**实施建议**:

1. 分阶段实施，先完成P0功能
2. 建立HBuilderX测试环境
3. 与HBuilderX团队确认API支持情况

---

_文档版本: v1.0_  
_创建时间: $(date)_  
_基于分析: gui目录完整代码扫描_  
_适配目标: HBuilderX IDE完整支持_
