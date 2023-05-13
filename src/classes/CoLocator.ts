import type { FileGroupConfigs } from "../utils/config";
import FileType from "./FileType";
import { isNotNullOrUndefined } from "../utils/predicates";
import type { FileMetaData, RelatedFileData } from "../types";

/**
 * The main facade for the extension logic
 */
export default class CoLocator {
  private fileTypeGroups: FileType[][] = [];

  constructor(public readonly patternGroupsConfig: FileGroupConfigs) {
    this.fileTypeGroups = this.patternGroupsConfig.map((fileGroupConfig) => {
      return fileGroupConfig.types.map((config) => {
        return new FileType(config);
      });
    });
  }

  dispose() {
    this.fileTypeGroups.forEach((fileGroup) => {
      fileGroup.forEach((fileType) => {
        fileType.reset();
      });
    });
  }

  initWorkspaceFiles(filePaths: string[]): void {
    this.fileTypeGroups.forEach((fileGroup) => {
      fileGroup.forEach((fileType) => {
        fileType.reset();
        fileType.registerPaths(filePaths);
      });
    });
  }

  getFileType(filePath: string): FileType | undefined {
    for (const fileTypeGroup of this.fileTypeGroups) {
      for (const fileType of fileTypeGroup) {
        if (fileType.matches(filePath)) {
          return fileType;
        }
      }
    }
  }

  getFileMetaData(targetFilePath: string): FileMetaData | undefined {
    const targetFileType = this.getFileType(targetFilePath);
    if (!targetFileType) {
      console.warn(
        "CoLocator#getFileMetaData",
        `No file type found for "${targetFilePath}" assuming it is not part of any group`,
      );
      return; // file is not part of any group
    }

    const relatedFileGroups = this.fileTypeGroups.map((fileGroup) => {
      return (
        fileGroup
          // eslint-disable-next-line array-callback-return
          .map((fileType) => {
            if (fileType === targetFileType) {
              return;
            }
            const keyPath = targetFileType.getKeyPath(targetFilePath);
            if (keyPath) {
              return fileType.getRelatedFile(keyPath);
            }
          })
          .filter(isNotNullOrUndefined)
      );
    });

    return {
      fileType: targetFileType,
      relatedFileGroups,
    };
  }

  getRelatedFilesQuickPickItems(currentFilePath: string): RelatedFileData[][] {
    const fileMeta = this.getFileMetaData(currentFilePath);
    if (!fileMeta || !fileMeta.relatedFileGroups?.length) {
      return []; // file has no known related files
    }

    return fileMeta.relatedFileGroups.map((relatedFileGroup) => {
      // dont include the current file as a related file
      return relatedFileGroup.filter((relatedFile) => relatedFile.fullPath !== currentFilePath);
    });
  }

  getRelatedFileMarkers(filePath: string) {
    const fileMeta = this.getFileMetaData(filePath);
    if (!fileMeta || !fileMeta.relatedFileGroups?.length) {
      return; // file has no known related files
    }

    const relatedFileMarkers = fileMeta.relatedFileGroups
      .flat()
      .map(({ marker }) => marker)
      .join("")
      .trim();

    return relatedFileMarkers;
  }
}
