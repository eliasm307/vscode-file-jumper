import * as vscode from "vscode";
import { getAllWorkspacePaths, getMainConfig, logAndShowIssuesWithConfig } from "./utils";
import Logger, { EXTENSION_KEY } from "../classes/Logger";
import { getIssuesWithMainConfig } from "../utils/config";
import type LinkManager from "../classes/LinkManager";
import type DecorationProviderManager from "./DecorationProviderManager";

export default function registerConfigurationWatcher({
  linkManager,
  decorationProviderManager,
}: {
  linkManager: LinkManager;
  decorationProviderManager: DecorationProviderManager;
}): vscode.Disposable {
  return vscode.Disposable.from(
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
}
