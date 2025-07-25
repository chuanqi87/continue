import * as fs from "fs";
import { promisify } from "util";

// 将 Node.js fs 方法转换为 Promise 版本
export const fsReadFile = promisify(fs.readFile);
export const fsStat = promisify(fs.stat);
export const fsReaddir = promisify(fs.readdir);

// URI 转换为文件系统路径的辅助函数
export function uriToFsPath(uri: any): string {
  if (typeof uri === "string") {
    // 如果是字符串，可能已经是路径
    return uri.startsWith("file://") ? uri.replace("file://", "") : uri;
  }

  if (uri.fsPath) {
    return uri.fsPath;
  }

  if (uri.path) {
    return uri.path;
  }

  // 如果是 HBuilderX URI 对象，转换为路径
  return uri.toString().replace("file://", "");
}

// FileType 枚举（根据 Node.js fs.Stats）
export enum NodeFileType {
  Unknown = 0,
  File = 1,
  Directory = 2,
  SymbolicLink = 64,
}
