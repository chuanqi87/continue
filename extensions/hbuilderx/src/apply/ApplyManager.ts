import { DiffLine } from "core";
import { ConfigHandler } from "core/config/ConfigHandler";
import { applyCodeBlock } from "core/edit/lazy/applyCodeBlock";
import { getUriPathBasename } from "core/util/uri";
const hx = require("vscode");

import { HbuilderXIde } from "../HBuilderXIde";
import { HbuilderXWebviewProtocol } from "../webviewProtocol";

export interface ApplyToFileOptions {
  streamId: string;
  filepath?: string;
  text: string;
  toolCallId?: string;
}

/**
 * HBuilderX 应用管理器
 * 由于 HBuilderX 不支持 diff 展示，采用直接写入文件的方式（跳过 previewEdit）
 * 集成了 tree-sitter 校验、diff 格式检测和 LLM 智能对比等完整逻辑
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
        const filePath =
          filepath ||
          editor.document.uri.fsPath ||
          editor.document.uri.toString();
        await this.handleExistingDocument(
          editor,
          currentContent,
          text,
          filePath,
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

  /**
   * 处理现有文档 - 直接写入文件，跳过 previewEdit 预览
   * HBuilderX 不支持 diff 展示，因此直接将计算好的新内容写入文件
   * 状态从 streaming 直接跳到 closed，不经过 done 等待用户确认
   */
  private async handleExistingDocument(
    editor: any,
    currentContent: string,
    text: string,
    filePath: string,
    streamId: string,
    toolCallId?: string,
  ) {
    console.log("[hbuilderx] 处理现有文档开始（直接写入模式）", {
      streamId,
      filePath,
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

      // 计算最终的新内容
      let newContent: string;
      if (isInstantApply) {
        console.log("[hbuilderx] 从 diffLines 重建新内容（即时应用路径）");
        // 从 diffLines 中提取 "same" 和 "new" 行来重建最终内容
        const diffLines: DiffLine[] = [];
        for await (const diffLine of diffLinesGenerator) {
          diffLines.push(diffLine);
        }
        console.log("[hbuilderx] 收集到 diff 行数:", diffLines.length);

        newContent = diffLines
          .filter((line) => line.type === "same" || line.type === "new")
          .map((line) => line.line)
          .join("\n");
      } else {
        console.log("[hbuilderx] 使用 LLM 对比结果作为新内容");
        newContent = text;
      }

      // 直接写入文件内容（使用 writeFile 替代 editor.edit + builder.replace）
      // HBuilderX 的 editor.edit/positionAt API 在处理中文等多字节字符时
      // 可能存在偏移量计算不一致的问题，导致替换范围不正确
      console.log("[hbuilderx] 直接写入文件内容（writeFile）", {
        filePath,
        oldLength: currentContent.length,
        newLength: newContent.length,
      });

      await this.ide.writeFile(filePath, newContent);
      console.log("[hbuilderx] 文件写入磁盘完成");

      // 重新打开文件以刷新编辑器中的内容
      await this.ide.openFile(filePath);
      console.log("[hbuilderx] 编辑器已刷新");

      // 直接设置状态为 closed，跳过 "done" 等待确认环节
      await this.webviewProtocol.request("updateApplyState", {
        streamId,
        status: "closed",
        numDiffs: 0,
        fileContent: newContent,
        toolCallId,
      });

      console.log("[hbuilderx] 处理现有文档完成（直接写入）", { streamId });
    } catch (error) {
      console.error("[hbuilderx] 处理现有文档失败", { streamId, error });
      throw error;
    }
  }
}
