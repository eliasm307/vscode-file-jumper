/* eslint-disable no-console */
// for adding configuration options: https://code.visualstudio.com/api/references/contribution-points#contributes.configuration
// overall structure: https://code.visualstudio.com/api/get-started/extension-anatomy
// full api reference: https://code.visualstudio.com/api/references/vscode-api
// sorting of context menu items: https://code.visualstudio.com/api/references/contribution-points#Sorting-of-groups
// see built in commands: https://code.visualstudio.com/api/references/commands

// todo
// - detect and handle configuration changes
// - make context menu only show on files with known related files
// - customise marketplace look https://code.visualstudio.com/api/working-with-extensions/publishing-extension#advanced-usage

import * as vscode from "vscode";
import { activate as activateContextMenuCommand } from "./navigateCommand";
import { getFileGroupConfigs, findReasonConfigIsInvalid } from "./utils/config";
import CoLocator from "./classes/CoLocator";

export async function activate(context: vscode.ExtensionContext) {
  console.log("extension activating...");

  const patternGroupsConfig = getFileGroupConfigs()!;
  const reasonConfigIsInvalid = findReasonConfigIsInvalid(patternGroupsConfig);
  if (reasonConfigIsInvalid) {
    return vscode.window.showErrorMessage(`Invalid configuration: ${reasonConfigIsInvalid}`);
  }

  console.log("extension loaded with patternGroupsConfig:", patternGroupsConfig[0]);

  const coLocator = new CoLocator({
    context,
    patternGroupsConfig,
  });

  const allFileUris = await vscode.workspace.findFiles("**/*");
  const allFilePaths = allFileUris.map((file) => file.path);
  console.log("allFilePaths", allFilePaths);

  coLocator.initWorkspaceFiles(allFilePaths);

  activateContextMenuCommand(coLocator);

  // todo listen for config changes to update file decorations
  // todo listen for file deletions/creations/renames to update file decorations
  context.subscriptions.push(
    vscode.window.registerFileDecorationProvider(coLocator.badgeDecorationProvider),
    vscode.workspace.onDidRenameFiles((e) => {
      // todo handle file rename
      console.warn("onDidRenameFiles", e);
    }),
    vscode.workspace.onDidCreateFiles((e) => {
      // todo handle file create
      console.warn("onDidCreateFiles", e);
    }),
    vscode.workspace.onDidDeleteFiles((e) => {
      // todo handle file delete
      console.warn("onDidDeleteFiles", e);
    }),
    vscode.workspace.onDidChangeWorkspaceFolders((e) => {
      // todo handle workspace folder change
      console.warn("onDidChangeWorkspaceFolders", e);
      // ? could use this to handle workspace folder change?
    }),
    vscode.workspace.onDidChangeConfiguration((e) => {
      // todo handle configuration change
      console.warn("onDidChangeConfiguration", e);
    }),
  );

  console.log("extension activated");
}
