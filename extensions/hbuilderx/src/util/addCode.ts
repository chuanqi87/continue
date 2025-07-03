import { RangeInFileWithContents } from "core";
const hx = require("hbuilderx");

import { HbuilderXIdeUtils } from "./ideUtils";

import type { HbuilderXWebviewProtocol } from "../webviewProtocol";

export function getRangeInFileWithContents(
  allowEmpty?: boolean,
  range?: any,
): RangeInFileWithContents | null {
  const editor = hx.window.getActiveTextEditor();

  if (editor) {
    const selection = editor.selection;
    const filepath = editor.document.uri.toString();

    if (range) {
      const contents = editor.document.getText(range);

      return {
        range: {
          start: {
            line: range.start.line,
            character: range.start.character,
          },
          end: {
            line: range.end.line,
            character: range.end.character,
          },
        },
        filepath,
        contents,
      };
    }

    if (selection.isEmpty && !allowEmpty) {
      return null;
    }

    let selectionRange = new hx.Range(selection.start, selection.end);
    const document = editor.document;
    // Select the context from the beginning of the selection start line to the selection start position
    const beginningOfSelectionStartLine = selection.start.with(undefined, 0);
    const textBeforeSelectionStart = document.getText(
      new hx.Range(beginningOfSelectionStartLine, selection.start),
    );
    // If there are only whitespace before the start of the selection, include the indentation
    if (textBeforeSelectionStart.trim().length === 0) {
      selectionRange = selectionRange.with({
        start: beginningOfSelectionStartLine,
      });
    }

    const contents = editor.document.getText(selectionRange);

    return {
      filepath,
      contents,
      range: {
        start: {
          line: selection.start.line,
          character: selection.start.character,
        },
        end: {
          line: selection.end.line,
          character: selection.end.character,
        },
      },
    };
  }

  return null;
}

export async function addHighlightedCodeToContext(
  webviewProtocol: HbuilderXWebviewProtocol | undefined,
) {
  const rangeInFileWithContents = getRangeInFileWithContents();
  if (rangeInFileWithContents) {
    webviewProtocol?.request("highlightedCode", {
      rangeInFileWithContents,
    });
  }
}

export async function addEntireFileToContext(
  uri: any,
  webviewProtocol: HbuilderXWebviewProtocol | undefined,
  ideUtils: HbuilderXIdeUtils,
) {
  // If a directory, add all files in the directory
  // const stat = await ideUtils.stat(uri);
  // if (stat?.type === vscode.FileType.Directory) {
  //   const files = (await ideUtils.readDirectory(uri))!; //files can't be null if we reached this point
  //   for (const [filename, type] of files) {
  //     if (type === vscode.FileType.File) {
  //       addEntireFileToContext(
  //         vscode.Uri.joinPath(uri, filename),
  //         webviewProtocol,
  //         ideUtils,
  //       );
  //     }
  //   }
  //   return;
  // }
  // // Get the contents of the file
  // const contents = (await vscode.workspace.fs.readFile(uri)).toString();
  // const rangeInFileWithContents = {
  //   filepath: uri.toString(),
  //   contents: contents,
  //   range: {
  //     start: {
  //       line: 0,
  //       character: 0,
  //     },
  //     end: {
  //       line: contents.split(os.EOL).length - 1,
  //       character: 0,
  //     },
  //   },
  // };
  // webviewProtocol?.request("highlightedCode", {
  //   rangeInFileWithContents,
  // });
}

export function addCodeToContextFromRange(
  range: any,
  webviewProtocol: HbuilderXWebviewProtocol,
  prompt?: string,
) {
  const document = hx.window.getActiveTextEditor()?.document;

  if (!document) {
    return;
  }

  const rangeInFileWithContents = {
    filepath: document.uri.toString(),
    contents: document.getText(range),
    range: {
      start: {
        line: range.start.line,
        character: range.start.character,
      },
      end: {
        line: range.end.line,
        character: range.end.character,
      },
    },
  };

  webviewProtocol?.request("highlightedCode", {
    rangeInFileWithContents,
    prompt,
    // Assume `true` since range selection is currently only used for quick actions/fixes
    shouldRun: true,
  });
}
