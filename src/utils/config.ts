import * as vscode from "vscode";

export type FileGroupConfig = {
  name?: string;
  types: FileTypeConfig[];
};

export type FileTypeConfig = {
  name: string;
  // ? should this allow using built in icons also? https://code.visualstudio.com/api/references/icons-in-labels
  marker: string;
  regex: string;
};

export type MainConfig = {
  fileGroups: FileGroupConfig[];
  ignoreRegexs: string[];
};

export function getFileGroupConfigs() {
  const config = vscode.workspace.getConfiguration("coLocate");
  return config.get<FileGroupConfig[]>("fileGroups");
}

export function getIgnoreRegexsConfig() {
  const config = vscode.workspace.getConfiguration("coLocate");
  return config.get<string[]>("ignoreRegexs");
}

export function getMainConfig(): MainConfig {
  return {
    fileGroups: getFileGroupConfigs() || [],
    ignoreRegexs: getIgnoreRegexsConfig() || [],
  };
}

// todo look into json schema validation to use one source of truth
export function findReasonMainConfigIsInvalid(config: MainConfig): string | undefined {
  if (!config.fileGroups?.length) {
    return "No config found";
  }

  if (!config.ignoreRegexs?.length) {
    for (const regex of config.ignoreRegexs) {
      if (typeof regex !== "string") {
        return `Invalid ignore regex: ${regex}`;
      }
      try {
        // eslint-disable-next-line no-new
        new RegExp(regex);
      } catch (e) {
        return `Invalid ignore regex: ${regex}`;
      }
    }
  }

  const fileGroupIndex = 0;
  for (const fileGroup of config.fileGroups) {
    const groupName = fileGroup.name || fileGroupIndex.toString();
    if (!fileGroup.types?.length) {
      return `No group items found in group "${groupName}"`;
    }

    if (fileGroup.types.length < 2) {
      return `Less than 2 items found in group "${groupName}"`;
    }

    let fileTypeIndex = 0;
    for (const fileType of fileGroup.types) {
      if (!fileType.name) {
        return `No name found for group item ${fileTypeIndex} in group "${groupName}"`;
      }

      if (!fileType.marker) {
        return `No marker found for group item "${fileType.name}" in group "${groupName}"`;
      }

      if (!fileType.regex) {
        return `No regex found for group item "${fileType.name}" in group "${groupName}"`;
      }
      fileTypeIndex++;
    }
  }
}
