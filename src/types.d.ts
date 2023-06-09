import type FileType from "./classes/FileType";

export type FileMetaData = {
  fileType: FileType;
  linkedFiles: LinkedFileData[];
};

export type LinkedFileData = {
  typeName: string;
  icon: string;
  fullPath: string;
};

export type DecorationData = {
  /**
   * @remark this can only be 2 characters long or it will cause the decoration to be ignored
   * @see https://github.com/microsoft/vscode/blob/32b6b2e968fce4f0db41e3bde4aed83f542cd2ac/src/vs/workbench/api/common/extHostTypes.ts#L2914
   * @see https://github.com/microsoft/vscode/blob/main/src/vs/workbench/api/common/extHostTypes.ts#L3435
   * @see https://stackoverflow.com/a/74483366
   */
  badgeText: string;
  tooltip: string;
};

/**
 * VS Code seems to provide paths with varying cases for the root C directory (e.g. "C:\...", "c:\...")
 * so we need to make sure to normalise them in some cases to make sure they match
 */
export type NormalisedPath = string & { __normalisedPath: never };
