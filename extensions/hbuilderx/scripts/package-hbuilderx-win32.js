const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
const { rimrafSync } = require("rimraf");
const { validateFilesPresent } = require("../../../scripts/util/index");
const {
  copyConfigSchema,
  installNodeModules,
  buildGui,
  copyOnnxRuntimeFromNodeModules,
  copyTreeSitterWasms,
  copyTreeSitterTagQryFiles,
  copyNodeModules,
  downloadEsbuildBinary,
  downloadRipgrepBinary,
  copySqliteBinary,
  installNodeModuleInTempDirAndCopyToCurrent,
  copyTokenizers,
  copyScripts,
  copyModels,
  copySupportAssets,
} = require("./utils");

/**
 * HBuilderX Windows平台打包脚本
 *
 * 仅打包 Windows (win32-x64) 平台的 native 依赖
 */

function logWithPrefix(message, level = "info") {
  const prefix =
    level === "error"
      ? "[hbuilderx] 错误"
      : level === "warn"
        ? "[hbuilderx] 警告"
        : "[hbuilderx]";
  console.log(`${prefix} ${message}`);
}

// Windows支持的架构
const WIN32_PLATFORMS = [
  "win32-x64", // Windows x64
];

async function downloadWin32LanceDB() {
  logWithPrefix("开始下载Windows平台的LanceDB...");

  // 先清理 out/node_modules/@lancedb 目录中的所有平台包
  const outLancedbDir = path.join(
    __dirname,
    "..",
    "out",
    "node_modules",
    "@lancedb",
  );
  if (fs.existsSync(outLancedbDir)) {
    const existingPackages = fs
      .readdirSync(outLancedbDir)
      .filter((f) => f.startsWith("vectordb-"));
    for (const pkg of existingPackages) {
      const pkgPath = path.join(outLancedbDir, pkg);
      if (fs.statSync(pkgPath).isDirectory()) {
        logWithPrefix(`清理其他平台的 LanceDB: ${pkg}`);
        rimrafSync(pkgPath);
      }
    }
  }

  const lancePackages = {
    "win32-x64": "@lancedb/vectordb-win32-x64-msvc",
  };

  for (const [platform, packageName] of Object.entries(lancePackages)) {
    logWithPrefix(`下载 ${platform} LanceDB: ${packageName}`);
    await installNodeModuleInTempDirAndCopyToCurrent(packageName, "@lancedb");

    // 将下载的包从 node_modules/@lancedb 复制到 out/node_modules/@lancedb
    const packageDir = packageName.split("/")[1]; // 提取 vectordb-win32-x64-msvc
    const srcPath = path.join(
      __dirname,
      "..",
      "node_modules",
      "@lancedb",
      packageDir,
    );
    const dstPath = path.join(
      __dirname,
      "..",
      "out",
      "node_modules",
      "@lancedb",
      packageDir,
    );

    if (fs.existsSync(srcPath)) {
      fs.mkdirSync(path.dirname(dstPath), { recursive: true });
      await new Promise((resolve, reject) => {
        require("ncp").ncp(srcPath, dstPath, { dereference: true }, (error) => {
          if (error) {
            logWithPrefix(
              `复制 ${packageName} 到 out 失败: ${error.message}`,
              "error",
            );
            reject(error);
          } else {
            logWithPrefix(`✅ ${packageName} 已复制到 out/node_modules`);
            resolve();
          }
        });
      });
    } else {
      logWithPrefix(`警告: ${srcPath} 不存在`, "warn");
    }
  }

  logWithPrefix("✅ Windows平台的LanceDB下载完成");
}

async function downloadWin32Esbuild() {
  logWithPrefix("开始下载Windows平台的ESBuild...");

  for (const target of WIN32_PLATFORMS) {
    logWithPrefix(`下载 ${target} ESBuild`);
    await downloadEsbuildBinary(target);
  }

  logWithPrefix("✅ Windows平台的ESBuild下载完成");
}

async function downloadWin32Ripgrep() {
  logWithPrefix("开始下载Windows平台的Ripgrep...");

  for (const target of WIN32_PLATFORMS) {
    logWithPrefix(`下载 ${target} Ripgrep`);
    await downloadRipgrepBinary(target);
  }

  logWithPrefix("✅ Windows平台的Ripgrep下载完成");
}

async function downloadWin32Sqlite3() {
  logWithPrefix("开始下载Windows平台的SQLite3...");

  const localBaseDir =
    process.env.CONTINUE_SQLITE3_LOCAL_DIR || "/Users/legend/Downloads/sqlite3";
  const cacheDir = path.join(__dirname, "../.sqlite3-cache");

  // 创建缓存目录
  if (!fs.existsSync(cacheDir)) {
    fs.mkdirSync(cacheDir, { recursive: true });
  }

  for (const target of WIN32_PLATFORMS) {
    logWithPrefix(`处理平台: ${target}`);

    const localFileNameMap = {
      "win32-x64": "sqlite3-v5.1.7-napi-v3-win32-x64.tar.gz",
    };

    const fileName = localFileNameMap[target];
    const cachedFile = path.join(cacheDir, `${target}.tar.gz`);

    // 优先使用本地文件
    const localCandidate = path.join(localBaseDir, fileName);
    if (fs.existsSync(localCandidate)) {
      logWithPrefix(`使用本地文件: ${localCandidate}`);
      fs.copyFileSync(localCandidate, cachedFile);
      continue;
    }

    // 从GitHub下载
    const downloadUrl =
      "https://github.com/TryGhost/node-sqlite3/releases/download/v5.1.7/sqlite3-v5.1.7-napi-v3-win32-x64.tar.gz";

    try {
      logWithPrefix(`下载 ${target} SQLite3...`);
      const { execSync } = require("child_process");
      execSync(
        `curl -L --fail --retry 3 --connect-timeout 30 -o ${cachedFile} ${downloadUrl}`,
        { stdio: "inherit" },
      );
      logWithPrefix(`✅ ${target} 下载完成`);
    } catch (error) {
      logWithPrefix(`❌ ${target} 下载失败: ${error.message}`, "error");
      throw error;
    }
  }

  logWithPrefix("✅ Windows平台的SQLite3下载完成");
}

async function packageHBuilderXWin32() {
  const startTime = Date.now();
  logWithPrefix("=".repeat(60));
  logWithPrefix("开始HBuilderX Windows平台打包");
  logWithPrefix("=".repeat(60));

  // 清理目录
  logWithPrefix("清理旧的构建文件...");
  rimrafSync(path.join(__dirname, "..", "bin"));
  rimrafSync(path.join(__dirname, "..", "out"));
  rimrafSync(path.join(__dirname, "..", ".sqlite3-cache"));

  fs.mkdirSync(path.join(__dirname, "..", "out", "node_modules"), {
    recursive: true,
  });

  const guiDist = path.join(__dirname, "..", "..", "..", "gui", "dist");
  if (!fs.existsSync(guiDist)) {
    fs.mkdirSync(guiDist, { recursive: true });
  }

  try {
    // Step 1: 复制配置
    logWithPrefix("步骤 1/13: 复制配置文件...");
    copyConfigSchema();

    // Step 2: 安装node_modules
    logWithPrefix("步骤 2/13: 安装node_modules...");
    installNodeModules();

    // Step 3: 构建GUI (IIFE格式，Windows需要)
    logWithPrefix("步骤 3/13: 构建GUI（IIFE格式，单入口）...");
    await buildGui(false, true, "win32");

    // Step 4: 复制支持资产
    logWithPrefix("步骤 4/13: 复制支持资产...");
    await copySupportAssets();

    // Step 5: 复制tree-sitter相关文件
    logWithPrefix("步骤 5/13: 复制tree-sitter相关文件...");
    await copyTreeSitterWasms();
    await copyTreeSitterTagQryFiles();

    // Step 6: 复制onnxruntime（Windows平台）
    logWithPrefix("步骤 6/13: 复制onnxruntime（Windows平台）...");
    await copyOnnxRuntimeFromNodeModules("win32", false);

    // Step 7: 复制tokenizers
    logWithPrefix("步骤 7/13: 复制tokenizers...");
    copyTokenizers();

    // Step 8: 复制脚本
    logWithPrefix("步骤 8/13: 复制脚本...");
    await copyScripts();

    // Step 9: 复制模型
    logWithPrefix("步骤 9/13: 复制模型...");
    await copyModels();

    // Step 10: 下载SQLite3（Windows平台）
    logWithPrefix("步骤 10/13: 下载SQLite3（Windows平台）...");
    await downloadWin32Sqlite3();

    // Step 11: 复制node_modules到out（必须在下载平台特定二进制文件之前）
    logWithPrefix("步骤 11/13: 复制node_modules...");
    await copyNodeModules("win32");

    // Step 12: 下载LanceDB、ESBuild、Ripgrep（Windows平台，在copyNodeModules之后）
    logWithPrefix("步骤 12/13: 下载其他native依赖（Windows平台）...");
    await downloadWin32LanceDB();
    await downloadWin32Esbuild();
    await downloadWin32Ripgrep();

    // Step 13: 复制SQLite3二进制文件（必须在copyNodeModules之后）
    logWithPrefix("步骤 13/13: 复制SQLite3二进制文件到node_modules...");
    await copySqliteBinary(false, "win32");

    // 复制jsdom worker文件
    fs.cpSync(
      "node_modules/jsdom/lib/jsdom/living/xhr/xhr-sync-worker.js",
      "out/xhr-sync-worker.js",
    );

    // 验证关键文件
    logWithPrefix("验证关键文件...");
    const requiredFiles = [
      // Tree-sitter
      "tree-sitter/code-snippet-queries/c_sharp.scm",
      "tag-qry/tree-sitter-c_sharp-tags.scm",

      // ONNX Runtime (Windows)
      "bin/napi-v3/win32/x64/onnxruntime_binding.node",
      "bin/napi-v3/win32/x64/onnxruntime.dll",

      // GUI
      "out/gui/assets/index.js",

      // Tutorial
      "media/move-chat-panel-right.md",
      "continue_tutorial.py",
      "config_schema.json",

      // Embeddings model
      "models/all-MiniLM-L6-v2/config.json",
      "models/all-MiniLM-L6-v2/onnx/model_quantized.onnx",

      // Web tree-sitter
      "out/tree-sitter.wasm",
      "out/xhr-sync-worker.js",

      // SQLite3 (Windows)
      "out/sqlite3-binaries/win32-x64/build/Release/node_sqlite3.node",
    ];

    validateFilesPresent(requiredFiles);

    // 生成包信息
    const packageJson = JSON.parse(
      fs.readFileSync(path.join(__dirname, "..", "package.json"), "utf8"),
    );

    const packageInfo = {
      name: "continue-hbuilderx-win32",
      version: packageJson.version,
      type: "win32-only",
      buildTime: new Date().toISOString(),
      supportedPlatforms: WIN32_PLATFORMS,
      guiFormat: "IIFE",
      nativeDependencies: {
        sqlite3: "5.1.7",
        onnxruntime: "1.14.0",
        lancedb: "0.4.20",
        esbuild: "0.17.19",
        ripgrep: "13.0.0",
      },
    };

    fs.writeFileSync(
      path.join(__dirname, "..", "out", "package-info.json"),
      JSON.stringify(packageInfo, null, 2),
    );

    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000 / 60).toFixed(2);

    logWithPrefix("=".repeat(60));
    logWithPrefix(`✅ HBuilderX Windows平台打包完成! 耗时: ${duration} 分钟`);
    logWithPrefix("=".repeat(60));
    logWithPrefix("");
    logWithPrefix("下一步:");
    logWithPrefix("  1. 运行 'npm run build' 编译TypeScript代码");
    logWithPrefix("  2. 运行 'npm run zip:win32' 打包Windows插件");
    logWithPrefix("");
  } catch (error) {
    logWithPrefix(`❌ 打包失败: ${error.message}`, "error");
    console.error(error.stack);
    process.exit(1);
  }
}

// 主函数
async function main() {
  const args = process.argv.slice(2);

  if (args.includes("--help") || args.includes("-h")) {
    console.log(`
HBuilderX Windows平台打包脚本

用法: node package-hbuilderx-win32.js

说明:
  此脚本会下载并打包Windows平台的native依赖:
  - SQLite3 (win32-x64)
  - ONNX Runtime (win32-x64)
  - LanceDB (win32-x64)
  - ESBuild (win32-x64)
  - Ripgrep (win32-x64)
  
  仅支持Windows (win32-x64) 平台。

环境变量:
  CONTINUE_SQLITE3_LOCAL_DIR  - SQLite3本地缓存目录 (默认: /Users/legend/Downloads/sqlite3)

示例:
  node package-hbuilderx-win32.js
`);
    return;
  }

  // 切换到扩展目录
  const scriptDir = path.dirname(__filename);
  const extensionDir = path.join(scriptDir, "..");
  process.chdir(extensionDir);

  logWithPrefix(`当前工作目录: ${process.cwd()}`);

  await packageHBuilderXWin32();
}

// 错误处理
process.on("uncaughtException", (error) => {
  logWithPrefix(`未捕获的异常: ${error.message}`, "error");
  console.error(error.stack);
  process.exit(1);
});

process.on("unhandledRejection", (reason, promise) => {
  logWithPrefix(`未处理的Promise拒绝: ${reason}`, "error");
  process.exit(1);
});

// 运行主函数
if (require.main === module) {
  main().catch((error) => {
    logWithPrefix(`脚本执行失败: ${error.message}`, "error");
    console.error(error.stack);
    process.exit(1);
  });
}

module.exports = {
  packageHBuilderXWin32,
  WIN32_PLATFORMS,
};
