const hx = require("hbuilderx");
import { ConfigHandler } from "core/config/ConfigHandler";
import { Core } from "core/core";
import { FromCoreProtocol, ToCoreProtocol } from "core/protocol";
import { InProcessMessenger } from "core/protocol/messenger";
import { v4 as uuidv4 } from "uuid";
import { registerAllCommands } from "../commands";
import { ContinueGUIWebviewViewProvider } from "../ContinueGUIWebviewViewProvider";
import { VerticalDiffManager } from "../diff/vertical/manager";
import { HbuilderXIde } from "../HBuilderXIde";
import EditDecorationManager from "../quickEdit/EditDecorationManager";
import { UriEventHandler } from "../stubs/uriHandler";
import { WorkOsAuthProvider } from "../stubs/WorkOsAuthProvider";
import { HbuilderXWebviewProtocol } from "../webviewProtocol";
import { HbuilderXMessenger } from "./HBuilderXMessenger";

export class HbuilderXExtension {
  private windowId: string;
  private ide: HbuilderXIde;
  private extensionContext: any;
  webviewProtocolPromise: Promise<HbuilderXWebviewProtocol>;
  private sidebar: ContinueGUIWebviewViewProvider;
  private core: Core;
  private configHandler: ConfigHandler;
  private verticalDiffManager: VerticalDiffManager;
  private editDecorationManager: EditDecorationManager;
  private workOsAuthProvider: WorkOsAuthProvider;
  private uriHandler = new UriEventHandler();

  constructor(extensionContext: any) {
    console.log("[hbuilderx] HbuilderXExtension构造函数开始");

    // Register auth provider
    this.workOsAuthProvider = new WorkOsAuthProvider(
      extensionContext,
      this.uriHandler,
    );
    this.workOsAuthProvider.refreshSessions();
    extensionContext.subscriptions.push(this.workOsAuthProvider);

    console.log("[hbuilderx] 创建EditDecorationManager");
    this.editDecorationManager = new EditDecorationManager(extensionContext);

    console.log("[hbuilderx] 创建webviewProtocol Promise");
    let resolveWebviewProtocol: any = undefined;
    this.webviewProtocolPromise = new Promise<HbuilderXWebviewProtocol>(
      (resolve) => {
        resolveWebviewProtocol = resolve;
      },
    );

    console.log("[hbuilderx] 初始化HbuilderXIde");
    this.ide = new HbuilderXIde(this.webviewProtocolPromise, extensionContext);
    this.extensionContext = extensionContext;
    this.windowId = uuidv4();
    console.log("[hbuilderx] 生成windowId:", this.windowId);

    // TODO: 需要实现
    // Dependencies of core
    console.log("[hbuilderx] 创建verticalDiffManager Promise");
    let resolveVerticalDiffManager: any = undefined;
    const verticalDiffManagerPromise = new Promise<VerticalDiffManager>(
      (resolve) => {
        console.log(
          "[hbuilderx] verticalDiffManagerPromise 创建完成，等待resolve",
        );
        resolveVerticalDiffManager = resolve;
      },
    );
    console.log("[hbuilderx] 创建configHandler Promise");
    let resolveConfigHandler: any = undefined;
    const configHandlerPromise = new Promise<ConfigHandler>((resolve) => {
      console.log("[hbuilderx] configHandlerPromise 创建完成，等待resolve");
      resolveConfigHandler = resolve;
    });

    console.log("[hbuilderx] 创建webviewPanel");
    let webviewPanel = hx.window.createWebView("continue.continueGUIView", {
      enableScripts: true,
    });

    console.log("[hbuilderx] 初始化ContinueGUIWebviewViewProvider");
    this.sidebar = new ContinueGUIWebviewViewProvider(
      webviewPanel,
      configHandlerPromise,
      this.windowId,
      this.extensionContext,
    );

    console.log("[hbuilderx] 解析webviewProtocol");
    resolveWebviewProtocol(this.sidebar.webviewProtocol);

    console.log("[hbuilderx] 创建InProcessMessenger");
    const inProcessMessenger = new InProcessMessenger<
      ToCoreProtocol,
      FromCoreProtocol
    >();

    console.log("[hbuilderx] 初始化HbuilderXMessenger");
    new HbuilderXMessenger(
      inProcessMessenger,
      this.sidebar.webviewProtocol,
      this.ide,
      verticalDiffManagerPromise,
      configHandlerPromise,
    );

    console.log("[hbuilderx] 初始化Core");
    this.core = new Core(inProcessMessenger, this.ide);
    this.configHandler = this.core.configHandler;
    console.log("[hbuilderx] 解析configHandler");
    resolveConfigHandler?.(this.configHandler);
    console.log("[hbuilderx] configHandler 已解析");

    console.log("[hbuilderx] 开始加载配置");
    this.configHandler.loadConfig();

    console.log("[hbuilderx] 创建VerticalDiffManager");
    this.verticalDiffManager = new VerticalDiffManager(
      this.sidebar.webviewProtocol,
      this.editDecorationManager,
    );
    console.log("[hbuilderx] 解析verticalDiffManager");
    resolveVerticalDiffManager?.(this.verticalDiffManager);
    console.log("[hbuilderx] verticalDiffManager 已解析");

    // setupRemoteConfigSync(
    //   this.configHandler.reloadConfig.bind(this.configHandler),
    // );

    // this.configHandler.loadConfig().then(({ config }) => {
    //   const { verticalDiffCodeLens } = registerAllCodeLensProviders(
    //     context,
    //     this.verticalDiffManager.fileUriToCodeLens,
    //     config,
    //   );

    //   this.verticalDiffManager.refreshCodeLens =
    //     verticalDiffCodeLens.refresh.bind(verticalDiffCodeLens);
    // });

    // this.configHandler.onConfigUpdate(
    //   async ({ config: newConfig, configLoadInterrupted }) => {
    //     if (configLoadInterrupted) {
    //       // Show error in status bar
    //       setupStatusBar(undefined, undefined, true);
    //     } else if (newConfig) {
    //       setupStatusBar(undefined, undefined, false);

    //       registerAllCodeLensProviders(
    //         context,
    //         this.verticalDiffManager.fileUriToCodeLens,
    //         newConfig,
    //       );
    //     }
    //   },
    // );

    // // Tab autocomplete
    // const config = vscode.workspace.getConfiguration(EXTENSION_NAME);
    // const enabled = config.get<boolean>("enableTabAutocomplete");

    // // Register inline completion provider
    // setupStatusBar(
    //   enabled ? StatusBarStatus.Enabled : StatusBarStatus.Disabled,
    // );
    // context.subscriptions.push(
    //   vscode.languages.registerInlineCompletionItemProvider(
    //     [{ pattern: "**" }],
    //     new ContinueCompletionProvider(
    //       this.configHandler,
    //       this.ide,
    //       this.sidebar.webviewProtocol,
    //     ),
    //   ),
    // );

    // // Handle uri events
    // this.uriHandler.event((uri) => {
    //   const queryParams = new URLSearchParams(uri.query);
    //   let profileId = queryParams.get("profile_id");
    //   let orgId = queryParams.get("org_id");

    //   this.core.invoke("config/refreshProfiles", {
    //     selectOrgId: orgId === "null" ? undefined : (orgId ?? undefined),
    //     selectProfileId:
    //       profileId === "null" ? undefined : (profileId ?? undefined),
    //   });
    // });

    // Battery
    // this.battery = new Battery();
    // context.subscriptions.push(this.battery);
    // context.subscriptions.push(monitorBatteryChanges(this.battery));

    // // FileSearch
    // this.fileSearch = new FileSearch(this.ide);
    // registerAllPromptFilesCompletionProviders(
    //   context,
    //   this.fileSearch,
    //   this.ide,
    // );

    // const quickEdit = new QuickEdit(
    //   this.verticalDiffManager,
    //   this.configHandler,
    //   this.sidebar.webviewProtocol,
    //   this.ide,
    //   context,
    //   this.fileSearch,
    // );

    // Commands
    console.log("[hbuilderx] 注册所有命令");
    registerAllCommands(
      extensionContext,
      this.ide,
      this.sidebar,
      this.configHandler,
      //   this.verticalDiffManager,
      // this.core.continueServerClientPromise,
      Promise.resolve(null as any), // continueServerClientPromise暂未实现
      //   this.battery,
      //   quickEdit,
      this.core,
      //   this.editDecorationManager,
    );

    // Listen for file saving - use global file watcher so that changes
    // from outside the window are also caught
    // fs.watchFile(getConfigJsonPath(), { interval: 1000 }, async (stats) => {
    //   if (stats.size === 0) {
    //     return;
    //   }
    //   await this.configHandler.reloadConfig();
    // });

    // fs.watchFile(
    //   getConfigYamlPath("vscode"),
    //   { interval: 1000 },
    //   async (stats) => {
    //     if (stats.size === 0) {
    //       return;
    //     }
    //     await this.configHandler.reloadConfig();
    //   },
    // );

    // fs.watchFile(getConfigTsPath(), { interval: 1000 }, (stats) => {
    //   if (stats.size === 0) {
    //     return;
    //   }
    //   this.configHandler.reloadConfig();
    // });

    hx.workspace.onDidSaveTextDocument(async (event: any) => {
      this.core.invoke("files/changed", {
        uris: [event.uri.toString()],
      });
    });

    // hx.workspace.onDidDeleteFiles(async (event: any) => {
    //   this.core.invoke("files/deleted", {
    //     uris: event.files.map((uri: any) => uri.toString()),
    //   });
    // });

    hx.workspace.onDidCloseTextDocument(async (event: any) => {
      this.core.invoke("files/closed", {
        uris: [event.uri.toString()],
      });
    });

    // hx.workspace.onDidCreateFiles(async (event: any) => {
    //   this.core.invoke("files/created", {
    //     uris: event.files.map((uri: any) => uri.toString()),
    //   });
    // });

    // Refresh index when branch is changed
    //   this.ide.getWorkspaceDirs().then((dirs) =>
    //     dirs.forEach(async (dir) => {
    //       const repo = await this.ide.getRepo(dir);
    //       if (repo) {
    //         repo.state.onDidChange(() => {
    //           // args passed to this callback are always undefined, so keep track of previous branch
    //           const currentBranch = repo?.state?.HEAD?.name;
    //           if (currentBranch) {
    //             if (this.PREVIOUS_BRANCH_FOR_WORKSPACE_DIR[dir]) {
    //               if (
    //                 currentBranch !== this.PREVIOUS_BRANCH_FOR_WORKSPACE_DIR[dir]
    //               ) {
    //                 // Trigger refresh of index only in this directory
    //                 this.core.invoke("index/forceReIndex", { dirs: [dir] });
    //               }
    //             }

    //             this.PREVIOUS_BRANCH_FOR_WORKSPACE_DIR[dir] = currentBranch;
    //           }
    //         });
    //       }
    //     }),
    //   );

    //   // Register a content provider for the readonly virtual documents
    //   const documentContentProvider = new (class
    //     implements vscode.TextDocumentContentProvider
    //   {
    //     // emitter and its event
    //     onDidChangeEmitter = new vscode.EventEmitter<vscode.Uri>();
    //     onDidChange = this.onDidChangeEmitter.event;

    //     provideTextDocumentContent(uri: vscode.Uri): string {
    //       return uri.query;
    //     }
    //   })();
    //   context.subscriptions.push(
    //     vscode.workspace.registerTextDocumentContentProvider(
    //       VsCodeExtension.continueVirtualDocumentScheme,
    //       documentContentProvider,
    //     ),
    //   );

    //   const linkProvider = vscode.languages.registerDocumentLinkProvider(
    //     { language: "yaml" },
    //     new ConfigYamlDocumentLinkProvider(),
    //   );
    //   context.subscriptions.push(linkProvider);

    this.ide.onDidChangeActiveTextEditor((filepath) => {
      void this.core.invoke("didChangeActiveTextEditor", { filepath });
    });

    //   vscode.workspace.onDidChangeConfiguration(async (event) => {
    //     if (event.affectsConfiguration(EXTENSION_NAME)) {
    //       const settings = await this.ide.getIdeSettings();
    //       void this.core.invoke("config/ideSettingsUpdate", settings);
    //     }
    //   });
  }
}
