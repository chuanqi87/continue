export type PreviewEditSessionLike = {
  accept: (uri: any) => Promise<any> | any;
  reject: (uri: any) => Promise<any> | any;
};

const sessions = new Map<string, PreviewEditSessionLike>();

function normalizeFilepath(filepath: string): string {
  try {
    if (filepath?.startsWith("file://")) {
      // 使用 hbuilderx 的 Uri 解析为 fsPath
      const hx = require("hbuilderx");
      return hx.Uri.parse(filepath).fsPath;
    }
  } catch {}
  return filepath;
}

export function setPreviewSession(
  filepath: string,
  session: PreviewEditSessionLike,
): void {
  sessions.set(normalizeFilepath(filepath), session);
}

export function getPreviewSession(
  filepath: string,
): PreviewEditSessionLike | undefined {
  return sessions.get(normalizeFilepath(filepath));
}

export function clearPreviewSession(filepath: string): void {
  sessions.delete(normalizeFilepath(filepath));
}

export function toUri(filepath: string): any {
  const hx = require("hbuilderx");
  return filepath?.startsWith("file://")
    ? hx.Uri.parse(filepath)
    : hx.Uri.file(filepath);
}
