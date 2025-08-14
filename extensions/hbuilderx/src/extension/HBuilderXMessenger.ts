import { ConfigHandler } from "core/config/ConfigHandler";
import { EDIT_MODE_STREAM_ID } from "core/edit/constants";
import { streamDiffLines } from "core/edit/streamDiffLines";
import {
  FromCoreProtocol,
  FromWebviewProtocol,
  ToCoreProtocol,
} from "core/protocol";
import { ToWebviewFromCoreProtocol } from "core/protocol/coreWebview";
import { ToIdeFromWebviewOrCoreProtocol } from "core/protocol/ide";
import { ToIdeFromCoreProtocol } from "core/protocol/ideCore";
import { InProcessMessenger, Message } from "core/protocol/messenger";
import {
  CORE_TO_WEBVIEW_PASS_THROUGH,
  WEBVIEW_TO_CORE_PASS_THROUGH,
} from "core/protocol/passThrough";
import { ApplyManager } from "../apply";
import { PreviewEditManager } from "../diff/PreviewEditManager";
import { HbuilderXIde } from "../HBuilderXIde";
import { getControlPlaneSessionInfo } from "../stubs/WorkOsAuthProvider";
import { handleLLMError } from "../util/errorHandling";
import { getExtensionUri } from "../util/hbuilderx";
import { HbuilderXWebviewProtocol } from "../webviewProtocol";
const hx = require("hbuilderx");

type ToIdeOrWebviewFromCoreProtocol = ToIdeFromCoreProtocol &
  ToWebviewFromCoreProtocol;

/**
 * A shared messenger class between Core and Webview
 * so we don't have to rewrite some of the handlers
 */
export class HbuilderXMessenger {
  onWebview<T extends keyof FromWebviewProtocol>(
    messageType: T,
    handler: (
      message: Message<FromWebviewProtocol[T][0]>,
    ) => Promise<FromWebviewProtocol[T][1]> | FromWebviewProtocol[T][1],
  ): void {
    void this.webviewProtocol.on(messageType, handler);
  }

  onCore<T extends keyof ToIdeOrWebviewFromCoreProtocol>(
    messageType: T,
    handler: (
      message: Message<ToIdeOrWebviewFromCoreProtocol[T][0]>,
    ) =>
      | Promise<ToIdeOrWebviewFromCoreProtocol[T][1]>
      | ToIdeOrWebviewFromCoreProtocol[T][1],
  ): void {
    this.inProcessMessenger.externalOn(messageType, handler);
  }

  onWebviewOrCore<T extends keyof ToIdeFromWebviewOrCoreProtocol>(
    messageType: T,
    handler: (
      message: Message<ToIdeFromWebviewOrCoreProtocol[T][0]>,
    ) =>
      | Promise<ToIdeFromWebviewOrCoreProtocol[T][1]>
      | ToIdeFromWebviewOrCoreProtocol[T][1],
  ): void {
    this.onWebview(messageType, handler);
    this.onCore(messageType, handler);
  }

  constructor(
    private readonly inProcessMessenger: InProcessMessenger<
      ToCoreProtocol,
      FromCoreProtocol
    >,
    private readonly webviewProtocol: HbuilderXWebviewProtocol,
    private readonly ide: HbuilderXIde,
    private readonly configHandlerPromise: Promise<ConfigHandler>,
  ) {
    /** WEBVIEW ONLY LISTENERS **/
    this.onWebview("showFile", (msg) => {
      this.ide.openFile(msg.data.filepath);
    });

    this.onWebview("vscode/openMoveRightMarkdown", (msg) => {
      hx.commands.executeCommand(
        "markdown.showPreview",
        hx.Uri.file(`${getExtensionUri()}/media/move-chat-panel-right.md`),
      );
    });

    this.onWebview("toggleDevTools", (msg) => {
      hx.commands.executeCommand("continue.viewLogs");
    });
    this.onWebview("reloadWindow", (msg) => {
      hx.commands.executeCommand("workbench.action.reloadWindow");
    });
    this.onWebview("focusEditor", (msg) => {
      hx.commands.executeCommand("workbench.action.focusActiveEditorGroup");
    });
    this.onWebview("toggleFullScreen", (msg) => {
      hx.commands.executeCommand("continue.toggleFullScreen");
    });

    this.onWebview("acceptDiff", async ({ data: { filepath, streamId } }) => {
      await hx.commands.executeCommand(
        "continue.acceptDiff",
        filepath,
        streamId,
      );
    });

    this.onWebview("rejectDiff", async ({ data: { filepath, streamId } }) => {
      await hx.commands.executeCommand(
        "continue.rejectDiff",
        filepath,
        streamId,
      );
    });

    this.onWebview("applyToFile", async ({ data }) => {
      console.log("[hbuilderx] applyToFile 开始处理", {
        streamId: data.streamId,
        filepath: data.filepath,
        textLength: data.text?.length || 0,
        toolCallId: data.toolCallId,
      });

      try {
        const configHandler = await this.configHandlerPromise;
        console.log("[hbuilderx] applyToFile 依赖项加载完成");

        const applyManager = new ApplyManager(
          this.ide,
          this.webviewProtocol,
          configHandler,
        );

        console.log(
          "[hbuilderx] applyToFile ApplyManager 创建完成，开始执行应用",
        );
        await applyManager.applyToFile(data);
        console.log("[hbuilderx] applyToFile 完成处理");
      } catch (error) {
        console.error("[hbuilderx] applyToFile 处理失败", error);
        throw error;
      }
    });

    this.onWebview("showTutorial", async (msg) => {
      console.warn("[hbuilderx] showTutorial 消息未实现");
      // await showTutorial(this.ide);
    });

    this.onWebview(
      "overwriteFile",
      async ({ data: { prevFileContent, filepath } }) => {
        if (prevFileContent === null) {
          // TODO: Delete the file
          return;
        }

        await this.ide.openFile(filepath);

        // Get active text editor
        const editor = await hx.window.getActiveTextEditor();

        if (!editor) {
          hx.window.showErrorMessage("No active editor to apply edits to");
          return;
        }

        editor.edit((builder: any) =>
          builder.replace(
            new hx.Range(
              editor.document.positionAt(0),
              editor.document.positionAt(editor.document.getText().length),
            ),
            prevFileContent,
          ),
        );
      },
    );

    this.onWebview("insertAtCursor", async (msg) => {
      const editor = await hx.window.getActiveTextEditor();
      if (editor === undefined || !editor.selection) {
        return;
      }

      editor.edit((editBuilder: any) => {
        editBuilder.replace(
          new hx.Range(editor.selection.start, editor.selection.end),
          msg.data.text,
        );
      });
    });
    this.onWebview("edit/addCurrentSelection", async (msg) => {
      console.warn("[hbuilderx] edit/addCurrentSelection 消息未实现");
      // const verticalDiffManager = await this.verticalDiffManagerPromise;
      // await addCurrentSelectionToEdit({
      //   args: undefined,
      //   editDecorationManager,
      //   webviewProtocol: this.webviewProtocol,
      //   verticalDiffManager,
      // });
    });
    // 实现与 VSCode 一致的 edit/sendPrompt：基于 range 计算 diff，流式更新 GUI
    this.onWebview("edit/sendPrompt", async (msg) => {
      try {
        const prompt = msg.data.prompt as string;
        const { start, end } = msg.data.range.range as {
          start: { line: number; character: number };
          end: { line: number; character: number };
        };
        const filepath: string = msg.data.range.filepath;

        // 确保文件已打开
        await this.ide.openFile(filepath);

        const editor = await hx.window.getActiveTextEditor();
        if (!editor) {
          throw new Error("No active editor to run edit on");
        }

        // 读取全文，基于 range 计算 prefix / highlighted / suffix
        const fullText: string = editor.document.getText();
        const lines = fullText.split("\n");

        function sliceUpTo(lineIdx: number, charIdx: number): string {
          if (lineIdx <= 0) {
            return lines[0]?.slice(0, charIdx) ?? "";
          }
          const before = lines.slice(0, lineIdx).join("\n");
          const head = before.length > 0 ? before + "\n" : "";
          return head + (lines[lineIdx] ?? "").slice(0, charIdx);
        }

        function sliceRange(
          sLine: number,
          sChar: number,
          eLine: number,
          eChar: number,
        ): string {
          if (sLine === eLine) {
            return (lines[sLine] ?? "").slice(sChar, eChar);
          }
          const first = (lines[sLine] ?? "").slice(sChar);
          const middle = lines.slice(sLine + 1, eLine).join("\n");
          const last = (lines[eLine] ?? "").slice(0, eChar);
          return [first, middle, last].filter((s) => s.length > 0).join("\n");
        }

        const prefix = sliceUpTo(start.line, start.character);
        const highlighted = sliceRange(
          start.line,
          start.character,
          end.line,
          end.character,
        );
        const suffix = fullText.slice(prefix.length + highlighted.length);

        // 读取配置，获取模型
        const configHandler = await this.configHandlerPromise;
        const loaded = await configHandler.loadConfig();
        const cfg = loaded.config;
        if (!cfg) {
          throw new Error("Edit: Failed to load config");
        }
        const llmCandidate =
          cfg.selectedModelByRole.edit ?? cfg.selectedModelByRole.chat;
        if (!llmCandidate) {
          throw new Error("No Edit or Chat model selected");
        }
        const llm = llmCandidate;

        const streamId = EDIT_MODE_STREAM_ID;

        // 准备 diff 流，并记录产出以返回 fileAfterEdit
        const streamedLines: string[] = [];
        async function* recordedStream() {
          const abortController = new AbortController();
          const gen = streamDiffLines({
            highlighted,
            prefix,
            suffix,
            llm,
            rulesToInclude: cfg!.rules,
            input: prompt,
            language: undefined,
            overridePrompt: undefined,
            abortController,
          });
          for await (const line of gen) {
            if (line.type === "new" || line.type === "same") {
              streamedLines.push(line.line);
            }
            yield line;
          }
        }

        // 使用 PreviewEditManager 进行预览应用，利用其 onStatusUpdate 推送状态
        const previewEditManager = new PreviewEditManager({
          onStatusUpdate: async (status, numDiffs, fileContent) => {
            await this.webviewProtocol.request("updateApplyState", {
              streamId,
              status: status || "streaming",
              numDiffs: numDiffs || 0,
              fileContent,
              filepath,
            });
          },
          onUserAccept: async (eUri, eEdit) => {
            // 用户在预览界面点击了接受：如果是单个 edit，可选择同步 numDiffs 或 fileContent
            await this.webviewProtocol.request("updateApplyState", {
              streamId,
              status: "done",
              filepath: (eUri?.fsPath ?? eUri) as string,
            });
          },
          onUserReject: async (eUri, eEdit) => {
            // 用户在预览界面点击了拒绝：对于单个 edit 或全部拒绝，通知 GUI 关闭
            await this.webviewProtocol.request("updateApplyState", {
              streamId,
              status: "closed",
              filepath: (eUri?.fsPath ?? eUri) as string,
              numDiffs: 0,
            });
          },
        });

        await previewEditManager.applyStreamDiffs(filepath, recordedStream());

        const fileAfterEdit = `${prefix}${streamedLines.join("\n")}${suffix}`;
        return fileAfterEdit;
      } catch (e) {
        await handleLLMError(e);
        throw e;
      }
    });

    this.onWebview("edit/clearDecorations", async (msg) => {
      console.warn("[hbuilderx] edit/clearDecorations 消息未实现");
      // editDecorationManager.clear();
    });

    this.onWebview("copyText", async (msg) => {
      console.log("[hbuilderx] copyText 开始处理", {
        textLength: msg.data.text?.length || 0,
      });

      try {
        // 使用 HBuilderX 的剪贴板 API
        await hx.env.clipboard.writeText(msg.data.text);
        console.log("[hbuilderx] copyText 复制成功");
      } catch (error: any) {
        console.error("[hbuilderx] copyText 复制失败", error);
        // 如果复制失败，显示错误提示
        hx.window.showErrorMessage(`复制失败: ${error?.message || error}`);
      }
    });

    /** PASS THROUGH FROM WEBVIEW TO CORE AND BACK **/
    WEBVIEW_TO_CORE_PASS_THROUGH.forEach((messageType) => {
      this.onWebview(messageType, async (msg) => {
        return await this.inProcessMessenger.externalRequest(
          messageType,
          msg.data,
          msg.messageId,
        );
      });
    });

    /** PASS THROUGH FROM CORE TO WEBVIEW AND BACK **/
    CORE_TO_WEBVIEW_PASS_THROUGH.forEach((messageType) => {
      this.onCore(messageType, async (msg) => {
        return this.webviewProtocol.request(messageType, msg.data);
      });
    });

    /** CORE ONLY LISTENERS **/
    // None right now

    /** BOTH CORE AND WEBVIEW **/
    this.onWebviewOrCore("readRangeInFile", async (msg) => {
      return await hx.workspace
        .openTextDocument(msg.data.filepath)
        .then((document: any) => {
          const start = new hx.Position(0, 0);
          const end = new hx.Position(5, 0);
          const range = new hx.Range(start.line, end.line);

          const contents = document.getText(range);
          return contents;
        });
    });

    this.onWebviewOrCore("getIdeSettings", async (msg) => {
      return this.ide.getIdeSettings();
    });
    this.onWebviewOrCore("getDiff", async (msg) => {
      return this.ide.getDiff(msg.data.includeUnstaged);
    });
    this.onWebviewOrCore("getTerminalContents", async (msg) => {
      return this.ide.getTerminalContents();
    });
    this.onWebviewOrCore("getDebugLocals", async (msg) => {
      return this.ide.getDebugLocals(Number(msg.data.threadIndex));
    });
    this.onWebviewOrCore("getAvailableThreads", async (msg) => {
      return this.ide.getAvailableThreads();
    });
    this.onWebviewOrCore("getTopLevelCallStackSources", async (msg) => {
      return this.ide.getTopLevelCallStackSources(
        msg.data.threadIndex,
        msg.data.stackDepth,
      );
    });
    this.onWebviewOrCore("getWorkspaceDirs", async (msg) => {
      return this.ide.getWorkspaceDirs();
    });
    this.onWebviewOrCore("writeFile", async (msg) => {
      return this.ide.writeFile(msg.data.path, msg.data.contents);
    });
    this.onWebviewOrCore("showVirtualFile", async (msg) => {
      return this.ide.showVirtualFile(msg.data.name, msg.data.content);
    });
    this.onWebviewOrCore("openFile", async (msg) => {
      return this.ide.openFile(msg.data.path);
    });
    this.onWebviewOrCore("runCommand", async (msg) => {
      await this.ide.runCommand(msg.data.command);
    });
    this.onWebviewOrCore("getSearchResults", async (msg) => {
      return this.ide.getSearchResults(msg.data.query);
    });
    this.onWebviewOrCore("getFileResults", async (msg) => {
      return this.ide.getFileResults(msg.data.pattern);
    });
    this.onWebviewOrCore("subprocess", async (msg) => {
      return this.ide.subprocess(msg.data.command, msg.data.cwd);
    });
    this.onWebviewOrCore("getProblems", async (msg) => {
      return this.ide.getProblems(msg.data.filepath);
    });
    this.onWebviewOrCore("getBranch", async (msg) => {
      const { dir } = msg.data;
      return this.ide.getBranch(dir);
    });
    this.onWebviewOrCore("getOpenFiles", async (msg) => {
      return this.ide.getOpenFiles();
    });
    this.onWebviewOrCore("getCurrentFile", async () => {
      return this.ide.getCurrentFile();
    });
    this.onWebviewOrCore("getPinnedFiles", async (msg) => {
      return this.ide.getPinnedFiles();
    });
    this.onWebviewOrCore("showLines", async (msg) => {
      const { filepath, startLine, endLine } = msg.data;
      return this.ide.showLines(filepath, startLine, endLine);
    });
    this.onWebviewOrCore("showToast", (msg) => {
      this.ide.showToast(...msg.data);
    });
    this.onWebviewOrCore("getControlPlaneSessionInfo", async (msg) => {
      return getControlPlaneSessionInfo(
        msg.data.silent,
        msg.data.useOnboarding,
      );
    });
    this.onWebviewOrCore("logoutOfControlPlane", async (msg) => {
      console.warn("[hbuilderx] logoutOfControlPlane 消息未实现");
      // const sessions = await this.workOsAuthProvider.getSessions();
      // await Promise.all(
      //   sessions.map((session) => workOsAuthProvider.removeSession(session.id)),
      // );
      // vscode.commands.executeCommand(
      //   "setContext",
      //   "continue.isSignedInToControlPlane",
      //   false,
      // );
    });
    this.onWebviewOrCore("saveFile", async (msg) => {
      return await this.ide.saveFile(msg.data.filepath);
    });
    this.onWebviewOrCore("readFile", async (msg) => {
      return await this.ide.readFile(msg.data.filepath);
    });
    this.onWebviewOrCore("openUrl", (msg) => {
      hx.env.openExternal(hx.Uri.parse(msg.data));
    });

    this.onWebviewOrCore("fileExists", async (msg) => {
      return await this.ide.fileExists(msg.data.filepath);
    });

    this.onWebviewOrCore("gotoDefinition", async (msg) => {
      return await this.ide.gotoDefinition(msg.data.location);
    });

    this.onWebviewOrCore("getFileStats", async (msg) => {
      return await this.ide.getFileStats(msg.data.files);
    });

    this.onWebviewOrCore("getGitRootPath", async (msg) => {
      return await this.ide.getGitRootPath(msg.data.dir);
    });

    this.onWebviewOrCore("listDir", async (msg) => {
      return await this.ide.listDir(msg.data.dir);
    });

    this.onWebviewOrCore("getRepoName", async (msg) => {
      return await this.ide.getRepoName(msg.data.dir);
    });

    this.onWebviewOrCore("getTags", async (msg) => {
      return await this.ide.getTags(msg.data);
    });

    this.onWebviewOrCore("getIdeInfo", async (msg) => {
      return await this.ide.getIdeInfo();
    });

    this.onWebviewOrCore("isTelemetryEnabled", async (msg) => {
      return await this.ide.isTelemetryEnabled();
    });

    this.onWebviewOrCore("getWorkspaceConfigs", async (msg) => {
      return await this.ide.getWorkspaceConfigs();
    });

    this.onWebviewOrCore("getUniqueId", async (msg) => {
      return await this.ide.getUniqueId();
    });

    this.onWebviewOrCore("reportError", async (msg) => {
      await handleLLMError(msg.data);
    });
  }
}
