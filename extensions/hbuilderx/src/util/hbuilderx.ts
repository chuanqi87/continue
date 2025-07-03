import { machineIdSync } from "node-machine-id";
const hx = require("hbuilderx");

// export function translate(range: vscode.Range, lines: number): vscode.Range {
//   return new vscode.Range(
//     range.start.line + lines,
//     range.start.character,
//     range.end.line + lines,
//     range.end.character,
//   );
// }

export function getNonce() {
  let text = "";
  const possible =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}

export function getExtensionUri(): any {
  // TODO: 待确认实现
  return "/Users/legend/Desktop/Code/continue/extensions/hbuilderx";
}

export function getViewColumnOfFile(uri: hx.Uri): hx.ViewColumn | undefined {
  for (const tabGroup of hx.window.tabGroups.all) {
    for (const tab of tabGroup.tabs) {
      if (
        (tab?.input as any)?.uri &&
        URI.equal((tab.input as any).uri, uri.toString())
      ) {
        return tabGroup.viewColumn;
      }
    }
  }
  return undefined;
}

export function getRightViewColumn(): hx.ViewColumn {
  // When you want to place in the rightmost panel if there is already more than one, otherwise use Beside
  let column = hx.ViewColumn.Beside;
  const columnOrdering = [
    hx.ViewColumn.One,
    hx.ViewColumn.Beside,
    hx.ViewColumn.Two,
    hx.ViewColumn.Three,
    hx.ViewColumn.Four,
    hx.ViewColumn.Five,
    hx.ViewColumn.Six,
    hx.ViewColumn.Seven,
    hx.ViewColumn.Eight,
    hx.ViewColumn.Nine,
  ];
  for (const tabGroup of hx.window.tabGroups.all) {
    if (
      columnOrdering.indexOf(tabGroup.viewColumn) >
      columnOrdering.indexOf(column)
    ) {
      column = tabGroup.viewColumn;
    }
  }
  return column;
}

let showTextDocumentInProcess = false;

export function openEditorAndRevealRange(
  uri: hx.Uri,
  range?: hx.Range,
  viewColumn?: hx.ViewColumn,
  preview?: boolean,
): Promise<hx.TextEditor> {
  return new Promise((resolve, _) => {
    hx.workspace.openTextDocument(uri).then(async (doc) => {
      try {
        // An error is thrown mysteriously if you open two documents in parallel, hence this
        while (showTextDocumentInProcess) {
          await new Promise((resolve) => {
            setInterval(() => {
              resolve(null);
            }, 200);
          });
        }
        showTextDocumentInProcess = true;
        hx.window
          .showTextDocument(doc, {
            viewColumn: getViewColumnOfFile(uri) || viewColumn,
            preview,
          })
          .then((editor: any) => {
            if (range) {
              editor.revealRange(range);
            }
            resolve(editor);
            showTextDocumentInProcess = false;
          });
      } catch (err) {
        console.log(err);
      }
    });
  });
}

export function getUniqueId() {
  // TODO: 待确认实现
  const id = hx.env.machineId;
  if (id === "someValue.machineId") {
    return machineIdSync();
  }
  return hx.env.machineId;
}
