import os from "os";

export type Platform = "MAC" | "LINUX" | "WINDOWS" | "UNKNOWN";

export function getPlatform(): Platform {
  const platform = os.platform();
  if (platform === "darwin") {
    return "MAC";
  } else if (platform === "linux") {
    return "LINUX";
  } else if (platform === "win32") {
    return "WINDOWS";
  } else {
    return "UNKNOWN";
  }
}
