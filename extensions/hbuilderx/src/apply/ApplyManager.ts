import { ConfigHandler } from "core/config/ConfigHandler";
import { applyCodeBlock } from "core/edit/lazy/applyCodeBlock";
import { getUriPathBasename } from "core/util/uri";
const hx = require("hbuilderx");

import { VerticalDiffManager } from "../diff/vertical/manager";
import { HbuilderXIde } from "../HbuilderXIde";
import { HbuilderXWebviewProtocol } from "../webviewProtocol";

export interface ApplyToFileOptions {
  streamId: string;
  filepath?: string;
  text: string;
  toolCallId?: string;
}

/**
 * Handles applying text/code to files including diff generation and streaming
 */
export class ApplyManager {
  constructor(
    private readonly ide: HbuilderXIde,
    private readonly webviewProtocol: HbuilderXWebviewProtocol,
    private readonly verticalDiffManager: VerticalDiffManager,
    private readonly configHandler: ConfigHandler,
  ) {}

  async applyToFile({
    streamId,
    filepath,
    text,
    toolCallId,
  }: ApplyToFileOptions) {
    console.log("[hbuilderx] ApplyManager.applyToFile 开始", {
      streamId,
      filepath,
      textLength: text?.length || 0,
      toolCallId,
    });

    try {
      console.log("[hbuilderx] 更新应用状态为 streaming");
      await this.webviewProtocol.request("updateApplyState", {
        streamId,
        status: "streaming",
        fileContent: text,
        toolCallId,
      });

      if (filepath) {
        console.log("[hbuilderx] 确保文件打开", { filepath });
        await this.ensureFileOpen(filepath);
      }

      const { activeTextEditor } = hx.window;
      if (!activeTextEditor) {
        console.error("[hbuilderx] 没有活动编辑器，无法应用编辑");
        hx.window.showErrorMessage("No active editor to apply edits to");
        return;
      }

      console.log("[hbuilderx] 获取到活动编辑器", {
        documentUri: activeTextEditor.document.uri.toString(),
        documentLength: activeTextEditor.document.getText().length,
      });

      const hasExistingDocument = !!activeTextEditor.document.getText().trim();
      console.log("[hbuilderx] 文档状态检查", { hasExistingDocument });

      if (hasExistingDocument) {
        console.log("[hbuilderx] 处理现有文档");
        await this.handleExistingDocument(
          activeTextEditor,
          text,
          streamId,
          toolCallId,
        );
      } else {
        console.log("[hbuilderx] 处理空文档");
        await this.handleEmptyDocument(
          activeTextEditor,
          text,
          streamId,
          toolCallId,
        );
      }

      console.log("[hbuilderx] ApplyManager.applyToFile 完成");
    } catch (error) {
      console.error("[hbuilderx] ApplyManager.applyToFile 失败", error);
      throw error;
    }
  }

  private async ensureFileOpen(filepath: string): Promise<void> {
    console.log("[hbuilderx] ensureFileOpen 开始", { filepath });
    const fileExists = await this.ide.fileExists(filepath);
    console.log("[hbuilderx] 文件存在检查", { filepath, fileExists });

    if (!fileExists) {
      console.log("[hbuilderx] 创建新文件", { filepath });
      await this.ide.writeFile(filepath, "");
      await this.ide.openFile(filepath);
    }
    console.log("[hbuilderx] 打开文件", { filepath });
    await this.ide.openFile(filepath);
    console.log("[hbuilderx] ensureFileOpen 完成", { filepath });
  }

  private async handleEmptyDocument(
    editor: any,
    text: string,
    streamId: string,
    toolCallId?: string,
  ) {
    console.log("[hbuilderx] 处理空文档开始", {
      streamId,
      textLength: text.length,
    });

    try {
      console.log("[hbuilderx] 执行编辑器插入操作");
      await editor.edit((builder: any) =>
        builder.insert(new hx.Position(0, 0), text),
      );

      console.log("[hbuilderx] 更新应用状态为 closed");
      await this.webviewProtocol.request("updateApplyState", {
        streamId,
        status: "closed",
        numDiffs: 0,
        fileContent: text,
        toolCallId,
      });

      console.log("[hbuilderx] 处理空文档完成", { streamId });
    } catch (error) {
      console.error("[hbuilderx] 处理空文档失败", { streamId, error });
      throw error;
    }
  }

  private async handleExistingDocument(
    editor: any,
    text: string,
    streamId: string,
    toolCallId?: string,
  ) {
    console.log("[hbuilderx] 处理现有文档开始", {
      streamId,
      textLength: text.length,
    });

    try {
      console.log("[hbuilderx] 加载配置");
      const { config } = await this.configHandler.loadConfig();
      if (!config) {
        console.error("[hbuilderx] 配置未加载");
        hx.window.showErrorMessage("Config not loaded");
        return;
      }

      const llm =
        config.selectedModelByRole.apply ?? config.selectedModelByRole.chat;
      if (!llm) {
        console.error("[hbuilderx] 未找到apply或chat模型");
        hx.window.showErrorMessage(
          `No model with roles "apply" or "chat" found in config.`,
        );
        return;
      }

      console.log("[hbuilderx] 使用模型", { modelTitle: llm.title });

      console.log("[hbuilderx] 开始生成代码块应用");
      const { isInstantApply, diffLinesGenerator } = await applyCodeBlock(
        editor.document.getText(),
        text,
        getUriPathBasename(editor.document.uri.toString()),
        llm,
      );

      console.log("[hbuilderx] 代码块应用生成完成", { isInstantApply });

      if (isInstantApply) {
        console.log("[hbuilderx] 执行即时应用");
        await this.verticalDiffManager.streamDiffLines(
          diffLinesGenerator,
          isInstantApply,
          streamId,
          toolCallId,
        );
      } else {
        console.log("[hbuilderx] 执行非即时应用差异处理");
        await this.handleNonInstantDiff(
          editor,
          text,
          llm,
          streamId,
          this.verticalDiffManager,
          toolCallId,
        );
      }

      console.log("[hbuilderx] 处理现有文档完成", { streamId });
    } catch (error) {
      console.error("[hbuilderx] 处理现有文档失败", { streamId, error });
      throw error;
    }
  }

  /**
   * Creates a prompt for applying code edits
   */
  private getApplyPrompt(text: string): string {
    return `The following code was suggested as an edit:\n\`\`\`\n${text}\n\`\`\`\nPlease apply it to the previous code.`;
  }

  private async handleNonInstantDiff(
    editor: any,
    text: string,
    llm: any,
    streamId: string,
    verticalDiffManager: VerticalDiffManager,
    toolCallId?: string,
  ) {
    console.log("[hbuilderx] 处理非即时差异开始", { streamId });

    try {
      const { config } = await this.configHandler.loadConfig();
      if (!config) {
        console.error("[hbuilderx] 配置未加载");
        hx.window.showErrorMessage("Config not loaded");
        return;
      }

      const prompt = this.getApplyPrompt(text);
      console.log("[hbuilderx] 生成应用提示", { promptLength: prompt.length });

      const fullEditorRange = new hx.Range(
        0,
        0,
        editor.document.lineCount - 1,
        editor.document.lineAt(editor.document.lineCount - 1).text.length,
      );
      const rangeToApplyTo = editor.selection.isEmpty
        ? fullEditorRange
        : editor.selection;

      console.log("[hbuilderx] 确定应用范围", {
        isFullDocument: editor.selection.isEmpty,
        rangeStartLine: rangeToApplyTo.start.line,
        rangeEndLine: rangeToApplyTo.end.line,
      });

      console.log("[hbuilderx] 开始流式编辑");
      await verticalDiffManager.streamEdit({
        input: prompt,
        llm,
        streamId,
        range: rangeToApplyTo,
        newCode: text,
        toolCallId,
        rulesToInclude: undefined, // No rules for apply
      });

      console.log("[hbuilderx] 处理非即时差异完成", { streamId });
    } catch (error) {
      console.error("[hbuilderx] 处理非即时差异失败", { streamId, error });
      throw error;
    }
  }
}
