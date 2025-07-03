const hx = require("hbuilderx");

import { getExtensionUri, getNonce, getUniqueId } from "./util/hbuilderx";
import { getExtensionVersion } from "./util/util";
import { HbuilderXWebviewProtocol } from "./webviewProtocol";

import type { FileEdit } from "core";
import { ConfigHandler } from "core/config/ConfigHandler";

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
        return configHandler.reloadConfig();
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

    let scriptUri: string;
    let styleMainUri: string;
    // GUI资源媒体路径
    const vscMediaUrl: string = hx.Uri.file(`${extensionUri}/gui`).toString();
    console.log("[hbuilderx] 媒体资源URL:", vscMediaUrl);

    // 检查是否为开发模式
    const inDevelopmentMode = context?.extensionMode === 2; //vscode.ExtensionMode.Development;
    console.log("[hbuilderx] 开发模式:", inDevelopmentMode);

    //TODO: 这里需要修改, 可能会有bug
    if (inDevelopmentMode) {
      // 生产模式：使用打包后的资源文件
      console.log("[hbuilderx] 使用生产模式资源");
      scriptUri = hx.Uri.file(`${extensionUri}/gui/assets/index.js`).toString();
      styleMainUri = hx.Uri.file(
        `${extensionUri}/gui/assets/index.css`,
      ).toString();
    } else {
      // 开发模式：使用本地开发服务器
      console.log("[hbuilderx] 使用开发模式资源");
      scriptUri = "http://localhost:5173/src/main.tsx";
      styleMainUri = "http://localhost:5173/src/index.css";
    }

    console.log("[hbuilderx] 脚本URI:", scriptUri);
    console.log("[hbuilderx] 样式URI:", styleMainUri);

    // 配置webview选项
    console.log("[hbuilderx] 配置webview选项");
    this._webview.options = {
      enableScripts: true, // 启用JavaScript
      localResourceRoots: [
        // 允许访问的本地资源根目录
        hx.Uri.file(`${extensionUri}/gui`),
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
    this._webview.html = `<!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <link href="${styleMainUri}" rel="stylesheet">
        
        <style>
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

        ${
          inDevelopmentMode
            ? `<script type="module">
          // React热重载相关配置（仅开发模式）
          import RefreshRuntime from "http://localhost:5173/@react-refresh"
          RefreshRuntime.injectIntoGlobalHook(window)
          window.$RefreshReg$ = () => {}
          window.$RefreshSig$ = () => (type) => type
          window.__vite_plugin_react_preamble_installed__ = true
          </script>`
            : ""
        }

        <script type="module" nonce="${nonce}" src="${scriptUri}"></script>

        <!-- 设置全局变量供前端使用 -->
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
      </body>
    </html>`;

    return this._webview.html;
  }
}
