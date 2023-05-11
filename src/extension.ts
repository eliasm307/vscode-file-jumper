// for adding configuration options: https://code.visualstudio.com/api/references/contribution-points#contributes.configuration
// overall structure: https://code.visualstudio.com/api/get-started/extension-anatomy
// full api reference: https://code.visualstudio.com/api/references/vscode-api

// todo
// - detect and handle configuration changes

import * as vscode from "vscode";
import { activate as activateContextMenuCommand } from "./navigateCommand";
import { activate as activateShortcutsView } from "./shortcutsView";
import { activate as activateTreeItemDecorator } from "./treeItemDecorator";
import { getPatternGroupsConfig, configIsValid } from "./utils/config";
import CoLocator from "./classes/CoLocator";

export function activate(context: vscode.ExtensionContext) {
  console.log("extension activating...");

  const patternGroupsConfig = getPatternGroupsConfig(context);

  if (!configIsValid(patternGroupsConfig)) {
    console.error("Invalid extension configuration");
    return;
  }

  console.log("extension loaded with patternGroupsConfig:", patternGroupsConfig[0]);

  const coLocator = new CoLocator({
    context: context,
    patternGroupsConfig: patternGroupsConfig,
  });

  // todo load current files on startup

  activateContextMenuCommand(coLocator);
  // activateShortcutsView(coLocator);
  activateTreeItemDecorator(coLocator);

  context.subscriptions.push(
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
      // vscode.workspace.textDocuments[0]
    }),
    vscode.workspace.onDidChangeConfiguration((e) => {
      // todo handle configuration change
      console.log("onDidChangeConfiguration", e);
    }),
  );

  console.log("extension activated");
}
