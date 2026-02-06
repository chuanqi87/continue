#!/bin/bash

# GUI构建和复制脚本
# 用于构建gui项目并将dist目录内容复制到extensions/hbuilderx/gui

set -e  # 遇到错误时退出

# 获取脚本所在目录的根目录
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

echo "[hbuilderx] 开始GUI构建和复制流程..."

# 进入gui目录
cd "$PROJECT_ROOT/gui"

echo "[hbuilderx] 当前工作目录: $(pwd)"

# 检查package.json是否存在
if [ ! -f "package.json" ]; then
    echo "[hbuilderx] 错误: 在gui目录中未找到package.json文件"
    exit 1
fi

# 检查是否有build脚本
if ! grep -q '"build"' package.json; then
    echo "[hbuilderx] 错误: package.json中未找到build脚本"
    exit 1
fi

echo "[hbuilderx] 开始执行npm run build..."

# 执行构建
npm run build

# 检查构建是否成功
if [ $? -ne 0 ]; then
    echo "[hbuilderx] 错误: npm run build 执行失败"
    exit 1
fi

echo "[hbuilderx] 构建成功完成"

# 检查dist目录是否存在
if [ ! -d "dist" ]; then
    echo "[hbuilderx] 错误: 构建后未找到dist目录"
    exit 1
fi

# 目标目录
TARGET_DIR="$PROJECT_ROOT/extensions/hbuilderx/gui"

# 确保目标目录存在
if [ ! -d "$TARGET_DIR" ]; then
    echo "[hbuilderx] 创建目标目录: $TARGET_DIR"
    mkdir -p "$TARGET_DIR"
fi

echo "[hbuilderx] 开始复制dist目录内容到 $TARGET_DIR"

# 复制dist目录内容到目标目录
# 使用rsync如果可用，否则使用cp
if command -v rsync &> /dev/null; then
    echo "[hbuilderx] 使用rsync进行复制..."
    rsync -av --delete dist/ "$TARGET_DIR/"
else
    echo "[hbuilderx] 使用cp进行复制..."
    # 先删除目标目录中的现有内容
    rm -rf "$TARGET_DIR"/*
    # 复制新内容
    cp -r dist/* "$TARGET_DIR/"
fi

if [ $? -eq 0 ]; then
    echo "[hbuilderx] 复制完成！"
    echo "[hbuilderx] 目标目录内容:"
    ls -la "$TARGET_DIR"
else
    echo "[hbuilderx] 错误: 复制过程失败"
    exit 1
fi

echo "[hbuilderx] GUI构建和复制流程完成！" 