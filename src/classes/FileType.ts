import { FileGroupConfigs, FileTypeConfig } from "../utils/config";
import { getShortPath } from "../utils/vscode";

export type RelatedFileData = {
  name: string;
  marker: string;
  fullPath: string;
  shortPath: string;
};

/**
 * @key the file path between the path prefix and suffix from patterns or the full path of a known related file
 * @value Details of found files that match the key path for this group
 */
type PatternGroupFiles = Record<string, RelatedFileData[]>;

export default class FileType {
  /**
   * @key the index of the pattern group
   */
  private fileGroupsByPatternGroupIndexMap: Record<number, PatternGroupFiles> = {};

  constructor(
    public readonly config: FileTypeConfig,
    private readonly options?: {
      // todo when does this get fired
      onFileRelationshipChange: (filePath: string) => void;
    },
  ) {}

  matches(filePath: string): boolean {
    throw new Error("Method not implemented.");
  }
  getRelatedFile(filePath: string): RelatedFileData | undefined {
    throw new Error("Method not implemented.");
  }
  registerPaths(filePaths: string[]) {
    throw new Error("Method not implemented.");
  }
  reset() {
    throw new Error("Method not implemented.");
  }

  /*
  addFile(newFilePath: string) {
    // todo update file candidates and also update context for context menu conditional showing
    // see https://code.visualstudio.com/api/references/when-clause-contexts#in-and-not-in-conditional-operators

    this.config.fileGroupConfigs.forEach((fileGroupConfig, patternGroupIndex) => {
      this.fileGroupsByPatternGroupIndexMap[patternGroupIndex] ??= {};
      const patternGroupFiles = this.fileGroupsByPatternGroupIndexMap[patternGroupIndex];

      fileGroupConfig.types.forEach((filetTypeConfig) => {
        const keyPath = this.getKeyPath(newFilePath, filetTypeConfig);
        if (!keyPath) {
          return;
        }

        const newFileData: RelatedFileData = {
          name: filetTypeConfig.name,
          marker: filetTypeConfig.marker,
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

    this.config.fileGroupConfigs.forEach((patternGroup, patternGroupIndex) => {
      const groupFiles = this.fileGroupsByPatternGroupIndexMap[patternGroupIndex];
      const groupOutput: RelatedFileData[] = [];

      patternGroup.types.forEach((fileTypeConfig) => {
        // try the cheap lookup first
        let relatedFilesForPattern = groupFiles[currentFilePath];

        // if that fails, try the slightly more expensive lookup by calculating the key path
        if (!relatedFilesForPattern) {
          const keyPath = this.getKeyPath(currentFilePath, fileTypeConfig);
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

  private getKeyPath(filePath: string, { regex }: FileTypeConfig): string | undefined {
    // todo this implicitly creates a regex for each call, we should create one before and reuse it
    return filePath.match(regex)?.[1];
  }
  */
}
