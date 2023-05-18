// for adding configuration options: https://code.visualstudio.com/api/references/contribution-points#contributes.configuration
// overall structure: https://code.visualstudio.com/api/get-started/extension-anatomy
// full api reference: https://code.visualstudio.com/api/references/vscode-api
// sorting of context menu items: https://code.visualstudio.com/api/references/contribution-points#Sorting-of-groups
// see built in commands: https://code.visualstudio.com/api/references/commands
// can use built in icons in some cases: https://code.visualstudio.com/api/references/icons-in-labels
// inspecting context keys of items in the editor, e.g. explorer tree items: https://code.visualstudio.com/api/references/when-clause-contexts#inspect-context-keys-utility
// integration testing: https://code.visualstudio.com/api/working-with-extensions/testing-extension
// manage extensions at: https://marketplace.visualstudio.com/manage
// good example: https://marketplace.visualstudio.com/items?itemName=wayou.vscode-todo-highlight

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
import {
  createUri,
  getAllWorkspacePaths,
  getMainConfig,
  getWorkspaceRelativePath,
  openFileInNewTab,
} from "./vscode/utils";
import Logger, { EXTENSION_KEY } from "./classes/Logger";
import { shortenPath } from "./utils";
import DecorationProviderManager from "./vscode/DecorationProviderManager";

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
    Logger.error("Error getting main config:", message);
    return vscode.window.showErrorMessage(`${EXTENSION_KEY} Configuration issue: ${message}`);
  }

  if (mainConfig.showDebugLogs) {
    const outputChannel = vscode.window.createOutputChannel("Co-Locate", {
      log: true,
    });
    context.subscriptions.push(outputChannel); // add this early incase we return early

    Logger.setOutputChannel(outputChannel);
    Logger.setEnabled(true); // default disabled
  }

  Logger.info("Extension activating...");

  const configIssues = getIssuesWithMainConfig(mainConfig);
  if (configIssues.length) {
    await logAndShowIssuesWithConfig(configIssues);
    Logger.info("Extension not activated due to config issues");
    return;
  }

  Logger.info("Extension activated with valid config:", mainConfig);

  const linkManager = new LinkManager();

  const decorationProviderManager = new DecorationProviderManager({
    getDecorationData: (config) => linkManager.getFileTypeDecoratorData(config),
  });

  linkManager.setOnFileLinksUpdatedHandler((affectedPaths) => {
    // need to use FS paths for context key so they work with menu items conditions (they dont have an option to use the normalised path)
    const fsPathsWithLinks = linkManager
      .getAllPathsWithOutgoingLinks()
      .map((normalisedPath) => createUri(normalisedPath).fsPath);

    const FS_PATHS_WITH_LINKS_CONTEXT_KEY = "coLocate.filePathsWithLinks";
    // this is used to show the context menu item conditionally on files we know have links
    void vscode.commands.executeCommand("setContext", FS_PATHS_WITH_LINKS_CONTEXT_KEY, fsPathsWithLinks);

    // notify decorators of changes
    // todo debug this getting more paths that it needs
    Logger.info("onFileLinksUpdated handler called with affectedPaths:", affectedPaths);
    decorationProviderManager.notifyFileDecorationsChanged(affectedPaths);
  });

  // should trigger notification after setting the file links updated handler so initial setup is handled
  linkManager.setContext({
    config: mainConfig,
    paths: await getAllWorkspacePaths(),
  });

  // should happen after the linkManager is setup with files,
  // because the providers get used as soon as they are registered and need to be able to get the file links
  const fileTypeNames = mainConfig.fileTypes.map((fileType) => fileType.name);
  decorationProviderManager.setFileTypeNames(fileTypeNames);

  context.subscriptions.push(
    { dispose: () => linkManager.revertToInitial() },
    { dispose: () => decorationProviderManager.dispose() },
    registerNavigateCommand(linkManager),
    /**
     * @remark When renaming a folder with children only one event is fired.
     */
    vscode.workspace.onDidRenameFiles(async (e) => {
      try {
        const oldPaths = e.files.map((file) => file.oldUri.path);
        const newPaths = e.files.map((file) => file.newUri.path);
        linkManager.renameFilesAndNotify({ oldPaths, newPaths });

        // show user error before throwing it internally
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        await vscode.window.showErrorMessage(`${EXTENSION_KEY} Issue handling renamed files: ${message}`);
        throw error;
      }
    }),
    /**
     * @remark This event is not fired when files change on disk, e.g triggered by another application, or when using the workspace.fs-api
     */
    vscode.workspace.onDidCreateFiles(async (e) => {
      try {
        linkManager.addPathsAndNotify(e.files.map((file) => file.path));

        // show user error before throwing it internally
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        await vscode.window.showErrorMessage(`${EXTENSION_KEY} Issue handling created files: ${message}`);
        throw error;
      }
    }),
    /**
     * @remark This event is not fired when files change on disk, e.g triggered by another application, or when using the workspace.fs-api
     *
     * @remark When deleting a folder with children only one event is fired.
     */
    vscode.workspace.onDidDeleteFiles(async (e) => {
      try {
        Logger.warn("onDidDeleteFiles", e);
        linkManager.removePathsAndNotify(e.files.map((file) => file.path));

        // show user error before throwing it internally
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        await vscode.window.showErrorMessage(`${EXTENSION_KEY} Issue handling deleted files: ${message}`);
        throw error;
      }
    }),
    vscode.workspace.onDidChangeWorkspaceFolders((e) => {
      // todo handle workspace folder change
      Logger.warn("onDidChangeWorkspaceFolders", e);
      // ? could use this to handle workspace folder change?
    }),
    vscode.workspace.onDidChangeConfiguration(async (e) => {
      try {
        const newMainConfig = getMainConfig();

        Logger.info("onDidChangeConfiguration", "newMainConfig", e, {
          newMainConfig,
        });

        const newConfigIssues = getIssuesWithMainConfig(newMainConfig);
        if (newConfigIssues.length) {
          await logAndShowIssuesWithConfig(newConfigIssues);
          Logger.info(`config change not applied due to config issues: [ ${newConfigIssues.join(", ")} ]`);
          return;
        }

        linkManager.setContext({
          config: newMainConfig,
          paths: await getAllWorkspacePaths(),
        });

        const newFileTypeNames = newMainConfig.fileTypes.map((fileType) => fileType.name);
        decorationProviderManager.setFileTypeNames(newFileTypeNames);

        // show the user error before throwing it internally
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        Logger.error("onDidChangeConfiguration", message, error);
        await vscode.window.showErrorMessage(`${EXTENSION_KEY} Issue handling configuration change: ${message}`);
        throw error;
      }
    }),
  );

  Logger.info("🚀 Extension activated");
}

function registerNavigateCommand(linkManager: LinkManager) {
  // command is conditionally triggered based on context:
  // see https://code.visualstudio.com/api/references/when-clause-contexts#in-and-not-in-conditional-operators
  const disposable = vscode.commands.registerCommand("coLocate.navigateCommand", async (uri: vscode.Uri) => {
    const quickPickItems = linkManager.getLinkedFilesFromPath(uri.path).map((linkedFile) => {
      return {
        label: `${linkedFile.marker} ${linkedFile.typeName}`,
        // if this overflows the end of the path is hidden and we want to prioritise the end of the path so we shorten it
        detail: shortenPath(getWorkspaceRelativePath(linkedFile.fullPath)),
        path: linkedFile.fullPath,
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
