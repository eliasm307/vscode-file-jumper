// managing tree items: https://code.visualstudio.com/api/extension-guides/tree-view

import * as vscode from "vscode";
import fs from "fs";
import CoLocator from "./classes/CoLocator";
import { getShortPath, openFile } from "./utils/vscode";

function fileExists(filePath: string): boolean {
  try {
    fs.accessSync(filePath, fs.constants.F_OK);
    return true;
  } catch (err) {
    return false;
  }
}

export function activate(coLocator: CoLocator) {
  // command is conditionally triggered based on context:
  // see https://code.visualstudio.com/api/references/when-clause-contexts#in-and-not-in-conditional-operators
  const disposable = vscode.commands.registerCommand(
    "coLocate.navigateCommand",
    async (uri: vscode.Uri) => {
      const shortPath = getShortPath(uri);
      const items = coLocator.getRelatedFilesQuickPickItems(uri.path);

      // todo check what this looks like
      // see https://github.com/microsoft/vscode-extension-samples/blob/main/quickinput-sample/src/extension.ts
      const selection = await vscode.window.showQuickPick(items, {
        title: `Navigate to file related to "${shortPath}"`,
        placeHolder: "Select a related file",
        // match on any info
        matchOnDescription: true,
        matchOnDetail: true,
      });

      console.log("Quick pick selection", selection);

      if (selection?.kind !== vscode.QuickPickItemKind.Default) {
        return;
      }

      // the user canceled the selection
      if (!selection?.filePath) {
        return;
      }

      openFile(selection.filePath);
      vscode.window.showInformationMessage(`Context Menu Option Clicked: ${shortPath}`); // todo remove
    },
  );

  coLocator.extension.context.subscriptions.push(disposable);
}

export function deactivate() {}
