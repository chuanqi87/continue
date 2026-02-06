const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

/**
 * 原生依赖验证脚本
 * 用于检查打包后的扩展是否包含所有必需的原生模块
 */

function logWithPrefix(message, level = "info") {
  const prefix =
    level === "error"
      ? "[hbuilderx] 错误"
      : level === "warn"
        ? "[hbuilderx] 警告"
        : level === "success"
          ? "[hbuilderx] ✅"
          : "[hbuilderx]";
  console.log(`${prefix} ${message}`);
}

// 检查文件是否存在并获取详细信息
function checkFileDetails(filePath, description) {
  const fullPath = path.resolve(filePath);

  if (!fs.existsSync(fullPath)) {
    return {
      exists: false,
      path: fullPath,
      description,
      error: "文件不存在",
    };
  }

  try {
    const stats = fs.statSync(fullPath);
    return {
      exists: true,
      path: fullPath,
      description,
      size: stats.size,
      sizeFormatted: `${(stats.size / 1024).toFixed(1)} KB`,
      modified: stats.mtime.toISOString(),
      isDirectory: stats.isDirectory(),
    };
  } catch (error) {
    return {
      exists: false,
      path: fullPath,
      description,
      error: error.message,
    };
  }
}

// 检查zip文件内容
function validateZipContents(zipPath, target) {
  logWithPrefix(`检查zip文件: ${zipPath}`);

  try {
    // 使用简单的grep方式检查关键文件
    const criticalFiles = [
      "out/build/Release/node_sqlite3.node",
      "out/node_modules/@lancedb/",
      "out/node_modules/@esbuild/",
      "out/node_modules/@vscode/ripgrep/bin/",
    ];

    const foundFiles = [];
    const missingFiles = [];

    criticalFiles.forEach((pattern) => {
      try {
        // 使用unzip -l + grep检查文件是否存在
        const result = execSync(
          `unzip -l "${zipPath}" | grep -q "${pattern}"`,
          {
            encoding: "utf8",
            stdio: "pipe",
          },
        );
        foundFiles.push(pattern);
        logWithPrefix(`✓ 找到: ${pattern}`, "success");
      } catch (error) {
        missingFiles.push(pattern);
        logWithPrefix(`✗ 缺失: ${pattern}`, "error");
      }
    });

    // 列出所有原生模块文件
    try {
      const nativeOutput = execSync(
        `unzip -l "${zipPath}" | grep -E "\\.(node|dll|dylib|so)$|esbuild|rg\\.exe|/rg$"`,
        {
          encoding: "utf8",
          stdio: "pipe",
        },
      );

      if (nativeOutput.trim()) {
        logWithPrefix("\n原生模块文件列表:");
        nativeOutput
          .trim()
          .split("\n")
          .forEach((line) => {
            // 提取文件名（最后一列）
            const parts = line.trim().split(/\s+/);
            if (parts.length >= 4) {
              const fileName = parts.slice(3).join(" ");
              logWithPrefix(`  📦 ${fileName}`);
            }
          });
      }
    } catch (error) {
      logWithPrefix("无法列出原生模块文件", "warn");
    }

    // 获取总文件数
    let totalFiles = 0;
    try {
      const countOutput = execSync(`unzip -l "${zipPath}" | tail -1`, {
        encoding: "utf8",
      });
      const match = countOutput.match(/(\d+)\s+files?/);
      if (match) {
        totalFiles = parseInt(match[1]);
      }
    } catch (error) {
      logWithPrefix("无法获取文件总数", "warn");
    }

    logWithPrefix(`zip文件包含 ${totalFiles} 个文件`);

    return {
      totalFiles,
      foundCritical: foundFiles.length,
      missingCritical: missingFiles.length,
      valid: missingFiles.length === 0,
    };
  } catch (error) {
    logWithPrefix(`zip验证失败: ${error.message}`, "error");
    return {
      valid: false,
      error: error.message,
    };
  }
}

// 检查本地原生依赖
function validateLocalNativeDeps(target) {
  logWithPrefix(`验证本地原生依赖 (${target})...`);

  const [os, arch] = target.split("-");
  const checks = [];

  // SQLite3检查
  const sqlite3Path = "out/build/Release/node_sqlite3.node";
  checks.push(checkFileDetails(sqlite3Path, "SQLite3 数据库引擎"));

  // ONNX Runtime检查
  const onnxBinding = `bin/napi-v3/${os}/${arch}/onnxruntime_binding.node`;
  checks.push(checkFileDetails(onnxBinding, "ONNX Runtime 绑定"));

  const onnxLib = `bin/napi-v3/${os}/${arch}/${
    os === "darwin"
      ? "libonnxruntime.1.14.0.dylib"
      : os === "linux"
        ? "libonnxruntime.so.1.14.0"
        : "onnxruntime.dll"
  }`;
  checks.push(checkFileDetails(onnxLib, "ONNX Runtime 库"));

  // LanceDB检查
  const lancedbPath = `out/node_modules/@lancedb/vectordb-${
    os === "win32"
      ? "win32-x64-msvc"
      : `${target}${os === "linux" ? "-gnu" : ""}`
  }/index.node`;
  checks.push(checkFileDetails(lancedbPath, "LanceDB 向量数据库"));

  // ESBuild检查
  const esbuildPath = `out/node_modules/@esbuild/${
    target === "win32-arm64"
      ? "esbuild.exe"
      : target === "win32-x64"
        ? "win32-x64/esbuild.exe"
        : `${target}/bin/esbuild`
  }`;
  checks.push(checkFileDetails(esbuildPath, "ESBuild 打包工具"));

  // Ripgrep检查
  const exe = os === "win32" ? ".exe" : "";
  const ripgrepPath = `out/node_modules/@vscode/ripgrep/bin/rg${exe}`;
  checks.push(checkFileDetails(ripgrepPath, "Ripgrep 搜索工具"));

  // 输出检查结果
  logWithPrefix(`\n原生依赖检查结果 (${target}):`);
  let allValid = true;

  checks.forEach((check) => {
    if (check.exists) {
      logWithPrefix(
        `  ✅ ${check.description}: ${check.sizeFormatted}`,
        "success",
      );
    } else {
      logWithPrefix(`  ❌ ${check.description}: ${check.error}`, "error");
      allValid = false;
    }
  });

  return {
    target,
    valid: allValid,
    checks,
    summary: {
      total: checks.length,
      valid: checks.filter((c) => c.exists).length,
      invalid: checks.filter((c) => !c.exists).length,
    },
  };
}

// 主验证函数
async function main() {
  const args = process.argv.slice(2);

  if (args.includes("--help") || args.includes("-h")) {
    console.log(`
原生依赖验证工具

用法: node validate-native-deps.js [选项]

选项:
  --target <platform>    验证指定平台的依赖
  --zip <path>          验证zip文件内容
  --all                 验证所有支持的平台
  --help, -h            显示此帮助信息

示例:
  node validate-native-deps.js --target win32-x64
  node validate-native-deps.js --zip build/continue-hbuilderx-0.1.0-win32-x64.zip
  node validate-native-deps.js --all
`);
    return;
  }

  // 切换到扩展目录
  const scriptDir = path.dirname(__filename);
  const extensionDir = path.join(scriptDir, "..");
  process.chdir(extensionDir);

  // zip文件验证
  const zipIndex = args.indexOf("--zip");
  if (zipIndex !== -1 && zipIndex + 1 < args.length) {
    const zipPath = args[zipIndex + 1];
    const target =
      path.basename(zipPath).match(/-([^-]+-[^-]+)\.zip$/)?.[1] || "unknown";

    if (!fs.existsSync(zipPath)) {
      logWithPrefix(`zip文件不存在: ${zipPath}`, "error");
      process.exit(1);
    }

    const result = validateZipContents(zipPath, target);
    if (!result.valid) {
      process.exit(1);
    }
    return;
  }

  // 单平台验证
  const targetIndex = args.indexOf("--target");
  if (targetIndex !== -1 && targetIndex + 1 < args.length) {
    const target = args[targetIndex + 1];
    const result = validateLocalNativeDeps(target);

    if (!result.valid) {
      logWithPrefix(`平台 ${target} 验证失败`, "error");
      process.exit(1);
    }
    return;
  }

  // 全平台验证
  if (args.includes("--all")) {
    const targets = [
      "darwin-arm64",
      "darwin-x64",
      "linux-arm64",
      "linux-x64",
      "win32-arm64",
      "win32-x64",
    ];
    let allValid = true;

    for (const target of targets) {
      logWithPrefix(`\n${"=".repeat(40)}`);
      const result = validateLocalNativeDeps(target);
      if (!result.valid) {
        allValid = false;
      }
    }

    if (!allValid) {
      logWithPrefix("\n❌ 部分平台验证失败", "error");
      process.exit(1);
    } else {
      logWithPrefix("\n✅ 所有平台验证通过", "success");
    }
    return;
  }

  // 默认行为：检查当前目录的构建状态
  logWithPrefix("检查当前构建状态...");

  const outExists = fs.existsSync("out");
  const binExists = fs.existsSync("bin");

  logWithPrefix(`out目录: ${outExists ? "存在" : "不存在"}`);
  logWithPrefix(`bin目录: ${binExists ? "存在" : "不存在"}`);

  if (!outExists && !binExists) {
    logWithPrefix("提示: 请先运行预打包脚本", "warn");
    logWithPrefix("示例: npm run prepackage -- --target win32-x64", "warn");
  }
}

if (require.main === module) {
  main().catch((error) => {
    logWithPrefix(`验证脚本执行失败: ${error.message}`, "error");
    console.error(error.stack);
    process.exit(1);
  });
}

module.exports = {
  validateLocalNativeDeps,
  validateZipContents,
  checkFileDetails,
};
