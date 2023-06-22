import * as vscode from "vscode";
import type LinkManager from "../classes/LinkManager";
import Logger, { EXTENSION_KEY } from "../classes/Logger";
import { uriToPath, getWorkspaceFoldersChildPaths, resolvePathsFromUris } from "./utils";

export default function registerFileWatcher(linkManager: LinkManager): vscode.Disposable {
  const fileSystemWatcher = vscode.workspace.createFileSystemWatcher("**", false, true);
  fileSystemWatcher.onDidCreate((uri) => handleFileCreation({ linkManager, uri }));
  fileSystemWatcher.onDidDelete((uri) => handleFileDeletion({ linkManager, uri }));

  return vscode.Disposable.from(
    fileSystemWatcher,
    vscode.workspace.onDidChangeWorkspaceFolders(async (e) => {
      try {
        Logger.warn("onDidChangeWorkspaceFolders", e);
        const [removePaths, addPaths] = await Promise.all([
          getWorkspaceFoldersChildPaths(e.removed),
          getWorkspaceFoldersChildPaths(e.added),
        ]);
        linkManager.modifyFilesAndNotify({ removePaths, addPaths });

        // show user error before throwing it internally
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        await vscode.window.showErrorMessage(`${EXTENSION_KEY} Issue handling renamed files: ${message}`);
        throw error;
      }
    }),
  );
}

async function handleFileDeletion({ linkManager, uri }: { linkManager: LinkManager; uri: vscode.Uri }) {
  try {
    const path = uriToPath(uri);
    Logger.info("onDidDeleteFiles", path);
    linkManager.modifyFilesAndNotify({ removePaths: [path] });

    // show user error before throwing it internally
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await vscode.window.showErrorMessage(`${EXTENSION_KEY} Issue handling deleted files: ${message}`);
    throw error;
  }
}

async function handleFileCreation({ linkManager, uri }: { linkManager: LinkManager; uri: vscode.Uri }) {
  try {
    const resolvedPaths = await resolvePathsFromUris([uri]);
    Logger.info("handleFileCreation", { uriPath: uri.path, resolvedPaths });
    linkManager.modifyFilesAndNotify({ addPaths: resolvedPaths });

    // show user error before throwing it internally
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await vscode.window.showErrorMessage(`${EXTENSION_KEY} Issue handling created files: ${message}`);
    throw error;
  }
}
