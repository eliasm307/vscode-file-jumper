import * as vscode from "vscode";
import type LinkManager from "../classes/LinkManager";
import Logger from "../classes/Logger";
import { shortenPath } from "../utils";
import { getWorkspaceRelativePath, getPossibleFileCreations, openFileInNewTab } from "./utils";
import type { FileCreationData } from "../types";

export default function registerCreateFileCommand(linkManager: LinkManager) {
  // command is conditionally triggered based on context:
  // see https://code.visualstudio.com/api/references/when-clause-contexts#in-and-not-in-conditional-operators
  return vscode.commands.registerCommand(
    "fileJumper.createFileCommand",
    async (fromUri: vscode.Uri) => {
      Logger.info("createFileCommand called with uri:", fromUri.path);

      const fileCreation = await getTargetPathFromUser({ linkManager, fromUri });
      if (fileCreation) {
        const uri = vscode.Uri.file(fileCreation.fullPath);
        await createFile(uri, fileCreation.defaultContent);
        await openFileInNewTab(uri.fsPath);
      }
      // else user canceled the selection
    },
  );
}

async function createFile(uri: vscode.Uri, defaultContent: string) {
  // todo test this works if folders don't exist
  // todo support templating, e.g. getting variables from path or the user
  await vscode.workspace.fs.writeFile(uri, Buffer.from(defaultContent));
}

async function getTargetPathFromUser({
  fromUri,
  linkManager,
}: {
  fromUri: vscode.Uri;
  linkManager: LinkManager;
}): Promise<FileCreationData | undefined> {
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
    title: `Create file from "${getWorkspaceRelativePath(fromUri)}"`,
    placeHolder: "Type here to filter results",
    // match on any info
    matchOnDescription: true,
    matchOnDetail: true,
  });

  Logger.info("getPathToNavigateToFromOptions Quick pick selection", selectedItem);

  // undefined if the user canceled the selection
  return selectedItem?.data;
}
