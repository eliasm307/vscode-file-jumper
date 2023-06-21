import * as vscode from "vscode";
import type LinkManager from "../classes/LinkManager";
import Logger, { EXTENSION_KEY } from "../classes/Logger";
import { uriToPath, resolvePathsFromUris, getWorkspaceFoldersChildPaths } from "./utils";

export default function registerFileWatcher(linkManager: LinkManager): vscode.Disposable {
  const subscriptions: vscode.Disposable[] = [
    /**
     * @remark When renaming a folder with children only one event is fired.
     */
    vscode.workspace.onDidRenameFiles(async (e) => {
      try {
        Logger.warn("onDidRenameFiles", e);

        const removePaths = e.files.map((file) => uriToPath(file.oldUri));
        const addedUris = e.files.map((file) => file.newUri);
        linkManager.modifyFilesAndNotify({
          // could be folders deleted here, but cant resolve them to paths because they dont exist anymore
          removePaths,
          addPaths: await resolvePathsFromUris(addedUris),
        });

        // show user error before throwing it internally
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        await vscode.window.showErrorMessage(`${EXTENSION_KEY} Issue handling renamed files: ${message}`);
        throw error;
      }
    }),
    vscode.workspace.onDidChangeWorkspaceFolders(async (e) => {
      try {
        Logger.warn("onDidChangeWorkspaceFolders", e);

        const removePaths = await getWorkspaceFoldersChildPaths(e.removed);
        const addPaths = await getWorkspaceFoldersChildPaths(e.added);
        linkManager.modifyFilesAndNotify({ removePaths, addPaths });

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
        Logger.info("onDidCreateFiles", e);

        linkManager.modifyFilesAndNotify({
          addPaths: await resolvePathsFromUris(e.files),
        });

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
        linkManager.modifyFilesAndNotify({
          // could be folders deleted here, but cant resolve them to paths because they dont exist anymore
          removePaths: e.files.map(uriToPath),
        });

        // show user error before throwing it internally
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        await vscode.window.showErrorMessage(`${EXTENSION_KEY} Issue handling deleted files: ${message}`);
        throw error;
      }
    }),
  ];

  return {
    dispose: () => subscriptions.forEach((subscription) => subscription.dispose()),
  };
}
