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

export function getFileGroupConfigs(context: vscode.ExtensionContext) {
  const config = vscode.workspace.getConfiguration("coLocate");
  const fileGroupConfigs = config.get<FileGroupConfigs>("fileGroups");
  return fileGroupConfigs;
}

export function configIsValid(
  fileGroupConfigs: FileGroupConfigs | undefined,
): fileGroupConfigs is FileGroupConfigs {
  if (!fileGroupConfigs?.length) {
    console.error("No config found");
    return false;
  }

  if (fileGroupConfigs.length !== 1) {
    console.error("Only one file group is supported at this time");
    return false;
  }

  const fileGroup = fileGroupConfigs[0];
  const groupName = fileGroup.name || "0";

  if (!fileGroup.types?.length) {
    console.error(`No group items found in group "${groupName}"`);
    return false;
  }

  if (fileGroup.types.length < 2) {
    console.error(`Less than 2 items found in group "${groupName}"`);
    return false;
  }

  let i = 0;
  for (const groupItem of fileGroup.types) {
    if (!groupItem.name) {
      console.error(`No name found for group item ${i} in group "${groupName}"`);
      return false;
    }

    if (!groupItem.marker) {
      console.error(`No marker found for group item "${groupItem.name}" in group "${groupName}"`);
      return false;
    }

    if (!groupItem.regex) {
      console.error(`No regex found for group item "${groupItem.name}" in group "${groupName}"`);
      return false;
    }
    i++;
  }

  return true;
}
