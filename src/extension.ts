/* eslint-disable no-console */
// for adding configuration options: https://code.visualstudio.com/api/references/contribution-points#contributes.configuration
// overall structure: https://code.visualstudio.com/api/get-started/extension-anatomy
// full api reference: https://code.visualstudio.com/api/references/vscode-api
// sorting of context menu items: https://code.visualstudio.com/api/references/contribution-points#Sorting-of-groups
// see built in commands: https://code.visualstudio.com/api/references/commands

// todo
// - detect and handle configuration changes
// - make context menu only show on files with known related files
// - customise marketplace look https://code.visualstudio.com/api/working-with-extensions/publishing-extension#advanced-usage

import * as vscode from "vscode";
import { findReasonMainConfigIsInvalid, getMainConfig } from "./utils/config";
import CoLocator from "./classes/CoLocator";
import BadgeDecorationProvider from "./vscode/BadgeDecorationProvider";
import { getShortPath, openFile } from "./utils/vscode";

export async function activate(context: vscode.ExtensionContext) {
  console.log("extension activating...");

  const mainConfig = getMainConfig();
  const reasonConfigIsInvalid = findReasonMainConfigIsInvalid(mainConfig);
  if (reasonConfigIsInvalid) {
    return vscode.window.showErrorMessage(`Invalid configuration: ${reasonConfigIsInvalid}`);
  }

  console.log("extension loaded with patternGroupsConfig:", mainConfig);

  const coLocator = new CoLocator(mainConfig);

  const badgeDecorationProvider = new BadgeDecorationProvider((filePath) => {
    return coLocator.getRelatedFileMarkers(filePath);
  });

  const allFileUris = await vscode.workspace.findFiles("**/*");
  const allFilePaths = allFileUris.map((file) => file.path);
  console.log("allFilePaths", allFilePaths);

  coLocator.initWorkspaceFiles(allFilePaths);

  // todo listen for config changes to update file decorations
  // todo listen for file deletions/creations/renames to update file decorations
  context.subscriptions.push(
    { dispose: () => coLocator.reset() },
    registerNavigateCommand(coLocator),
    vscode.window.registerFileDecorationProvider(badgeDecorationProvider),
    vscode.workspace.onDidRenameFiles((e) => {
      // todo handle file rename
      console.warn("onDidRenameFiles", e);
      coLocator.removeFiles(e.files.map((file) => file.oldUri.path));
      coLocator.addFiles(e.files.map((file) => file.newUri.path));
      badgeDecorationProvider.notifyFileDecorationsChanged();
    }),
    vscode.workspace.onDidCreateFiles((e) => {
      // todo handle file create
      console.warn("onDidCreateFiles", e);
      coLocator.addFiles(e.files.map((file) => file.path));
      badgeDecorationProvider.notifyFileDecorationsChanged();
    }),
    vscode.workspace.onDidDeleteFiles((e) => {
      // todo handle file delete
      console.warn("onDidDeleteFiles", e);
      coLocator.removeFiles(e.files.map((file) => file.path));
      badgeDecorationProvider.notifyFileDecorationsChanged();
    }),
    vscode.workspace.onDidChangeWorkspaceFolders((e) => {
      // todo handle workspace folder change
      console.warn("onDidChangeWorkspaceFolders", e);
      // ? could use this to handle workspace folder change?
    }),
    vscode.workspace.onDidChangeConfiguration((e) => {
      // todo handle configuration change
      console.warn("onDidChangeConfiguration", e);
      coLocator.setConfig(getMainConfig());
      badgeDecorationProvider.notifyFileDecorationsChanged();
    }),
  );

  console.log("extension activated");
}

type QuickPickItem = vscode.QuickPickItem & { filePath?: string };

function registerNavigateCommand(coLocator: CoLocator) {
  // command is conditionally triggered based on context:
  // see https://code.visualstudio.com/api/references/when-clause-contexts#in-and-not-in-conditional-operators
  const disposable = vscode.commands.registerCommand(
    "coLocate.navigateCommand",
    async (uri: vscode.Uri) => {
      const shortPath = getShortPath(uri);
      const groupedRelatedFiles = coLocator.getFileMetaData(uri.path)?.relatedFileGroups || [];

      const lastGroupIndex = groupedRelatedFiles.length - 1;
      const quickPickItems = groupedRelatedFiles.flatMap((group, i) => {
        const quickPickGroupItems = group.map((relatedFile): QuickPickItem => {
          return {
            label: `${relatedFile.marker} ${relatedFile.typeName}`,
            detail: getShortPath(relatedFile.fullPath),
            filePath: relatedFile.fullPath,
          };
        });

        const isLastGroup = i === lastGroupIndex;
        if (!isLastGroup) {
          quickPickGroupItems.push({
            kind: vscode.QuickPickItemKind.Separator,
            label: "──────────────────────────────────",
          });
        }

        return quickPickGroupItems;
      });

      // todo check what this looks like
      // see https://github.com/microsoft/vscode-extension-samples/blob/main/quickinput-sample/src/extension.ts
      const selection = await vscode.window.showQuickPick(quickPickItems, {
        title: `Navigate to file related to "${shortPath}"`,
        placeHolder: "Select a related file",
        // match on any info
        matchOnDescription: true,
        matchOnDetail: true,
      });

      console.log("Quick pick selection", selection);

      if (selection?.kind !== vscode.QuickPickItemKind.Default) {
        return;
      }

      // the user canceled the selection
      if (!selection?.filePath) {
        return;
      }

      await openFile(selection.filePath);
      await vscode.window.showInformationMessage(`Context Menu Option Clicked: ${shortPath}`); // todo remove
    },
  );

  return disposable;
}
