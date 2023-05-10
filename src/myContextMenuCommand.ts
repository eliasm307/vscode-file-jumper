// managing tree items: https://code.visualstudio.com/api/extension-guides/tree-view

import * as vscode from "vscode";
import fs from "fs";

function fileExists(filePath: string): boolean {
  try {
    fs.accessSync(filePath, fs.constants.F_OK);
    return true;
  } catch (err) {
    return false;
  }
}

export function activate(context: vscode.ExtensionContext) {
  const disposable = vscode.commands.registerCommand(
    "extension.myContextMenuCommand",
    (uri: vscode.Uri, ...args) => {
      console.log("myContextMenuCommand", uri, args);
      vscode.window.showInformationMessage(`Context Menu Option Clicked: ${uri.fsPath}`);
    },
  );

  context.subscriptions.push(disposable);
}

export function deactivate() {}
