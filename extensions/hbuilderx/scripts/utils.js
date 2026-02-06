const fs = require("fs");
const ncp = require("ncp").ncp;
const path = require("path");
const { rimrafSync } = require("rimraf");
const { execCmdSync } = require("../../../scripts/util/index");

const continueDir = path.join(__dirname, "..", "..", "..");

function copyTokenizers() {
  fs.copyFileSync(
    path.join(__dirname, "../../../core/llm/llamaTokenizerWorkerPool.mjs"),
    path.join(__dirname, "../out/llamaTokenizerWorkerPool.mjs"),
  );
  console.log("[hbuilderx] Copied llamaTokenizerWorkerPool");

  fs.copyFileSync(
    path.join(__dirname, "../../../core/llm/llamaTokenizer.mjs"),
    path.join(__dirname, "../out/llamaTokenizer.mjs"),
  );
  console.log("[hbuilderx] Copied llamaTokenizer");
}

// Generate and copy JSON schemas used by other IDEs
function copyConfigSchema() {
  // Reuse VSCode schema as the source of truth
  process.chdir(path.join(continueDir, "extensions", "vscode"));
  // Modify and copy for .continuerc.json
  const schema = JSON.parse(fs.readFileSync("config_schema.json", "utf8"));
  schema.$defs.SerializedContinueConfig.properties.mergeBehavior = {
    type: "string",
    enum: ["merge", "overwrite"],
    default: "merge",
    title: "Merge behavior",
    markdownDescription:
      "If set to 'merge', .continuerc.json will be applied on top of config.json (arrays and objects are merged). If set to 'overwrite', then every top-level property of .continuerc.json will overwrite that property from config.json.",
    "x-intellij-html-description":
      "<p>If set to <code>merge</code>, <code>.continuerc.json</code> will be applied on top of <code>config.json</code> (arrays and objects are merged). If set to <code>overwrite</code>, then every top-level property of <code>.continuerc.json</code> will overwrite that property from <code>config.json</code>.</p>",
  };
  fs.writeFileSync("continue_rc_schema.json", JSON.stringify(schema, null, 2));

  // Copy config schemas to intellij
  fs.copyFileSync(
    "config_schema.json",
    path.join(
      "..",
      "intellij",
      "src",
      "main",
      "resources",
      "config_schema.json",
    ),
  );
  fs.copyFileSync(
    "continue_rc_schema.json",
    path.join(
      "..",
      "intellij",
      "src",
      "main",
      "resources",
      "continue_rc_schema.json",
    ),
  );
}

function installNodeModules() {
  // Install node_modules for HBuilderX extension and GUI
  process.chdir(path.join(continueDir, "extensions", "hbuilderx"));
  execCmdSync("npm install");
  console.log("[hbuilderx] npm install in extensions/hbuilderx completed");

  process.chdir(path.join(continueDir, "gui"));
  execCmdSync("npm install");
  console.log("[hbuilderx] npm install in gui completed");
}

async function buildGui(isGhAction, isHBuilderX = false, platform = null) {
  // Make sure we are in the right directory
  if (!process.cwd().endsWith("gui")) {
    process.chdir(path.join(continueDir, "gui"));
  }
  // 总是执行构建（HBuilderX打包需要）
  if (isHBuilderX && platform) {
    process.env.HBUILDERX_PLATFORM = platform;
    const format = platform === "win32" ? "IIFE" : "ES Module";
    console.log(
      `[hbuilderx] 为平台 ${platform} 构建前端代码，使用 ${format} 格式`,
    );
  } else if (isHBuilderX) {
    console.log("[hbuilderx] 构建前端代码");
  }
  execCmdSync("npm run build");

  // Copy over the dist folder to the JetBrains extension //
  const intellijExtensionWebviewPath = path.join(
    "..",
    "extensions",
    "intellij",
    "src",
    "main",
    "resources",
    "webview",
  );

  const indexHtmlPath = path.join(intellijExtensionWebviewPath, "index.html");
  fs.copyFileSync(indexHtmlPath, "tmp_index.html");
  rimrafSync(intellijExtensionWebviewPath);
  fs.mkdirSync(intellijExtensionWebviewPath, { recursive: true });

  await new Promise((resolve, reject) => {
    ncp("dist", intellijExtensionWebviewPath, (error) => {
      if (error) {
        console.warn(
          "[hbuilderx] Error copying React app build to JetBrains extension: ",
          error,
        );
        reject(error);
      }
      resolve();
    });
  });

  // Put back index.html
  if (fs.existsSync(indexHtmlPath)) {
    rimrafSync(indexHtmlPath);
  }
  fs.copyFileSync("tmp_index.html", indexHtmlPath);
  fs.unlinkSync("tmp_index.html");

  console.log("[hbuilderx] Copied gui build to JetBrains extension");

  // Then copy over the dist folder to the VSCode extension //
  const vscodeGuiPath = path.join("../extensions/vscode/gui");
  fs.mkdirSync(vscodeGuiPath, { recursive: true });
  await new Promise((resolve, reject) => {
    ncp("dist", vscodeGuiPath, (error) => {
      if (error) {
        console.log(
          "[hbuilderx] Error copying React app build to VSCode extension: ",
          error,
        );
        reject(error);
      } else {
        console.log("[hbuilderx] Copied gui build to VSCode extension");
        resolve();
      }
    });
  });

  // Also copy to HBuilderX extension //
  const hbuilderxGuiPath = path.join("../extensions/hbuilderx/out/gui");
  fs.mkdirSync(hbuilderxGuiPath, { recursive: true });
  await new Promise((resolve, reject) => {
    ncp("dist", hbuilderxGuiPath, (error) => {
      if (error) {
        console.log(
          "[hbuilderx] Error copying React app build to HBuilderX extension: ",
          error,
        );
        reject(error);
      } else {
        console.log("[hbuilderx] Copied gui build to HBuilderX extension");
        resolve();
      }
    });
  });

  if (!fs.existsSync(path.join("dist", "assets", "index.js"))) {
    throw new Error("gui build did not produce index.js");
  }
}

async function copyOnnxRuntimeFromNodeModules(
  target,
  isHBuilderXAllPlatforms = false,
) {
  // Work within HBuilderX extension directory
  process.chdir(path.join(continueDir, "extensions", "hbuilderx"));
  fs.mkdirSync("bin", { recursive: true });

  await new Promise((resolve, reject) => {
    ncp(
      path.join(__dirname, "../../../core/node_modules/onnxruntime-node/bin"),
      path.join(__dirname, "../bin"),
      {
        dereference: true,
      },
      (error) => {
        if (error) {
          console.warn(
            "[hbuilderx] Error copying onnxruntime-node files",
            error,
          );
          reject(error);
        }
        resolve();
      },
    );
  });

  // HBuilderX需要保留所有平台的二进制文件以支持跨平台
  if (!isHBuilderXAllPlatforms && target) {
    // 仅在非HBuilderX全平台打包模式下删除其他平台的二进制文件
    try {
      if (!target.startsWith("darwin")) {
        rimrafSync(path.join(__dirname, "../bin/napi-v3/darwin"));
      } else if (target === "darwin") {
        // darwin 仅保留 arm64，删除 x64
        rimrafSync(path.join(__dirname, "../bin/napi-v3/darwin/x64"));
        console.log("[hbuilderx] 已删除 darwin/x64，仅保留 arm64");
      }
      if (!target.startsWith("linux")) {
        rimrafSync(path.join(__dirname, "../bin/napi-v3/linux"));
      }
      if (!target.startsWith("win")) {
        rimrafSync(path.join(__dirname, "../bin/napi-v3/win32"));
      }
    } catch (e) {
      console.warn("[hbuilderx] Error removing unused binaries", e);
    }
  }

  // 删除体积过大的CUDA/TensorRT二进制文件（所有平台都删除）
  try {
    const platformsToClean = ["linux/x64", "linux/arm64"];
    const filesToRemove = [
      "libonnxruntime_providers_cuda.so",
      "libonnxruntime_providers_shared.so",
      "libonnxruntime_providers_tensorrt.so",
    ];

    platformsToClean.forEach((platform) => {
      filesToRemove.forEach((file) => {
        const filepath = path.join(
          __dirname,
          `../bin/napi-v3/${platform}`,
          file,
        );
        if (fs.existsSync(filepath)) {
          fs.rmSync(filepath);
          console.log(`[hbuilderx] 已删除大文件: ${file} from ${platform}`);
        }
      });
    });
  } catch (e) {
    console.warn("[hbuilderx] Error removing large binaries", e);
  }

  console.log(
    "[hbuilderx] Copied onnxruntime-node" +
      (isHBuilderXAllPlatforms ? " (所有平台)" : ""),
  );
}

async function copyTreeSitterWasms() {
  // Work within HBuilderX extension directory
  process.chdir(path.join(continueDir, "extensions", "hbuilderx"));
  fs.mkdirSync("out", { recursive: true });

  await new Promise((resolve, reject) => {
    ncp(
      path.join(__dirname, "../../../core/node_modules/tree-sitter-wasms/out"),
      path.join(__dirname, "../out/tree-sitter-wasms"),
      { dereference: true },
      (error) => {
        if (error) {
          console.warn(
            "[hbuilderx] Error copying tree-sitter-wasm files",
            error,
          );
          reject(error);
        } else {
          resolve();
        }
      },
    );
  });

  fs.copyFileSync(
    path.join(__dirname, "../../../core/vendor/tree-sitter.wasm"),
    path.join(__dirname, "../out/tree-sitter.wasm"),
  );
  console.log("[hbuilderx] Copied tree-sitter wasms");
}

async function copyTreeSitterTagQryFiles() {
  const vscodeDir = path.join(continueDir, "extensions", "vscode");
  const hbxDir = path.join(continueDir, "extensions", "hbuilderx");

  // Copy tag-qry
  const srcTagQry = path.join(vscodeDir, "tag-qry");
  const dstTagQry = path.join(hbxDir, "tag-qry");
  if (fs.existsSync(srcTagQry)) {
    await new Promise((resolve, reject) => {
      ncp(srcTagQry, dstTagQry, { dereference: true }, (error) => {
        if (error) {
          console.warn("[hbuilderx] Error copying tag-qry files", error);
          reject(error);
        } else {
          console.log("[hbuilderx] Copied tag-qry files");
          resolve();
        }
      });
    });
  } else {
    console.log("[hbuilderx] Skip copying tag-qry: source not found");
  }

  // Copy tree-sitter queries
  const srcTreeSitter = path.join(vscodeDir, "tree-sitter");
  const dstTreeSitter = path.join(hbxDir, "tree-sitter");
  if (fs.existsSync(srcTreeSitter)) {
    await new Promise((resolve, reject) => {
      ncp(srcTreeSitter, dstTreeSitter, { dereference: true }, (error) => {
        if (error) {
          console.warn(
            "[hbuilderx] Error copying tree-sitter query files",
            error,
          );
          reject(error);
        } else {
          console.log("[hbuilderx] Copied tree-sitter query files");
          resolve();
        }
      });
    });
  } else {
    console.log(
      "[hbuilderx] Skip copying tree-sitter queries: source not found",
    );
  }
}

async function copyNodeModules(target) {
  // 【新方案】在 out 目录中执行生产环境的 npm install
  // 只安装 dependencies，不包含 devDependencies，减小体积
  process.chdir(path.join(continueDir, "extensions", "hbuilderx"));

  console.log("[hbuilderx] 在 out/ 目录中安装生产依赖...");

  const outDir = path.join(__dirname, "..", "out");
  const packageJsonSrc = path.join(__dirname, "..", "package.json");
  const packageJsonDst = path.join(outDir, "package.json");
  const packageLockSrc = path.join(__dirname, "..", "package-lock.json");
  const packageLockDst = path.join(outDir, "package-lock.json");

  // 创建 out 目录
  fs.mkdirSync(outDir, { recursive: true });

  // 复制 package.json 和 package-lock.json 到 out
  fs.copyFileSync(packageJsonSrc, packageJsonDst);
  if (fs.existsSync(packageLockSrc)) {
    fs.copyFileSync(packageLockSrc, packageLockDst);
  }

  // 在 out 目录中执行 npm install --production
  console.log("[hbuilderx] 执行: npm install --production --ignore-scripts");
  try {
    execCmdSync("cd out && npm install --production --ignore-scripts");
    console.log("[hbuilderx] ✅ 生产依赖安装完成");
  } catch (error) {
    console.error("[hbuilderx] npm install 失败:", error);
    throw error;
  }

  // 删除 out 目录中的 package.json 和 package-lock.json（打包时不需要）
  if (fs.existsSync(packageJsonDst)) {
    fs.unlinkSync(packageJsonDst);
  }
  if (fs.existsSync(packageLockDst)) {
    fs.unlinkSync(packageLockDst);
  }

  // 清理不需要的文件以减小体积
  console.log("[hbuilderx] 清理不必要的文件...");

  const dstNodeModules = path.join(outDir, "node_modules");

  // 删除 esbuild/bin（平台特定的 @esbuild 包已经有了）
  const esbuildBin = path.join(dstNodeModules, "esbuild", "bin");
  if (fs.existsSync(esbuildBin)) {
    fs.rmSync(esbuildBin, { recursive: true, force: true });
    console.log("[hbuilderx] 清理了 esbuild/bin");
  }

  // 【关键】仅在单平台打包时清理其他平台的文件
  // 跨平台打包（target === null）时保留所有平台的二进制文件
  if (target !== null) {
    // 清理错误平台的@esbuild文件，只保留目标平台
    const esbuildDir = path.join(dstNodeModules, "@esbuild");
    if (fs.existsSync(esbuildDir)) {
      const platformDirs = fs.readdirSync(esbuildDir);
      const targetPlatform =
        target === "win32-arm64"
          ? "win32-arm64"
          : target === "win32-x64"
            ? "win32-x64"
            : target === "linux-arm64"
              ? "linux-arm64"
              : target === "linux-x64"
                ? "linux-x64"
                : target === "darwin-arm64"
                  ? "darwin-arm64"
                  : target === "darwin-x64"
                    ? "darwin-x64"
                    : null;

      if (targetPlatform) {
        for (const dir of platformDirs) {
          const dirPath = path.join(esbuildDir, dir);
          if (
            fs.existsSync(dirPath) &&
            fs.statSync(dirPath).isDirectory() &&
            dir !== targetPlatform
          ) {
            console.log(`[hbuilderx] 删除错误平台的esbuild: ${dir}`);
            fs.rmSync(dirPath, { recursive: true, force: true });
          }
        }
      }
    }

    // 清理错误平台的LanceDB文件
    const lancedbDir = path.join(dstNodeModules, "@lancedb");
    if (fs.existsSync(lancedbDir)) {
      const vectordbFiles = fs
        .readdirSync(lancedbDir)
        .filter((f) => f.startsWith("vectordb-"));
      const targetFile =
        target === "win32-x64"
          ? "vectordb-win32-x64-msvc"
          : target === "win32-arm64"
            ? "vectordb-win32-x64-msvc" // fallback to x64
            : target === "linux-x64"
              ? "vectordb-linux-x64-gnu"
              : target === "linux-arm64"
                ? "vectordb-linux-aarch64-gnu"
                : target === "darwin-x64"
                  ? "vectordb-darwin-x64"
                  : target === "darwin-arm64"
                    ? "vectordb-darwin-arm64"
                    : null;

      if (targetFile) {
        for (const file of vectordbFiles) {
          const filePath = path.join(lancedbDir, file);
          if (
            fs.existsSync(filePath) &&
            fs.statSync(filePath).isDirectory() &&
            file !== targetFile
          ) {
            console.log(`[hbuilderx] 删除错误平台的lancedb: ${file}`);
            fs.rmSync(filePath, { recursive: true, force: true });
          }
        }
      }
    }
  } else {
    console.log(
      "[hbuilderx] 跨平台打包模式：保留所有平台的 esbuild 和 lancedb 二进制文件",
    );
  }

  console.log("[hbuilderx] ✅ node_modules 复制和清理完成");
}

// async function downloadEsbuildBinary(isGhAction, isArm, target) {
//   process.chdir(path.join(continueDir, "extensions", "hbuilderx"));
//   ...
// }

async function downloadEsbuildBinary(target) {
  console.log("[hbuilderx] Downloading pre-built esbuild binary");
  rimrafSync("out/node_modules/@esbuild");
  fs.mkdirSync(`out/node_modules/@esbuild/${target}/bin`, { recursive: true });
  fs.mkdirSync(`out/tmp`, { recursive: true });
  const downloadUrl = {
    "darwin-arm64":
      "https://registry.npmjs.org/@esbuild/darwin-arm64/-/darwin-arm64-0.17.19.tgz",
    "linux-arm64":
      "https://registry.npmjs.org/@esbuild/linux-arm64/-/linux-arm64-0.17.19.tgz",
    "win32-arm64":
      "https://registry.npmjs.org/@esbuild/win32-arm64/-/win32-arm64-0.17.19.tgz",
    "linux-x64":
      "https://registry.npmjs.org/@esbuild/linux-x64/-/linux-x64-0.17.19.tgz",
    "darwin-x64":
      "https://registry.npmjs.org/@esbuild/darwin-x64/-/darwin-x64-0.17.19.tgz",
    "win32-x64":
      "https://registry.npmjs.org/@esbuild/win32-x64/-/win32-x64-0.17.19.tgz",
  }[target];
  execCmdSync(`curl -L -o out/tmp/esbuild.tgz ${downloadUrl}`);
  execCmdSync("cd out/tmp && tar -xvzf esbuild.tgz");
  // Copy the installed package back to the current directory
  let tmpPath = "out/tmp/package/bin";
  let outPath = `out/node_modules/@esbuild/${target}/bin`;
  if (target.startsWith("win")) {
    tmpPath = "out/tmp/package";
    outPath = `out/node_modules/@esbuild/${target}`;
  }

  await new Promise((resolve, reject) => {
    ncp(
      path.join(tmpPath),
      path.join(outPath),
      { dereference: true },
      (error) => {
        if (error) {
          console.error(`[hbuilderx] Error copying esbuild package`, error);
          reject(error);
        } else {
          resolve();
        }
      },
    );
  });
  rimrafSync("out/tmp");
}

async function downloadSqliteBinary(target) {
  console.log(`[hbuilderx] Preparing sqlite3 binary for ${target}`);

  // 验证目标平台
  if (!target) {
    throw new Error("[hbuilderx] 目标平台未指定");
  }

  const supportedTargets = [
    "darwin-arm64",
    "linux-arm64",
    "win32-arm64",
    "linux-x64",
    "darwin-x64",
    "win32-x64",
  ];
  if (!supportedTargets.includes(target)) {
    throw new Error(
      `[hbuilderx] 不支持的目标平台: ${target}. 支持的平台: ${supportedTargets.join(", ")}`,
    );
  }

  // win32-arm64使用win32-x64的sqlite3作为fallback（官方没有arm64版本）
  const actualTarget = target === "win32-arm64" ? "win32-x64" : target;

  rimrafSync("../../core/node_modules/sqlite3/build");

  // 1) 优先使用本地缓存的 tar.gz 包
  const localBaseDir =
    process.env.CONTINUE_SQLITE3_LOCAL_DIR || "/Users/legend/Downloads/sqlite3";
  const localFileNameMap = {
    "darwin-arm64": "sqlite3-v5.1.7-napi-v6-darwin-arm64.tar.gz",
    "linux-arm64": "sqlite3-v5.1.7-napi-v3-linux-arm64.tar.gz",
    "win32-arm64": "sqlite3-v5.1.7-napi-v6-win32-arm64.tar.gz",
    "linux-x64": "sqlite3-v5.1.7-napi-v3-linux-x64.tar.gz",
    "darwin-x64": "sqlite3-v5.1.7-napi-v6-darwin-x64.tar.gz",
    "win32-x64": "sqlite3-v5.1.7-napi-v3-win32-x64.tar.gz",
  };
  const localCandidate = path.join(
    localBaseDir,
    localFileNameMap[actualTarget] || "",
  );

  if (target === "win32-arm64") {
    console.log(
      `[hbuilderx] 注意: win32-arm64使用win32-x64的sqlite3二进制（官方无arm64版本）`,
    );
  }

  const destTarPath = "../../core/node_modules/sqlite3/build.tar.gz";

  let usedLocal = false;
  try {
    if (fs.existsSync(localCandidate)) {
      console.log(`[hbuilderx] Using local sqlite3 binary: ${localCandidate}`);
      const stats = fs.statSync(localCandidate);
      console.log(
        `[hbuilderx] 本地文件大小: ${(stats.size / 1024 / 1024).toFixed(1)} MB`,
      );
      fs.copyFileSync(localCandidate, destTarPath);
      usedLocal = true;
    } else {
      console.log(
        "[hbuilderx] Local sqlite3 binary not found, will download from remote",
      );
    }
  } catch (e) {
    console.warn(
      "[hbuilderx] Error while checking/copying local sqlite3 binary",
      e,
    );
  }

  // 2) 如果本地不存在则回退到下载
  if (!usedLocal) {
    console.log(
      `[hbuilderx] Downloading pre-built sqlite3 binary for ${target}`,
    );
    const downloadUrl = {
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
    }[actualTarget];

    if (!downloadUrl) {
      throw new Error(
        `[hbuilderx] 未找到目标平台 ${actualTarget} 的SQLite3下载URL`,
      );
    }

    try {
      execCmdSync(
        `curl -L --fail --retry 5 --retry-all-errors --connect-timeout 30 -o ${destTarPath} ${downloadUrl} || curl -L --http1.1 --fail --retry 5 --retry-all-errors --connect-timeout 30 -o ${destTarPath} ${downloadUrl}`,
      );

      // 验证下载的文件
      if (!fs.existsSync(destTarPath)) {
        throw new Error(`[hbuilderx] SQLite3下载失败: ${destTarPath} 不存在`);
      }

      const downloadStats = fs.statSync(destTarPath);
      console.log(
        `[hbuilderx] 下载完成，文件大小: ${(downloadStats.size / 1024 / 1024).toFixed(1)} MB`,
      );
    } catch (downloadError) {
      throw new Error(`[hbuilderx] SQLite3下载失败: ${downloadError.message}`);
    }
  }

  // 3) 解压并验证
  try {
    execCmdSync("cd ../../core/node_modules/sqlite3 && tar -xvzf build.tar.gz");

    // 验证解压结果
    const extractedNodePath =
      "../../core/node_modules/sqlite3/build/Release/node_sqlite3.node";
    if (!fs.existsSync(extractedNodePath)) {
      throw new Error(
        `[hbuilderx] SQLite3解压后验证失败: ${extractedNodePath} 不存在`,
      );
    }

    console.log(`[hbuilderx] ✅ SQLite3 (${target}) 准备完成`);
    fs.unlinkSync(destTarPath);
  } catch (extractError) {
    throw new Error(`[hbuilderx] SQLite3解压失败: ${extractError.message}`);
  }
}

// 下载所有平台的sqlite3二进制文件（HBuilderX跨平台打包需要）
async function downloadAllPlatformsSqlite3() {
  console.log("[hbuilderx] 开始下载所有平台的SQLite3二进制文件...");

  // 只支持三个主流平台：macOS (ARM64/Intel) 和 Windows x64
  const platforms = ["darwin-arm64", "darwin-x64", "win32-x64"];

  const localBaseDir =
    process.env.CONTINUE_SQLITE3_LOCAL_DIR || "/Users/legend/Downloads/sqlite3";
  const cacheDir = path.join(__dirname, "../.sqlite3-cache");

  // 创建缓存目录
  if (!fs.existsSync(cacheDir)) {
    fs.mkdirSync(cacheDir, { recursive: true });
  }

  const downloadedFiles = {};

  for (const target of platforms) {
    console.log(`[hbuilderx] 处理平台: ${target}`);
    const actualTarget = target === "win32-arm64" ? "win32-x64" : target;

    const localFileNameMap = {
      "darwin-arm64": "sqlite3-v5.1.7-napi-v6-darwin-arm64.tar.gz",
      "linux-arm64": "sqlite3-v5.1.7-napi-v3-linux-arm64.tar.gz",
      "win32-arm64": "sqlite3-v5.1.7-napi-v6-win32-arm64.tar.gz",
      "linux-x64": "sqlite3-v5.1.7-napi-v3-linux-x64.tar.gz",
      "darwin-x64": "sqlite3-v5.1.7-napi-v6-darwin-x64.tar.gz",
      "win32-x64": "sqlite3-v5.1.7-napi-v3-win32-x64.tar.gz",
    };

    const fileName = localFileNameMap[actualTarget];
    const cachedFile = path.join(cacheDir, `${target}.tar.gz`);

    // 优先使用本地文件
    const localCandidate = path.join(localBaseDir, fileName);
    if (fs.existsSync(localCandidate)) {
      console.log(`[hbuilderx] 使用本地文件: ${localCandidate}`);
      fs.copyFileSync(localCandidate, cachedFile);
      downloadedFiles[target] = cachedFile;
      continue;
    }

    // 从GitHub下载
    const downloadUrl = {
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
    }[actualTarget];

    try {
      console.log(`[hbuilderx] 下载 ${target} SQLite3...`);
      execCmdSync(
        `curl -L --fail --retry 3 --connect-timeout 30 -o ${cachedFile} ${downloadUrl}`,
      );
      downloadedFiles[target] = cachedFile;
      console.log(`[hbuilderx] ✅ ${target} 下载完成`);
    } catch (error) {
      console.error(`[hbuilderx] ❌ ${target} 下载失败:`, error.message);
      throw error;
    }
  }

  return downloadedFiles;
}

async function copySqliteBinary(isAllPlatforms = false, targetPlatform = null) {
  process.chdir(path.join(continueDir, "extensions", "hbuilderx"));
  console.log("[hbuilderx] Copying sqlite node binding from core");

  if (isAllPlatforms) {
    // HBuilderX跨平台模式：复制所有平台的sqlite3二进制
    console.log("[hbuilderx] 跨平台模式：准备所有平台的SQLite3二进制文件");

    const cacheDir = path.join(__dirname, "../.sqlite3-cache");
    const platforms = ["darwin-arm64", "darwin-x64", "win32-x64"];
  } else if (targetPlatform === "darwin" || targetPlatform === "win32") {
    // 单平台模式：仅复制指定平台的sqlite3二进制
    console.log(
      `[hbuilderx] 单平台模式：准备${targetPlatform}平台的SQLite3二进制文件`,
    );

    const cacheDir = path.join(__dirname, "../.sqlite3-cache");
    const platforms =
      targetPlatform === "darwin" ? ["darwin-arm64"] : ["win32-x64"];

    // 创建目标目录结构
    const outDir = path.join(__dirname, "../out/sqlite3-binaries");
    if (!fs.existsSync(outDir)) {
      fs.mkdirSync(outDir, { recursive: true });
    }

    for (const target of platforms) {
      const cachedFile = path.join(cacheDir, `${target}.tar.gz`);
      if (!fs.existsSync(cachedFile)) {
        throw new Error(`[hbuilderx] 缺少 ${target} 的SQLite3二进制文件`);
      }

      // 解压到临时目录
      const tempDir = path.join(outDir, target);
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }

      try {
        // 复制tar文件到临时目录
        const tempTar = path.join(tempDir, "build.tar.gz");
        fs.copyFileSync(cachedFile, tempTar);

        // 解压
        execCmdSync(`cd ${tempDir} && tar -xzf build.tar.gz`);
        fs.unlinkSync(tempTar);

        // 验证
        const nodeFile = path.join(tempDir, "build/Release/node_sqlite3.node");
        if (fs.existsSync(nodeFile)) {
          console.log(`[hbuilderx] ✅ ${target} SQLite3 二进制解压成功`);
        } else {
          throw new Error(`[hbuilderx] ${target} SQLite3 二进制验证失败`);
        }
      } catch (error) {
        console.error(`[hbuilderx] ❌ ${target} 处理失败:`, error.message);
        throw error;
      }
    }

    // 将目标平台的SQLite3二进制复制到标准位置
    // 注意：这里应该复制目标打包平台（platforms[0]），而不是当前运行平台
    const targetBuildPlatform = platforms[0]; // 取第一个平台（darwin-arm64 或 win32-x64）
    const targetBinary = path.join(outDir, targetBuildPlatform, "build");

    if (fs.existsSync(targetBinary)) {
      // 复制到 out/build（用于本地开发测试）
      const targetPath = path.join(__dirname, "../out/build");
      await new Promise((resolve, reject) => {
        ncp(targetBinary, targetPath, { dereference: true }, (error) => {
          if (error) {
            reject(error);
          } else {
            console.log(
              `[hbuilderx] ✅ ${targetBuildPlatform} SQLite3二进制复制到out/build`,
            );
            resolve();
          }
        });
      });
    }

    // 【关键】将目标平台的二进制文件复制到 out/node_modules/sqlite3/build/Release/
    // 用途：
    // 1. npm install会安装sqlite3包，但不会包含预编译的.node文件
    // 2. 运行时需要从这里加载对应平台的二进制文件
    // 3. 跨平台运行时，preloadSqlite3Module() 会检测并替换成正确平台的二进制
    console.log(
      `[hbuilderx] 复制${targetBuildPlatform} SQLite3二进制到 out/node_modules/sqlite3/build/Release/`,
    );
    const sqlite3ModuleBuildDir = path.join(
      __dirname,
      "../out/node_modules/sqlite3/build/Release",
    );
    fs.mkdirSync(sqlite3ModuleBuildDir, { recursive: true });

    const sourceBinary = path.join(targetBinary, "Release/node_sqlite3.node");
    const targetNodeFile = path.join(
      sqlite3ModuleBuildDir,
      "node_sqlite3.node",
    );

    if (fs.existsSync(sourceBinary)) {
      fs.copyFileSync(sourceBinary, targetNodeFile);
      console.log(
        `[hbuilderx] ✅ 复制完成: ${targetNodeFile} (${(fs.statSync(targetNodeFile).size / 1024).toFixed(1)} KB)`,
      );
    } else {
      console.warn(
        `[hbuilderx] ⚠️  目标平台 ${targetBuildPlatform} 的二进制文件不存在: ${sourceBinary}`,
      );
    }

    return;
  }

  // 单平台模式：原有逻辑
  const sourcePath = path.join(
    __dirname,
    "../../../core/node_modules/sqlite3/build",
  );
  const targetPath1 = path.join(__dirname, "../out/build");
  const targetPath2 = path.join(__dirname, "../out"); // 额外的拷贝位置，参考VSCode实现

  // 验证源路径存在
  if (!fs.existsSync(sourcePath)) {
    throw new Error(`[hbuilderx] SQLite3 源路径不存在: ${sourcePath}`);
  }

  // 检查关键的sqlite3文件
  const sqlite3NodePath = path.join(sourcePath, "Release/node_sqlite3.node");
  if (!fs.existsSync(sqlite3NodePath)) {
    throw new Error(`[hbuilderx] 关键文件缺失: ${sqlite3NodePath}`);
  }

  const stats = fs.statSync(sqlite3NodePath);
  console.log(
    `[hbuilderx] SQLite3 二进制大小: ${(stats.size / 1024).toFixed(1)} KB`,
  );

  // 第一次拷贝：复制到 out/build/ 目录（用于验证文件）
  await new Promise((resolve, reject) => {
    ncp(sourcePath, targetPath1, { dereference: true }, (error) => {
      if (error) {
        console.warn(
          "[hbuilderx] Error copying sqlite3 files to out/build",
          error,
        );
        reject(error);
      } else {
        // 验证拷贝结果
        const copiedSqlite3 = path.join(
          targetPath1,
          "Release/node_sqlite3.node",
        );
        if (fs.existsSync(copiedSqlite3)) {
          console.log("[hbuilderx] ✅ SQLite3 拷贝到 out/build 成功");
          resolve();
        } else {
          reject(new Error("[hbuilderx] SQLite3 拷贝到 out/build 验证失败"));
        }
      }
    });
  });

  // 第二次拷贝：复制到 out/ 目录（用于HBuilderX运行时解析，参考VSCode实现）
  await new Promise((resolve, reject) => {
    ncp(sourcePath, targetPath2, { dereference: true }, (error) => {
      if (error) {
        console.warn("[hbuilderx] Error copying sqlite3 files to out/", error);
        reject(error);
      } else {
        // 验证拷贝结果
        const copiedSqlite3 = path.join(
          targetPath2,
          "Release/node_sqlite3.node",
        );
        if (fs.existsSync(copiedSqlite3)) {
          console.log("[hbuilderx] ✅ SQLite3 拷贝到 out/ 成功");
          resolve();
        } else {
          reject(new Error("[hbuilderx] SQLite3 拷贝到 out/ 验证失败"));
        }
      }
    });
  });
}

async function downloadRipgrepBinary(target) {
  console.log("[hbuilderx] Preparing ripgrep binary");
  rimrafSync("node_modules/@vscode/ripgrep/bin");
  fs.mkdirSync("node_modules/@vscode/ripgrep/bin", { recursive: true });

  const localBaseDir =
    process.env.CONTINUE_RIPGREP_LOCAL_DIR || "/Users/legend/Downloads/ripgrep";
  const localFileNameMap = {
    "darwin-arm64": "ripgrep-v13.0.0-10-aarch64-apple-darwin.tar.gz",
    "linux-arm64": "ripgrep-v13.0.0-10-aarch64-unknown-linux-gnu.tar.gz",
    "win32-arm64": "ripgrep-v13.0.0-10-aarch64-pc-windows-msvc.zip",
    "linux-x64": "ripgrep-v13.0.0-10-x86_64-unknown-linux-musl.tar.gz",
    "darwin-x64": "ripgrep-v13.0.0-10-x86_64-apple-darwin.tar.gz",
    "win32-x64": "ripgrep-v13.0.0-10-x86_64-pc-windows-msvc.zip",
  };

  const downloadUrl = {
    "darwin-arm64":
      "https://github.com/microsoft/ripgrep-prebuilt/releases/download/v13.0.0-10/ripgrep-v13.0.0-10-aarch64-apple-darwin.tar.gz",
    "linux-arm64":
      "https://github.com/microsoft/ripgrep-prebuilt/releases/download/v13.0.0-10/ripgrep-v13.0.0-10-aarch64-unknown-linux-gnu.tar.gz",
    "win32-arm64":
      "https://github.com/microsoft/ripgrep-prebuilt/releases/download/v13.0.0-10/ripgrep-v13.0.0-10-aarch64-pc-windows-msvc.zip",
    "linux-x64":
      "https://github.com/microsoft/ripgrep-prebuilt/releases/download/v13.0.0-10/ripgrep-v13.0.0-10-x86_64-unknown-linux-musl.tar.gz",
    "darwin-x64":
      "https://github.com/microsoft/ripgrep-prebuilt/releases/download/v13.0.0-10/ripgrep-v13.0.0-10-x86_64-apple-darwin.tar.gz",
    "win32-x64":
      "https://github.com/microsoft/ripgrep-prebuilt/releases/download/v13.0.0-10/ripgrep-v13.0.0-10-x86_64-pc-windows-msvc.zip",
  }[target];

  const localCandidate = path.join(
    localBaseDir,
    localFileNameMap[target] || "",
  );
  const isWindows = target.startsWith("win");
  const destPath = isWindows
    ? "node_modules/@vscode/ripgrep/bin/build.zip"
    : "node_modules/@vscode/ripgrep/bin/build.tar.gz";

  let usedLocal = false;
  try {
    if (fs.existsSync(localCandidate)) {
      console.log(`[hbuilderx] Using local ripgrep binary: ${localCandidate}`);
      fs.copyFileSync(localCandidate, destPath);
      usedLocal = true;
    } else {
      console.log(
        "[hbuilderx] Local ripgrep binary not found, will download from remote",
      );
    }
  } catch (e) {
    console.warn(
      "[hbuilderx] Error while checking/copying local ripgrep binary",
      e,
    );
  }

  if (!usedLocal) {
    console.log("[hbuilderx] Downloading pre-built ripgrep binary");
    if (isWindows) {
      execCmdSync(
        `curl -L --fail --retry 5 --retry-all-errors --connect-timeout 30 -o ${destPath} ${downloadUrl} || curl -L --http1.1 --fail --retry 5 --retry-all-errors --connect-timeout 30 -o ${destPath} ${downloadUrl}`,
      );
    } else {
      execCmdSync(
        `curl -L --fail --retry 5 --retry-all-errors --connect-timeout 30 -o ${destPath} ${downloadUrl} || curl -L --http1.1 --fail --retry 5 --retry-all-errors --connect-timeout 30 -o ${destPath} ${downloadUrl}`,
      );
    }
  }

  if (isWindows) {
    execCmdSync("cd node_modules/@vscode/ripgrep/bin && unzip build.zip");
    fs.unlinkSync("node_modules/@vscode/ripgrep/bin/build.zip");
  } else {
    execCmdSync(
      "cd node_modules/@vscode/ripgrep/bin && tar -xvzf build.tar.gz",
    );
    fs.unlinkSync("node_modules/@vscode/ripgrep/bin/build.tar.gz");
  }
}

// We can't simply touch one of our files to trigger a rebuild, because
// esbuild doesn't always use modifications times to detect changes -
// for example, if it finds a file changed within the last 3 seconds,
// it will fall back to full-contents-comparison for that file
//
// So to facilitate development workflows, we always include a timestamp string
// in the build
function writeBuildTimestamp() {
  fs.writeFileSync(
    path.join(continueDir, "extensions/hbuilderx", "src/.buildTimestamp.ts"),
    `export default "${new Date().toISOString()}";\n`,
  );
}

async function installNodeModuleInTempDirAndCopyToCurrent(packageName, toCopy) {
  console.log(`[hbuilderx] Copying ${packageName} to ${toCopy}`);
  const adjustedName = packageName.replace(/@/g, "").replace("/", "-");

  const tempDir = `/tmp/continue-node_modules-${adjustedName}`;
  const currentDir = process.cwd();

  // 对于 scope 包（如 @lancedb），不要删除整个父目录，只删除对应的子包
  // 这样可以保留之前下载的其他平台的包
  if (!toCopy.startsWith("@")) {
    // 非 scope 包，可以安全删除
    rimrafSync(`node_modules/${toCopy}`);
  } else {
    // scope 包，确保父目录存在但不删除
    const scopeDir = path.join(currentDir, "node_modules", toCopy);
    fs.mkdirSync(scopeDir, { recursive: true });
  }

  // Ensure the temporary directory exists
  fs.mkdirSync(tempDir, { recursive: true });

  try {
    // Move to the temporary directory
    process.chdir(tempDir);

    // 检查本地缓存
    const cacheDir =
      process.env.CONTINUE_LANCEDB_CACHE_DIR ||
      path.join(require("os").homedir(), "Downloads", "lancedb-cache");
    const cachedPackage = path.join(cacheDir, `${adjustedName}.tgz`);

    let usedCache = false;

    if (fs.existsSync(cachedPackage)) {
      console.log(`[hbuilderx] 使用本地缓存: ${cachedPackage}`);
      try {
        // 初始化 package.json
        execCmdSync("npm init -y");

        // 从本地缓存安装
        execCmdSync(`npm install --force "${cachedPackage}" --no-save`);
        usedCache = true;
        console.log(`[hbuilderx] ✓ 已从缓存安装 ${packageName}`);
      } catch (error) {
        console.warn(
          `[hbuilderx] 从缓存安装失败，将从npm下载: ${error.message}`,
        );
        usedCache = false;
      }
    }

    // 如果缓存不存在或安装失败，从npm下载
    if (!usedCache) {
      console.log(`[hbuilderx] 从npm下载: ${packageName}`);
      execCmdSync(`npm init -y && npm i -f ${packageName} --no-save`);
    }

    console.log(
      `[hbuilderx] Contents of: ${packageName}`,
      fs.readdirSync(path.join(tempDir, "node_modules", toCopy)),
    );

    // Wait briefly to ensure files are flushed
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Copy the installed package back to the current directory
    // 对于 @lancedb 这样的 scope 包，需要确保不覆盖已有的子包
    const srcPath = path.join(tempDir, "node_modules", toCopy);
    const dstPath = path.join(currentDir, "node_modules", toCopy);

    // 如果是 scope 包（如 @lancedb），则逐个复制子目录以避免覆盖
    if (toCopy.startsWith("@")) {
      const subDirs = fs.readdirSync(srcPath);
      for (const subDir of subDirs) {
        const srcSubPath = path.join(srcPath, subDir);
        const dstSubPath = path.join(dstPath, subDir);

        // 确保目标父目录存在
        fs.mkdirSync(dstPath, { recursive: true });

        await new Promise((resolve, reject) => {
          ncp(srcSubPath, dstSubPath, { dereference: true }, (error) => {
            if (error) {
              console.error(
                `[hbuilderx] Error copying ${packageName}/${subDir}`,
                error,
              );
              reject(error);
            } else {
              console.log(`[hbuilderx] Copied ${packageName}/${subDir}`);
              resolve();
            }
          });
        });
      }
    } else {
      // 非 scope 包，直接复制
      await new Promise((resolve, reject) => {
        ncp(srcPath, dstPath, { dereference: true }, (error) => {
          if (error) {
            console.error(
              `[hbuilderx] Error copying ${packageName} package`,
              error,
            );
            reject(error);
          } else {
            resolve();
          }
        });
      });
    }
  } finally {
    // Return to the original directory
    process.chdir(currentDir);
  }
}

async function copyScripts() {
  process.chdir(path.join(continueDir, "extensions", "hbuilderx"));
  console.log("[hbuilderx] Copying scripts from core");
  fs.copyFileSync(
    path.join(__dirname, "../../../core/util/start_ollama.sh"),
    path.join(__dirname, "../out/start_ollama.sh"),
  );
  console.log("[hbuilderx] Copied script files");
}

async function copyModels() {
  // Copy models used for embeddings from VSCode extension into HBuilderX
  const src = path.join(continueDir, "extensions", "vscode", "models");
  const dst = path.join(continueDir, "extensions", "hbuilderx", "models");
  if (!fs.existsSync(src)) {
    console.log("[hbuilderx] Skip copying models: source not found");
    return;
  }
  fs.mkdirSync(dst, { recursive: true });
  await new Promise((resolve, reject) => {
    ncp(src, dst, { dereference: true }, (error) => {
      if (error) {
        console.warn("[hbuilderx] Error copying models", error);
        reject(error);
      } else {
        console.log("[hbuilderx] Copied models to HBuilderX extension");
        resolve();
      }
    });
  });
}

async function copySupportAssets() {
  const vscodeDir = path.join(continueDir, "extensions", "vscode");
  const hbxDir = path.join(continueDir, "extensions", "hbuilderx");

  // Copy media folder
  const srcMedia = path.join(vscodeDir, "media");
  const dstMedia = path.join(hbxDir, "media");
  if (fs.existsSync(srcMedia)) {
    await new Promise((resolve, reject) => {
      ncp(srcMedia, dstMedia, { dereference: true }, (error) => {
        if (error) {
          console.warn("[hbuilderx] Error copying media assets", error);
          reject(error);
        } else {
          console.log("[hbuilderx] Copied media assets");
          resolve();
        }
      });
    });
  } else {
    console.log("[hbuilderx] Skip copying media: source not found");
  }

  // Copy continue_tutorial.py
  const srcTutor = path.join(vscodeDir, "continue_tutorial.py");
  const dstTutor = path.join(hbxDir, "continue_tutorial.py");
  if (fs.existsSync(srcTutor)) {
    fs.copyFileSync(srcTutor, dstTutor);
    console.log("[hbuilderx] Copied continue_tutorial.py");
  } else {
    console.log(
      "[hbuilderx] Skip copying continue_tutorial.py: source not found",
    );
  }
}

module.exports = {
  continueDir,
  buildGui,
  copyOnnxRuntimeFromNodeModules,
  copyTreeSitterWasms,
  copyTreeSitterTagQryFiles,
  copyNodeModules,
  downloadEsbuildBinary,
  copySqliteBinary,
  downloadAllPlatformsSqlite3,
  installNodeModuleInTempDirAndCopyToCurrent,
  downloadSqliteBinary,
  downloadRipgrepBinary,
  copyTokenizers,
  copyScripts,
  writeBuildTimestamp,
  copyConfigSchema,
  installNodeModules,
  copyModels,
  copySupportAssets,
};
