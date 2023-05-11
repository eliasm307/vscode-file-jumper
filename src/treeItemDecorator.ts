import * as vscode from "vscode";
import CoLocator from "./classes/CoLocator";
import { FeatureContext } from "./types";

export function activate(context: FeatureContext) {
  const decorationProvider = new BadgeDecorationProvider(context);
  context.extension.context.subscriptions.push(
    vscode.window.registerFileDecorationProvider(decorationProvider),
  );
}

class BadgeDecorationProvider implements vscode.FileDecorationProvider {
  constructor(public readonly context: FeatureContext) {}

  provideFileDecoration(
    uri: vscode.Uri,
    token: vscode.CancellationToken,
  ): vscode.ProviderResult<vscode.FileDecoration> {
    const isMatch = uri.path.endsWith("test.ts");

    console.log("BadgeDecorationProvider", {
      uri,
      isMatch,
    });

    if (isMatch) {
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
