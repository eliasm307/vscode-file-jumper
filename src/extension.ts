import * as vscode from "vscode";
import LinkManager from "./classes/LinkManager";
import Logger, { EXTENSION_KEY } from "./classes/Logger";
import { getIssuesWithMainConfig } from "./utils/config";
import DecorationProviderManager from "./vscode/DecorationProviderManager";
import { createUri, getAllWorkspacePaths, getMainConfig, logAndShowIssuesWithConfig } from "./vscode/utils";
import type { MainConfig } from "./utils/config";
import registerNavigateCommand from "./vscode/registerNavigateCommand";
import registerFileSystemWatcher from "./vscode/registerFileSystemWatcher";
import registerConfigurationWatcher from "./vscode/registerConfigurationWatcher";

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
    await logAndShowIssuesWithConfig(configIssues);
    Logger.info("Extension not activated due to config issues");
    return;
  }

  Logger.info("Extension activated with valid config:", mainConfig);

  const linkManager = new LinkManager();

  const decorationProviderManager = new DecorationProviderManager({
    getDecorationData: (config) => linkManager.getFileTypeDecoratorData(config),
  });

  linkManager.setOnFileLinksUpdatedHandler(async (affectedPaths) => {
    // need to use FS paths for context key so they work with menu items conditions (they dont have an option to use the normalised path)
    const fsPathsWithLinks = linkManager.getAllPathsWithOutgoingLinks().map((normalisedPath) => createUri(normalisedPath).fsPath);

    const FS_PATHS_WITH_LINKS_CONTEXT_KEY = "fileJumper.filePathsWithLinks";
    // this is used to show the context menu item conditionally on files we know have links
    await vscode.commands.executeCommand("setContext", FS_PATHS_WITH_LINKS_CONTEXT_KEY, fsPathsWithLinks);

    // notify decorators of changes
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
    registerFileSystemWatcher(linkManager),
    registerConfigurationWatcher({ linkManager, decorationProviderManager }),
  );

  Logger.info("🚀 Extension activated");
}
