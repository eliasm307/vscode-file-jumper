// for adding configuration options: https://code.visualstudio.com/api/references/contribution-points#contributes.configuration
// overall structure: https://code.visualstudio.com/api/get-started/extension-anatomy
// full api reference: https://code.visualstudio.com/api/references/vscode-api

// todo
// - detect and handle configuration changes

import * as vscode from "vscode";
import { activate as activateContextMenuCommand } from "./navigateCommand";
import { getPatternGroupsConfig, configIsValid } from "./utils/config";
import CoLocator from "./classes/CoLocator";

export async function activate(context: vscode.ExtensionContext) {
  console.log("extension activating...");

  const patternGroupsConfig = getPatternGroupsConfig(context);

  if (!configIsValid(patternGroupsConfig)) {
    console.error("Invalid extension configuration");
    return;
  }

  console.log("extension loaded with patternGroupsConfig:", patternGroupsConfig[0]);

  const knownFilePaths = vscode.workspace.textDocuments.map((doc) => doc.uri.path);
  const allFiles = await vscode.workspace.findFiles("**/*");
  const allFilePaths = allFiles.map((file) => file.path);

  console.log("knownFilePaths", knownFilePaths);
  console.log("allFilePaths", allFilePaths);

  const coLocator = new CoLocator({
    context: context,
    patternGroupsConfig: patternGroupsConfig,
  });

  // todo load current files on startup

  activateContextMenuCommand(coLocator);
  // activateShortcutsView(coLocator);

  context.subscriptions.push();

  // todo listen for config changes to update file decorations
  // todo listen for file deletions/creations/renames to update file decorations

  context.subscriptions.push(
    vscode.window.registerFileDecorationProvider(coLocator.badgeDecorationProvider),
    vscode.workspace.onDidRenameFiles((e) => {
      // todo handle file rename
      console.log("onDidRenameFiles", e);
    }),
    vscode.workspace.onDidCreateFiles((e) => {
      // todo handle file create
      console.log("onDidCreateFiles", e);
    }),
    vscode.workspace.onDidDeleteFiles((e) => {
      // todo handle file delete
      console.log("onDidDeleteFiles", e);
    }),
    vscode.workspace.onDidChangeWorkspaceFolders((e) => {
      // todo handle workspace folder change
      console.log("onDidChangeWorkspaceFolders", e);
      // ? could use this to handle workspace folder change?
    }),
    vscode.workspace.onDidChangeConfiguration((e) => {
      // todo handle configuration change
      console.log("onDidChangeConfiguration", e);
    }),
  );

  console.log("extension activated");
}
