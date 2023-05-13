import FileType from "./FileType";
import { isTruthy } from "../utils/predicates";
import type { FileMetaData, RelatedFileData } from "../types";
import type { MainConfig } from "../utils/config";

export default class CoLocator {
  addFiles(arg0: string[]) {
    throw new Error("Method not implemented.");
  }

  removeFiles(arg0: string[]) {
    throw new Error("Method not implemented.");
  }

  setConfig(arg0: MainConfig) {
    throw new Error("Method not implemented.");
  }

  private fileTypeGroups: FileType[][] = [];

  private ignoreRegexs: RegExp[] = [];

  constructor(config: MainConfig) {
    this.fileTypeGroups = config.fileGroups.map((fileGroupConfig) => {
      return fileGroupConfig.types.map((fileTypeConfig) => {
        return new FileType(fileTypeConfig);
      });
    });

    this.ignoreRegexs = config.ignoreRegexs.map((pattern) => new RegExp(pattern));
  }

  reset() {
    this.fileTypeGroups.forEach((fileGroup) => {
      fileGroup.forEach((fileType) => {
        fileType.reset();
      });
    });
  }

  initWorkspaceFiles(filePaths: string[]): void {
    // todo test it doesn't include ignored files
    filePaths = filePaths.filter((filePath) => {
      return !this.ignoreRegexs.some((regex) => regex.test(filePath));
    });

    if (!filePaths.length) {
      return;
    }

    this.fileTypeGroups.forEach((fileGroup) => {
      fileGroup.forEach((fileType) => {
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

  // todo test it doesn't include the given file as a related file to itself
  getFileMetaData(targetFilePath: string): FileMetaData | undefined {
    const targetFileType = this.getFileType(targetFilePath);
    if (!targetFileType) {
      console.warn(
        "CoLocator#getFileMetaData",
        `No file type found for "${targetFilePath}" assuming it is not part of any group`,
      );
      return; // file is not part of any group
    }
    const keyPath = targetFileType.getKeyPath(targetFilePath);

    let relatedFileGroups: RelatedFileData[][] = [];
    if (keyPath) {
      relatedFileGroups = this.fileTypeGroups.map((fileGroup) => {
        return fileGroup
          .filter((fileType) => fileType !== targetFileType) // prevent a file from being related to itself
          .map((fileType) => fileType.getRelatedFile(keyPath))
          .filter(isTruthy);
      });
    }

    return {
      fileType: targetFileType,
      relatedFileGroups,
    };
  }

  getRelatedFiles(filePath: string): string[] {
    return (
      this.getFileMetaData(filePath)
        ?.relatedFileGroups.flat()
        .map(({ fullPath }) => fullPath) || []
    );
  }

  getRelatedFileMarkers(filePath: string) {
    return this.getFileMetaData(filePath)
      ?.relatedFileGroups.flat()
      .map(({ marker }) => marker)
      .join("")
      .trim();
  }
}
