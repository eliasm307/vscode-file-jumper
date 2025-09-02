import * as vscode from "vscode";
import LinkManager from "./classes/LinkManager";
import Logger, { EXTENSION_KEY } from "./classes/Logger";
import { getIssuesWithMainConfig } from "./utils/config";
import DecorationProviderManager from "./vscode/DecorationProviderManager";
import {
  createUri,
  getAllWorkspacePaths,
  getMainConfig,
  getPossibleFileCreations,
  logAndShowIssuesWithConfig,
} from "./vscode/utils";
import type { RawMainConfig } from "./utils/config";
import registerNavigateCommand from "./vscode/registerNavigateCommand";
import registerFileSystemWatcher from "./vscode/registerFileSystemWatcher";
import registerConfigurationWatcher from "./vscode/registerConfigurationWatcher";
import registerCreateFileCommand from "./vscode/registerCreateFileCommand";

// todo generate readme from extension config in package.json, e.g. get descriptions of config options, generate types etc

export async function activate(context: vscode.ExtensionContext) {
  let mainConfig: RawMainConfig;
  try {
    // I don't think its worth adding a JSON schema validator package for this, we can just catch the error and show it to the user
    mainConfig = getMainConfig();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    Logger.error("Error getting main config:", message);
    // we dont know if the user doesn't want notifications so we show it anyway
    await vscode.window.showErrorMessage(
      `${EXTENSION_KEY} Could not read extension configuration: ${message}`,
    );
    return;
  }

  if (mainConfig.showDebugLogs) {
    const outputChannel = vscode.window.createOutputChannel("file-jumper", {
      log: true,
    });
    context.subscriptions.push(outputChannel); // add this early incase we return early

    Logger.setOutputChannel(outputChannel);
    Logger.setEnabled(true); // default disabled
  }

  Logger.info("Extension activating...");

  const configIssues = getIssuesWithMainConfig(mainConfig);
  if (configIssues.length) {
    Logger.info("Extension not activated due to config issues");
    await logAndShowIssuesWithConfig({
      issues: configIssues,
      notificationsAllowed: mainConfig.allowNotifications ?? false,
    });
    return;
  }

  Logger.info("Extension activated with valid config:", mainConfig);

  const linkManager = new LinkManager();

  const decorationProviderManager = new DecorationProviderManager({
    getDecorationData: (config) => linkManager.getFileTypeDecoratorData(config),
  });

  linkManager.setOnFileLinksUpdatedHandler(async (affectedPaths) => {
    Logger.info("START onFileLinksUpdated handler called with affectedPaths:", affectedPaths);

    try {
      // need to use FS paths for context key so they work (ie match) with menu items conditions (they don't have an option to use the normalised path)
      const fsPathsWithLinks = linkManager
        .getAllPathsWithOutgoingLinks()
        .map((normalisedPath) => createUri(normalisedPath).fsPath);

      // this is used to show the context menu item conditionally on files we know have links
      await vscode.commands.executeCommand(
        "setContext",
        "fileJumper.filePathsWithLinks", // key, used in Extension commands conditions
        fsPathsWithLinks,
      );

      // this is used to show the context menu item conditionally on files we know can create other files
      const fsPathsThatCanCreateFiles = await getFsPathsWithPossibleFileCreations(linkManager);
      await vscode.commands.executeCommand(
        "setContext",
        "fileJumper.filePathsWithPossibleCreations", // key, used in Extension commands conditions
        fsPathsThatCanCreateFiles,
      );

      // notify decorators of changes
      Logger.info("onFileLinksUpdated handler called with affectedPaths:", affectedPaths);
      Logger.info(
        "onFileLinksUpdated handler called, possibleCreationFsPaths:",
        fsPathsThatCanCreateFiles,
      );
      decorationProviderManager.notifyFileDecorationsChanged(affectedPaths);
    } catch (e) {
      Logger.error("Error in onFileLinksUpdated handler", e);
    }
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
    decorationProviderManager,
    registerNavigateCommand(linkManager),
    registerCreateFileCommand(linkManager),
    registerFileSystemWatcher(linkManager),
    registerConfigurationWatcher({ linkManager, decorationProviderManager }),
  );

  Logger.info("🚀 Extension activated");
}

async function getFsPathsWithPossibleFileCreations(linkManager: LinkManager) {
  const possibleCreationsMap = linkManager.getAllPathsWithPossibleCreationsEntries();
  return (
    (
      await Promise.all(
        // remove creations for files that already exist
        possibleCreationsMap.map(
          async ([path, allCreations]) =>
            [path, await getPossibleFileCreations(allCreations)] as const,
        ),
      )
    )
      // remove paths that have no possible creations
      .filter(([, possibleCreations]) => possibleCreations.length)
      .map(([path]) => createUri(path).fsPath)
  );
}
