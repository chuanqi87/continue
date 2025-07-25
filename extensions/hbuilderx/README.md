# Continue HBuilderX Extension

Continue AI助手的HBuilderX扩展版本 - 基于VSCode版本的最小化移植实现。

![Version](https://img.shields.io/badge/version-0.2.0-blue)
![HBuilderX](https://img.shields.io/badge/HBuilderX-2.8.1+-green)
![License](https://img.shields.io/badge/license-MIT-yellow)

## ✨ 功能特性

### 🎨 现代化GUI界面
- **完整聊天界面**：模仿Continue官方设计的现代化UI
- **主题自适应**：自动适配HBuilderX的Monokai、Atom One Dark等主题
- **响应式布局**：支持不同窗口大小，移动端友好
- **代码块支持**：语法高亮、复制按钮、多语言识别

### 🤖 多AI模型支持
- **GPT-4**：OpenAI最强模型，适合复杂代码分析
- **Claude 3**：Anthropic安全导向的AI助手
- **Llama 2**：Meta开源模型，支持本地部署
- **Code Llama**：专门针对代码优化的模型

### 💬 智能对话系统
- **上下文感知**：记住最近5轮对话内容
- **智能回复**：根据问题类型生成不同风格的回复
- **实时响应**：模拟真实AI的响应时间和状态
- **错误处理**：优雅的错误提示和降级处理

### 🔧 开发者友好
- **快捷键启动**：`Ctrl+Shift+H` / `Cmd+Shift+H`
- **预设问题**：常见编程任务的快速启动
- **历史记录**：对话历史管理（开发中）
- **模型切换**：一键切换不同AI模型

## 🚀 快速开始

### 安装要求
- HBuilderX 2.8.1 或更高版本
- Node.js 16+ （开发环境）

### 安装步骤

1. **克隆项目**
```bash
git clone <repository-url>
cd continue/extensions/hbuilderx
```

2. **安装依赖**
```bash
npm install
```

3. **编译扩展**
```bash
npm run build
```

4. **在HBuilderX中安装**
   - 打开HBuilderX
   - 菜单：工具 > 插件安装 > 导入插件
   - 选择 `extensions/hbuilderx` 目录

### 使用方法

1. **启动聊天面板**
   - 快捷键：`Ctrl+Shift+H` (Windows/Linux) 或 `Cmd+Shift+H` (macOS)
   - 或右键菜单："Continue AI助手"

2. **选择AI模型**
   - 在顶部下拉菜单中选择想要使用的AI模型

3. **开始对话**
   - 点击预设问题快速开始
   - 或在输入框中输入自定义问题

## 🏗️ 架构设计

### 文件结构
```
src/
├── gui/
│   └── ContinueGUI.ts          # 完整HTML界面生成器
├── ai/
│   └── AIServiceMock.ts        # AI服务Mock实现
├── WebViewProvider.ts          # HBuilderX WebView提供者
├── ChatPanel.ts                # 聊天面板管理器
└── extension.ts                # 扩展主入口
```

### 技术栈
- **TypeScript** - 类型安全的开发体验
- **原生HTML/CSS/JS** - 无框架依赖，最小化实现
- **HBuilderX WebView API** - 平台原生的WebView集成
- **Mock AI服务** - 模拟真实AI响应，便于开发测试

### 消息协议
```typescript
// 扩展 → WebView
interface ToWebviewMessage {
  command: 'receiveMessage' | 'error' | 'modelChanged';
  message?: string;
  model?: string;
  usage?: TokenUsage;
}

// WebView → 扩展
interface FromWebviewMessage {
  command: 'sendMessage' | 'changeModel';
  message?: string;
  model?: string;
}
```

## 🎨 界面预览

### 主界面布局
```
┌─────────────────────────────────────┐
│ 🤖 Continue    [配置] [历史]          │
├─────────────────────────────────────┤
│ [GPT-4 (OpenAI)          ▼]         │
├─────────────────────────────────────┤
│ ┌─────────┬─────────────────────────┐ │
│ │ 对话历史  │ 欢迎使用 Continue AI     │ │
│ │         │                         │ │
│ │ 当前对话  │ [📖 解释代码] [✨ 生成代码] │ │
│ │         │ [🔧 修复错误] [⚡ 性能优化] │ │
│ │         │                         │ │
│ │         │ ┌─────────────────────┐ │ │
│ │         │ │ 输入您的问题... [🚀] │ │ │
│ │         │ └─────────────────────┘ │ │
│ └─────────┴─────────────────────────┘ │
└─────────────────────────────────────┘
```

### 对话界面
- **用户消息**：右对齐，蓝色背景
- **AI回复**：左对齐，透明背景带边框
- **代码块**：深色背景，语法高亮，复制按钮
- **加载状态**：优雅的动画效果

## 🔮 发展路线图

### v0.2.0 ✅ 当前版本
- [x] 完整GUI界面移植
- [x] 多AI模型Mock支持
- [x] 主题自适应
- [x] 基础聊天功能

### v0.3.0 🚧 下个版本
- [ ] 真实AI服务集成（OpenAI API）
- [ ] 对话历史持久化
- [ ] 代码上下文识别
- [ ] 文件导入分析

### v1.0.0 🔮 长期目标
- [ ] 完整Continue Core集成
- [ ] 高级配置界面
- [ ] 多工作区支持
- [ ] 插件市场发布

## 🛠️ 开发指南

### 本地开发

1. **监听模式编译**
```bash
npm run watch
```

2. **重新加载扩展**
   - 在HBuilderX中：工具 > 插件安装 > 重新加载

### 添加新AI模型

1. **在AIServiceMock中添加模型定义**
```typescript
{
  id: 'new-model',
  name: 'New Model',
  provider: 'Provider Name',
  description: '模型描述'
}
```

2. **实现模型特定的回复逻辑**
```typescript
private static generateNewModelResponse(message: string): string {
  // 自定义回复逻辑
}
```

### 真实AI服务集成

参考`src/ai/AIServiceMock.ts`的接口设计：
```typescript
interface AIService {
  chat(request: ChatRequest): Promise<ChatResponse>;
  getModels(): AIModel[];
  setCurrentModel(modelId: string): boolean;
}
```

## 📝 更新日志

### v0.2.0 (2024-12-XX)
- ✨ 完整Continue GUI界面移植
- 🤖 多AI模型Mock支持
- 🎨 现代化聊天界面设计
- 🔧 代码块展示和复制功能
- 📱 响应式布局适配

### v0.1.4 (2024-12-XX)
- 🐛 修复macOS字体兼容性问题
- 🔧 优化WebView直接打开方式

### v0.1.3 (2024-12-XX)
- ⚡ openChatPanel命令直接创建WebView
- 🎯 简化用户操作流程

### v0.1.2 (2024-12-XX)
- 🔄 按HBuilderX规范重新实现WebView
- 📝 完善使用文档

### v0.1.1 (2024-12-XX)
- 🎨 实现基础WebView聊天界面
- 💬 双向消息通信机制

### v0.1.0 (2024-12-XX)
- 🎉 项目初始化
- 📋 基础扩展框架

## 📄 许可证

本项目采用 MIT 许可证。详见 [LICENSE](LICENSE) 文件。

## 🤝 贡献指南

欢迎贡献代码！请查看 [CONTINUE_GUI_INTEGRATION.md](CONTINUE_GUI_INTEGRATION.md) 了解技术细节。

### 贡献流程
1. Fork 项目
2. 创建功能分支 (`git checkout -b feature/amazing-feature`)
3. 提交更改 (`git commit -m 'Add amazing feature'`)
4. 推送到分支 (`git push origin feature/amazing-feature`)
5. 创建 Pull Request

## 📞 支持与反馈

- **问题反馈**：GitHub Issues
- **功能建议**：GitHub Discussions
- **技术交流**：参考技术文档

---

**Continue HBuilderX Extension** - 让AI编程助手在HBuilderX中重生 🚀 