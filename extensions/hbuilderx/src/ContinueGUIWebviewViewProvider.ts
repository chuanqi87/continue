const hx = require("hbuilderx");

import type { FileEdit } from "core";
import { ConfigHandler } from "core/config/ConfigHandler";
import os from "os";
import { getExtensionUri, getNonce, getUniqueId } from "./util/hbuilderx";
import { getExtensionVersion } from "./util/util";
import { HbuilderXWebviewProtocol } from "./webviewProtocol";

export class ContinueGUIWebviewViewProvider {
  public static readonly viewType = "continue.continueGUIView";
  public webviewProtocol: HbuilderXWebviewProtocol;

  public get isReady(): boolean {
    return !!this.webview;
  }

  constructor(
    private readonly webviewPanel: any,
    private readonly configHandlerPromise: Promise<ConfigHandler>,
    private readonly windowId: string,
    private readonly extensionContext: any,
  ) {
    console.log("[hbuilderx] 初始化ContinueGUIWebviewViewProvider");
    console.log("[hbuilderx] windowId:", windowId);

    this.webviewProtocol = new HbuilderXWebviewProtocol(
      (async () => {
        const configHandler = await this.configHandlerPromise;
        return configHandler.reloadConfig(
          "HBuilderX webview protocol initialized",
        );
      }).bind(this),
    );
    this._webviewPanel = webviewPanel;
    this._webview = webviewPanel._webView;

    console.log("[hbuilderx] 设置webview HTML内容");
    // 生成并设置webview的HTML内容
    this.getSidebarContent(this.extensionContext, webviewPanel);
  }

  private _webviewPanel?: any; //hx.WebviewPanel;
  private _webview?: any; //hx.WebviewView;

  get isVisible() {
    return this._webviewPanel?.visible;
  }

  get webview() {
    return this._webview;
  }

  public resetWebviewProtocolWebview(): void {
    console.log("[hbuilderx] 重置webview协议的webview引用");

    if (this._webview) {
      this.webviewProtocol.webview = this._webview;
    } else {
      console.warn("[hbuilderx] 重置时未找到webview实例");
    }
  }

  sendMainUserInput(input: string) {
    console.log("[hbuilderx] 发送用户输入到webview:", input);
    this._webview?.postMessage({
      type: "userInput",
      input,
    });
  }

  async getSidebarContent(
    context: any, //hx.ExtensionContext,
    panel: any, //hx.WebviewPanel,
    page: string | undefined = undefined,
    edits: FileEdit[] | undefined = undefined,
    isFullScreen = false,
  ) {
    console.log("[hbuilderx] 开始生成webview HTML内容");
    console.log("[hbuilderx] 页面参数:", page);

    // 获取扩展安装路径URI
    const extensionUri = getExtensionUri();
    console.log("[hbuilderx] 扩展URI:", extensionUri);

    // GUI资源媒体路径
    const vscMediaUrl: string = hx.Uri.file(
      `${extensionUri}/out/gui`,
    ).toString();
    console.log("[hbuilderx] 媒体资源URL:", vscMediaUrl);

    // 生产模式：使用打包后的资源文件
    console.log("[hbuilderx] 使用生产模式资源");
    let scriptUri = hx.Uri.file(
      `${extensionUri}/out/gui/assets/index.js`,
    ).toString();
    let styleMainUri = hx.Uri.file(
      `${extensionUri}/out/gui/assets/index.css`,
    ).toString();
    let styleXCircleIconUri = hx.Uri.file(
      `${extensionUri}/out/gui/assets/XCircleIcon.js`,
    ).toString();
    // SystemJS loader (用于Windows平台兼容性)
    let systemJsUri = hx.Uri.file(
      `${extensionUri}/out/gui/assets/system.js`,
    ).toString();
    console.log("[hbuilderx] 脚本URI:", scriptUri);
    console.log("[hbuilderx] 样式URI:", styleMainUri);

    // 配置webview选项
    console.log("[hbuilderx] 配置webview选项");
    this._webview.options = {
      enableScripts: true, // 启用JavaScript
      localResourceRoots: [
        // 允许访问的本地资源根目录
        hx.Uri.file(`${extensionUri}/out/gui`),
        hx.Uri.file(`${extensionUri}/assets`),
      ],
      enableCommandUris: true, // 启用命令URI
      portMapping: [
        {
          // 端口映射配置（用于开发模式）
          webviewPort: 65433,
          extensionHostPort: 65433,
        },
      ],
    };

    // 生成安全nonce用于CSP
    const nonce = getNonce();
    console.log("[hbuilderx] 生成nonce:", nonce);

    // TODO: 暂不支持主题设置
    // const currentTheme = getTheme();
    // hx.workspace.onDidChangeConfiguration((e) => {
    //   if (
    //     e.affectsConfiguration("workbench.colorTheme") ||
    //     e.affectsConfiguration("window.autoDetectColorScheme") ||
    //     e.affectsConfiguration("window.autoDetectHighContrast") ||
    //     e.affectsConfiguration("workbench.preferredDarkColorTheme") ||
    //     e.affectsConfiguration("workbench.preferredLightColorTheme") ||
    //     e.affectsConfiguration("workbench.preferredHighContrastColorTheme") ||
    //     e.affectsConfiguration("workbench.preferredHighContrastLightColorTheme")
    //   ) {
    //     // Send new theme to GUI to update embedded Monaco themes
    //     this.webviewProtocol?.request("setTheme", { theme: getTheme() });
    //   }
    // });

    this.webviewProtocol.webview = panel._webView;

    console.log("[hbuilderx] 生成最终HTML内容");

    // 返回完整的HTML内容
    const html = `<!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <link href="${styleMainUri}" rel="stylesheet">
        <link rel="modulepreload" href="${styleXCircleIconUri}">
        <style>
          /* HBuilderX深色主题CSS变量 - 与VSCode Dark+主题保持一致 */
          :root, body, html {
            /* 基础颜色 */
            --vscode-editor-background: #1e1e1e;
            --vscode-editor-foreground: #d4d4d4;
            --vscode-sideBar-background: #252526;
            --vscode-sideBar-foreground: #cccccc;
            --vscode-panel-background: #1e1e1e;
            --vscode-panel-foreground: #d4d4d4;
            --vscode-sideBar-border: #2d2d30;
            --vscode-panel-border: #2d2d30;
            
            /* 按钮颜色 */
            --vscode-button-background: #0e639c;
            --vscode-button-foreground: #ffffff;
            --vscode-button-hoverBackground: #1177bb;
            --vscode-button-secondaryBackground: #3a3d41;
            --vscode-button-secondaryForeground: #cccccc;
            --vscode-button-secondaryHoverBackground: #45494e;
            
            /* 输入框颜色 */
            --vscode-input-background: #3c3c3c;
            --vscode-input-foreground: #cccccc;
            --vscode-input-border: #3c3c3c;
            --vscode-input-placeholderForeground: #a6a6a6;
            
            /* 焦点和边框 */
            --vscode-focusBorder: #007fd4;
            --vscode-commandCenter-background: #2d2d30;
            --vscode-commandCenter-foreground: #cccccc;
            --vscode-commandCenter-activeBorder: #007fd4;
            --vscode-commandCenter-inactiveBorder: #454545;
            
            /* 列表和树 */
            --vscode-list-hoverBackground: #2a2d2e;
            --vscode-list-activeSelectionBackground: #094771;
            --vscode-list-activeSelectionForeground: #ffffff;
            --vscode-list-inactiveSelectionBackground: #37373d;
            --vscode-list-warningForeground: #cca700;
            --vscode-list-errorForeground: #f48771;
            --vscode-list-deemphasizedForeground: #8c8c8c;
            --vscode-tree-tableOddRowsBackground: #2d2d30;
            
            /* 描述性文本 */
            --vscode-descriptionForeground: #ccccccb3;
            
            /* 徽章 */
            --vscode-badge-background: #4d4d4d;
            --vscode-badge-foreground: #ffffff;
            
            /* 文本链接 */
            --vscode-textLink-foreground: #3794ff;
            --vscode-textLink-activeForeground: #3794ff;
            
            /* 代码块 */
            --vscode-textCodeBlock-background: #1e1e1e;
            
            /* 状态颜色 */
            --vscode-editorError-foreground: #f48771;
            --vscode-editorWarning-foreground: #cca700;
            --vscode-notebookStatusSuccessIcon-foreground: #89d185;
            --vscode-notebookStatusRunningIcon-foreground: #3794ff;
            --vscode-testing-iconPassed: #89d185;
            --vscode-gitDecoration-addedResourceForeground: #89d185;
            
            /* 图表颜色 */
            --vscode-charts-blue: #3794ff;
            --vscode-charts-green: #89d185;
            
            /* 终端颜色 */
            --vscode-terminal-ansiGreen: #0dbc79;
            
            /* 标签页 */
            --vscode-tab-activeBorderTop: #3794ff;
            --vscode-tab-hoverBackground: #2a2d2e;
            
            /* 查找高亮 */
            --vscode-editor-findMatchBackground: #515c6a;
            --vscode-editor-findMatchHighlightBackground: #ea5c0055;
            
            /* 滚动条 */
            --vscode-scrollbarSlider-background: #79797966;
            --vscode-scrollbarSlider-hoverBackground: #646464b3;
            --vscode-scrollbarSlider-activeBackground: #bfbfbf66;
          }
          
          /* 字体设置 */
          * {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Helvetica Neue", Arial, "Noto Sans", sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji" !important;
          }
          
          /* 针对中文字符的字体设置 */
          :lang(zh), :lang(zh-CN), :lang(zh-TW) {
            font-family: -apple-system, BlinkMacSystemFont, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "WenQuanYi Micro Hei", sans-serif !important;
          }
          
          /* 覆盖可能的字体指定 */
          body, div, span, p, h1, h2, h3, h4, h5, h6, input, textarea, button {
            font-family: inherit !important;
          }
        </style>

        <title>Continue</title>
      </head>
      <body lang="zh-CN">
        <div id="root"></div>
        
        <!-- 设置全局变量供前端使用（必须在加载脚本前设置） -->
        <script>localStorage.setItem("ide", '"hbuilderx"')</script>
        <script>localStorage.setItem("extensionVersion", '"${getExtensionVersion()}"')</script>
        <script>window.windowId = "${this.windowId}"</script>
        <script>window.vscMachineId = "${getUniqueId()}"</script>
        <script>window.vscMediaUrl = "${vscMediaUrl}"</script>
        <script>window.ide = "hbuilderx"</script>
        <script>window.colorThemeName = "dark-plus"</script>
                <script>window.workspacePaths = ${JSON.stringify(
                  hx.workspace.workspaceFolders?.map((folder: any) =>
                    folder.uri.toString(),
                  ) || [],
                )}</script>
        <script>window.isFullScreen = ${isFullScreen}</script>

        ${
          edits
            ? `<!-- 传递编辑信息到前端 -->
               <script>window.edits = ${JSON.stringify(edits)}</script>`
            : ""
        }
        ${
          page
            ? `<!-- 设置初始页面路径 -->
               <script>window.location.pathname = "${page}"</script>`
            : ""
        }
        
        <!-- 加载主应用脚本（ES Module格式） -->
        <script type="module" nonce="${nonce}" src="${scriptUri}"></script>
      </body>
    </html>`;

    // Windows平台HTML（使用SystemJS格式，兼容老版本浏览器）
    // HBuilderX Windows版本的webview较老，不支持ES Module
    const winHtml = `<!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <link href="${styleMainUri}" rel="stylesheet">
        <style>
          /* HBuilderX深色主题CSS变量 - 与VSCode Dark+主题保持一致 */
          :root, body, html {
            /* 基础颜色 */
            --vscode-editor-background: #1e1e1e;
            --vscode-editor-foreground: #d4d4d4;
            --vscode-sideBar-background: #252526;
            --vscode-sideBar-foreground: #cccccc;
            --vscode-panel-background: #1e1e1e;
            --vscode-panel-foreground: #d4d4d4;
            --vscode-sideBar-border: #2d2d30;
            --vscode-panel-border: #2d2d30;
            
            /* 按钮颜色 */
            --vscode-button-background: #0e639c;
            --vscode-button-foreground: #ffffff;
            --vscode-button-hoverBackground: #1177bb;
            --vscode-button-secondaryBackground: #3a3d41;
            --vscode-button-secondaryForeground: #cccccc;
            --vscode-button-secondaryHoverBackground: #45494e;
            
            /* 输入框颜色 */
            --vscode-input-background: #3c3c3c;
            --vscode-input-foreground: #cccccc;
            --vscode-input-border: #3c3c3c;
            --vscode-input-placeholderForeground: #a6a6a6;
            
            /* 焦点和边框 */
            --vscode-focusBorder: #007fd4;
            --vscode-commandCenter-background: #2d2d30;
            --vscode-commandCenter-foreground: #cccccc;
            --vscode-commandCenter-activeBorder: #007fd4;
            --vscode-commandCenter-inactiveBorder: #454545;
            
            /* 列表和树 */
            --vscode-list-hoverBackground: #2a2d2e;
            --vscode-list-activeSelectionBackground: #094771;
            --vscode-list-activeSelectionForeground: #ffffff;
            --vscode-list-inactiveSelectionBackground: #37373d;
            --vscode-list-warningForeground: #cca700;
            --vscode-list-errorForeground: #f48771;
            --vscode-list-deemphasizedForeground: #8c8c8c;
            --vscode-tree-tableOddRowsBackground: #2d2d30;
            
            /* 描述性文本 */
            --vscode-descriptionForeground: #ccccccb3;
            
            /* 徽章 */
            --vscode-badge-background: #4d4d4d;
            --vscode-badge-foreground: #ffffff;
            
            /* 文本链接 */
            --vscode-textLink-foreground: #3794ff;
            --vscode-textLink-activeForeground: #3794ff;
            
            /* 代码块 */
            --vscode-textCodeBlock-background: #1e1e1e;
            
            /* 状态颜色 */
            --vscode-editorError-foreground: #f48771;
            --vscode-editorWarning-foreground: #cca700;
            --vscode-notebookStatusSuccessIcon-foreground: #89d185;
            --vscode-notebookStatusRunningIcon-foreground: #3794ff;
            --vscode-testing-iconPassed: #89d185;
            --vscode-gitDecoration-addedResourceForeground: #89d185;
            
            /* 图表颜色 */
            --vscode-charts-blue: #3794ff;
            --vscode-charts-green: #89d185;
            
            /* 终端颜色 */
            --vscode-terminal-ansiGreen: #0dbc79;
            
            /* 标签页 */
            --vscode-tab-activeBorderTop: #3794ff;
            --vscode-tab-hoverBackground: #2a2d2e;
            
            /* 查找高亮 */
            --vscode-editor-findMatchBackground: #515c6a;
            --vscode-editor-findMatchHighlightBackground: #ea5c0055;
            
            /* 滚动条 */
            --vscode-scrollbarSlider-background: #79797966;
            --vscode-scrollbarSlider-hoverBackground: #646464b3;
            --vscode-scrollbarSlider-activeBackground: #bfbfbf66;
          }
          
          /* 字体设置 */
          * {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Helvetica Neue", Arial, "Noto Sans", sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji" !important;
          }
          
          /* 针对中文字符的字体设置 */
          :lang(zh), :lang(zh-CN), :lang(zh-TW) {
            font-family: -apple-system, BlinkMacSystemFont, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "WenQuanYi Micro Hei", sans-serif !important;
          }
          
          /* 覆盖可能的字体指定 */
          body, div, span, p, h1, h2, h3, h4, h5, h6, input, textarea, button {
            font-family: inherit !important;
          }
        </style>

        <title>Continue</title>
      </head>
      <body lang="zh-CN">
        <div id="root"></div>
        
        <!-- 设置全局变量供前端使用（必须在加载脚本前设置） -->
        <script>localStorage.setItem("ide", '"hbuilderx"')</script>
        <script>localStorage.setItem("extensionVersion", '"${getExtensionVersion()}"')</script>
        <script>window.windowId = "${this.windowId}"</script>
        <script>window.vscMachineId = "${getUniqueId()}"</script>
        <script>window.vscMediaUrl = "${vscMediaUrl}"</script>
        <script>window.ide = "hbuilderx"</script>
        <script>window.colorThemeName = "dark-plus"</script>
                <script>window.workspacePaths = ${JSON.stringify(
                  hx.workspace.workspaceFolders?.map((folder: any) =>
                    folder.uri.toString(),
                  ) || [],
                )}</script>
        <script>window.isFullScreen = ${isFullScreen}</script>

        ${
          edits
            ? `<!-- 传递编辑信息到前端 -->
               <script>window.edits = ${JSON.stringify(edits)}</script>`
            : ""
        }
        ${
          page
            ? `<!-- 设置初始页面路径 -->
               <script>window.location.pathname = "${page}"</script>`
            : ""
        }
        
        <!-- 加载SystemJS格式的应用脚本 -->
        <!-- SystemJS已经内嵌在构建的脚本中，直接加载即可 -->
        <script nonce="${nonce}" src="${scriptUri}"></script>
      </body>
    </html>`;

    this._webview.html = os.platform() === "win32" ? winHtml : html;

    return this._webview.html;
  }
}
