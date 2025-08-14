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

async function buildGui(isGhAction) {
  // Make sure we are in the right directory
  if (!process.cwd().endsWith("gui")) {
    process.chdir(path.join(continueDir, "gui"));
  }
  if (isGhAction) {
    execCmdSync("npm run build");
  }

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
  const hbuilderxGuiPath = path.join("../extensions/hbuilderx/gui");
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
  if (!fs.existsSync(path.join("dist", "assets", "index.css"))) {
    throw new Error("gui build did not produce index.css");
  }
}

async function copyOnnxRuntimeFromNodeModules(target) {
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
  if (target) {
    // If building for production, only need the binaries for current platform
    try {
      if (!target.startsWith("darwin")) {
        rimrafSync(path.join(__dirname, "../bin/napi-v3/darwin"));
      }
      if (!target.startsWith("linux")) {
        rimrafSync(path.join(__dirname, "../bin/napi-v3/linux"));
      }
      if (!target.startsWith("win")) {
        rimrafSync(path.join(__dirname, "../bin/napi-v3/win32"));
      }

      // Also don't want to include cuda/shared/tensorrt binaries, they are too large
      if (target.startsWith("linux")) {
        const filesToRemove = [
          "libonnxruntime_providers_cuda.so",
          "libonnxruntime_providers_shared.so",
          "libonnxruntime_providers_tensorrt.so",
        ];
        filesToRemove.forEach((file) => {
          const filepath = path.join(
            __dirname,
            "../bin/napi-v3/linux/x64",
            file,
          );
          if (fs.existsSync(filepath)) {
            fs.rmSync(filepath);
          }
        });
      }
    } catch (e) {
      console.warn("[hbuilderx] Error removing unused binaries", e);
    }
  }
  console.log("[hbuilderx] Copied onnxruntime-node");
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
  // Copy node_modules for pre-built binaries
  process.chdir(path.join(continueDir, "extensions", "hbuilderx"));

  const NODE_MODULES_TO_COPY = [
    "esbuild",
    "@esbuild",
    "@lancedb",
    "@vscode/ripgrep",
    "workerpool",
  ];
  fs.mkdirSync("out/node_modules", { recursive: true });

  await Promise.all(
    NODE_MODULES_TO_COPY.map(
      (mod) =>
        new Promise((resolve, reject) => {
          const srcDir = path.join("node_modules", mod);
          const dstDir = path.join("out", "node_modules", mod);
          fs.mkdirSync(dstDir, { recursive: true });

          if (!fs.existsSync(srcDir)) {
            console.log(`[hbuilderx] Skip copying missing module: ${mod}`);
            resolve();
            return;
          }

          ncp(srcDir, dstDir, { dereference: true }, function (error) {
            if (error) {
              console.error(`[hbuilderx] Error copying ${mod}`, error);
              reject(error);
            } else {
              console.log(`[hbuilderx] Copied ${mod}`);
              resolve();
            }
          });
        }),
    ),
  );

  // delete esbuild/bin because platform-specific @esbuild is downloaded
  fs.rmSync(`out/node_modules/esbuild/bin`, { recursive: true, force: true });

  // 清理错误平台的@esbuild文件，只保留目标平台
  const esbuildDir = `out/node_modules/@esbuild`;
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
        if (
          dir !== targetPlatform &&
          fs.statSync(path.join(esbuildDir, dir)).isDirectory()
        ) {
          console.log(`[hbuilderx] 删除错误平台的esbuild: ${dir}`);
          fs.rmSync(path.join(esbuildDir, dir), {
            recursive: true,
            force: true,
          });
        }
      }
    }
  }

  // 清理错误平台的LanceDB文件
  const lancedbDir = `out/node_modules/@lancedb`;
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
        if (file !== targetFile) {
          console.log(`[hbuilderx] 删除错误平台的lancedb: ${file}`);
          fs.rmSync(path.join(lancedbDir, file), {
            recursive: true,
            force: true,
          });
        }
      }
    }
  }

  // 清理错误平台的ONNX Runtime文件（已有逻辑会处理）

  console.log(`[hbuilderx] Copied ${NODE_MODULES_TO_COPY.join(", ")}`);
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

async function copySqliteBinary() {
  process.chdir(path.join(continueDir, "extensions", "hbuilderx"));
  console.log("[hbuilderx] Copying sqlite node binding from core");

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
  console.log(`{[hbuilderx]} Copying ${packageName} to ${toCopy}`);
  const adjustedName = packageName.replace(/@/g, "").replace("/", "-");

  const tempDir = `/tmp/continue-node_modules-${adjustedName}`;
  const currentDir = process.cwd();

  // Remove the dir we will be copying to
  rimrafSync(`node_modules/${toCopy}`);

  // Ensure the temporary directory exists
  fs.mkdirSync(tempDir, { recursive: true });

  try {
    // Move to the temporary directory
    process.chdir(tempDir);

    // Initialize a new package.json and install the package
    execCmdSync(`npm init -y && npm i -f ${packageName} --no-save`);

    console.log(
      `[hbuilderx] Contents of: ${packageName}`,
      fs.readdirSync(path.join(tempDir, "node_modules", toCopy)),
    );

    // Wait briefly to ensure files are flushed
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Copy the installed package back to the current directory
    await new Promise((resolve, reject) => {
      ncp(
        path.join(tempDir, "node_modules", toCopy),
        path.join(currentDir, "node_modules", toCopy),
        { dereference: true },
        (error) => {
          if (error) {
            console.error(
              `[hbuilderx] Error copying ${packageName} package`,
              error,
            );
            reject(error);
          } else {
            resolve();
          }
        },
      );
    });
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
