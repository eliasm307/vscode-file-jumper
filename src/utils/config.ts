import * as vscode from "vscode";

type FileGroupConfig = {
  name?: string;
  types: FileTypeConfig[];
};

export type FileTypeConfig = {
  name: string;
  // ? should this allow using built in icons also? https://code.visualstudio.com/api/references/icons-in-labels
  marker: string;
  regex: string;
};

/**
 * @remark Only allowing one pattern group initially, but this could be expanded to allow multiple groups in the future
 */
export type FileGroupConfigs = [FileGroupConfig];

export function getFileGroupConfigs() {
  const config = vscode.workspace.getConfiguration("coLocate");
  const fileGroupConfigs = config.get<FileGroupConfigs>("fileGroups");
  return fileGroupConfigs;
}

export function findReasonConfigIsInvalid(
  fileGroupConfigs: FileGroupConfigs | undefined,
): string | undefined {
  if (!fileGroupConfigs?.length) {
    return "No config found";
  }

  if (fileGroupConfigs.length !== 1) {
    return "Only one file group is supported at this time";
  }

  const fileGroup = fileGroupConfigs[0];
  const groupName = fileGroup.name || "0";

  if (!fileGroup.types?.length) {
    return `No group items found in group "${groupName}"`;
  }

  if (fileGroup.types.length < 2) {
    return `Less than 2 items found in group "${groupName}"`;
  }

  let i = 0;
  for (const groupItem of fileGroup.types) {
    if (!groupItem.name) {
      return `No name found for group item ${i} in group "${groupName}"`;
    }

    if (!groupItem.marker) {
      return `No marker found for group item "${groupItem.name}" in group "${groupName}"`;
    }

    if (!groupItem.regex) {
      return `No regex found for group item "${groupItem.name}" in group "${groupName}"`;
    }
    i++;
  }
}
