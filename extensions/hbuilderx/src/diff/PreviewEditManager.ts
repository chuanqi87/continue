import type { ApplyState, DiffLine } from "core";
const hx = require("vscode");

export interface PreviewEditOptions {
  onStatusUpdate?: (
    status?: ApplyState["status"],
    numDiffs?: ApplyState["numDiffs"],
    fileContent?: ApplyState["fileContent"],
  ) => void;
}

/**
 * 使用HBuilderX原生previewEdit接口的预览编辑管理器
 */
export class PreviewEditManager {
  constructor(private options: PreviewEditOptions = {}) {}

  /**
   * 应用文本差异并显示预览
   */
  async applyTextDiff(
    fileUri: string,
    oldContent: string,
    newContent: string,
  ): Promise<void> {
    console.log("[hbuilderx] PreviewEditManager.applyTextDiff 开始", {
      fileUri,
      oldContentLength: oldContent.length,
      newContentLength: newContent.length,
    });

    try {
      // 更新状态为处理中
      this.options.onStatusUpdate?.("streaming", undefined, newContent);

      // 使用diff.structuredPatch()生成结构化差异
      const diff = require("diff");
      const patches = diff.structuredPatch(
        "old", // oldFileName
        "new", // newFileName
        oldContent,
        newContent,
        undefined, // oldHeader
        undefined, // newHeader
        { context: 3 }, // options
      );

      // 打印patches基本信息
      console.log("[hbuilderx] structuredPatch基本信息", {
        hunksCount: patches.hunks.length,
        oldFileName: patches.oldFileName,
        newFileName: patches.newFileName,
      });

      // 转换patches为TextEdit格式
      const textEdits: any[] = [];

      patches.hunks.forEach((hunk: any, hunkIndex: number) => {
        // 计算删除和新增的行
        let oldLineCount = 0;
        let newLineCount = 0;
        let newContent = "";

        // 分析hunk中的每一行
        hunk.lines.forEach((line: string, lineIndex: number) => {
          const prefix = line.charAt(0);
          const content = line.substring(1);

          switch (prefix) {
            case " ": // 相同行
              oldLineCount++;
              newLineCount++;
              break;
            case "-": // 删除行
              oldLineCount++;
              break;
            case "+": // 新增行
              newLineCount++;
              newContent += content + "\n";
              break;
          }
        });

        // 移除最后一个换行符
        if (newContent.endsWith("\n")) {
          newContent = newContent.slice(0, -1);
        }

        // 如果有变化，创建TextEdit
        if (oldLineCount !== newLineCount || newContent.length > 0) {
          // 正确理解structuredPatch的格式：
          // oldStart: 原始文件中hunk的起始行号（1基索引）
          // oldLines: 原始文件中hunk覆盖的行数
          // newStart: 新文件中hunk的起始行号（1基索引）
          // newLines: 新文件中hunk覆盖的行数
          // lines: 差异行数组，包含上下文行

          // 重新理解：hunk.lines数组中的行号映射
          // 每行的行号 = hunk.oldStart + 当前行在hunk中的位置
          const hunkStartLine = hunk.oldStart - 1; // 转换为0基索引
          let currentLine = hunkStartLine;
          let deleteLines: number[] = [];
          let insertLines: string[] = [];

          // 遍历hunk.lines，找到删除行的实际位置
          hunk.lines.forEach((line: string, lineIndex: number) => {
            const prefix = line.charAt(0);
            const content = line.substring(1);

            switch (prefix) {
              case " ": // 相同行（上下文）
                currentLine++;
                break;
              case "-": // 删除行
                deleteLines.push(currentLine);
                currentLine++;
                break;
              case "+": // 新增行
                insertLines.push(content);
                break;
            }
          });

          // 如果有删除行，创建替换编辑
          if (deleteLines.length > 0) {
            const startLine = deleteLines[0];
            const lastDeleteLine = deleteLines[deleteLines.length - 1];
            const oldLinesArr = oldContent.split("\n");
            const endChar = (oldLinesArr[lastDeleteLine] ?? "").length;

            const textEdit = new hx.TextEdit(
              {
                start: new hx.Position(startLine, 0),
                end: new hx.Position(lastDeleteLine, endChar),
              },
              newContent,
            );

            textEdits.push(textEdit);
          }
        }
      });

      if (textEdits.length === 0) {
        console.log("[hbuilderx] 没有差异，直接完成");
        this.options.onStatusUpdate?.("closed", 0, newContent);
        return;
      }

      // 创建WorkspaceEdit
      const workspaceEdit = new hx.WorkspaceEdit();

      // 确保fileUri是正确的file://协议格式
      let normalizedUri = fileUri;
      if (!fileUri.startsWith("file://")) {
        normalizedUri = fileUri.startsWith("/")
          ? `file://${fileUri}`
          : `file:///${fileUri}`;
      }

      const uri = hx.Uri.parse(normalizedUri);

      workspaceEdit.set(uri.fsPath, textEdits);

      try {
        // 调用HBuilderX的预览编辑接口
        const result = await hx.workspace.previewEdit(workspaceEdit);

        // 检查是否有返回值或错误
        if (result === false || result === null) {
        }
      } catch (previewError) {
        // 尝试备用方案：直接应用编辑
        console.log("[hbuilderx] 尝试备用方案：直接应用WorkspaceEdit");
        try {
          await hx.workspace.applyEdit(workspaceEdit);
        } catch (applyError) {
          throw previewError; // 抛出原始错误
        }
      }

      // 更新状态为完成
      this.options.onStatusUpdate?.("done", textEdits.length, newContent);
    } catch (error) {
      console.error("[hbuilderx] PreviewEditManager.applyTextDiff 失败", error);
      this.options.onStatusUpdate?.("closed", 0, oldContent);
      throw error;
    }
  }

  /**
   * 应用流式差异
   */
  async applyStreamDiffs(
    fileUri: string,
    diffStream: AsyncGenerator<DiffLine>,
  ): Promise<void> {
    try {
      // 收集所有差异行
      const diffLines: DiffLine[] = [];
      for await (const diffLine of diffStream) {
        diffLines.push(diffLine);
      }

      // 重建原始内容和新内容
      const oldContent = diffLines
        .filter((line) => line.type === "same" || line.type === "old")
        .map((line) => line.line)
        .join("\n");

      const newContent = diffLines
        .filter((line) => line.type === "same" || line.type === "new")
        .map((line) => line.line)
        .join("\n");

      // 应用差异
      await this.applyTextDiff(fileUri, oldContent, newContent);
    } catch (error) {
      console.error(
        "[hbuilderx] PreviewEditManager.applyStreamDiffs 失败",
        error,
      );
      throw error;
    }
  }

  /**
   * 直接替换文件内容
   */
  async replaceFileContent(
    fileUri: string,
    oldContent: string,
    newContent: string,
  ): Promise<void> {
    try {
      this.options.onStatusUpdate?.("streaming", undefined, newContent);

      const workspaceEdit = new hx.WorkspaceEdit();
      const uri = hx.Uri.parse(fileUri);

      // 创建一个完整替换的TextEdit
      const fullRange = new hx.Range(
        new hx.Position(0, 0),
        new hx.Position(Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER),
      );

      const textEdit = new hx.TextEdit(fullRange, newContent);
      workspaceEdit.set(uri, [textEdit]);

      await hx.workspace.previewEdit(workspaceEdit);

      this.options.onStatusUpdate?.("done", 1, newContent);
      console.log("[hbuilderx] PreviewEditManager.replaceFileContent 完成");
    } catch (error) {
      console.error(
        "[hbuilderx] PreviewEditManager.replaceFileContent 失败",
        error,
      );
      this.options.onStatusUpdate?.("closed", 0, oldContent);
      throw error;
    }
  }

  /**
   * 清理资源
   */
  dispose(): void {
    // 如果需要清理资源，在这里处理
  }
}
