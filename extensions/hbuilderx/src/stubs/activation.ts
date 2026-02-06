import { EXTENSION_NAME } from "core/control-plane/env";
const hx = require("hbuilderx");

import { getUserToken } from "./auth";
import { RemoteConfigSync } from "./remoteConfig";

export async function setupRemoteConfigSync(reloadConfig: () => void) {
  const settings = hx.workspace.getConfiguration(EXTENSION_NAME);
  const remoteConfigServerUrl = settings.get("remoteConfigServerUrl", null);
  if (
    remoteConfigServerUrl === null ||
    remoteConfigServerUrl === undefined ||
    remoteConfigServerUrl.trim() === ""
  ) {
    return;
  }
  getUserToken().then(async (token) => {
    await hx.workspace
      .getConfiguration(EXTENSION_NAME)
      .update("userToken", token);
    try {
      const configSync = new RemoteConfigSync(reloadConfig, token);
      configSync.setup();
    } catch (e) {
      console.warn(`Failed to sync remote config: ${e}`);
    }
  });
}
