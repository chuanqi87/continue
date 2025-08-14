const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
const { rimrafSync } = require("rimraf");

/**
 * 改进的跨平台打包脚本
 * 解决sqlite3和其他原生依赖的平台兼容问题
 */

const SUPPORTED_TARGETS = [
  "darwin-arm64",
  "darwin-x64",
  "win32-arm64",
  "win32-x64",
];

// 原生依赖模块配置
const NATIVE_DEPENDENCIES = {
  sqlite3: {
    downloadUrls: {
      "darwin-arm64":
        "https://github.com/TryGhost/node-sqlite3/releases/download/v5.1.7/sqlite3-v5.1.7-napi-v6-darwin-arm64.tar.gz",
      "linux-arm64":
        "https://github.com/TryGhost/node-sqlite3/releases/download/v5.1.7/sqlite3-v5.1.7-napi-v3-linux-arm64.tar.gz",
      "win32-arm64":
        "https://github.com/TryGhost/node-sqlite3/releases/download/v5.1.7/sqlite3-v5.1.7-napi-v6-win32-arm64.tar.gz",
      "linux-x64":
        "https://github.com/TryGhost/node-sqlite3/releases/download/v5.1.7/sqlite3-v5.1.7-napi-v3-linux-x64.tar.gz",
      "darwin-x64":
        "https://github.com/TryGhost/node-sqlite3/releases/download/v5.1.7/sqlite3-v5.1.7-napi-v6-darwin-x64.tar.gz",
      "win32-x64":
        "https://github.com/TryGhost/node-sqlite3/releases/download/v5.1.7/sqlite3-v5.1.7-napi-v3-win32-x64.tar.gz",
    },
    localCacheDir:
      process.env.CONTINUE_SQLITE3_LOCAL_DIR ||
      "/Users/legend/Downloads/sqlite3",
    localFileNames: {
      "darwin-arm64": "sqlite3-v5.1.7-napi-v6-darwin-arm64.tar.gz",
      "linux-arm64": "sqlite3-v5.1.7-napi-v3-linux-arm64.tar.gz",
      "win32-arm64": "sqlite3-v5.1.7-napi-v6-win32-arm64.tar.gz",
      "linux-x64": "sqlite3-v5.1.7-napi-v3-linux-x64.tar.gz",
      "darwin-x64": "sqlite3-v5.1.7-napi-v6-darwin-x64.tar.gz",
      "win32-x64": "sqlite3-v5.1.7-napi-v3-win32-x64.tar.gz",
    },
    validatePath: "out/build/Release/node_sqlite3.node",
  },
  onnxruntime: {
    validatePaths: {
      "darwin-arm64": [
        "bin/napi-v3/darwin/arm64/onnxruntime_binding.node",
        "bin/napi-v3/darwin/arm64/libonnxruntime.1.14.0.dylib",
      ],
      "darwin-x64": [
        "bin/napi-v3/darwin/x64/onnxruntime_binding.node",
        "bin/napi-v3/darwin/x64/libonnxruntime.1.14.0.dylib",
      ],
      "linux-arm64": [
        "bin/napi-v3/linux/arm64/onnxruntime_binding.node",
        "bin/napi-v3/linux/arm64/libonnxruntime.so.1.14.0",
      ],
      "linux-x64": [
        "bin/napi-v3/linux/x64/onnxruntime_binding.node",
        "bin/napi-v3/linux/x64/libonnxruntime.so.1.14.0",
      ],
      "win32-arm64": [
        "bin/napi-v3/win32/arm64/onnxruntime_binding.node",
        "bin/napi-v3/win32/arm64/onnxruntime.dll",
      ],
      "win32-x64": [
        "bin/napi-v3/win32/x64/onnxruntime_binding.node",
        "bin/napi-v3/win32/x64/onnxruntime.dll",
      ],
    },
  },
  lancedb: {
    validatePaths: {
      "darwin-arm64":
        "out/node_modules/@lancedb/vectordb-darwin-arm64/index.node",
      "darwin-x64": "out/node_modules/@lancedb/vectordb-darwin-x64/index.node",
      "linux-arm64":
        "out/node_modules/@lancedb/vectordb-linux-arm64-gnu/index.node",
      "linux-x64":
        "out/node_modules/@lancedb/vectordb-linux-x64-gnu/index.node",
      "win32-arm64":
        "out/node_modules/@lancedb/vectordb-win32-x64-msvc/index.node",
      "win32-x64":
        "out/node_modules/@lancedb/vectordb-win32-x64-msvc/index.node",
    },
  },
  esbuild: {
    validatePaths: {
      "darwin-arm64": "out/node_modules/@esbuild/darwin-arm64/bin/esbuild",
      "darwin-x64": "out/node_modules/@esbuild/darwin-x64/bin/esbuild",
      "linux-arm64": "out/node_modules/@esbuild/linux-arm64/bin/esbuild",
      "linux-x64": "out/node_modules/@esbuild/linux-x64/bin/esbuild",
      "win32-arm64": "out/node_modules/@esbuild/win32-arm64/esbuild.exe",
      "win32-x64": "out/node_modules/@esbuild/win32-x64/esbuild.exe",
    },
  },
  ripgrep: {
    validatePaths: {
      "darwin-arm64": "out/node_modules/@vscode/ripgrep/bin/rg",
      "darwin-x64": "out/node_modules/@vscode/ripgrep/bin/rg",
      "linux-arm64": "out/node_modules/@vscode/ripgrep/bin/rg",
      "linux-x64": "out/node_modules/@vscode/ripgrep/bin/rg",
      "win32-arm64": "out/node_modules/@vscode/ripgrep/bin/rg.exe",
      "win32-x64": "out/node_modules/@vscode/ripgrep/bin/rg.exe",
    },
  },
};

function logWithPrefix(message, level = "info") {
  const prefix =
    level === "error"
      ? "[hbuilderx] 错误"
      : level === "warn"
        ? "[hbuilderx] 警告"
        : "[hbuilderx]";
  console.log(`${prefix} ${message}`);
}

function validateNativeDependencies(target) {
  logWithPrefix(`验证目标平台 ${target} 的原生依赖...`);
  const [os, arch] = target.split("-");
  const missingFiles = [];

  // 检查sqlite3
  const sqlite3Path = NATIVE_DEPENDENCIES.sqlite3.validatePath;
  if (!fs.existsSync(sqlite3Path)) {
    missingFiles.push(`SQLite3: ${sqlite3Path}`);
  }

  // 检查onnxruntime
  const onnxPaths = NATIVE_DEPENDENCIES.onnxruntime.validatePaths[target];
  if (onnxPaths) {
    onnxPaths.forEach((p) => {
      if (!fs.existsSync(p)) {
        missingFiles.push(`ONNX Runtime: ${p}`);
      }
    });
  }

  // 检查lancedb
  const lancedbPath = NATIVE_DEPENDENCIES.lancedb.validatePaths[target];
  if (lancedbPath && !fs.existsSync(lancedbPath)) {
    missingFiles.push(`LanceDB: ${lancedbPath}`);
  }

  // 检查esbuild
  const esbuildPath = NATIVE_DEPENDENCIES.esbuild.validatePaths[target];
  if (esbuildPath && !fs.existsSync(esbuildPath)) {
    missingFiles.push(`ESBuild: ${esbuildPath}`);
  }

  // 检查ripgrep
  const ripgrepPath = NATIVE_DEPENDENCIES.ripgrep.validatePaths[target];
  if (ripgrepPath && !fs.existsSync(ripgrepPath)) {
    missingFiles.push(`Ripgrep: ${ripgrepPath}`);
  }

  if (missingFiles.length > 0) {
    logWithPrefix("发现缺失的原生依赖文件:", "error");
    missingFiles.forEach((file) => logWithPrefix(`  - ${file}`, "error"));
    return false;
  }

  logWithPrefix(`✅ 所有原生依赖验证通过 (${target})`);
  return true;
}

function createPackageInfo(target) {
  const version = JSON.parse(fs.readFileSync("package.json", "utf8")).version;
  const [os, arch] = target.split("-");

  return {
    name: `continue-hbuilderx-${version}-${target}`,
    version,
    target,
    os,
    arch,
    timestamp: new Date().toISOString(),
    nativeDependencies: {
      sqlite3: NATIVE_DEPENDENCIES.sqlite3.validatePath,
      onnxruntime: NATIVE_DEPENDENCIES.onnxruntime.validatePaths[target],
      lancedb: NATIVE_DEPENDENCIES.lancedb.validatePaths[target],
      esbuild: NATIVE_DEPENDENCIES.esbuild.validatePaths[target],
      ripgrep: NATIVE_DEPENDENCIES.ripgrep.validatePaths[target],
    },
  };
}

async function packageForTarget(target) {
  logWithPrefix(`开始为 ${target} 平台打包...`);

  try {
    // 1. 预打包 - 准备所有依赖
    logWithPrefix(`执行预打包: npm run prepare-deps -- --target ${target}`);
    execSync(`npm run prepare-deps -- --target ${target}`, {
      stdio: "inherit",
      cwd: process.cwd(),
    });

    // 2. 验证原生依赖
    if (!validateNativeDependencies(target)) {
      throw new Error(`目标平台 ${target} 的原生依赖验证失败`);
    }

    // 3. 生成包信息文件
    const packageInfo = createPackageInfo(target);
    fs.writeFileSync(
      "out/package-info.json",
      JSON.stringify(packageInfo, null, 2),
    );
    logWithPrefix(`生成包信息文件: out/package-info.json`);

    // 4. 执行打包
    logWithPrefix(`执行打包: npm run package -- --target ${target}`);
    execSync(`npm run package -- --target ${target}`, {
      stdio: "inherit",
      cwd: process.cwd(),
    });

    // 5. 验证生成的zip文件
    const buildDir = path.join(process.cwd(), "build");
    const zipPattern = `continue-hbuilderx-*-${target}.zip`;
    const zipFiles = fs
      .readdirSync(buildDir)
      .filter((f) => f.includes(target) && f.endsWith(".zip"));

    if (zipFiles.length === 0) {
      throw new Error(`未找到目标平台 ${target} 的zip文件`);
    }

    const zipPath = path.join(buildDir, zipFiles[0]);
    const zipStats = fs.statSync(zipPath);
    logWithPrefix(
      `✅ 成功创建 ${target} 包: ${zipFiles[0]} (${(zipStats.size / 1024 / 1024).toFixed(1)} MB)`,
    );

    return {
      target,
      zipFile: zipFiles[0],
      zipPath,
      size: zipStats.size,
      success: true,
    };
  } catch (error) {
    logWithPrefix(`❌ ${target} 平台打包失败: ${error.message}`, "error");
    return {
      target,
      success: false,
      error: error.message,
    };
  }
}

async function packageAllPlatforms() {
  const startTime = Date.now();
  logWithPrefix("开始为所有支持的平台打包...");

  // 确保构建目录存在
  const buildDir = path.join(process.cwd(), "build");
  if (!fs.existsSync(buildDir)) {
    fs.mkdirSync(buildDir, { recursive: true });
  }

  const results = [];

  for (const target of SUPPORTED_TARGETS) {
    logWithPrefix(`\n${"=".repeat(50)}`);
    logWithPrefix(`开始处理平台: ${target}`);
    logWithPrefix(`${"=".repeat(50)}`);

    const result = await packageForTarget(target);
    results.push(result);

    // 清理临时文件，为下一个平台做准备
    try {
      rimrafSync("out");
      rimrafSync("bin");
      logWithPrefix(`清理临时文件完成`);
    } catch (e) {
      logWithPrefix(`清理临时文件时出现警告: ${e.message}`, "warn");
    }
  }

  // 生成打包报告
  const endTime = Date.now();
  const duration = ((endTime - startTime) / 1000 / 60).toFixed(1);

  logWithPrefix(`\n${"=".repeat(60)}`);
  logWithPrefix(`打包完成! 总耗时: ${duration} 分钟`);
  logWithPrefix(`${"=".repeat(60)}`);

  const successful = results.filter((r) => r.success);
  const failed = results.filter((r) => !r.success);

  logWithPrefix(`✅ 成功: ${successful.length}/${results.length} 个平台`);

  if (successful.length > 0) {
    logWithPrefix("\n成功打包的平台:");
    successful.forEach((r) => {
      const sizeMB = (r.size / 1024 / 1024).toFixed(1);
      logWithPrefix(`  ✅ ${r.target}: ${r.zipFile} (${sizeMB} MB)`);
    });
  }

  if (failed.length > 0) {
    logWithPrefix("\n失败的平台:", "error");
    failed.forEach((r) => {
      logWithPrefix(`  ❌ ${r.target}: ${r.error}`, "error");
    });
  }

  // 生成详细报告文件
  const report = {
    timestamp: new Date().toISOString(),
    duration: `${duration} minutes`,
    summary: {
      total: results.length,
      successful: successful.length,
      failed: failed.length,
    },
    results,
    nativeDependencies: Object.keys(NATIVE_DEPENDENCIES),
  };

  const reportPath = path.join(buildDir, `package-report-${Date.now()}.json`);
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  logWithPrefix(`📋 详细报告已保存: ${reportPath}`);

  // 如果有失败的平台，退出码非0
  if (failed.length > 0) {
    process.exit(1);
  }
}

// 检查zip内容的函数
function validateZipContents(zipPath, target) {
  try {
    logWithPrefix(`验证 ${target} zip文件内容...`);

    // 使用unzip -l列出zip内容
    const output = execSync(`unzip -l "${zipPath}"`, { encoding: "utf8" });

    // 检查关键的原生依赖文件
    const requiredFiles = [
      "out/build/Release/node_sqlite3.node",
      "out/node_modules/@lancedb/",
      "out/node_modules/@esbuild/",
      "out/node_modules/@vscode/ripgrep/bin/rg",
    ];

    const missingInZip = [];
    requiredFiles.forEach((file) => {
      if (!output.includes(file)) {
        missingInZip.push(file);
      }
    });

    if (missingInZip.length > 0) {
      logWithPrefix(`⚠️  zip文件中缺少以下文件:`, "warn");
      missingInZip.forEach((file) => logWithPrefix(`    - ${file}`, "warn"));
      return false;
    }

    logWithPrefix(`✅ zip文件内容验证通过`);
    return true;
  } catch (error) {
    logWithPrefix(`zip文件验证失败: ${error.message}`, "error");
    return false;
  }
}

// 主函数
async function main() {
  const args = process.argv.slice(2);

  // 解析命令行参数
  if (args.includes("--help") || args.includes("-h")) {
    console.log(`
用法: node package-all-platforms.js [选项]

选项:
  --target <platform>    只打包指定平台 (${SUPPORTED_TARGETS.join(", ")})
  --validate-zip         验证生成的zip文件内容
  --clean               打包前清理所有临时文件
  --help, -h            显示此帮助信息

示例:
  node package-all-platforms.js                    # 打包所有平台
  node package-all-platforms.js --target win32-x64 # 只打包Windows x64
  node package-all-platforms.js --validate-zip     # 打包并验证zip内容
`);
    return;
  }

  // 切换到正确的目录
  const scriptDir = path.dirname(__filename);
  const extensionDir = path.join(scriptDir, "..");
  process.chdir(extensionDir);

  logWithPrefix(`当前工作目录: ${process.cwd()}`);

  // 清理选项
  if (args.includes("--clean")) {
    logWithPrefix("清理临时文件...");
    rimrafSync("out");
    rimrafSync("bin");
    rimrafSync("build");
    logWithPrefix("清理完成");
  }

  // 单平台打包
  const targetIndex = args.indexOf("--target");
  if (targetIndex !== -1 && targetIndex + 1 < args.length) {
    const target = args[targetIndex + 1];
    if (!SUPPORTED_TARGETS.includes(target)) {
      logWithPrefix(`不支持的目标平台: ${target}`, "error");
      logWithPrefix(`支持的平台: ${SUPPORTED_TARGETS.join(", ")}`, "error");
      process.exit(1);
    }

    const result = await packageForTarget(target);

    // 验证zip内容
    if (args.includes("--validate-zip") && result.success) {
      validateZipContents(result.zipPath, target);
    }

    if (!result.success) {
      process.exit(1);
    }
    return;
  }

  // 全平台打包
  await packageAllPlatforms();
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
  packageForTarget,
  validateNativeDependencies,
  validateZipContents,
  SUPPORTED_TARGETS,
  NATIVE_DEPENDENCIES,
};
