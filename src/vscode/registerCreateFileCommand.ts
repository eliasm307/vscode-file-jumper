import * as vscode from "vscode";
import type LinkManager from "../classes/LinkManager";
import Logger, { EXTENSION_KEY } from "../classes/Logger";
import { shortenPath } from "../utils";
import {
  getWorkspaceRelativePath,
  getPossibleFileCreations,
  openFileInNewTab,
  createFile,
  deleteFile,
} from "./utils";
import type { FileCreationData } from "../types";

export default function registerCreateFileCommand(linkManager: LinkManager) {
  // command is conditionally triggered based on context:
  // see https://code.visualstudio.com/api/references/when-clause-contexts#in-and-not-in-conditional-operators
  return vscode.commands.registerCommand(
    "fileJumper.createFileCommand",
    async (fromUri: vscode.Uri) => {
      Logger.info("createFileCommand called with uri:", fromUri.path);

      try {
        const selectedFileCreations = await getFilesCreationsFromUser({ linkManager, fromUri });
        if (!selectedFileCreations.length) {
          return;
        }

        const stepSize = 100 / selectedFileCreations.length;
        // example https://github.com/microsoft/vscode-extension-samples/blob/main/notifications-sample/src/extension.ts
        await vscode.window.withProgress(
          {
            title: `Creating ${selectedFileCreations.length} file(s)`,
            location: vscode.ProgressLocation.Notification,
            cancellable: true,
          },
          async (progress, cancelToken) => {
            // todo test it can create multiple files at once
            // execute selected file creations, do this one at a time so editors don't get closed during file creation if a limit is reached
            try {
              for (const fileCreation of selectedFileCreations) {
                progress.report({ increment: 0, message: `Creating ${fileCreation.name}...` });
                await executeFileCreationAndOpen(fileCreation, cancelToken);
                progress.report({ increment: stepSize });
                if (cancelToken.isCancellationRequested) {
                  Logger.info("createFileCommand cancelled");
                  break;
                }
              }

              if (cancelToken.isCancellationRequested) {
                // todo test it can delete all created files if the user cancels the creation
                for (const fileCreation of selectedFileCreations) {
                  progress.report({ increment: 0, message: `Deleting ${fileCreation.name}...` });
                  await deleteFile(fileCreation.fullPath).catch(() => null); // ignore errors
                }
              }
            } catch (e) {
              Logger.error("Error in createFileCommand process", e);
              await vscode.window.showErrorMessage(
                `${EXTENSION_KEY} Error creating file(s) from "${getWorkspaceRelativePath(
                  fromUri,
                )}": ${String(e)}`,
              );
            } finally {
              progress.report({ increment: 100 });
            }
          },
        );
      } catch (e) {
        Logger.error("Error in createFileCommand handler", e);
        await vscode.window.showErrorMessage(
          `${EXTENSION_KEY} Error creating file(s) from "${getWorkspaceRelativePath(
            fromUri,
          )}": ${String(e)}`,
        );
      }
    },
  );
}

async function executeFileCreationAndOpen(
  fileCreation: FileCreationData,
  cancelToken: vscode.CancellationToken,
) {
  Logger.info("executeFileCreationAndOpen", fileCreation);
  // todo test it can create file if it requires folders that don't exist
  await createFile(fileCreation.fullPath);
  if (cancelToken.isCancellationRequested) {
    return;
  }

  // todo test it opens all created files in a new tab
  // open the created file in a new tab
  const newFileEditor = await openFileInNewTab(fileCreation.fullPath);
  if (cancelToken.isCancellationRequested) {
    return;
  }

  const hasExistingContent = !!newFileEditor.document.getText().trim();
  if (hasExistingContent) {
    // todo test it does not insert initial content if the file already has content
    return;
  }

  // todo test it can insert inline snippet definitions
  // if it is an array then it is the snippet body, create a snippet and trigger it
  if (Array.isArray(fileCreation.initialContentSnippet)) {
    const snippet = new vscode.SnippetString(fileCreation.initialContentSnippet.join("\n"));
    await newFileEditor.insertSnippet(snippet);

    // todo test it can insert existing snippets by name
    // if it is a string then it is meant to be an existing snippet name, trigger the snippet
  } else if (fileCreation.initialContentSnippet) {
    await vscode.commands.executeCommand("editor.action.insertSnippet", {
      name: fileCreation.initialContentSnippet,
    });
  }
}

async function getFilesCreationsFromUser({
  fromUri,
  linkManager,
}: {
  fromUri: vscode.Uri;
  linkManager: LinkManager;
}): Promise<FileCreationData[]> {
  const allFileOptions = linkManager.getAllFileCreationsFrom(fromUri.path);
  const fileOptions = await getPossibleFileCreations(allFileOptions);
  Logger.info("getFileCreationsFrom", fromUri.path, fileOptions);

  const quickPickItems = fileOptions.map((data) => {
    return {
      label: `${data.icon || ""} ${data.name}`.trim(),
      // if this overflows the end of the path is hidden and we want to prioritise the end of the path so we shorten it
      detail: shortenPath(getWorkspaceRelativePath(data.fullPath)),
      data,
    } satisfies vscode.QuickPickItem & { data: FileCreationData };
  });

  Logger.info("getPathToNavigateToFromOptions quickPickItems", fromUri.path, quickPickItems);

  // see https://github.com/microsoft/vscode-extension-samples/blob/main/quickinput-sample/src/extension.ts
  const selectedItem = await vscode.window.showQuickPick(quickPickItems, {
    // the title wraps so no need to shorten the path
    title: `Create file(s) from "${getWorkspaceRelativePath(fromUri)}"`,
    placeHolder: "Type here to filter results",
    // match on any info
    matchOnDescription: true,
    matchOnDetail: true,
    canPickMany: true,
  });

  Logger.info("getPathToNavigateToFromOptions Quick pick selection", selectedItem);

  // undefined if the user canceled the selection
  return selectedItem?.map((item) => item.data) || [];
}
