import { DiffLine } from "core";
import { ConfigHandler } from "core/config/ConfigHandler";
import { applyCodeBlock } from "core/edit/lazy/applyCodeBlock";
import { getUriPathBasename } from "core/util/uri";
const hx = require("vscode");

import { PreviewEditManager } from "../diff/PreviewEditManager";
import { HbuilderXIde } from "../HBuilderXIde";
import { HbuilderXWebviewProtocol } from "../webviewProtocol";

export interface ApplyToFileOptions {
  streamId: string;
  filepath?: string;
  text: string;
  toolCallId?: string;
}

/**
 * 使用HBuilderX原生previewEdit接口的应用管理器
 * 集成了tree-sitter校验、diff格式检测和LLM智能对比等完整逻辑
 */
export class ApplyManager {
  constructor(
    private readonly ide: HbuilderXIde,
    private readonly webviewProtocol: HbuilderXWebviewProtocol,
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

      const editor = await hx.window.getActiveTextEditor();
      if (!editor) {
        console.error("[hbuilderx] 没有活动编辑器，无法应用编辑");
        hx.window.showErrorMessage("No active editor to apply edits to");
        return;
      }

      console.log("[hbuilderx] 获取到活动编辑器", {
        documentUri: editor.document.uri.toString(),
        documentLength: editor.document.getText().length,
      });

      const currentContent = editor.document.getText();
      const hasExistingDocument = !!currentContent.trim();
      console.log("[hbuilderx] 文档状态检查", { hasExistingDocument });

      if (hasExistingDocument) {
        console.log("[hbuilderx] 处理现有文档");
        await this.handleExistingDocument(
          editor,
          currentContent,
          text,
          streamId,
          toolCallId,
        );
      } else {
        console.log("[hbuilderx] 处理空文档");
        await this.handleEmptyDocument(editor, text, streamId, toolCallId);
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
    currentContent: string,
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

      const filename = getUriPathBasename(editor.document.uri.toString());
      console.log("[hbuilderx] 开始智能代码块应用分析", { filename });

      // 使用applyCodeBlock进行智能判断和处理
      const abortController = new AbortController();
      const { isInstantApply, diffLinesGenerator } = await applyCodeBlock(
        currentContent,
        text,
        filename,
        llm,
        abortController,
      );

      console.log("[hbuilderx] 代码块应用分析完成", {
        isInstantApply,
        analysisType: isInstantApply
          ? "即时应用(Tree-sitter/Diff)"
          : "LLM智能对比",
      });

      // 创建PreviewEditManager来处理预览
      const previewEditManager = new PreviewEditManager({
        onStatusUpdate: async (status, numDiffs, fileContent) => {
          await this.webviewProtocol.request("updateApplyState", {
            streamId,
            status: status || "streaming",
            numDiffs: numDiffs || 0,
            fileContent: fileContent || text,
            toolCallId,
          });
        },
      });

      if (isInstantApply) {
        console.log(
          "[hbuilderx] 执行即时应用 - 使用Tree-sitter分析或Diff格式检测",
        );
        await this.handleInstantApply(
          editor,
          diffLinesGenerator,
          previewEditManager,
          streamId,
          toolCallId,
        );
      } else {
        console.log("[hbuilderx] 执行智能差异处理 - 使用LLM进行对比分析");
        await this.handleIntelligentDiff(editor, text, previewEditManager);
      }

      console.log("[hbuilderx] 处理现有文档完成", { streamId });
    } catch (error) {
      console.error("[hbuilderx] 处理现有文档失败", { streamId, error });
      throw error;
    }
  }

  /**
   * 处理即时应用 - 通过Tree-sitter语法分析或Diff格式检测确定的更改
   */
  private async handleInstantApply(
    editor: any,
    diffLinesGenerator: AsyncGenerator<DiffLine>,
    previewEditManager: PreviewEditManager,
    streamId: string,
    toolCallId?: string,
  ) {
    console.log("[hbuilderx] handleInstantApply 开始");

    try {
      // 收集所有diff行
      const diffLines: DiffLine[] = [];
      for await (const diffLine of diffLinesGenerator) {
        diffLines.push(diffLine);
      }

      console.log("[hbuilderx] 收集到diff行数:", diffLines.length);

      // 使用PreviewEditManager进行流式差异处理
      async function* generateDiffLines() {
        for (const diffLine of diffLines) {
          yield diffLine;
        }
      }

      await previewEditManager.applyStreamDiffs(
        editor.document.uri.fsPath,
        generateDiffLines(),
      );

      console.log("[hbuilderx] handleInstantApply 完成");
    } catch (error) {
      console.error("[hbuilderx] handleInstantApply 失败", error);
      throw error;
    }
  }

  /**
   * 处理智能差异 - 通过LLM进行智能对比和分析
   */
  private async handleIntelligentDiff(
    editor: any,
    newText: string,
    previewEditManager: PreviewEditManager,
  ) {
    console.log("[hbuilderx] handleIntelligentDiff 开始");

    try {
      const currentContent = editor.document.getText();
      const fileUri = editor.document.uri.fsPath;

      console.log("[hbuilderx] 执行智能文本差异对比");

      // 使用PreviewEditManager进行文本差异处理
      await previewEditManager.applyTextDiff(fileUri, currentContent, newText);

      console.log("[hbuilderx] handleIntelligentDiff 完成");
    } catch (error) {
      console.error("[hbuilderx] handleIntelligentDiff 失败", error);
      throw error;
    }
  }
}
