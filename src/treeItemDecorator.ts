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

class BadgeDecorationProvider implements vscode.FileDecorationProvider {
  constructor(public readonly coLocator: CoLocator) {}

  onDidChangeFileDecorations?: vscode.Event<vscode.Uri | vscode.Uri[] | undefined> | undefined;

  provideFileDecoration(
    uri: vscode.Uri,
    cancelToken: vscode.CancellationToken,
  ): vscode.ProviderResult<vscode.FileDecoration> {
    // todo fix, this isnt accurate as the decorations could change as more files are discovered, the files need to be processed in one go at the start then changes managed
    const decoration = this.coLocator.registerFileAndGetDecorationData({
      filePath: uri.path,
      cancelToken,
    });
    if (decoration) {
      return new vscode.FileDecoration(decoration.badge, decoration.tooltip);
    }
  }
}

export function deactivate() {}
