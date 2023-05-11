import * as vscode from "vscode";
import { PatternGroupsConfig, PatternItem } from "../utils/config";
import { getShortPath } from "../utils/vscode";

type RelatedFileData = { name: string; marker: string; fullPath: string; shortPath: string };

/**
 * @key the file path between the path prefix and suffix from patterns or the full path of a known related file
 * @value Details of found files that match the key path for this group
 */
type PatternGroupFiles = Record<string, RelatedFileData[]>;

export default class FileLinker {
  /**
   * @key the index of the pattern group
   */
  private fileGroupsByPatternGroupIndexMap: Record<number, PatternGroupFiles> = {};

  constructor(
    private readonly config: {
      patternGroupsConfig: PatternGroupsConfig;
    },
  ) {}

  addFile(newFilePath: string) {
    // todo update file candidates and also update context for context menu conditional showing
    // see https://code.visualstudio.com/api/references/when-clause-contexts#in-and-not-in-conditional-operators

    this.config.patternGroupsConfig.forEach((patternGroup, patternGroupIndex) => {
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

    this.config.patternGroupsConfig.forEach((patternGroup, patternGroupIndex) => {
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
