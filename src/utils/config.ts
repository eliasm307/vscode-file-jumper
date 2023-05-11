import * as vscode from "vscode";

export type PatternItem = {
  name: string;
  // ? should this allow using built in icons also? https://code.visualstudio.com/api/references/icons-in-labels
  marker: string;
  pathPrefix?: string | string[];
  pathSuffix?: string | string[];
};

type PatternGroupConfig = {
  groupName: string;
  groupItems: PatternItem[];
};

/**
 * @remark Only allowing one pattern group initially, but this could be expanded to allow multiple groups in the future
 */
export type PatternGroupsConfig = [PatternGroupConfig];

export function getPatternGroupsConfig(context: vscode.ExtensionContext) {
  const config = vscode.workspace.getConfiguration("coLocate");

  const patternGroupsConfig = config.get<PatternGroupsConfig>("patternGroups");

  return patternGroupsConfig;
}

export function configIsValid(
  patternGroupsConfig: PatternGroupsConfig | undefined,
): patternGroupsConfig is PatternGroupsConfig {
  if (!patternGroupsConfig?.length) {
    console.error("No config found");
    return false;
  }

  if (patternGroupsConfig.length !== 1) {
    console.error("Only one pattern group is supported at this time");
    return false;
  }

  const patternGroup = patternGroupsConfig[0];

  const groupName = patternGroup.groupName || "0";

  if (!patternGroup.groupItems?.length) {
    console.error(`No group items found in group "${groupName}"`);
    return false;
  }

  if (patternGroup.groupItems.length < 2) {
    console.error(`Less than 2 items found in group "${groupName}"`);
    return false;
  }

  let i = 0;
  for (const groupItem of patternGroup.groupItems) {
    if (!groupItem.name) {
      console.error(`No name found for group item ${i} in group "${groupName}"`);
      return false;
    }

    if (!groupItem.marker) {
      console.error(`No marker found for group item "${groupItem.name}" in group "${groupName}"`);
      return false;
    }

    const hasPrefix = !!groupItem.pathPrefix || groupItem.pathPrefix?.length;
    const hasSuffix = !!groupItem.pathSuffix || groupItem.pathSuffix?.length;

    if (!hasPrefix && !hasSuffix) {
      console.error(
        `No pathPrefix or pathSuffix found for group item "${groupItem.name}" in group "${groupName}"`,
      );
      return false;
    }
    i++;
  }

  return true;
}
