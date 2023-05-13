import * as vscode from "vscode";
import type { MainConfig } from "./config";

export async function openFile(filePath: string) {
  await vscode.commands.executeCommand("vscode.open", createUri(filePath));

  // can also try
  // vscode.workspace.openTextDocument(uri)
}

export function getShortPath(pathOrUri: string | vscode.Uri) {
  return vscode.workspace.asRelativePath(pathOrUri, false);
}

export function createUri(path: string) {
  return vscode.Uri.file(path);
}

export function getMainConfig(): MainConfig {
  const extensionConfig = vscode.workspace.getConfiguration("coLocate");
  return {
    fileTypes: extensionConfig.get("fileTypes") || [],
    ignoreRegexs: extensionConfig.get("ignoreRegexs") || [],
  };
}
