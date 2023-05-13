import FileType from "./FileType";
import { isTruthy } from "../utils/predicates";
import type { FileMetaData, RelatedFileData } from "../types";
import type { MainConfig } from "../utils/config";

export default class CoLocator {
  private fileTypes: FileType[] = [];

  private ignoreRegexs: RegExp[] = [];

  /**
   * @remark cache not cleared on reset as it doesn't affect behaviour
   */
  // todo investigate if this is actually worth it
  private filePathToFileTypeCache: Map<string, FileType> = new Map();

  constructor(config: MainConfig) {
    this.fileTypes = config.fileTypes.map((fileTypeConfig) => new FileType(fileTypeConfig));
    this.ignoreRegexs = config.ignoreRegexs.map((pattern) => new RegExp(pattern));
  }

  fileShouldBeIgnored(filePath: string): boolean {
    return this.ignoreRegexs.some((regex) => regex.test(filePath));
  }

  registerFiles(filePaths: string[]): void {
    // todo test it doesn't include ignored files
    filePaths = filePaths.filter((filePath) => !this.fileShouldBeIgnored(filePath));
    if (filePaths.length) {
      this.fileTypes.forEach((fileType) => fileType.registerPaths(filePaths));
    }
  }

  getFileType(filePath: string): FileType | undefined {
    if (this.fileShouldBeIgnored(filePath)) {
      console.warn("CoLocator#getFileType", `File "${filePath}" is ignored`);
      return;
    }

    const cachedFileType = this.filePathToFileTypeCache.get(filePath);
    if (cachedFileType) {
      return cachedFileType;
    }
    for (const fileType of this.fileTypes) {
      if (fileType.matches(filePath)) {
        this.filePathToFileTypeCache.set(filePath, fileType);
        return fileType;
      }
    }
  }

  getFileMetaData(inputFilePath: string): FileMetaData | undefined {
    const inputFileType = this.getFileType(inputFilePath);
    if (!inputFileType) {
      console.warn(
        "CoLocator#getFileMetaData",
        `File "${inputFilePath}" does not match any known file types or is ignored`,
      );
      return; // file is not of a known type
    }
    const keyPath = inputFileType.getKeyPath(inputFilePath);

    let relatedFiles: RelatedFileData[] = [];
    if (keyPath) {
      relatedFiles = this.fileTypes
        .filter((fileType) => fileType !== inputFileType) // prevent a file from being related to itself
        .filter((fileType) => inputFileType.canRelateTo(fileType))
        .map((fileType) => fileType.getRelatedFile(keyPath))
        .filter(isTruthy);
    }

    return {
      fileType: inputFileType,
      relatedFiles,
    };
  }

  getRelatedFiles(filePath: string): RelatedFileData[] {
    return this.getFileMetaData(filePath)?.relatedFiles || [];
  }

  getRelatedFileMarkers(filePath: string) {
    return this.getFileMetaData(filePath)
      ?.relatedFiles.flat()
      .map(({ marker }) => marker)
      .join("")
      .trim();
  }

  reset() {
    this.fileTypes.forEach((fileType) => fileType.reset());
  }

  addFiles(arg0: string[]) {
    console.warn("CoLocator#addFiles", arg0);
    throw new Error("Method not implemented.");
  }

  removeFiles(arg0: string[]) {
    console.warn("CoLocator#removeFiles", arg0);
    throw new Error("Method not implemented.");
  }

  updateConfig(arg0: MainConfig) {
    console.warn("CoLocator#updateConfig", arg0);
    throw new Error("Method not implemented.");
  }
}
