import * as vscode from "vscode";
import type { MainConfig } from "./config";
import { formatRawIgnorePatternsConfig, formatRawFileTypesConfig } from "./config";

export async function openFileInNewTab(filePath: string) {
  const doc = await vscode.workspace.openTextDocument(createUri(filePath));
  await vscode.window.showTextDocument(doc, { preview: false });
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
    fileTypes: formatRawFileTypesConfig(extensionConfig.get("fileTypes")),
    ignorePatterns: formatRawIgnorePatternsConfig(extensionConfig.get("ignorePatterns")),
  };
}
