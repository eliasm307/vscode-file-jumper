import * as vscode from "vscode";
import CoLocator from "./classes/CoLocator";

export function activate(coLocator: CoLocator) {
  const decorationProvider = new BadgeDecorationProvider(coLocator);
  coLocator.extension.context.subscriptions.push(
    vscode.window.registerFileDecorationProvider(decorationProvider),
  );

  // todo listen for config changes to update file decorations
  // todo listen for file deletions/creations/renames to update file decorations
}

export class BadgeDecorationProvider implements vscode.FileDecorationProvider {
  constructor(public readonly coLocator: CoLocator) {
    coLocator.setBadgeDecorationProvider(this);
  }

  onDidChangeFileDecorationsEmitter = new vscode.EventEmitter<
    vscode.Uri | vscode.Uri[] | undefined
  >();
  onDidChangeFileDecorations = this.onDidChangeFileDecorationsEmitter.event;

  provideFileDecoration(
    uri: vscode.Uri,
    cancelToken: vscode.CancellationToken,
  ): vscode.ProviderResult<vscode.FileDecoration> {
    const decoration = this.coLocator.getDecorationData({
      filePath: uri.path,
      cancelToken,
    });
    if (decoration) {
      return new vscode.FileDecoration(decoration.badge, decoration.tooltip);
    }
  }
}

export function deactivate() {}
