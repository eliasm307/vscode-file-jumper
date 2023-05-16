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
import { createUri, getMainConfig, getWorkspaceRelativePath, openFileInNewTab } from "./vscode/utils";
import Logger, { EXTENSION_KEY } from "./classes/Logger";
import { shortenPath } from "./utils";

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
      const fsPathsWithLinks = linkManager.getPathsWithRelatedFiles().map((normalisedPath) => createUri(normalisedPath).fsPath);

      Logger.info("#onFileLinksUpdated: fsPathsWithLinks = ", fsPathsWithLinks);
      const FS_PATHS_WITH_LINKS_CONTEXT_KEY = "coLocate.filePathsWithLinks";
      void vscode.commands.executeCommand("setContext", FS_PATHS_WITH_LINKS_CONTEXT_KEY, fsPathsWithLinks);
    },
  });

  const badgeDecorationProvider = new BadgeDecorationProvider({
    getDecorationData: (path) => linkManager.getDecorationData(path),
  });

  const allUris = await vscode.workspace.findFiles("**/*");
  const allPaths = allUris.map((file) => file.path);
  Logger.info("allPaths", allPaths);

  linkManager.addPathsAndNotify(allPaths);

  context.subscriptions.push(
    { dispose: () => linkManager.reset() },
    registerNavigateCommand(linkManager),
    vscode.window.registerFileDecorationProvider(badgeDecorationProvider),
    /**
     * @remark When renaming a folder with children only one event is fired.
     */
    vscode.workspace.onDidRenameFiles((e) => {
      const oldPaths = e.files.map((file) => file.oldUri.path);
      const newPaths = e.files.map((file) => file.newUri.path);
      linkManager.renameFilesAndNotify({ oldPaths, newPaths });
      badgeDecorationProvider.notifyFileDecorationsChanged();
    }),
    /**
     * @remark This event is not fired when files change on disk, e.g triggered by another application, or when using the workspace.fs-api
     */
    vscode.workspace.onDidCreateFiles((e) => {
      linkManager.addPathsAndNotify(e.files.map((file) => file.path));
      badgeDecorationProvider.notifyFileDecorationsChanged();
    }),
    /**
     * @remark This event is not fired when files change on disk, e.g triggered by another application, or when using the workspace.fs-api
     *
     * @remark When deleting a folder with children only one event is fired.
     */
    vscode.workspace.onDidDeleteFiles((e) => {
      // todo create a FileStructureManager class to handle finding out which files are actually affected by a possible folder delete/rename
      Logger.warn("onDidDeleteFiles", e);
      linkManager.removePathsAndNotify(e.files.map((file) => file.path));
      badgeDecorationProvider.notifyFileDecorationsChanged();
    }),
    vscode.workspace.onDidChangeWorkspaceFolders((e) => {
      // todo handle workspace folder change
      Logger.warn("onDidChangeWorkspaceFolders", e);
      // ? could use this to handle workspace folder change?
    }),
    vscode.workspace.onDidChangeConfiguration(async (e) => {
      const newMainConfig = getMainConfig();

      Logger.info("onDidChangeConfiguration", "newMainConfig", e, {
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

  Logger.info("🚀 Extension activated");
}

function registerNavigateCommand(linkManager: LinkManager) {
  // command is conditionally triggered based on context:
  // see https://code.visualstudio.com/api/references/when-clause-contexts#in-and-not-in-conditional-operators
  const disposable = vscode.commands.registerCommand("coLocate.navigateCommand", async (uri: vscode.Uri) => {
    const quickPickItems = linkManager.getRelatedFiles(uri.path).map((relatedFile) => {
      return {
        label: `${relatedFile.marker} ${relatedFile.typeName}`,
        // if this overflows the end of the path is hidden and we want to prioritise the end of the path so we shorten it
        detail: shortenPath(getWorkspaceRelativePath(relatedFile.fullPath)),
        path: relatedFile.fullPath,
      } satisfies vscode.QuickPickItem & { path: string };
    });

    // see https://github.com/microsoft/vscode-extension-samples/blob/main/quickinput-sample/src/extension.ts
    const selectedItem = await vscode.window.showQuickPick(quickPickItems, {
      // the title wraps so no need to shorten the path
      title: `Open file related to "${getWorkspaceRelativePath(uri)}"`,
      placeHolder: "Type here to filter results",
      // match on any info
      matchOnDescription: true,
      matchOnDetail: true,
    });

    Logger.info("Quick pick selection", selectedItem);

    if (!selectedItem?.path) {
      return; // the user canceled the selection
    }

    await openFileInNewTab(selectedItem.path);
  });

  return disposable;
}
