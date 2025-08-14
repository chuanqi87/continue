# HBuilderX扩展跨平台打包指南

## 概述

本目录包含了用于构建和打包HBuilderX扩展的完整脚本系统，特别针对解决原生依赖（如sqlite3）的跨平台兼容性问题。整个构建系统采用三阶段流程：**依赖准备 → 编排控制 → 实际打包**。

## 脚本架构

### 构建流程图

```
┌─────────────────────────────────────────────────────────────┐
│                    package-all-platforms.js                │
│                     (主控制器/编排脚本)                        │
└─────────────────┬───────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────┐
│  对每个目标平台 (darwin-arm64, win32-x64, 等)               │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐          │
│  │ 1. 依赖准备  │→ │ 2. 依赖验证  │→ │ 3. 实际打包  │          │
│  │(prepackage) │  │(validate)   │  │(package.js) │          │
│  └─────────────┘  └─────────────┘  └─────────────┘          │
└─────────────────────────────────────────────────────────────┘
```

## 主要脚本详解

### 1. `package-all-platforms.js` - 主控制器/编排脚本

**🎯 主要作用**: 高级编排脚本，管理多平台打包的完整流程

**核心功能:**

- 🔄 **工作流程管理**: 为每个目标平台依次执行：依赖准备 → 验证 → 打包 → 清理
- 📊 **报告生成**: 生成详细的打包报告和统计信息
- 🛡️ **错误处理**: 完善的错误处理和日志记录
- 🧹 **自动清理**: 每个平台打包完成后自动清理临时文件
- 🎯 **平台管理**: 支持单平台或全平台打包

**依赖关系:**

- 调用 `npm run prepare-deps` (即 `prepackage-cross-platform.js`)
- 调用 `npm run package` (即 `package.js`)
- 使用内置的 `validateNativeDependencies()` 函数

**支持的平台:**

- `darwin-arm64` (macOS ARM64)
- `darwin-x64` (macOS x64)
- `win32-arm64` (Windows ARM64)
- `win32-x64` (Windows x64)

### 2. `prepackage-cross-platform.js` - 依赖准备脚本

**🏗️ 主要作用**: 为特定目标平台准备所有必需的依赖项和资源

**核心功能:**

- 🧹 **环境清理**: 清理临时目录 (`bin`, `out`)
- 📋 **配置复制**: 复制配置文件到其他扩展
- 📦 **模块安装**: 安装Node.js模块
- 🎨 **GUI构建**: 构建用户界面并复制到扩展目录
- 📁 **资源复制**: 复制支持资源、Tree-sitter文件、模型等
- ⬇️ **原生依赖下载**: 下载平台特定的原生二进制文件
- ✅ **完整性验证**: 验证所有必需文件是否正确安装

**处理的原生依赖:**

- **SQLite3**: 数据库存储和索引
- **ONNX Runtime**: AI模型推理引擎
- **LanceDB**: 向量数据库
- **ESBuild**: JavaScript打包工具
- **Ripgrep**: 文本搜索工具

### 3. `package.js` - 实际打包脚本

**📦 主要作用**: 将准备好的文件打包成最终的zip文件

**核心功能:**

- 🔍 **文件验证**: 确保关键文件存在（如 `out/extension.js`）
- 🛠️ **自动构建**: 如果extension.js不存在，自动运行esbuild
- 📁 **文件选择**: 选择性包含必要的文件和目录
- 🗜️ **压缩打包**: 创建zip或tar.gz格式的扩展包
- 🚫 **排除规则**: 排除不必要的文件（如开发依赖）

**包含的文件/目录:**

- `out/` - 编译后的扩展代码和依赖
- `bin/` - 原生二进制文件
- `gui/` - 用户界面资源
- `media/` - 媒体文件和教程
- `models/` - AI模型文件
- `textmate-syntaxes/` - 语法高亮文件
- `config_schema.json` - 配置模式
- `package.json` - 包信息
- `README.md` - 说明文档

### 4. `validate-native-deps.js` - 原生依赖验证工具

**🔍 主要作用**: 验证原生依赖的完整性和正确性

**核心功能:**

- 📋 **本地验证**: 检查本地构建的原生依赖文件
- 📦 **包验证**: 检查zip文件中的原生模块
- 📊 **报告生成**: 生成详细的依赖检查报告
- 🎯 **平台特定**: 针对不同平台验证相应的依赖文件

### 5. `utils.js` - 工具函数库

**🛠️ 主要作用**: 提供所有脚本共享的工具函数

**核心功能:**

- ⬇️ **下载管理**: 处理原生二进制文件的下载和本地缓存
- 📁 **文件操作**: 复制、移动、验证文件和目录
- 🏗️ **构建工具**: GUI构建、模块安装、资源处理
- 🔧 **平台检测**: 自动检测和处理不同平台的差异
- 🗃️ **缓存管理**: 支持本地缓存以加速构建过程

## 使用方法

### 🚀 快速开始

```bash
# 1. 打包所有支持的平台 (推荐用法)
npm run package-all-platforms

# 2. 打包特定平台
npm run package-win32-x64      # Windows x64
npm run package-win32-arm64    # Windows ARM64
npm run package-darwin-x64     # macOS x64
npm run package-darwin-arm64   # macOS ARM64

# 3. 带验证的打包
npm run package-all-platforms -- --validate-zip

# 4. 清理后重新打包
npm run package-all-platforms -- --clean
```

### 🔧 高级用法

```bash
# 只准备依赖，不打包
npm run prepare-deps -- --target win32-x64

# 验证特定平台的依赖
npm run validate-deps -- --target win32-x64

# 验证zip文件内容
npm run validate-deps -- --zip build/continue-hbuilderx-0.1.0-win32-x64.zip

# 验证所有平台
npm run validate-deps -- --all
```

### 🐛 开发调试用法

```bash
# 快速构建（开发阶段）
npm run build

# 单独运行脚本进行调试
node scripts/prepackage-cross-platform.js --target win32-x64
node scripts/package.js --target win32-x64
node scripts/validate-native-deps.js --target win32-x64

# 查看帮助信息
node scripts/package-all-platforms.js --help
```

## 脚本依赖关系

### 调用链路

```
package-all-platforms.js (主控制器)
├── npm run prepare-deps (prepackage-cross-platform.js)
│   ├── utils.js (各种工具函数)
│   ├── 下载原生依赖
│   ├── 构建GUI
│   └── 复制资源文件
├── validateNativeDependencies() (内置验证)
├── npm run package (package.js)
│   ├── 验证extension.js存在
│   ├── 自动运行esbuild（如需要）
│   └── 创建zip文件
└── validateZipContents() (可选的zip验证)
```

### npm scripts 映射

```json
{
  "prepare-deps": "node scripts/prepackage-cross-platform.js",
  "package": "node scripts/package.js",
  "package-all-platforms": "node scripts/package-all-platforms.js",
  "validate-deps": "node scripts/validate-native-deps.js"
}
```

## 原生依赖说明

扩展包含以下原生依赖，需要为每个目标平台下载对应的二进制文件：

### 1. SQLite3 (`node_sqlite3.node`)

- **用途:** 数据库存储和索引
- **位置:** `out/build/Release/node_sqlite3.node`
- **来源:** https://github.com/TryGhost/node-sqlite3/releases/
- **版本:** v5.1.7

### 2. ONNX Runtime (`onnxruntime_binding.node`)

- **用途:** AI模型推理
- **位置:** `bin/napi-v3/{os}/{arch}/onnxruntime_binding.node`
- **库文件:**
  - macOS: `libonnxruntime.1.14.0.dylib`
  - Linux: `libonnxruntime.so.1.14.0`
  - Windows: `onnxruntime.dll`

### 3. LanceDB (`index.node`)

- **用途:** 向量数据库
- **位置:** `out/node_modules/@lancedb/vectordb-{platform}/index.node`
- **特殊说明:** Windows ARM64使用x64版本

### 4. ESBuild (`esbuild` / `esbuild.exe`)

- **用途:** JavaScript打包工具
- **位置:** `out/node_modules/@esbuild/{platform}/bin/esbuild`

### 5. Ripgrep (`rg` / `rg.exe`)

- **用途:** 文本搜索工具
- **位置:** `out/node_modules/@vscode/ripgrep/bin/rg`

## 平台支持

| 平台    | 架构  | 状态 | 备注               |
| ------- | ----- | ---- | ------------------ |
| Windows | x64   | ✅   | 完全支持           |
| Windows | ARM64 | ⚠️   | LanceDB使用x64版本 |
| macOS   | x64   | ✅   | 完全支持           |
| macOS   | ARM64 | ✅   | 完全支持           |

**注意**: 根据项目内存记录，Linux平台打包已不再需要，因此已从支持列表中移除。

## 常见问题

### Q: Windows上报"找不到sqlite3"错误

**A:** 确保使用正确的目标平台打包：

```bash
npm run package-win32-x64  # 针对Windows x64
```

### Q: 如何验证打包是否正确？

**A:** 使用验证脚本：

```bash
# 验证zip内容
npm run validate-deps -- --zip build/your-package.zip

# 验证本地构建
npm run validate-deps -- --target win32-x64
```

### Q: 本地缓存如何使用？

**A:** 设置环境变量指向本地缓存目录：

```bash
export CONTINUE_SQLITE3_LOCAL_DIR="/path/to/sqlite3/cache"
export CONTINUE_RIPGREP_LOCAL_DIR="/path/to/ripgrep/cache"
```

### Q: 如何清理构建缓存？

**A:** 使用清理选项：

```bash
npm run package-all-platforms -- --clean
```

### Q: 打包失败如何调试？

**A:** 分步骤执行和验证：

```bash
# 1. 单独准备依赖
npm run prepare-deps -- --target win32-x64

# 2. 验证依赖是否正确
npm run validate-deps -- --target win32-x64

# 3. 执行打包
npm run package -- --target win32-x64

# 4. 验证最终包
npm run validate-deps -- --zip build/continue-hbuilderx-*.zip
```

## 开发流程

### 🔄 完整开发周期

1. **开发阶段**:

   ```bash
   npm run build  # 快速构建，用于开发测试
   ```

2. **测试阶段**:

   ```bash
   npm run package-win32-x64  # 打包测试特定平台
   ```

3. **发布阶段**:

   ```bash
   npm run package-all-platforms  # 打包所有平台
   ```

4. **验证阶段**:
   ```bash
   npm run validate-deps -- --all  # 验证所有打包结果
   ```

### 🛠️ 脚本开发和调试

```bash
# 调试单个脚本
node scripts/prepackage-cross-platform.js --target win32-x64
node scripts/package.js --target win32-x64
node scripts/validate-native-deps.js --target win32-x64

# 查看详细日志
DEBUG=* npm run package-all-platforms

# 检查生成的文件
ls -la build/
unzip -l build/continue-hbuilderx-*.zip
```

## 输出文件

打包完成后，在 `build/` 目录下会生成：

### 📦 扩展包文件

- `continue-hbuilderx-{version}-{platform}.zip` - 各平台的扩展包

### 📊 报告文件

- `package-report-{timestamp}.json` - 详细的打包报告
- 每个包内包含 `out/package-info.json` - 包信息文件

### 📋 报告内容示例

```json
{
  "timestamp": "2024-01-01T12:00:00.000Z",
  "duration": "15.3 minutes",
  "summary": {
    "total": 4,
    "successful": 4,
    "failed": 0
  },
  "results": [...],
  "nativeDependencies": ["sqlite3", "onnxruntime", "lancedb", "esbuild", "ripgrep"]
}
```

## 环境变量

| 变量名                       | 用途                   | 默认值                            |
| ---------------------------- | ---------------------- | --------------------------------- |
| `CONTINUE_SQLITE3_LOCAL_DIR` | SQLite3本地缓存目录    | `/Users/legend/Downloads/sqlite3` |
| `CONTINUE_RIPGREP_LOCAL_DIR` | Ripgrep本地缓存目录    | 无                                |
| `GITHUB_ACTIONS`             | GitHub Actions环境标识 | 无                                |

## 故障排除

### 🔧 常见问题及解决方案

1. **下载失败**:

   - 检查网络连接
   - 使用本地缓存目录
   - 检查防火墙设置

2. **文件缺失**:

   - 运行 `npm run validate-deps` 确认具体缺失的文件
   - 重新运行 `npm run prepare-deps`

3. **权限问题**:

   - 确保有写入 `build/`, `out/`, `bin/` 目录的权限
   - 在Windows上可能需要管理员权限

4. **平台不匹配**:

   - 确认目标平台参数正确
   - 检查是否支持当前平台

5. **内存不足**:
   - 关闭其他应用程序
   - 单独打包每个平台而不是全部一起

### 🐛 调试技巧

```bash
# 1. 查看详细错误信息
npm run package-all-platforms 2>&1 | tee build.log

# 2. 检查中间文件
ls -la out/
ls -la bin/

# 3. 验证特定依赖
file out/build/Release/node_sqlite3.node
ldd out/build/Release/node_sqlite3.node  # Linux
otool -L out/build/Release/node_sqlite3.node  # macOS

# 4. 检查zip内容
unzip -l build/continue-hbuilderx-*.zip | grep -E "(sqlite3|onnx|lance|esbuild|rg)"
```

## 最佳实践

### ✅ 推荐做法

1. **使用npm scripts**: 优先使用 `npm run package-all-platforms` 而不是直接调用脚本
2. **验证构建**: 每次打包后运行验证脚本
3. **使用本地缓存**: 设置本地缓存目录以加速重复构建
4. **分步调试**: 遇到问题时分步执行和验证

### ❌ 避免的做法

1. **不要手动修改**: 不要手动修改 `out/` 或 `bin/` 目录
2. **不要跳过验证**: 不要跳过原生依赖验证步骤
3. **不要混用脚本**: 不要同时运行多个打包脚本
4. **不要忽略错误**: 及时处理构建过程中的警告和错误

## 脚本间的数据流

```
用户输入 (target platform)
         ↓
package-all-platforms.js (解析参数，循环处理平台)
         ↓
prepackage-cross-platform.js (准备依赖，下载二进制文件)
         ↓
validateNativeDependencies() (验证依赖完整性)
         ↓
package.js (打包成zip文件)
         ↓
validateZipContents() (可选：验证zip内容)
         ↓
生成报告和统计信息
```

通过这个完整的脚本系统，可以确保HBuilderX扩展在所有支持的平台上都能正确运行，同时提供了完善的验证和错误处理机制。
