#!/bin/bash

# 简单的HBuilderX插件打包脚本
# 压缩指定的文件和目录到zip文件
# 
# 用法:
#   bash package-zip.sh          # 打包所有平台（默认）
#   bash package-zip.sh darwin   # 仅打包 macOS 版本
#   bash package-zip.sh win32    # 仅打包 Windows 版本

set -e

# 获取脚本所在目录的父目录（即hbuilderx扩展根目录）
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
EXTENSION_DIR="$(dirname "$SCRIPT_DIR")"

# 进入扩展目录
cd "$EXTENSION_DIR"

# 清理函数：恢复package.json
cleanup() {
    if [ -n "$PACKAGE_JSON_BACKUP" ] && [ -f "$PACKAGE_JSON_BACKUP" ]; then
        echo "[hbuilderx] 恢复原始 package.json"
        mv "$PACKAGE_JSON_BACKUP" package.json
    fi
}

# 设置trap，确保脚本退出时执行清理
trap cleanup EXIT

# 读取package.json中的版本号
VERSION=$(node -p "require('./package.json').version")

# 生成时间戳 (格式: YYYYMMDD-HHMMSS)
TIMESTAMP=$(date +"%Y%m%d-%H%M%S")

# 获取平台参数（可选）
PLATFORM="${1:-all}"

# 包名包含版本号、平台和时间戳
if [ "$PLATFORM" = "darwin" ]; then
    PACKAGE_NAME="continue-hbuilderx-darwin-${VERSION}-${TIMESTAMP}"
    echo "[hbuilderx] 打包 macOS 版本"
elif [ "$PLATFORM" = "win32" ]; then
    PACKAGE_NAME="continue-hbuilderx-win32-${VERSION}-${TIMESTAMP}"
    echo "[hbuilderx] 打包 Windows 版本"
else
    PACKAGE_NAME="continue-hbuilderx-${VERSION}-${TIMESTAMP}"
    echo "[hbuilderx] 打包所有平台版本"
fi

# 构建目录
BUILD_DIR="build"
mkdir -p "$BUILD_DIR"

# 输出zip文件路径
OUTPUT_ZIP="${BUILD_DIR}/${PACKAGE_NAME}.zip"

# 如果输出文件已存在，先删除
if [ -f "$OUTPUT_ZIP" ]; then
    echo "[hbuilderx] 删除已存在的压缩包: $OUTPUT_ZIP"
    rm "$OUTPUT_ZIP"
fi

echo "[hbuilderx] 开始打包 Continue HBuilderX 插件..."
echo "[hbuilderx] 版本: $VERSION"

# 要打包的文件和目录列表
FILES_TO_PACKAGE=(
    "README.md"
    "package.json"
    "out"
    "media"
    "models"
    "textmate-syntaxes"
    "tree-sitter"
)

# 检查所有文件/目录是否存在
echo "[hbuilderx] 检查文件和目录..."
MISSING_FILES=()

# 如果是Windows平台，需要临时替换package.json
PACKAGE_JSON_BACKUP=""
if [ "$PLATFORM" = "win32" ]; then
    if [ -f "package.json.win" ]; then
        echo "[hbuilderx] Windows平台打包，使用 package.json.win"
        PACKAGE_JSON_BACKUP="package.json.backup.tmp"
        cp package.json "$PACKAGE_JSON_BACKUP"
        cp package.json.win package.json
        echo "[hbuilderx] ✓ 已切换到 package.json.win"
    else
        echo "[hbuilderx] ⚠️  警告: package.json.win 不存在，将使用默认的 package.json"
    fi
fi

for item in "${FILES_TO_PACKAGE[@]}"; do
    if [ ! -e "$item" ]; then
        MISSING_FILES+=("$item")
        echo "[hbuilderx] ⚠️  警告: $item 不存在"
    else
        echo "[hbuilderx] ✓ $item"
    fi
done

# 如果有缺失的文件，询问是否继续
if [ ${#MISSING_FILES[@]} -gt 0 ]; then
    echo ""
    echo "[hbuilderx] 警告: ${#MISSING_FILES[@]} 个文件/目录不存在"
    echo "[hbuilderx] 缺失的项目: ${MISSING_FILES[*]}"
    read -p "是否继续打包? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "[hbuilderx] 打包已取消"
        exit 1
    fi
fi

# 创建zip压缩包
echo ""
echo "[hbuilderx] 正在创建压缩包..."
zip -r "$OUTPUT_ZIP" "${FILES_TO_PACKAGE[@]}" \
    -x "*.DS_Store" \
    -x "*/.DS_Store" \
    -x "**/.DS_Store" \
    -x "*.map" \
    -x "**/*.map" \
    -x "out/sqlite3-binaries/*" \
    -x "out/sqlite3-binaries/**/*" \
    -q

# 获取压缩包大小
if [ -f "$OUTPUT_ZIP" ]; then
    FILE_SIZE=$(ls -lh "$OUTPUT_ZIP" | awk '{print $5}')
    echo ""
    echo "[hbuilderx] ✓ 打包完成！"
    echo "[hbuilderx] 输出文件: $OUTPUT_ZIP"
    echo "[hbuilderx] 文件大小: $FILE_SIZE"
    echo ""
    
    # 显示压缩包内容概览
    echo "[hbuilderx] 压缩包内容概览:"
    unzip -l "$OUTPUT_ZIP" | head -n 20
    echo ""
    echo "[hbuilderx] 使用 'unzip -l $OUTPUT_ZIP' 查看完整内容"
else
    echo "[hbuilderx] ✗ 打包失败"
    exit 1
fi

