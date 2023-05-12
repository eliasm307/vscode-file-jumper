import type { FileTypeConfig } from "../utils/config";

export type RelatedFileData = {
  typeName: string;
  marker: string;
  fullPath: string;
};

/**
 * @key the file path between the path prefix and suffix from patterns or the full path of a known related file
 * @value Details of found files that match the key path for this group
 */
type PatternGroupFiles = Record<string, RelatedFileData[]>;

export default class FileType {
  private keyPathToFullPathMap: Record<string, string> = {};

  private regex: RegExp;

  constructor(
    public readonly config: FileTypeConfig,
    private readonly options?: {
      // todo when does this get fired
      onFileRelationshipChange: (filePath: string) => void;
    },
  ) {
    this.regex = new RegExp(config.regex);
  }

  matches(filePath: string): boolean {
    throw new Error("Method not implemented.");
  }

  getRelatedFile(keyPath: string): RelatedFileData | undefined {
    const fullPath = this.keyPathToFullPathMap[keyPath];
    if (!fullPath) {
      return;
    }

    return {
      typeName: this.config.name,
      marker: this.config.marker,
      fullPath,
    };
  }

  registerPaths(filePaths: string[]) {
    filePaths.forEach((fullPath) => {
      const keyPath = this.getKeyPath(fullPath);
      if (keyPath) {
        this.keyPathToFullPathMap[keyPath] = fullPath;
      }
    });
  }

  reset() {
    this.keyPathToFullPathMap = {};
  }

  private getKeyPath(filePath: string): string | undefined {
    // todo this implicitly creates a regex for each call, we should create one before and reuse it
    return filePath.match(this.regex)?.[1];
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
  */
}
