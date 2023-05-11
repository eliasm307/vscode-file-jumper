import * as vscode from "vscode"; // type only import to make sure we dont have dependency on vscode effects to make testing easier
import { PatternGroupsConfig, PatternItem } from "../utils/config";
import { QuickPickItemKind } from "vscode";
import { getShortPath } from "../utils/vscode";
import { BadgeDecorationProvider } from "../treeItemDecorator";

type RelatedFileData = { name: string; marker: string; fullPath: string; shortPath: string };

/**
 * @key the file path between the path prefix and suffix from patterns or the full path of a known related file
 * @value Details of found files that match the key path for this group
 */
type PatternGroupFiles = Record<string, RelatedFileData[]>;

class FileCandidates {
  /**
   * @key the index of the pattern group
   */
  private fileGroupsByPatternGroupIndexMap: Record<number, PatternGroupFiles> = {};

  constructor(
    public readonly extension: {
      patternGroupsConfig: PatternGroupsConfig;
    },
  ) {}

  addFile(newFilePath: string) {
    // todo update file candidates and also update context for context menu conditional showing
    // see https://code.visualstudio.com/api/references/when-clause-contexts#in-and-not-in-conditional-operators

    this.extension.patternGroupsConfig.forEach((patternGroup, patternGroupIndex) => {
      this.fileGroupsByPatternGroupIndexMap[patternGroupIndex] ??= {};
      const patternGroupFiles = this.fileGroupsByPatternGroupIndexMap[patternGroupIndex];

      patternGroup.groupItems.forEach((patternItem) => {
        const keyPath = this.getKeyPath(newFilePath, patternItem);
        if (!keyPath) {
          return;
        }

        const newFileData: RelatedFileData = {
          name: patternItem.name,
          marker: patternItem.marker,
          fullPath: newFilePath,
          shortPath: getShortPath(newFilePath),
        };

        patternGroupFiles[keyPath] ??= [];
        patternGroupFiles[keyPath].push(newFileData);

        patternGroupFiles[newFilePath] ??= [];
        patternGroupFiles[newFilePath].push(newFileData);
      });
    });
  }

  getRelatedFileGroups(currentFilePath: string): RelatedFileData[][] {
    const groupedRelatedFiles: RelatedFileData[][] = [];

    this.extension.patternGroupsConfig.forEach((patternGroup, patternGroupIndex) => {
      const groupFiles = this.fileGroupsByPatternGroupIndexMap[patternGroupIndex];
      const groupOutput: RelatedFileData[] = [];

      patternGroup.groupItems.forEach((patternItem) => {
        // try the cheap lookup first
        let relatedFilesForPattern = groupFiles[currentFilePath];

        // if that fails, try the slightly more expensive lookup by calculating the key path
        if (!relatedFilesForPattern) {
          const keyPath = this.getKeyPath(currentFilePath, patternItem);
          if (keyPath) {
            relatedFilesForPattern = groupFiles[keyPath];
          }

          // if we still dont have any related files, skip this pattern
          if (!relatedFilesForPattern) {
            return;
          }
        }

        groupOutput.push(...relatedFilesForPattern);
      });

      if (groupOutput.length) {
        groupedRelatedFiles.push(groupOutput);
      }
    });

    console.log("getRelatedFileGroups", { currentFilePath, groupedRelatedFiles });
    return groupedRelatedFiles;
  }

  private getKeyPath(
    filePath: string,
    { pathPrefix = [], pathSuffix = [] }: PatternItem,
  ): string | undefined {
    const pathPrefixes = Array.isArray(pathPrefix) ? pathPrefix : [pathPrefix];
    const pathSuffixes = Array.isArray(pathSuffix) ? pathSuffix : [pathSuffix];

    const pathPrefixMatch = pathPrefixes.find((prefix) => filePath.includes(prefix));
    if (!pathPrefixMatch) {
      return;
    }

    const pathSuffixMatch = pathSuffixes.find((suffix) => filePath.endsWith(suffix));
    if (!pathSuffixMatch) {
      return;
    }

    let keyPath = filePath;

    // remove everything before the prefix including the prefix
    keyPath = keyPath.slice(keyPath.indexOf(pathPrefixMatch) + pathPrefixMatch.length);

    // remove the suffix
    keyPath = keyPath.slice(0, keyPath.indexOf(pathSuffixMatch));

    return keyPath;
  }
}

export type QuickPickItem = vscode.QuickPickItem &
  (
    | {
        kind: QuickPickItemKind.Default;
        filePath: string;
      }
    | {
        kind: QuickPickItemKind.Separator;
      }
  );

/**
 * The main facade for the extension logic
 */
export default class CoLocator implements vscode.Disposable {
  // todo use this to notify of updated decorations on change
  private badgeDecorationProvider: BadgeDecorationProvider;
  private fileCandidates: FileCandidates;

  private subscriptions: vscode.Disposable[] = [];

  constructor(
    public readonly extension: {
      context: vscode.ExtensionContext;
      patternGroupsConfig: PatternGroupsConfig;
    },
  ) {
    this.fileCandidates = new FileCandidates({
      patternGroupsConfig: extension.patternGroupsConfig,
    });

    // this.extension.context.
  }

  dispose() {
    this.subscriptions.forEach((s) => s.dispose());
  }

  setBadgeDecorationProvider(badgeDecorationProvider: BadgeDecorationProvider) {
    this.badgeDecorationProvider = badgeDecorationProvider;
  }

  getDecorationData({
    filePath,
    cancelToken,
  }: {
    filePath: string;
    cancelToken?: vscode.CancellationToken;
  }): { badge: string; tooltip: string } | undefined {
    // todo handle cancel

    const isMatch = filePath.endsWith("test.ts");

    console.log("BadgeDecorationProvider", {
      filePath,
      isMatch,
    });

    if (isMatch) {
      // todo shouldnt add a file here, just use whats available
      this.fileCandidates.addFile(filePath);
      return {
        badge: "🧪",
        tooltip: "This file is a test file",
      };
    }
    return undefined;
  }

  getRelatedFilesQuickPickItems(currentFilePath: string): QuickPickItem[] {
    const relatedFileGroups = this.fileCandidates.getRelatedFileGroups(currentFilePath);

    console.log("getRelatedFilesQuickPickItems", { currentFilePath, relatedFileGroups });

    return relatedFileGroups.flatMap((relatedFileGroup, i) => {
      const groupItems = relatedFileGroup
        // dont include the current file as a related file
        .filter((relatedFile) => relatedFile.fullPath !== currentFilePath)
        .map((relatedFile): QuickPickItem => {
          return {
            kind: QuickPickItemKind.Default,
            label: `${relatedFile.marker} ${relatedFile.name}`,
            detail: relatedFile.shortPath,
            filePath: relatedFile.fullPath,
          };
        });

      const isLastGroup = i === relatedFileGroups.length - 1;
      if (!isLastGroup) {
        groupItems.push({
          kind: QuickPickItemKind.Separator,
          label: "──────────────────────────────────",
        });
      }

      return groupItems;
    });
  }
}
