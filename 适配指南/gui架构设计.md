# GUI 模块架构设计

## 概述

`gui` 模块是一个基于 React 的单页面应用 (SPA)，它作为内嵌在 IDE (如 VS Code, HBuilderX) 中的 Webview 运行。其主要职责是为用户提供一个图形化界面，用于交互、配置以及展示信息。

## 技术选型

- **UI 框架:** [React](https://react.dev/)
- **状态管理:** [Redux](https://redux.js.org/) with [Redux Toolkit](https://redux-toolkit.js.org/)
- **路由:** [React Router](https://reactrouter.com/) (使用 `MemoryRouter`)
- **样式:** [Tailwind CSS](https://tailwindcss.com/)
- **构建工具:** [Vite](https://vitejs.dev/)
- **语言:** [TypeScript](https://www.typescriptlang.org/)

## 架构图

```mermaid
graph TD
    subgraph GUI (Webview)
        A[React 组件] --> B{Redux Store};
        B --> C[Redux Thunks];
        A --> C;
    end

    subgraph IDE Host (VS Code / HBuilderX)
        D[扩展代码];
        E[IDE API];
        D --> E;
    end

    C -- "消息" --> F(IdeMessenger);
    F -- "消息" --> D;
    D -- "事件" --> F;
    F -- "事件" --> C;

    B -- "状态" --> A;
```

## 核心设计

### 1. 组件化 UI (React)

UI 层由一系列 React 组件构成，遵循组件化的开发模式。主要分为两类：

- **页面组件 (`src/pages`)**: 代表应用中的不同页面，如主聊天界面、历史记录、设置等。由路由进行管理。
- **通用组件 (`src/components`)**: 可复用的 UI 单元，如按钮、输入框、布局等。

`App.tsx` 作为应用的根组件，负责整合路由、上下文提供者 (Context Provider) 以及全局组件。

### 2. 集中式状态管理 (Redux)

应用的状态由 Redux 统一管理，确保了状态的可预测性和易于调试。

- **State Slices (`src/redux/slices`)**: 状态被切分为多个逻辑模块 (slice)，如 `session`, `ui`, `config` 等，每个 slice 负责管理应用状态的一部分。
- **Redux Toolkit**: 使用 Redux Toolkit 简化了 action 和 reducer 的编写，并内置了 Immer.js 来实现不可变更新。
- **状态持久化 (`redux-persist`)**: 为了在应用重载或关闭后恢复状态，项目使用了 `redux-persist`。通过 `createFilter` 精确控制需要持久化的状态，避免了存储不必要或无法序列化的数据。
- **状态迁移**: 为了应对未来状态结构的变化，项目中包含了状态迁移 (`migration`) 的机制，保证了旧版本数据的兼容性。

### 3. 路由 (React Router)

应用使用 `react-router-dom` 进行导航。值得注意的是，它采用了 `createMemoryRouter` 而不是 `createBrowserRouter`。这意味着路由状态完全保存在内存中，不会改变浏览器的 URL。这非常适合内嵌在 Webview 中的应用，因为它们不需要真实的浏览器历史记录。

### 4. IDE 通信 (IdeMessenger)

这是整个架构的关键部分，是连接 GUI (Webview) 和 IDE 宿主 (VS Code / HBuilderX 扩展) 的桥梁。

- **`IdeMessenger` 类**: 封装了与 IDE 通信的底层细节。它通过 IDE 提供的 message passing API 发送和接收消息。
- **Redux Thunks**: 异步操作，如调用 IDE API 获取文件内容、显示通知等，都通过 Redux Thunks 进行。`IdeMessenger` 实例作为 `extraArgument` 注入到 thunks 中，使得在 action creator 中可以方便地调用 `ideMessenger` 的方法与 IDE 通信。
- **事件驱动**: 这种设计是事件驱动的。UI 上的用户操作会 dispatch 一个 thunk，该 thunk 通过 `IdeMessenger` 向 IDE 发送消息。IDE 处理完任务后，再通过 `IdeMessenger` 向 GUI 发送一个事件，GUI 监听到事件后更新 Redux store，最终反映到 UI 上。

## 目录结构

```
gui/
├── src/
│   ├── components/   # 通用 React 组件
│   ├── pages/        # 页面级组件
│   ├── redux/        # Redux store, slices, actions
│   │   ├── slices/   # 状态切片
│   │   └── store.ts  # Redux store 配置
│   ├── hooks/        # 自定义 React hooks
│   ├── context/      # React Context
│   ├── styles/       # 全局样式
│   ├── util/         # 工具函数
│   ├── App.tsx       # 根组件
│   └── main.tsx      # 应用入口
├── public/           # 静态资源
├── package.json      # 项目依赖和脚本
└── vite.config.ts    # Vite 配置文件
```

## 总结

`gui` 模块是一个设计良好、高度模块化的前端应用。它通过 React 和 Redux 构建了一个响应式的用户界面，并利用一个巧妙的 `IdeMessenger` 机制实现了与宿主 IDE 的高效解耦通信。这种架构使得 GUI 的开发和迭代可以独立于特定的 IDE 扩展，同时保证了强大的可扩展性。
