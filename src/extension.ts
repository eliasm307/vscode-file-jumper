import * as vscode from "vscode";
import LinkManager from "./classes/LinkManager";
import Logger, { EXTENSION_KEY } from "./classes/Logger";
import { getIssuesWithMainConfig } from "./utils/config";
import DecorationProviderManager from "./vscode/DecorationProviderManager";
import { createUri, getAllWorkspacePaths, getMainConfig } from "./vscode/utils";
import type { MainConfig } from "./utils/config";
import registerNavigateCommand from "./vscode/registerNavigateCommand";
import registerFileSystemWatcher from "./vscode/registerFileSystemWatcher";

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

  linkManager.setOnFileLinksUpdatedHandler((affectedPaths) => {
    // need to use FS paths for context key so they work with menu items conditions (they dont have an option to use the normalised path)
    const fsPathsWithLinks = linkManager.getAllPathsWithOutgoingLinks().map((normalisedPath) => createUri(normalisedPath).fsPath);

    const FS_PATHS_WITH_LINKS_CONTEXT_KEY = "fileJumper.filePathsWithLinks";
    // this is used to show the context menu item conditionally on files we know have links
    void vscode.commands.executeCommand("setContext", FS_PATHS_WITH_LINKS_CONTEXT_KEY, fsPathsWithLinks);

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
