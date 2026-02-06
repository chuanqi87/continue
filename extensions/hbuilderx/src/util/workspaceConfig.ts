const hx = require("hbuilderx");

export const CONTINUE_WORKSPACE_KEY = "continue";

export function getContinueWorkspaceConfig() {
  return hx.workspace.getConfiguration(CONTINUE_WORKSPACE_KEY);
}
