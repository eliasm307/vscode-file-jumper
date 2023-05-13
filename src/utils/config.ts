import * as vscode from "vscode";

export type FileTypeConfig = {
  name: string;
  marker: string;
  regex: string;
  /**
   * The names of other file types that this file type produces links to
   *
   * @remark by default (when not defined), all file types can be linked to all other file types
   *
   * @remark setting this to an empty array will prevent this file type from being related to any other file types, ie it will not have shortcuts from it but other file types can have shortcuts to it
   */
  onlyLinkTo?: string[];
};

export type MainConfig = {
  fileTypes: FileTypeConfig[];
  ignoreRegexs: string[];
};

function getFileGroupConfigs() {
  const config = vscode.workspace.getConfiguration("coLocate");
  return config.get<FileTypeConfig[]>("fileTypes");
}

function getIgnoreRegexsConfig() {
  const config = vscode.workspace.getConfiguration("coLocate");
  return config.get<string[]>("ignoreRegexs");
}

export function getMainConfig(): MainConfig {
  return {
    fileTypes: getFileGroupConfigs() || [],
    ignoreRegexs: getIgnoreRegexsConfig() || [],
  };
}
