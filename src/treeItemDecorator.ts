import * as vscode from "vscode";

export function activate(context: vscode.ExtensionContext) {
  const decorationProvider = new BadgeDecorationProvider();
  context.subscriptions.push(vscode.window.registerFileDecorationProvider(decorationProvider));
}

class BadgeDecorationProvider implements vscode.FileDecorationProvider {
  provideFileDecoration(
    uri: vscode.Uri,
    token: vscode.CancellationToken,
  ): vscode.ProviderResult<vscode.FileDecoration> {
    const isJsonFile = uri.path.endsWith(".json");

    if (isJsonFile) {
      return new vscode.FileDecoration(
        "🧩🔗", // Badge text
        "Decoration", // Badge color (optional)
        // new vscode.ThemeColor("button.background"),
      );
    }
    return undefined;
  }
}

export function deactivate() {}
