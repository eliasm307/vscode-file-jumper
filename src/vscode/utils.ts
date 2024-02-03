import * as vscode from "vscode";
import { formatRawFileTypesConfig, formatRawIgnorePatternsConfig } from "../utils/config";
import type { RawMainConfig } from "../utils/config";
import Logger, { EXTENSION_KEY } from "../classes/Logger";
import type { FileCreationData } from "../types";
import { isTruthy } from "../utils";

export async function openFileInNewTab(path: string) {
  const doc = await vscode.workspace.openTextDocument(createUri(path));
  return vscode.window.showTextDocument(doc, { preview: false });
}

export function getWorkspaceRelativePath(pathOrUri: string | vscode.Uri) {
  return vscode.workspace.asRelativePath(pathOrUri, false);
}

export function createUri(path: string) {
  return vscode.Uri.file(path);
}

export function uriToPath(uri: vscode.Uri) {
  return uri.path;
}

export async function getWorkspaceFoldersChildPaths(folders: readonly vscode.WorkspaceFolder[]) {
  const paths: string[] = [];
  for (const removedFolder of folders) {
    const removedUris = await vscode.workspace.findFiles(
      new vscode.RelativePattern(removedFolder.uri, "**"),
    );
    paths.push(...removedUris.map(uriToPath));
  }
  return paths;
}

export function getMainConfig(): Required<RawMainConfig> {
  const extensionConfig = vscode.workspace.getConfiguration("fileJumper");

  return {
    fileTypes: formatRawFileTypesConfig(extensionConfig.get("fileTypes")),
    ignorePatterns: formatRawIgnorePatternsConfig(extensionConfig.get("ignorePatterns")),
    showDebugLogs: extensionConfig.get("showDebugLogs") ?? false,
    autoJump: extensionConfig.get("autoJump") ?? true,
    allowNotifications: extensionConfig.get("allowNotifications") ?? false,
  };
}

export async function getAllWorkspacePaths(): Promise<string[]> {
  const allUris = await vscode.workspace.findFiles("**");
  return allUris.map(uriToPath);
}

/**
 * For modification events a folder is given as a single uri and this function recursively resolves
 * all the child paths of folders to produce the actual list of paths that were affected
 */
export async function resolvePathsFromUris(uris: readonly vscode.Uri[]): Promise<string[]> {
  const resolvedUris = await Promise.all(
    uris.map(async (uri) => {
      try {
        const stat = await vscode.workspace.fs.stat(uri);
        if (stat.type === vscode.FileType.Directory) {
          const folderChildUris = await vscode.workspace.findFiles(
            new vscode.RelativePattern(uri, "**"),
          );
          return folderChildUris;
        }
        return uri;
      } catch (e) {
        Logger.error(`Failed to resolve paths from uri: ${uri.path}`, e);
        return [];
      }
    }),
  );
  return resolvedUris.flat().map(uriToPath);
}

export async function logAndShowIssuesWithConfig({
  issues,
  notificationsAllowed,
}: {
  issues: string[];
  notificationsAllowed: boolean;
}): Promise<void> {
  for (const issue of issues) {
    Logger.info(`Configuration issue: ${issue}`);
    if (notificationsAllowed) {
      await vscode.window.showErrorMessage(`${EXTENSION_KEY} Configuration issue: ${issue}`);
    }
  }
}

export async function pathExists(path: string): Promise<boolean> {
  try {
    await vscode.workspace.fs.stat(createUri(path));
    Logger.info("Path exists:", path);
    return true;
  } catch {
    Logger.info("Path does not exist:", path);
    return false;
  }
}

export async function getPossibleFileCreations(
  all: FileCreationData[],
): Promise<FileCreationData[]> {
  return (await Promise.all(all.map(nullIfCreationNotPossible))).filter(isTruthy);
}

async function nullIfCreationNotPossible(data: FileCreationData): Promise<FileCreationData | null> {
  // If the file already exists then it is not a possible creation
  return (await pathExists(data.fullPath)) ? null : data;
}

export async function createFile(path: string) {
  Logger.info("Creating file:", path);
  const uri = createUri(path);
  await vscode.workspace.fs.writeFile(uri, new Uint8Array());
  Logger.info("Created file:", path);
}

export async function deleteFile(path: string) {
  Logger.info("Deleting file:", path);
  const uri = createUri(path);
  await vscode.workspace.fs.delete(uri);
  Logger.info("Deleted file:", path);
}
