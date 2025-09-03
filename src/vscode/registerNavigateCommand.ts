import * as vscode from "vscode";
import type LinkManager from "../classes/LinkManager";
import Logger, { EXTENSION_KEY } from "../classes/Logger";
import { shortenPath } from "../utils";
import { openFileInNewTab, getWorkspaceRelativePath } from "./utils";

export default function registerNavigateCommand(linkManager: LinkManager) {
  // command is conditionally triggered based on context:
  // see https://code.visualstudio.com/api/references/when-clause-contexts#in-and-not-in-conditional-operators
  return vscode.commands.registerCommand(
    "fileJumper.navigateCommand",
    async (fromUri?: vscode.Uri) => {
      // If no URI is provided (e.g., from keyboard shortcut), use the active editor
      if (!fromUri) {
        const activeEditor = vscode.window.activeTextEditor;
        if (!activeEditor) {
          const message = "No active file to navigate from. Please open a file first.";
          Logger.error(message);
          if (linkManager.notificationsAllowed) {
            await vscode.window.showErrorMessage(`${EXTENSION_KEY} ${message}`);
          }
          return;
        }
        fromUri = activeEditor.document.uri;
        Logger.info("navigateCommand uri set to active editor uri", fromUri.path);
      }

      Logger.info("navigateCommand called with uri:", fromUri.path);

      try {
        const selectedPath = await getTargetPathFromUser({ linkManager, fromUri });
        if (selectedPath) {
          await openFileInNewTab(selectedPath);
        }
        // else user canceled the selection
      } catch (e) {
        // todo test it can handle errors
        Logger.error("Error in navigateCommand handler", e);

        if (linkManager.notificationsAllowed) {
          const message = e instanceof Error ? e.message : String(e);
          await vscode.window.showErrorMessage(
            `${EXTENSION_KEY} Error navigating to file: ${message}`,
          );
        }
      }
    },
  );
}

async function getTargetPathFromUser({
  fromUri,
  linkManager,
}: {
  fromUri: vscode.Uri;
  linkManager: LinkManager;
}): Promise<string | undefined> {
  const fileOptions = linkManager.getLinkedFilesFromPath(fromUri.path);
  const allFilesWithLinks = linkManager.getAllPathsWithOutgoingLinks();

  Logger.info("linkedFilesFromPath", fromUri.path, fileOptions);
  Logger.info("allFilesWithLinks", allFilesWithLinks); // for debugging

  if (linkManager.autoJumpEnabled && fileOptions.length === 1) {
    return fileOptions[0].fullPath; // no need to show quick pick if there is only one option
  }

  const quickPickItems = fileOptions.map((linkedFile) => {
    return {
      label: `${linkedFile.icon} ${linkedFile.typeName}`,
      // if this overflows the end of the path is hidden and we want to prioritise the end of the path so we shorten it
      detail: shortenPath(getWorkspaceRelativePath(linkedFile.fullPath)),
      path: linkedFile.fullPath,
    } satisfies vscode.QuickPickItem & { path: string };
  });

  Logger.info("quickPickItems", fromUri.path, quickPickItems);

  // see https://github.com/microsoft/vscode-extension-samples/blob/main/quickinput-sample/src/extension.ts
  const selectedItem = await vscode.window.showQuickPick(quickPickItems, {
    // the title wraps so no need to shorten the path
    title: `Open file related to "${getWorkspaceRelativePath(fromUri)}"`,
    placeHolder: "Type here to filter results",
    // match on any info
    matchOnDescription: true,
    matchOnDetail: true,
  });

  Logger.info("Quick pick selection", selectedItem);

  // undefined if the user canceled the selection
  return selectedItem?.path;
}
