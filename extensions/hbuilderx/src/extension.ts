const hx = require("hbuilderx");
import { getTsConfigPath } from "core/util/paths";
import { Telemetry } from "core/util/posthog";
import { HbuilderXExtension } from "./extension/HbuilderXExtension";
import { getExtensionVersion } from "./util/util";

// 保存扩展实例引用，以便在 deactivate 时正确清理资源
let extensionInstance: HbuilderXExtension | undefined;

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

    extensionInstance = new HbuilderXExtension(context);

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

  // 清理扩展实例资源（包括销毁 WebviewPanel，避免重启时重复注册）
  if (extensionInstance) {
    try {
      extensionInstance.dispose();
    } catch (error) {
      console.error("[hbuilderx] deactivate清理扩展实例失败:", error);
    }
    extensionInstance = undefined;
  }

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
