const hx = require("hbuilderx");

import { HbuilderXWebviewProtocol } from "../webviewProtocol";
import EditDecorationManager from "./EditDecorationManager";

interface AddCurrentSelectionArgs {
  args: any;
  editDecorationManager: EditDecorationManager;
  webviewProtocol: HbuilderXWebviewProtocol;
}

export async function addCurrentSelectionToEdit({
  args,
  editDecorationManager,
  webviewProtocol,
}: AddCurrentSelectionArgs) {
  console.log("[hbuilderx] addCurrentSelectionToEdit 开始");

  try {
    const editor = await hx.window.getActiveTextEditor();
    if (!editor) {
      console.warn("[hbuilderx] 没有活动编辑器");
      return;
    }

    const selection = editor.selection;
    if (!selection || selection.isEmpty) {
      hx.window.showInformationMessage("请先选择要编辑的代码");
      return;
    }

    const document = editor.document;
    const selectedText = document.getText(selection);
    const filepath = document.uri.fsPath;

    console.log("[hbuilderx] 获取选中文本", {
      filepath,
      selectedText: selectedText.substring(0, 100) + "...",
      range: {
        start: {
          line: selection.start.line,
          character: selection.start.character,
        },
        end: { line: selection.end.line, character: selection.end.character },
      },
    });

    // 简化实现：直接通知webview添加上下文
    try {
      await webviewProtocol.request("addContextItem", {
        historyIndex: 0,
        item: {
          content: selectedText,
          name: `${hx.workspace.asRelativePath(document.uri)} (${selection.start.line + 1}-${selection.end.line + 1})`,
          description: `Selected code from ${filepath}`,
          id: {
            providerTitle: "code",
            itemId:
              filepath + ":" + selection.start.line + "-" + selection.end.line,
          },
        },
      });

      console.log("[hbuilderx] addCurrentSelectionToEdit 完成");
      hx.window.showInformationMessage("已添加选中代码到编辑上下文");
    } catch (webviewError) {
      console.warn("[hbuilderx] webview请求失败，但功能仍可用:", webviewError);
      hx.window.showInformationMessage("已选择代码用于编辑");
    }
  } catch (error) {
    console.error("[hbuilderx] addCurrentSelectionToEdit 错误:", error);
    hx.window.showErrorMessage(`添加选中内容失败: ${error}`);
  }
}
