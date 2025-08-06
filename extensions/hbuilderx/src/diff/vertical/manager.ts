import { ChatMessage, DiffLine, ILLM, RuleWithSource } from "core";
import { streamDiffLines } from "core/edit/streamDiffLines";
import { pruneLinesFromBottom, pruneLinesFromTop } from "core/llm/countTokens";
import { getMarkdownLanguageTagForFile } from "core/util";
import * as URI from "uri-js";
const hx = require("hbuilderx");

import { isFastApplyModel } from "../../apply/utils";
import EditDecorationManager from "../../quickEdit/EditDecorationManager";
import { handleLLMError } from "../../util/errorHandling";
import { HbuilderXWebviewProtocol } from "../../webviewProtocol";

import { VerticalDiffHandler, VerticalDiffHandlerOptions } from "./handler";

export interface VerticalDiffCodeLens {
  start: number;
  numRed: number;
  numGreen: number;
}

export class VerticalDiffManager {
  public refreshCodeLens: () => void = () => {};

  private fileUriToHandler: Map<string, VerticalDiffHandler> = new Map();

  fileUriToCodeLens: Map<string, VerticalDiffCodeLens[]> = new Map();

  private userChangeListener: hx.Disposable | undefined;

  logDiffs: DiffLine[] | undefined;

  constructor(
    private readonly webviewProtocol: HbuilderXWebviewProtocol,
    private readonly editDecorationManager: EditDecorationManager,
  ) {
    this.userChangeListener = undefined;
  }

  createVerticalDiffHandler(
    fileUri: string,
    startLine: number,
    endLine: number,
    options: VerticalDiffHandlerOptions,
  ): VerticalDiffHandler | undefined {
    if (this.fileUriToHandler.has(fileUri)) {
      this.fileUriToHandler.get(fileUri)?.clear(false);
      this.fileUriToHandler.delete(fileUri);
    }
    const editor = hx.window.activeTextEditor; // TODO might cause issues if user switches files
    if (editor && URI.equal(editor.document.uri.toString(), fileUri)) {
      const handler = new VerticalDiffHandler(
        startLine,
        endLine,
        editor,
        this.fileUriToCodeLens,
        this.clearForfileUri.bind(this),
        this.refreshCodeLens,
        options,
      );
      this.fileUriToHandler.set(fileUri, handler);
      return handler;
    } else {
      return undefined;
    }
  }

  getHandlerForFile(fileUri: string) {
    return this.fileUriToHandler.get(fileUri);
  }

  // Creates a listener for document changes by user.
  private enableDocumentChangeListener(): hx.Disposable | undefined {
    if (this.userChangeListener) {
      //Only create one listener per file
      return;
    }

    this.userChangeListener = hx.workspace.onDidChangeTextDocument(
      (event: any) => {
        // Check if there is an active handler for the affected file
        const fileUri = event.document.uri.toString();
        const handler = this.getHandlerForFile(fileUri);
        if (handler) {
          // If there is an active diff for that file, handle the document change
          this.handleDocumentChange(event, handler);
        }
      },
    );
  }

  // Listener for user doc changes is disabled during updates to the text document by continue
  public disableDocumentChangeListener() {
    if (this.userChangeListener) {
      this.userChangeListener.dispose();
      this.userChangeListener = undefined;
    }
  }

  private handleDocumentChange(
    event: hx.TextDocumentChangeEvent,
    handler: VerticalDiffHandler,
  ) {
    // Loop through each change in the event
    event.contentChanges.forEach((change: any) => {
      // Calculate the number of lines added or removed
      const linesAdded = change.text.split("\n").length - 1;
      const linesDeleted = change.range.end.line - change.range.start.line;
      const lineDelta = linesAdded - linesDeleted;

      // Update the diff handler with the new line delta
      handler.updateLineDelta(
        event.document.uri.toString(),
        change.range.start.line,
        lineDelta,
      );
    });
  }

  clearForfileUri(fileUri: string | undefined, accept: boolean) {
    if (!fileUri) {
      const activeEditor = hx.window.activeTextEditor;
      if (!activeEditor) {
        return;
      }
      fileUri = activeEditor.document.uri.toString();
    }

    const handler = this.fileUriToHandler.get(fileUri);
    if (handler) {
      handler.clear(accept);
      this.fileUriToHandler.delete(fileUri);
    }

    this.disableDocumentChangeListener();

    hx.commands.executeCommand("setContext", "continue.diffVisible", false);
  }

  async acceptRejectVerticalDiffBlock(
    accept: boolean,
    fileUri?: string,
    index?: number,
  ) {
    if (!fileUri) {
      const activeEditor = hx.window.activeTextEditor;
      if (!activeEditor) {
        return;
      }
      fileUri = activeEditor.document.uri.toString();
    }

    if (typeof index === "undefined") {
      index = 0;
    }

    const blocks = this.fileUriToCodeLens.get(fileUri);
    const block = blocks?.[index];
    if (!blocks || !block) {
      return;
    }

    const handler = this.getHandlerForFile(fileUri);
    if (!handler) {
      return;
    }

    // Disable listening to file changes while continue makes changes
    this.disableDocumentChangeListener();

    // CodeLens object removed from editorToVerticalDiffCodeLens here
    await handler.acceptRejectBlock(
      accept,
      block.start,
      block.numGreen,
      block.numRed,
    );

    if (blocks.length === 1) {
      this.clearForfileUri(fileUri, true);
    } else {
      // Re-enable listener for user changes to file
      this.enableDocumentChangeListener();
    }

    this.refreshCodeLens();
  }

  async streamDiffLines(
    diffStream: AsyncGenerator<DiffLine>,
    instant: boolean,
    streamId: string,
    toolCallId?: string,
  ) {
    console.log("[hbuilderx] streamDiffLines 开始", {
      streamId,
      instant,
      toolCallId,
    });

    try {
      hx.commands.executeCommand("setContext", "continue.diffVisible", true);

      // Get the current editor fileUri/range
      let editor = hx.window.activeTextEditor;
      if (!editor) {
        console.error("[hbuilderx] streamDiffLines 没有活动编辑器");
        return;
      }
      const fileUri = editor.document.uri.toString();
      const startLine = 0;
      const endLine = editor.document.lineCount - 1;

      console.log("[hbuilderx] streamDiffLines 编辑器信息", {
        fileUri,
        startLine,
        endLine,
        documentLineCount: editor.document.lineCount,
      });

      // Check for existing handlers in the same file the new one will be created in
      const existingHandler = this.getHandlerForFile(fileUri);
      if (existingHandler) {
        console.log("[hbuilderx] streamDiffLines 清除现有处理器");
        existingHandler.clear(false);
      }

      await new Promise((resolve) => {
        setTimeout(resolve, 200);
      });

      console.log("[hbuilderx] streamDiffLines 创建差异处理器");
      // Create new handler with determined start/end
      const diffHandler = this.createVerticalDiffHandler(
        fileUri,
        startLine,
        endLine,
        {
          instant,
          onStatusUpdate: (status, numDiffs, fileContent) =>
            void this.webviewProtocol.request("updateApplyState", {
              streamId,
              status,
              numDiffs,
              fileContent,
              filepath: fileUri,
              toolCallId,
            }),
        },
      );

      if (!diffHandler) {
        console.error("[hbuilderx] streamDiffLines 创建差异处理器失败");
        console.warn("Issue occurred while creating new vertical diff handler");
        return;
      }

      console.log("[hbuilderx] streamDiffLines 差异处理器创建成功");

      if (editor.selection) {
        // Unselect the range
        editor.selection = new hx.Selection(
          editor.selection.active,
          editor.selection.active,
        );
      }

      hx.commands.executeCommand("setContext", "continue.streamingDiff", true);

      console.log("[hbuilderx] streamDiffLines 开始运行差异处理器");
      this.logDiffs = await diffHandler.run(diffStream);

      // enable a listener for user edits to file while diff is open
      this.enableDocumentChangeListener();
      console.log("[hbuilderx] streamDiffLines 完成", { streamId });
    } catch (e) {
      console.error("[hbuilderx] streamDiffLines 失败", { streamId, error: e });
      this.disableDocumentChangeListener();
      const handled = await handleLLMError(e);
      if (!handled) {
        let message = "Error streaming diffs";
        if (e instanceof Error) {
          message += `: ${e.message}`;
        }
        throw new Error(message);
      }
    } finally {
      hx.commands.executeCommand("setContext", "continue.streamingDiff", false);
    }
  }

  async streamEdit({
    input,
    llm,
    streamId,
    onlyOneInsertion,
    quickEdit,
    range,
    newCode,
    toolCallId,
    rulesToInclude,
  }: {
    input: string;
    llm: ILLM;
    streamId?: string;
    onlyOneInsertion?: boolean;
    quickEdit?: string;
    range?: hx.Range;
    newCode?: string;
    toolCallId?: string;
    rulesToInclude: undefined | RuleWithSource[];
  }): Promise<string | undefined> {
    console.log("[hbuilderx] streamEdit 开始", {
      streamId,
      inputLength: input.length,
      modelTitle: llm.title,
      onlyOneInsertion,
      quickEdit,
      hasRange: !!range,
      hasNewCode: !!newCode,
      toolCallId,
      rulesToIncludeCount: rulesToInclude?.length || 0,
    });

    try {
      hx.commands.executeCommand("setContext", "continue.diffVisible", true);

      let editor = hx.window.activeTextEditor;

      if (!editor) {
        console.error("[hbuilderx] streamEdit 没有活动编辑器");
        return undefined;
      }

      const fileUri = editor.document.uri.toString();
      console.log("[hbuilderx] streamEdit 获取编辑器", {
        fileUri,
        documentLineCount: editor.document.lineCount,
        selection: editor.selection
          ? {
              startLine: editor.selection.start.line,
              startCharacter: editor.selection.start.character,
              endLine: editor.selection.end.line,
              endCharacter: editor.selection.end.character,
              isEmpty: editor.selection.isEmpty,
            }
          : null,
      });

      let startLine, endLine: number;

      if (range) {
        startLine = range.start.line;
        endLine = range.end.line;
        console.log("[hbuilderx] streamEdit 使用指定范围", {
          startLine,
          endLine,
          rangeStartCharacter: range.start.character,
          rangeEndCharacter: range.end.character,
        });
      } else {
        startLine = editor.selection.start.line;
        endLine = editor.selection.end.line;
        console.log("[hbuilderx] streamEdit 使用选择范围", {
          startLine,
          endLine,
          selectionStartCharacter: editor.selection.start.character,
          selectionEndCharacter: editor.selection.end.character,
        });
      }

      // Check for existing handlers in the same file the new one will be created in
      const existingHandler = this.getHandlerForFile(fileUri);

      console.log("[hbuilderx] streamEdit 检查现有处理器", {
        hasExistingHandler: !!existingHandler,
        quickEdit,
      });

      if (existingHandler) {
        console.log("[hbuilderx] streamEdit 现有处理器信息", {
          existingHandlerRange: {
            startLine: existingHandler.range.start.line,
            endLine: existingHandler.range.end.line,
          },
          currentRange: { startLine, endLine },
        });

        if (quickEdit) {
          // Previous diff was a quickEdit
          // Check if user has highlighted a range
          let rangeBool =
            startLine !== endLine ||
            editor.selection.start.character !== editor.selection.end.character;

          // Check if the range is different from the previous range
          let newRangeBool =
            startLine !== existingHandler.range.start.line ||
            endLine !== existingHandler.range.end.line;

          console.log("[hbuilderx] streamEdit quickEdit 范围检查", {
            rangeBool,
            newRangeBool,
            startLine,
            endLine,
            existingStartLine: existingHandler.range.start.line,
            existingEndLine: existingHandler.range.end.line,
          });

          if (!rangeBool || !newRangeBool) {
            // User did not highlight a new range -> use start/end from the previous quickEdit
            startLine = existingHandler.range.start.line;
            endLine = existingHandler.range.end.line;
            console.log("[hbuilderx] streamEdit 使用现有处理器范围", {
              startLine,
              endLine,
            });
          }
        }

        // Clear the previous handler
        // This allows the user to edit above the changed area,
        // but extra delta was added for each line generated by Continue
        // Before adding this back, we need to distinguish between human and Continue
        // let effectiveLineDelta =
        //   existingHandler.getLineDeltaBeforeLine(startLine);
        // startLine += effectiveLineDelta;
        // endLine += effectiveLineDelta;

        console.log("[hbuilderx] streamEdit 清除现有处理器");
        await existingHandler.clear(false);
      }

      await new Promise((resolve) => {
        setTimeout(resolve, 150);
      });

      console.log("[hbuilderx] streamEdit 创建差异处理器", {
        fileUri,
        startLine,
        endLine,
        instant: isFastApplyModel(llm),
        hasInput: !!input,
        hasStreamId: !!streamId,
      });

      // Create new handler with determined start/end
      const diffHandler = this.createVerticalDiffHandler(
        fileUri,
        startLine,
        endLine,
        {
          instant: isFastApplyModel(llm),
          input,
          onStatusUpdate: (status, numDiffs, fileContent) =>
            streamId &&
            void this.webviewProtocol.request("updateApplyState", {
              streamId,
              status,
              numDiffs,
              fileContent,
              filepath: fileUri,
              toolCallId,
            }),
        },
      );

      if (!diffHandler) {
        console.error("[hbuilderx] streamEdit 创建差异处理器失败");
        console.warn("Issue occurred while creating new vertical diff handler");
        return undefined;
      }

      console.log("[hbuilderx] streamEdit 差异处理器创建成功");

      let selectedRange = diffHandler.range;

      console.log("[hbuilderx] streamEdit 初始选择范围", {
        startLine: selectedRange.start.line,
        endLine: selectedRange.end.line,
        isEmpty: selectedRange.isEmpty,
      });

      // Only if the selection is empty, use exact prefix/suffix instead of by line
      if (selectedRange.isEmpty) {
        selectedRange = new hx.Range(
          editor.selection.start.with(undefined, 0),
          editor.selection.end.with(undefined, Number.MAX_SAFE_INTEGER),
        );
        console.log("[hbuilderx] streamEdit 调整空选择范围", {
          startLine: selectedRange.start.line,
          endLine: selectedRange.end.line,
          startCharacter: selectedRange.start.character,
          endCharacter: selectedRange.end.character,
        });
      }

      const rangeContent = editor.document.getText(selectedRange);
      const prefix = pruneLinesFromTop(
        editor.document.getText(
          new hx.Range(new hx.Position(0, 0), selectedRange.start),
        ),
        llm.contextLength / 4,
        llm.model,
      );
      const suffix = pruneLinesFromBottom(
        editor.document.getText(
          new hx.Range(
            selectedRange.end,
            new hx.Position(editor.document.lineCount, 0),
          ),
        ),
        llm.contextLength / 4,
        llm.model,
      );

      console.log("[hbuilderx] streamEdit 内容处理", {
        rangeContentLength: rangeContent.length,
        prefixLength: prefix.length,
        suffixLength: suffix.length,
        contextLength: llm.contextLength,
        model: llm.model,
      });

      let overridePrompt: ChatMessage[] | undefined;
      if (llm.promptTemplates?.apply) {
        console.log("[hbuilderx] streamEdit 使用应用模板", {
          hasPromptTemplate: !!llm.promptTemplates.apply,
        });
        const rendered = llm.renderPromptTemplate(
          llm.promptTemplates.apply,
          [],
          {
            original_code: rangeContent,
            new_code: newCode ?? "",
          },
        );
        overridePrompt =
          typeof rendered === "string"
            ? [{ role: "user", content: rendered }]
            : rendered;
        console.log("[hbuilderx] streamEdit 模板渲染完成", {
          isString: typeof rendered === "string",
          promptLength:
            typeof rendered === "string" ? rendered.length : rendered.length,
        });
      } else {
        console.log("[hbuilderx] streamEdit 未使用应用模板");
      }

      if (editor.selection) {
        // Unselect the range
        editor.selection = new hx.Selection(
          editor.selection.active,
          editor.selection.active,
        );
        console.log("[hbuilderx] streamEdit 清除选择");
      }

      hx.commands.executeCommand("setContext", "continue.streamingDiff", true);

      this.editDecorationManager.clear();
      console.log("[hbuilderx] streamEdit 清除编辑装饰");

      try {
        const streamedLines: string[] = [];

        console.log("[hbuilderx] streamEdit 开始流式差异处理", {
          hasRangeContent: !!rangeContent,
          hasPrefix: !!prefix,
          hasSuffix: !!suffix,
          hasRulesToInclude: !!rulesToInclude,
          hasInput: !!input,
          language: getMarkdownLanguageTagForFile(fileUri),
          onlyOneInsertion,
          hasOverridePrompt: !!overridePrompt,
        });

        async function* recordedStream() {
          const stream = streamDiffLines({
            highlighted: rangeContent,
            prefix,
            suffix,
            llm,
            rulesToInclude,
            input,
            language: getMarkdownLanguageTagForFile(fileUri),
            onlyOneInsertion: !!onlyOneInsertion,
            overridePrompt,
            abortControllerId: fileUri,
          });

          for await (const line of stream) {
            if (line.type === "new" || line.type === "same") {
              streamedLines.push(line.line);
            }
            yield line;
          }
        }

        console.log("[hbuilderx] streamEdit 运行差异处理器");
        this.logDiffs = await diffHandler.run(recordedStream());

        console.log("[hbuilderx] streamEdit 差异处理完成", {
          streamedLinesCount: streamedLines.length,
          logDiffsCount: this.logDiffs?.length || 0,
        });

        // enable a listener for user edits to file while diff is open
        this.enableDocumentChangeListener();
        console.log("[hbuilderx] streamEdit 启用文档变更监听器");

        const result = `${prefix}${streamedLines.join("\n")}${suffix}`;
        console.log("[hbuilderx] streamEdit 返回结果", {
          resultLength: result.length,
        });
        return result;
      } catch (e) {
        console.error("[hbuilderx] streamEdit 内部处理失败", {
          streamId,
          error: e,
          errorMessage: e instanceof Error ? e.message : String(e),
          errorStack: e instanceof Error ? e.stack : undefined,
        });
        this.disableDocumentChangeListener();
        const handled = await handleLLMError(e);
        if (!handled) {
          let message = "Error streaming edit diffs";
          if (e instanceof Error) {
            message += `: ${e.message}`;
          }
          throw new Error(message);
        }
      } finally {
        hx.commands.executeCommand(
          "setContext",
          "continue.streamingDiff",
          false,
        );
        console.log("[hbuilderx] streamEdit 设置流式差异上下文为false");
      }
    } catch (error) {
      console.error("[hbuilderx] streamEdit 失败", {
        streamId,
        error,
        errorMessage: error instanceof Error ? error.message : String(error),
        errorStack: error instanceof Error ? error.stack : undefined,
      });
      throw error;
    }
  }
}
