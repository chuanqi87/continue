import { EXTENSION_NAME } from "core/control-plane/env";
const hx = require("hbuilderx");

export async function getUserToken(): Promise<string> {
  // Prefer manual user token first
  const settings = hx.workspace.getConfiguration(EXTENSION_NAME);
  const userToken = settings.get("userToken", null);
  if (userToken) {
    return userToken;
  }

  const session = await hx.authentication.getSession("github", [], {
    createIfNone: true,
  });
  return session.accessToken;
}
