/* eslint-disable no-console */
// for adding configuration options: https://code.visualstudio.com/api/references/contribution-points#contributes.configuration
// overall structure: https://code.visualstudio.com/api/get-started/extension-anatomy
// full api reference: https://code.visualstudio.com/api/references/vscode-api
// sorting of context menu items: https://code.visualstudio.com/api/references/contribution-points#Sorting-of-groups
// see built in commands: https://code.visualstudio.com/api/references/commands
// can use built in icons in some cases: https://code.visualstudio.com/api/references/icons-in-labels

// todo
// - detect and handle configuration changes
// - make context menu only show on files with known related files
// - customise marketplace look https://code.visualstudio.com/api/working-with-extensions/publishing-extension#advanced-usage

import * as vscode from "vscode";
import type { MainConfig } from "./utils/config";
import { getMainConfig } from "./utils/config";
import CoLocator from "./classes/CoLocator";
import BadgeDecorationProvider from "./vscode/BadgeDecorationProvider";
import { getShortPath, openFile } from "./utils/vscode";

export async function activate(context: vscode.ExtensionContext) {
  console.log("extension activating...");

  let mainConfig: MainConfig;
  try {
    // I dont think its worth adding a JSON schema validator package for this, we can just catch the error and show it to the user
    mainConfig = getMainConfig();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return vscode.window.showErrorMessage(`Configuration issue: ${message}`);
  }

  console.log("extension loaded with patternGroupsConfig:", mainConfig);

  const coLocator = new CoLocator(mainConfig);

  const badgeDecorationProvider = new BadgeDecorationProvider({
    getRelatedFileMarkers: (filePath) => coLocator.getRelatedFileMarkers(filePath),
  });

  const allFileUris = await vscode.workspace.findFiles("**/*");
  const allFilePaths = allFileUris.map((file) => file.path);
  console.log("allFilePaths", allFilePaths);

  coLocator.initWorkspaceFiles(allFilePaths);

  // todo listen for config changes to update file decorations
  // todo listen for file deletions/creations/renames to update file decorations
  context.subscriptions.push(
    { dispose: () => coLocator.reset() },
    registerNavigateCommand(coLocator),
    vscode.window.registerFileDecorationProvider(badgeDecorationProvider),
    vscode.workspace.onDidRenameFiles((e) => {
      // todo handle file rename
      console.warn("onDidRenameFiles", e);
      coLocator.removeFiles(e.files.map((file) => file.oldUri.path));
      coLocator.addFiles(e.files.map((file) => file.newUri.path));
      badgeDecorationProvider.notifyFileDecorationsChanged();
    }),
    vscode.workspace.onDidCreateFiles((e) => {
      // todo handle file create
      console.warn("onDidCreateFiles", e);
      coLocator.addFiles(e.files.map((file) => file.path));
      badgeDecorationProvider.notifyFileDecorationsChanged();
    }),
    vscode.workspace.onDidDeleteFiles((e) => {
      // todo handle file delete
      console.warn("onDidDeleteFiles", e);
      coLocator.removeFiles(e.files.map((file) => file.path));
      badgeDecorationProvider.notifyFileDecorationsChanged();
    }),
    vscode.workspace.onDidChangeWorkspaceFolders((e) => {
      // todo handle workspace folder change
      console.warn("onDidChangeWorkspaceFolders", e);
      // ? could use this to handle workspace folder change?
    }),
    vscode.workspace.onDidChangeConfiguration((e) => {
      // todo handle configuration change
      console.warn("onDidChangeConfiguration", e);
      coLocator.updateConfig(getMainConfig());
      badgeDecorationProvider.notifyFileDecorationsChanged();
    }),
  );

  console.log("extension activated");
}

function registerNavigateCommand(coLocator: CoLocator) {
  // command is conditionally triggered based on context:
  // see https://code.visualstudio.com/api/references/when-clause-contexts#in-and-not-in-conditional-operators
  const disposable = vscode.commands.registerCommand(
    "coLocate.navigateCommand",
    async (uri: vscode.Uri) => {
      const shortPath = getShortPath(uri);
      const relatedFiles = coLocator.getFileMetaData(uri.path)?.relatedFiles || [];

      const quickPickItems = relatedFiles.map((relatedFile) => {
        return {
          label: `${relatedFile.marker} ${relatedFile.typeName}`,
          detail: getShortPath(relatedFile.fullPath),
          filePath: relatedFile.fullPath,
        } satisfies vscode.QuickPickItem & { filePath: string };
      });

      // todo check what this looks like
      // see https://github.com/microsoft/vscode-extension-samples/blob/main/quickinput-sample/src/extension.ts
      const selectedItem = await vscode.window.showQuickPick(quickPickItems, {
        title: `Navigate to file related to "${shortPath}"`,
        placeHolder: "Select a related file",
        // match on any info
        matchOnDescription: true,
        matchOnDetail: true,
      });

      console.log("Quick pick selection", selectedItem);

      if (!selectedItem?.filePath) {
        return; // the user canceled the selection
      }

      await openFile(selectedItem.filePath);
    },
  );

  return disposable;
}
