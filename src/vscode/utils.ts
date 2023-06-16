import * as vscode from "vscode";

import { formatRawFileTypesConfig, formatRawIgnorePatternsConfig } from "../utils/config";

import type { MainConfig } from "../utils/config";

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
    const removedUris = await vscode.workspace.findFiles(new vscode.RelativePattern(removedFolder.uri, "**"));
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
  const allUris = (await vscode.workspace.findFiles("**")) || [];
  return allUris.map((uri) => uri.path);
}

/**
 * For modification events a folder is given as a single uri and this function recursively resolves
 * all the child paths of folders to produce the actual list of paths that were affected
 */
export async function resolvePathsFromUris(uris: readonly vscode.Uri[]): Promise<string[]> {
  const resolvedUris = await Promise.all(
    uris.map(async (uri) => {
      const stat = await vscode.workspace.fs.stat(uri);
      if (stat.type === vscode.FileType.Directory) {
        return vscode.workspace.findFiles(new vscode.RelativePattern(uri, "**"));
      }
      return uri;
    }),
  );
  return resolvedUris.flat().map(uriToPath);
}
