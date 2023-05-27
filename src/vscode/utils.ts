import * as vscode from "vscode";
import type { MainConfig } from "../utils/config";
import { formatRawFileTypesConfig, formatRawIgnorePatternsConfig } from "../utils/config";

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

export async function getWorkspaceFolderChildPaths(folders: readonly vscode.WorkspaceFolder[]) {
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
    showDebugLogs: extensionConfig.get("showDebugLogs") || false,
  };
}

export async function getAllWorkspacePaths(): Promise<string[]> {
  const allUris = (await vscode.workspace.findFiles("**")) || [];
  return allUris.map((uri) => uri.path);
}
