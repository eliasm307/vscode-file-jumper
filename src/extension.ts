/* eslint-disable no-console */
// for adding configuration options: https://code.visualstudio.com/api/references/contribution-points#contributes.configuration
// overall structure: https://code.visualstudio.com/api/get-started/extension-anatomy
// full api reference: https://code.visualstudio.com/api/references/vscode-api
// sorting of context menu items: https://code.visualstudio.com/api/references/contribution-points#Sorting-of-groups
// see built in commands: https://code.visualstudio.com/api/references/commands
// can use built in icons in some cases: https://code.visualstudio.com/api/references/icons-in-labels
// inspecting context keys of items in the editor, e.g. explorer tree items: https://code.visualstudio.com/api/references/when-clause-contexts#inspect-context-keys-utility
// integration testing: https://code.visualstudio.com/api/working-with-extensions/testing-extension
// manage extensions at: https://marketplace.visualstudio.com/manage

// todo
// - detect and handle configuration changes
// - make context menu only show on files with known related files
// - customise marketplace look https://code.visualstudio.com/api/working-with-extensions/publishing-extension#advanced-usage
// - add context menu for tab item
// - use object for file types config instead of array, to prevent duplicates

import * as vscode from "vscode";
import type { MainConfig } from "./utils/config";
import { mainConfigsAreEqual, getIssuesWithMainConfig } from "./utils/config";

import LinkManager from "./classes/LinkManager";
import BadgeDecorationProvider from "./vscode/BadgeDecorationProvider";
import { createUri, getMainConfig, getShortPath, openFileInNewTab } from "./utils/vscode";

async function validateConfigAndShowAnyErrors(config: MainConfig): Promise<boolean> {
  const configIssues = getIssuesWithMainConfig(config);
  if (configIssues.length) {
    await vscode.window.showErrorMessage(`Configuration issue: ${configIssues[0]}`);
  }

  return configIssues.length === 0;
}

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

  if (!(await validateConfigAndShowAnyErrors(mainConfig))) {
    return;
  }

  console.log("extension loaded with valid config:", mainConfig);

  const relationshipManager = new LinkManager(mainConfig, {
    onFileRelationshipsUpdated() {
      const fsFilePathsWithRelationships = relationshipManager
        .getFilePathsWithRelatedFiles()
        .map((normalisedPath) => createUri(normalisedPath).fsPath);

      console.log(
        "onFileRelationshipsUpdated: fsFilePathsWithRelationships = ",
        fsFilePathsWithRelationships,
      );
      void vscode.commands.executeCommand(
        "setContext",
        "coLocate.filePathsWithLinks",
        fsFilePathsWithRelationships,
      );
    },
  });

  const badgeDecorationProvider = new BadgeDecorationProvider({
    getDecorationData: (filePath) => relationshipManager.getDecorationData(filePath),
  });

  const allFileUris = await vscode.workspace.findFiles("**/*");
  const allFilePaths = allFileUris.map((file) => file.path);
  console.log("allFilePaths", allFilePaths);

  relationshipManager.registerFiles(allFilePaths);

  // todo listen for config changes to update file decorations
  // todo listen for file deletions/creations/renames to update file decorations
  context.subscriptions.push(
    { dispose: () => relationshipManager.reset() },
    registerNavigateCommand(relationshipManager),
    vscode.window.registerFileDecorationProvider(badgeDecorationProvider),
    vscode.workspace.onDidRenameFiles((e) => {
      // todo handle file rename
      console.warn("onDidRenameFiles", e);
      relationshipManager.removeFiles(e.files.map((file) => file.oldUri.path));
      relationshipManager.addFiles(e.files.map((file) => file.newUri.path));
      badgeDecorationProvider.notifyFileDecorationsChanged();
    }),
    vscode.workspace.onDidCreateFiles((e) => {
      // todo handle file create
      console.warn("onDidCreateFiles", e);
      relationshipManager.addFiles(e.files.map((file) => file.path));
      badgeDecorationProvider.notifyFileDecorationsChanged();
    }),
    vscode.workspace.onDidDeleteFiles((e) => {
      // todo handle file delete
      console.warn("onDidDeleteFiles", e);
      relationshipManager.removeFiles(e.files.map((file) => file.path));
      badgeDecorationProvider.notifyFileDecorationsChanged();
    }),
    vscode.workspace.onDidChangeWorkspaceFolders((e) => {
      // todo handle workspace folder change
      console.warn("onDidChangeWorkspaceFolders", e);
      // ? could use this to handle workspace folder change?
    }),
    vscode.workspace.onDidChangeConfiguration(async (e) => {
      const newMainConfig = getMainConfig();

      const configHasChanged = !mainConfigsAreEqual(mainConfig, newMainConfig);
      // todo handle configuration change
      console.warn("onDidChangeConfiguration", e, "newMainConfig", {
        configHasChanged,
        mainConfig,
        newMainConfig,
      });

      if (!configHasChanged || !(await validateConfigAndShowAnyErrors(mainConfig))) {
        return;
      }

      relationshipManager.updateConfig(newMainConfig);
      badgeDecorationProvider.notifyFileDecorationsChanged();
    }),
  );

  console.log("extension activated");
}

function registerNavigateCommand(linkManager: LinkManager) {
  // command is conditionally triggered based on context:
  // see https://code.visualstudio.com/api/references/when-clause-contexts#in-and-not-in-conditional-operators
  const disposable = vscode.commands.registerCommand(
    "coLocate.navigateCommand",
    async (uri: vscode.Uri) => {
      const quickPickItems = linkManager.getRelatedFiles(uri.path).map((relatedFile) => {
        return {
          label: `${relatedFile.marker} ${relatedFile.typeName}`,
          detail: getShortPath(relatedFile.fullPath),
          filePath: relatedFile.fullPath,
        } satisfies vscode.QuickPickItem & { filePath: string };
      });

      // see https://github.com/microsoft/vscode-extension-samples/blob/main/quickinput-sample/src/extension.ts
      const selectedItem = await vscode.window.showQuickPick(quickPickItems, {
        title: `Open file related to "${getShortPath(uri)}"`,
        placeHolder: "Type here to filter results",
        // match on any info
        matchOnDescription: true,
        matchOnDetail: true,
      });

      console.log("Quick pick selection", selectedItem);

      if (!selectedItem?.filePath) {
        return; // the user canceled the selection
      }

      await openFileInNewTab(selectedItem.filePath);
    },
  );

  return disposable;
}
