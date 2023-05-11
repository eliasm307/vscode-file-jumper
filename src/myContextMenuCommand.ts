// managing tree items: https://code.visualstudio.com/api/extension-guides/tree-view

import * as vscode from "vscode";
import fs from "fs";
import { FeatureContext } from "./types";

function fileExists(filePath: string): boolean {
  try {
    fs.accessSync(filePath, fs.constants.F_OK);
    return true;
  } catch (err) {
    return false;
  }
}

export function activate({ extension, coLocator }: FeatureContext) {
  const disposable = vscode.commands.registerCommand(
    "extension.myContextMenuCommand",
    (uri: vscode.Uri, ...args) => {
      console.log("myContextMenuCommand", uri, args);
      vscode.window.showInformationMessage(`Context Menu Option Clicked: ${uri.fsPath}`);
    },
  );

  extension.context.subscriptions.push(disposable);
}

export function deactivate() {}
