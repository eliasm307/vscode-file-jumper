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
// - support onlyLinkFrom

import * as vscode from "vscode";
import type { MainConfig } from "./utils/config";
import { getIssuesWithMainConfig } from "./utils/config";
import LinkManager from "./classes/LinkManager";
import BadgeDecorationProvider from "./vscode/BadgeDecorationProvider";
import { createUri, getMainConfig, getShortPath, openFileInNewTab } from "./vscode/utils";
import Logger, { EXTENSION_KEY } from "./classes/Logger";

async function logAndShowIssuesWithConfig(issues: string[]): Promise<void> {
  for (const issue of issues) {
    Logger.info(`Configuration issue: ${issue}`);
    await vscode.window.showErrorMessage(`${EXTENSION_KEY} Configuration issue: ${issue}`);
  }
}

export async function activate(context: vscode.ExtensionContext) {
  let mainConfig: MainConfig;
  try {
    // I dont think its worth adding a JSON schema validator package for this, we can just catch the error and show it to the user
    mainConfig = getMainConfig();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return vscode.window.showErrorMessage(`Configuration issue: ${message}`);
  }

  if (mainConfig.showDebugLogs) {
    const outputChannel = vscode.window.createOutputChannel("Co-Locate", {
      log: true,
    });
    context.subscriptions.push(outputChannel); // add this early incase we return early

    Logger.setOutputChannel(outputChannel);
    Logger.setEnabled(true); // default disabled
  }

  Logger.info("extension activating...");

  const configIssues = getIssuesWithMainConfig(mainConfig);
  if (configIssues.length) {
    await logAndShowIssuesWithConfig(configIssues);
    Logger.info("extension not activated due to config issues");
    return;
  }

  Logger.info("extension activated with valid config:", mainConfig);

  const linkManager = new LinkManager(mainConfig, {
    onFileLinksUpdated() {
      const fsFilePathsWithLinks = linkManager.getFilePathsWithRelatedFiles().map((normalisedPath) => createUri(normalisedPath).fsPath);

      Logger.info("#onFileLinksUpdated: fsFilePathsWithLinks = ", fsFilePathsWithLinks);
      void vscode.commands.executeCommand("setContext", "coLocate.filePathsWithLinks", fsFilePathsWithLinks);
    },
  });

  const badgeDecorationProvider = new BadgeDecorationProvider({
    getDecorationData: (filePath) => linkManager.getDecorationData(filePath),
  });

  const allFileUris = await vscode.workspace.findFiles("**/*");
  const allFilePaths = allFileUris.map((file) => file.path);
  Logger.info("allFilePaths", allFilePaths);

  linkManager.registerFiles(allFilePaths);

  // todo listen for config changes to update file decorations
  // todo listen for file deletions/creations/renames to update file decorations
  context.subscriptions.push(
    { dispose: () => linkManager.reset() },
    registerNavigateCommand(linkManager),
    vscode.window.registerFileDecorationProvider(badgeDecorationProvider),
    vscode.workspace.onDidRenameFiles((e) => {
      // todo handle file rename
      Logger.warn("onDidRenameFiles", e);
      linkManager.removeFiles(e.files.map((file) => file.oldUri.path));
      linkManager.addFiles(e.files.map((file) => file.newUri.path));
      badgeDecorationProvider.notifyFileDecorationsChanged();
    }),
    vscode.workspace.onDidCreateFiles((e) => {
      // todo handle file create
      Logger.warn("onDidCreateFiles", e);
      linkManager.addFiles(e.files.map((file) => file.path));
      badgeDecorationProvider.notifyFileDecorationsChanged();
    }),
    vscode.workspace.onDidDeleteFiles((e) => {
      // todo handle file delete
      Logger.warn("onDidDeleteFiles", e);
      linkManager.removeFiles(e.files.map((file) => file.path));
      badgeDecorationProvider.notifyFileDecorationsChanged();
    }),
    vscode.workspace.onDidChangeWorkspaceFolders((e) => {
      // todo handle workspace folder change
      Logger.warn("onDidChangeWorkspaceFolders", e);
      // ? could use this to handle workspace folder change?
    }),
    vscode.workspace.onDidChangeConfiguration(async (e) => {
      const newMainConfig = getMainConfig();

      // todo handle configuration change
      Logger.warn("onDidChangeConfiguration", "newMainConfig", e, {
        newMainConfig,
      });

      const newConfigIssues = getIssuesWithMainConfig(newMainConfig);
      if (newConfigIssues.length) {
        await logAndShowIssuesWithConfig(newConfigIssues);
        Logger.info("config change not applied due to config issues");
        return;
      }

      linkManager.updateConfig(newMainConfig);
      badgeDecorationProvider.notifyFileDecorationsChanged();
    }),
  );

  Logger.info("extension activated");
}

function registerNavigateCommand(linkManager: LinkManager) {
  // command is conditionally triggered based on context:
  // see https://code.visualstudio.com/api/references/when-clause-contexts#in-and-not-in-conditional-operators
  const disposable = vscode.commands.registerCommand("coLocate.navigateCommand", async (uri: vscode.Uri) => {
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

    Logger.info("Quick pick selection", selectedItem);

    if (!selectedItem?.filePath) {
      return; // the user canceled the selection
    }

    await openFileInNewTab(selectedItem.filePath);
  });

  return disposable;
}
