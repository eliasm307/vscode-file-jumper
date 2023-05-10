import * as vscode from "vscode";

export function activate(context: vscode.ExtensionContext) {
  const disposable = vscode.commands.registerCommand(
    "extension.myContextMenuCommand",
    (uri: vscode.Uri) => {
      vscode.window.showInformationMessage(`Context Menu Option Clicked: ${uri.fsPath}`);
    },
  );

  context.subscriptions.push(disposable);
}

export function deactivate() {}
