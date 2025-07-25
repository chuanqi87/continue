const hx = require("hbuilderx");
import { getTsConfigPath } from "core/util/paths";
import { Telemetry } from "core/util/posthog";
import { HbuilderXExtension } from "./extension/HbuilderXExtension";
import { getExtensionVersion } from "./util/util";

/**
 * 插件激活入口
 */
function activate(context: any) {
  console.log("[hbuilderx]Continue扩展正在激活...");

  try {
    // await setupCa();
    // Add necessary files
    getTsConfigPath();
    // getContinueRcPath();

    // Register commands and providers
    // TODO: 功能暂不提供
    // registerQuickFixProvider();
    // setupInlineTips(context);

    const _ = new HbuilderXExtension(context);

    // Load Continue configuration
    if (!context.workspaceState.get("hasBeenInstalled")) {
      context.workspaceState.update("hasBeenInstalled", true);
      Telemetry.capture(
        "install",
        {
          extensionVersion: getExtensionVersion(),
        },
        true,
      );
    }

    // TODO: 注册config.yaml schema
  } catch (error) {
    console.error("[hbuilderx]Continue扩展激活失败:", error);
  }

  console.log("[hbuilderx]Continue扩展激活完成");
}

/**
 * 插件停用
 */
function deactivate() {
  console.log("[hbuilderx]Continue扩展正在停用...");

  Telemetry.capture(
    "deactivate",
    {
      extensionVersion: getExtensionVersion(),
    },
    true,
  );

  Telemetry.shutdownPosthogClient();

  console.log("[hbuilderx]Continue扩展停用完成");
}

module.exports = {
  activate,
  deactivate,
};
