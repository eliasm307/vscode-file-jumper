import * as vscode from "vscode";
import { formatRawFileTypesConfig, formatRawIgnorePatternsConfig } from "../utils/config";
import type { MainConfig } from "../utils/config";
import Logger, { EXTENSION_KEY } from "../classes/Logger";
import type { FileCreationData } from "../types";
import { isTruthy } from "../utils";

export async function openFileInNewTab(path: string) {
  const doc = await vscode.workspace.openTextDocument(createUri(path));
  await vscode.window.showTextDocument(doc, { preview: false });
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

export function getMainConfig(): MainConfig {
  const extensionConfig = vscode.workspace.getConfiguration("fileJumper");

  return {
    fileTypes: formatRawFileTypesConfig(extensionConfig.get("fileTypes")),
    ignorePatterns: formatRawIgnorePatternsConfig(extensionConfig.get("ignorePatterns")),
    showDebugLogs: extensionConfig.get("showDebugLogs") ?? false,
    autoJump: extensionConfig.get("autoJump") ?? true,
  };
}

export async function getAllWorkspacePaths(): Promise<string[]> {
  const allUris = await vscode.workspace.findFiles("**");
  return allUris.map((uri) => uri.path);
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
          return await vscode.workspace.findFiles(new vscode.RelativePattern(uri, "**"));
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

export async function logAndShowIssuesWithConfig(issues: string[]): Promise<void> {
  for (const issue of issues) {
    Logger.info(`Configuration issue: ${issue}`);
    await vscode.window.showErrorMessage(`${EXTENSION_KEY} Configuration issue: ${issue}`);
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
  return (await pathExists(data.fullPath)) ? null : data;
}
