/* eslint-disable @typescript-eslint/naming-convention */
import { ILLM, RuleWithSource } from "core";
import { ConfigHandler } from "core/config/ConfigHandler";
const hx = require("hbuilderx");

import { HbuilderXIde } from "../HBuilderXIde";
import { HbuilderXWebviewProtocol } from "../webviewProtocol";

export class QuickEdit {
  /**
   * Matches the search char followed by non-space chars, excluding matches ending with a space.
   * This is used to detect file search queries while allowing subsequent prompt text
   */
  private static readonly fileSearchRegex = /@[^\s]+(?<!\s)/g;

  private range: hx.Range | undefined = undefined;
  private editorWhenOpened: any;
  private quickPick: any;
  private contextProviderStr: string | undefined;
  private previousInput = "";

  constructor(
    private readonly configHandler: ConfigHandler,
    private readonly webviewProtocol: HbuilderXWebviewProtocol,
    private readonly ide: HbuilderXIde,
    private readonly context: any,
  ) {}

  private async getContextProviderStr(
    query: string,
    config: any,
  ): Promise<string | undefined> {
    if (!config?.contextProviders) {
      return undefined;
    }

    // Find file context providers
    const fileContextProviders = config.contextProviders.filter(
      (provider: any) =>
        ["file", "folder", "search", "url", "tree-sitter", "code"].includes(
          provider.description.title.toLowerCase(),
        ),
    );

    if (fileContextProviders.length === 0) {
      return undefined;
    }

    // Use the first available file context provider
    const provider = fileContextProviders[0];

    try {
      const contextItems = await this.ide.getContextItems(
        provider.description.title,
        query,
        {},
      );

      if (contextItems && contextItems.length > 0) {
        return contextItems.map((item: any) => item.content).join("\n\n");
      }
    } catch (error) {
      console.warn(
        "[hbuilderx] Failed to get context from provider:",
        provider.description.title,
        error,
      );
    }

    return undefined;
  }

  private async streamResponse(
    input: string,
    llm: ILLM,
    rules: RuleWithSource[],
  ) {
    try {
      console.log("[hbuilderx] QuickEdit streamResponse 开始");

      const messages = [
        {
          role: "system" as const,
          content: `You are a helpful coding assistant. Please respond to the user's query about their code.
          
${rules.map((rule) => rule.rule).join("\n")}`,
        },
        {
          role: "user" as const,
          content: input,
        },
      ];

      console.log("[hbuilderx] 开始流式响应");

      for await (const chunk of llm.streamChat(messages)) {
        console.log("[hbuilderx] 收到响应块:", chunk.content);

        // 在控制台显示响应
        if (chunk.content) {
          hx.window.showInformationMessage(chunk.content, ["确定"]);
        }
      }

      console.log("[hbuilderx] QuickEdit streamResponse 完成");
    } catch (error) {
      console.error("[hbuilderx] QuickEdit streamResponse 错误:", error);
      hx.window.showErrorMessage(`QuickEdit 错误: ${error}`);
    }
  }

  async show() {
    console.log("[hbuilderx] QuickEdit.show() 开始");

    try {
      const { config } = await this.configHandler.loadConfig();
      if (!config) {
        hx.window.showErrorMessage("无法加载配置");
        return;
      }

      const model =
        config.selectedModelByRole?.edit ?? config.selectedModelByRole?.chat;
      if (!model) {
        hx.window.showErrorMessage("未选择编辑或聊天模型");
        return;
      }

      console.log("[hbuilderx] 使用模型:", model.title);

      // 获取当前编辑器和选择
      const editor = await hx.window.getActiveTextEditor();
      if (!editor) {
        hx.window.showErrorMessage("没有活动的编辑器");
        return;
      }

      this.editorWhenOpened = editor;
      this.range =
        editor.selection && !editor.selection.isEmpty
          ? new hx.Range(editor.selection.start, editor.selection.end)
          : undefined;

      console.log("[hbuilderx] 编辑器信息获取完成");

      // 显示输入对话框
      const input = await hx.window.showInputBox({
        prompt: "请输入您的编辑指令",
        placeHolder: "例如: 添加注释, 重构这个函数, 修复bug等...",
      });

      if (!input || input.trim() === "") {
        console.log("[hbuilderx] 用户取消输入");
        return;
      }

      console.log("[hbuilderx] 用户输入:", input);

      // 获取上下文
      let fullInput = input;
      if (this.range) {
        const selectedText = editor.document.getText(this.range);
        fullInput = `请对以下代码进行编辑:\n\n\`\`\`\n${selectedText}\n\`\`\`\n\n编辑指令: ${input}`;
      }

      // 获取上下文提供者内容
      const contextStr = await this.getContextProviderStr(input, config);
      if (contextStr) {
        fullInput = `${contextStr}\n\n${fullInput}`;
      }

      console.log("[hbuilderx] 准备发送到模型");

      // 流式响应
      await this.streamResponse(fullInput, model, config.rules || []);
    } catch (error) {
      console.error("[hbuilderx] QuickEdit.show() 错误:", error);
      hx.window.showErrorMessage(`QuickEdit 错误: ${error}`);
    }
  }
}
