import type {
  ContinueRcJson,
  FileStatsMap,
  FileType,
  IDE,
  IdeInfo,
  IdeSettings,
  IndexTag,
  Location,
  Problem,
  Range,
  RangeInFile,
  SignatureHelp,
  TerminalOptions,
  Thread,
  ToastType,
} from "core";
import * as child_process from "node:child_process";
import { exec } from "node:child_process";

import * as URI from "uri-js";
import { Repository } from "./otherExtensions/git";
import { SecretStorage } from "./stubs/SecretStorage";
import { NodeFileType } from "./util/fsUtil";
import { openEditorAndRevealRange } from "./util/hbuilderx";
import { HbuilderXIdeUtils } from "./util/ideUtils";
import { getExtensionVersion } from "./util/util";
import { HbuilderXWebviewProtocol } from "./webviewProtocol";

const hx = require("hbuilderx");
const EXTENSION_NAME = "continue";

class HbuilderXIde implements IDE {
  ideUtils: HbuilderXIdeUtils;
  secretStorage: SecretStorage;

  constructor(
    private readonly hbuilderXWebviewProtocolPromise: Promise<HbuilderXWebviewProtocol>,
    private readonly context: any,
  ) {
    this.ideUtils = new HbuilderXIdeUtils();
    this.secretStorage = new SecretStorage(context);
  }
  gotoTypeDefinition(location: Location): Promise<RangeInFile[]> {
    throw new Error("Method not implemented.");
  }
  getSignatureHelp(location: Location): Promise<SignatureHelp | null> {
    throw new Error("Method not implemented.");
  }

  getIdeInfo(): Promise<IdeInfo> {
    return Promise.resolve({
      ideType: "hbuilderx",
      name: hx.env.appName,
      version: hx.env.appVersion,
      remoteName: "local",
      extensionVersion: getExtensionVersion(),
      isPrerelease: false,
    });
  }

  getIdeSettings(): Promise<IdeSettings> {
    return Promise.resolve(this.getIdeSettingsSync());
  }

  isWorkspaceRemote(): Promise<boolean> {
    return Promise.resolve(false);
  }

  getDiff(includeUnstaged: boolean): Promise<string[]> {
    console.log(
      "[hbuilderx] getDiff 方法未实现, includeUnstaged:",
      includeUnstaged,
    );
    throw new Error("getDiff 方法未实现");
  }

  getClipboardContent(): Promise<{ text: string; copiedAt: string }> {
    return hx.env.clipboard
      .readText()
      .then((text: string) => {
        return { text, copiedAt: new Date().toISOString() };
      })
      .catch((error: any) => {
        console.error("[hbuilderx] getClipboardContent error:", error);
        return { text: "", copiedAt: "" };
      });
  }

  async isTelemetryEnabled(): Promise<boolean> {
    const continueEnabled: boolean =
      (await hx.workspace
        .getConfiguration(EXTENSION_NAME)
        .get("telemetryEnabled")) ?? true;
    return continueEnabled;
  }

  getUniqueId(): Promise<string> {
    return Promise.resolve(this.ideUtils.getUniqueId());
  }

  getTerminalContents(): Promise<string> {
    console.log("[hbuilderx] getTerminalContents 方法未实现");
    throw new Error("getTerminalContents 方法未实现");
  }

  getDebugLocals(threadIndex: number): Promise<string> {
    console.log(
      "[hbuilderx] getDebugLocals 方法未实现, threadIndex:",
      threadIndex,
    );
    throw new Error("getDebugLocals 方法未实现");
  }

  getTopLevelCallStackSources(
    threadIndex: number,
    stackDepth: number,
  ): Promise<string[]> {
    console.log(
      "[hbuilderx] getTopLevelCallStackSources 方法未实现, threadIndex:",
      threadIndex,
      "stackDepth:",
      stackDepth,
    );
    throw new Error("getTopLevelCallStackSources 方法未实现");
  }

  getAvailableThreads(): Promise<Thread[]> {
    console.log("[hbuilderx] getAvailableThreads 方法未实现");
    throw new Error("getAvailableThreads 方法未实现");
  }

  getWorkspaceDirs(): Promise<string[]> {
    return Promise.resolve(
      this.ideUtils.getWorkspaceDirectories().map((uri: any) => uri.toString()),
    );
  }

  async getWorkspaceConfigs(): Promise<ContinueRcJson[]> {
    const workspaceDirs =
      hx.workspace.workspaceFolders?.map((folder: any) => folder.uri) || [];
    const configs: ContinueRcJson[] = [];
    for (const workspaceDir of workspaceDirs) {
      const files = await this.ideUtils.readDirectory(workspaceDir);
      if (files === null) {
        //Unlikely, but just in case...
        continue;
      }
      for (const [filename, type] of files) {
        if (
          (type === NodeFileType.File || type === NodeFileType.SymbolicLink) &&
          filename === ".continuerc.json"
        ) {
          const contents = await this.readFile(
            hx.Uri.parse(`${workspaceDir}/${filename}`).toString(),
          );
          configs.push(JSON.parse(contents));
        }
      }
    }
    return configs;
  }

  async fileExists(fileUri: string): Promise<boolean> {
    try {
      const stat = await this.ideUtils.stat(hx.Uri.parse(fileUri));
      return stat !== null;
    } catch (error) {
      // console.error("[hbuilderx] fileExists error:", error);
      return false;
    }
  }

  async writeFile(path: string, contents: string): Promise<void> {
    await this.ideUtils.writeFile(path, contents);
  }

  showVirtualFile(title: string, contents: string): Promise<void> {
    console.log(
      "[hbuilderx] showVirtualFile 方法未实现, title:",
      title,
      "contents length:",
      contents.length,
    );
    throw new Error("showVirtualFile 方法未实现");
  }

  async openFile(path: string): Promise<void> {
    await this.ideUtils.openFile(hx.Uri.parse(path));
  }

  async openUrl(url: string): Promise<void> {
    await hx.env.openExternal(hx.Uri.parse(url));
  }

  runCommand(command: string, options?: TerminalOptions): Promise<void> {
    console.log(
      "[hbuilderx] runCommand 方法未实现, command:",
      command,
      "options:",
      options,
    );
    throw new Error("runCommand 方法未实现");
  }

  async saveFile(fileUri: string): Promise<void> {
    hx.window.visibleTextEditors
      .filter((editor: any) => this.documentIsCode(editor.document.uri))
      .forEach((editor: any) => {
        if (URI.equal(editor.document.uri.toString(), fileUri)) {
          editor.document.save();
        }
      });
  }

  private documentIsCode(uri: any) {
    return uri.scheme === "file";
  }

  async readFile(fileUri: string): Promise<string> {
    console.log("[hbuilderx] readFile, fileUri:", fileUri);
    try {
      const uri = hx.Uri.parse(fileUri);

      // Check whether it's an open document
      const openTextDocument = hx.workspace.textDocuments.find((doc: any) =>
        URI.equal(doc.uri.toString(), uri.toString()),
      );
      if (openTextDocument !== undefined) {
        const content = openTextDocument.getText();
        console.log("[hbuilderx] readFile: Found open document", {
          fileUri,
          contentLength: content.length,
          contentPreview: content.substring(0, 100) + "...",
        });
        return content;
      }

      console.log(
        "[hbuilderx] readFile: Document not open, reading from file system",
        {
          fileUri,
        },
      );

      const fileStats = await this.ideUtils.stat(uri);
      if (fileStats === null || fileStats.size > 10 * HbuilderXIde.MAX_BYTES) {
        console.warn("[hbuilderx] readFile: File too large or not found", {
          fileUri,
          fileStats,
          maxBytes: HbuilderXIde.MAX_BYTES,
        });
        return "";
      }

      console.log("[hbuilderx] readFile: File stats OK, reading content", {
        fileUri,
        fileSize: fileStats.size,
      });

      const bytes = await this.ideUtils.readFile(uri);
      if (bytes === null) {
        console.warn("[hbuilderx] readFile: Failed to read file bytes", {
          fileUri,
        });
        return "";
      }

      // Truncate the buffer to the first MAX_BYTES
      const truncatedBytes = bytes.slice(0, HbuilderXIde.MAX_BYTES);
      const contents = new TextDecoder().decode(truncatedBytes);
      console.log("[hbuilderx] readFile: Successfully read file contents", {
        fileUri,
        originalSize: bytes.length,
        truncatedSize: truncatedBytes.length,
        contentLength: contents.length,
        contentPreview: contents.substring(0, 100) + "...",
      });
      return contents;
    } catch (e) {
      console.error("[hbuilderx] readFile error:", e);
      return "";
    }
  }

  readRangeInFile(fileUri: string, range: Range): Promise<string> {
    return this.ideUtils.readRangeInFile(hx.Uri.parse(fileUri), range);
  }

  async showLines(
    fileUri: string,
    startLine: number,
    endLine: number,
  ): Promise<void> {
    console.log(
      "[hbuilderx] showLines, fileUri:",
      fileUri,
      "startLine:",
      startLine,
      "endLine:",
      endLine,
    );

    openEditorAndRevealRange(hx.Uri.parse(fileUri), {
      start: startLine,
      end: endLine,
    }).then((editor: any) => {
      // Select the lines
      editor.selection = {
        start: { line: startLine, character: 0 },
        end: { line: endLine, character: 0 },
      };
    });
  }

  async getOpenFiles(): Promise<string[]> {
    return this.ideUtils.getOpenFiles().map((uri) => uri.toString());
  }

  async getCurrentFile(): Promise<
    | undefined
    | {
        isUntitled: boolean;
        path: string;
        contents: string;
      }
  > {
    if (!hx.window.activeTextEditor) {
      return undefined;
    }
    return {
      isUntitled: hx.window.activeTextEditor.document.isUntitled,
      path: hx.window.activeTextEditor.document.uri.toString(),
      contents: hx.window.activeTextEditor.document.getText(),
    };
  }

  getPinnedFiles(): Promise<string[]> {
    console.log("[hbuilderx] getPinnedFiles 方法未实现");
    throw new Error("getPinnedFiles 方法未实现");
  }

  async getSearchResults(query: string, maxResults?: number): Promise<string> {
    console.log(
      "[hbuilderx] getSearchResults called, query:",
      query,
      "maxResults:",
      maxResults,
    );
    const results: string[] = [];
    for (const dir of await this.getWorkspaceDirs()) {
      const dirResults = await this.runRipgrepQuery(dir, [
        "-i", // Case-insensitive search
        "--ignore-file",
        ".continueignore",
        "--ignore-file",
        ".gitignore",
        "-C",
        "2", // Show 2 lines of context
        "--heading", // Only show filepath once per result
        ...(maxResults ? ["-m", maxResults.toString()] : []),
        "-e",
        query, // Pattern to search for
        ".", // Directory to search in
      ]);

      results.push(dirResults);
    }

    const allResults = results.join("\n");
    if (maxResults) {
      // In case of multiple workspaces, do max results per workspace and then truncate to maxResults
      // Will prioritize first workspace results, fine for now
      // Results are separated by either ./ or --
      const matches = Array.from(allResults.matchAll(/(\n--|\n\.\/)/g));
      if (matches.length > maxResults) {
        return allResults.substring(0, matches[maxResults].index);
      } else {
        return allResults;
      }
    } else {
      return allResults;
    }
  }

  async getFileResults(
    pattern: string,
    maxResults?: number,
  ): Promise<string[]> {
    console.log(
      "[hbuilderx] getFileResults called, pattern:",
      pattern,
      "maxResults:",
      maxResults,
    );

    const results: string[] = [];
    for (const dir of await this.getWorkspaceDirs()) {
      const dirResults = await this.runRipgrepQuery(dir, [
        "--files",
        "--iglob",
        pattern,
        "--ignore-file",
        ".continueignore",
        "--ignore-file",
        ".gitignore",
        ...(maxResults ? ["--max-count", String(maxResults)] : []),
      ]);

      results.push(dirResults);
    }

    const allResults = results.join("\n").split("\n");
    if (maxResults) {
      // In the case of multiple workspaces, maxResults will be applied to each workspace
      // And then the combined results will also be truncated
      return allResults.slice(0, maxResults);
    } else {
      return allResults;
    }
  }

  subprocess(command: string, cwd?: string): Promise<[string, string]> {
    return new Promise((resolve, reject) => {
      exec(command, { cwd }, (error, stdout, stderr) => {
        if (error) {
          console.warn(error);
          reject(stderr);
        }
        resolve([stdout, stderr]);
      });
    });
  }

  getProblems(fileUri?: string | undefined): Promise<Problem[]> {
    console.log("[hbuilderx] getProblems 方法未实现, fileUri:", fileUri);
    throw new Error("getProblems 方法未实现");
  }

  getBranch(dir: string): Promise<string> {
    return this.ideUtils.getBranch(hx.Uri.parse(dir));
  }

  async getTags(artifactId: string): Promise<IndexTag[]> {
    const workspaceDirs = await this.getWorkspaceDirs();

    const branches = await Promise.all(
      workspaceDirs.map((dir) => this.getBranch(dir)),
    );

    const tags: IndexTag[] = workspaceDirs.map((directory, i) => ({
      directory,
      branch: branches[i],
      artifactId,
    }));

    return tags;
  }

  async getRepo(dir: string): Promise<Repository | undefined> {
    return this.ideUtils.getRepo(hx.Uri.parse(dir));
  }

  async getRepoName(dir: string): Promise<string | undefined> {
    const repo = await this.getRepo(dir);
    const remotes = repo?.state.remotes;
    if (!remotes) {
      return undefined;
    }
    const remote =
      remotes?.find((r: any) => r.name === "origin") ?? remotes?.[0];
    if (!remote) {
      return undefined;
    }
    const ownerAndRepo = remote.fetchUrl
      ?.replace(".git", "")
      .split("/")
      .slice(-2);
    return ownerAndRepo?.join("/");
  }

  showToast(
    type: ToastType,
    message: string,
    ...otherParams: any[]
  ): Promise<any> {
    switch (type) {
      case "error":
        return hx.window
          .showErrorMessage(message, "Show logs")
          .then((selection: any) => {
            if (selection === "Show logs") {
              hx.commands.executeCommand("workbench.action.toggleDevTools");
            }
          });
      case "info":
        return hx.window.showInformationMessage(message, ...otherParams);
      case "warning":
        return hx.window.showWarningMessage(message, ...otherParams);
    }
  }

  async getGitRootPath(dir: string): Promise<string | undefined> {
    const root = await this.ideUtils.getGitRoot(hx.Uri.parse(dir));
    return root?.toString();
  }

  async listDir(dir: string): Promise<[string, FileType][]> {
    const entries = await this.ideUtils.readDirectory(hx.Uri.parse(dir));
    return entries === null ? [] : (entries as any);
  }

  async getFileStats(files: string[]): Promise<FileStatsMap> {
    const pathToLastModified: FileStatsMap = {};
    for (const file of files) {
      const stat = await this.ideUtils.stat(hx.Uri.parse(file));
      pathToLastModified[file] = {
        lastModified: stat!.mtime,
        size: stat!.size,
      };
    }
    return pathToLastModified;
  }

  // Secret Storage
  readSecrets(keys: string[]): Promise<Record<string, string>> {
    console.log("[hbuilderx] readSecrets 方法未实现, keys:", keys);
    throw new Error("readSecrets 方法未实现");
  }

  writeSecrets(secrets: { [key: string]: string }): Promise<void> {
    console.log(
      "[hbuilderx] writeSecrets 方法未实现, secrets keys:",
      Object.keys(secrets),
    );
    throw new Error("writeSecrets 方法未实现");
  }

  // LSP
  gotoDefinition(location: Location): Promise<RangeInFile[]> {
    console.log("[hbuilderx] gotoDefinition 方法未实现, location:", location);
    throw new Error("gotoDefinition 方法未实现");
  }

  // Callbacks
  onDidChangeActiveTextEditor(callback: (fileUri: string) => void): void {
    hx.window.onDidChangeActiveTextEditor((editor: any) => {
      if (editor) {
        callback(editor.document.uri.toString());
      }
    });
  }

  private getIdeSettingsSync(): IdeSettings {
    const settings = hx.workspace.getConfiguration(EXTENSION_NAME);
    const remoteConfigServerUrl = settings.get("remoteConfigServerUrl");
    const ideSettings: IdeSettings = {
      remoteConfigServerUrl,
      remoteConfigSyncPeriod: settings.get("remoteConfigSyncPeriod"),
      userToken: settings.get("userToken"),
      continueTestEnvironment: "production",
      pauseCodebaseIndexOnStart: settings.get("pauseCodebaseIndexOnStart"),
    };
    return ideSettings;
  }

  runRipgrepQuery(dirUri: string, args: string[]) {
    console.log(
      "[hbuilderx] runRipgrepQuery called, dirUri:",
      dirUri,
      "args:",
      args,
    );
    //TODO: 需要优化，获取当前工作目录
    const relativeDir = hx.Uri.parse(dirUri).fsPath;
    const ripGrepPath = hx.Uri.parse(
      "/Applications/HBuilderX-Alpha.app/Contents/HBuilderX/plugins/ripgrep/bin/rg",
    );

    console.log(
      "[hbuilderx] 启动 ripgrep 进程，工作目录:",
      relativeDir,
      "可执行文件:",
      ripGrepPath.fsPath,
    );

    const p = child_process.spawn(ripGrepPath.fsPath, args, {
      cwd: relativeDir,
    });
    let output = "";
    let dataChunkCount = 0;

    p.stdout.on("data", (data) => {
      dataChunkCount++;
      const dataStr = data.toString();
      output += dataStr;
      console.log(
        `[hbuilderx] 接收到数据块 ${dataChunkCount}，大小: ${dataStr.length} 字符，总输出长度: ${output.length}`,
      );
    });

    return new Promise<string>((resolve, reject) => {
      p.on("error", (error) => {
        console.error("[hbuilderx] ripgrep 进程错误:", error.message);
        reject(error);
      });

      p.on("close", (code) => {
        console.log(
          `[hbuilderx] ripgrep 进程结束，退出代码: ${code}，总输出长度: ${output.length}，数据块数: ${dataChunkCount}`,
        );

        if (code === 0) {
          console.log("[hbuilderx] ripgrep 查询成功完成");
          resolve(output);
        } else if (code === 1) {
          // No matches
          console.log("[hbuilderx] ripgrep 未找到匹配项");
          resolve("No matches found");
        } else {
          console.error(`[hbuilderx] ripgrep 进程异常退出，代码: ${code}`);
          reject(new Error(`Process exited with code ${code}`));
        }
      });
    });
  }

  private static MAX_BYTES = 100000;
}

export { HbuilderXIde };
