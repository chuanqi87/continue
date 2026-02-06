import * as fs from "fs";
import { promisify } from "util";

// 将 Node.js fs 方法转换为 Promise 版本
export const fsReadFile = promisify(fs.readFile);
export const fsStat = promisify(fs.stat);
export const fsReaddir = promisify(fs.readdir);

// URI 转换为文件系统路径的辅助函数
export function uriToFsPath(uri: any): string {
  if (typeof uri === "string") {
    if (uri.startsWith("file://")) {
      // 正确处理 file URI
      const decoded = decodeURIComponent(uri.replace("file://", ""));
      // 在 Windows 上移除开头的 /
      return process.platform === "win32" && decoded.startsWith("/")
        ? decoded.slice(1)
        : decoded;
    }
    return uri;
  }

  if (uri.fsPath) {
    return uri.fsPath;
  }

  if (uri.path) {
    return uri.path;
  }

  // 如果是 HBuilderX URI 对象，转换为路径
  const pathStr = uri.toString().replace("file://", "");
  const decoded = decodeURIComponent(pathStr);
  return process.platform === "win32" && decoded.startsWith("/")
    ? decoded.slice(1)
    : decoded;
}

// FileType 枚举（根据 Node.js fs.Stats）
export enum NodeFileType {
  Unknown = 0,
  File = 1,
  Directory = 2,
  SymbolicLink = 64,
}
