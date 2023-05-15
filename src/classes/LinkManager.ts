import FileType from "./FileType";
import type { DecorationData, FileMetaData, RelatedFileData } from "../types";
import type { MainConfig } from "../utils/config";
import { mainConfigsAreEqual } from "../utils/config";
import Logger from "./Logger";

function isTruthy<T>(x: T | undefined | null | "" | 0 | false): x is T {
  return !!x;
}

export default class LinkManager {
  private fileTypes: FileType[] = [];

  private ignorePatterns: RegExp[] = [];

  private registeredFilePaths: string[] = [];

  /**
   * @remark cache not cleared on reset as it doesn't affect behaviour
   */
  // todo investigate if this is actually worth it
  private filePathToFileTypeCache: Map<string, FileType> = new Map();

  constructor(
    private config: MainConfig,
    private readonly options?: {
      onFileRelationshipsUpdated: () => void;
    },
  ) {
    Logger.log("LinkManager#constructor", config);
    this.fileTypes = config.fileTypes.map((fileTypeConfig) => new FileType(fileTypeConfig));
    this.ignorePatterns = config.ignorePatterns.map((pattern) => new RegExp(pattern));
  }

  fileShouldBeIgnored(filePath: string): boolean {
    return this.ignorePatterns.some((regex) => regex.test(filePath));
  }

  registerFiles(filePaths: string[]): void {
    Logger.log("#registerFiles", filePaths);
    const endTimerAndLog = Logger.startTimer(`#registerFiles(${filePaths.length})`);
    this.registeredFilePaths = filePaths.filter((filePath) => !this.fileShouldBeIgnored(filePath));
    if (this.registeredFilePaths.length) {
      this.fileTypes.forEach((fileType) => fileType.registerPaths(this.registeredFilePaths));
    }
    endTimerAndLog();

    this.notifyFileRelationshipsUpdated();
  }

  private notifyFileRelationshipsUpdated() {
    this.options?.onFileRelationshipsUpdated();
  }

  getFileType(filePath: string): FileType | undefined {
    if (this.fileShouldBeIgnored(filePath)) {
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

    const metaData: FileMetaData = {
      fileType: inputFileType,
      relatedFiles,
    };

    return metaData;
  }

  getRelatedFiles(filePath: string): RelatedFileData[] {
    return this.getFileMetaData(filePath)?.relatedFiles || [];
  }

  getFilePathsWithRelatedFiles(): string[] {
    return this.registeredFilePaths.filter((filePath) => this.getRelatedFiles(filePath).length);
  }

  getDecorationData(filePath: string): DecorationData | undefined {
    const runKey = `#getDecorationData: ${filePath}`;
    const endTimerAndLog = Logger.startTimer(runKey);

    try {
      const metaData = this.getFileMetaData(filePath);
      Logger.log(runKey, "fileMetaData", metaData);

      const relatedFiles = metaData?.relatedFiles;
      if (!relatedFiles?.length) {
        return;
      }

      const relatedFileTypes = relatedFiles.map((file) => file.typeName).join(" + ");
      const relatedFileMarkers = relatedFiles.map((file) => file.marker).join("");
      const output = {
        badgeText: relatedFileMarkers,
        tooltip: `Links: ${relatedFileTypes}`,
      };

      Logger.log(runKey, "decorationData", output);

      return output;

      // time
    } finally {
      endTimerAndLog();
    }
  }

  /** This resets the instance with the expectation that it will be re-used */
  reset() {
    this.fileTypes.forEach((fileType) => fileType.reset());
    this.registeredFilePaths = [];
  }

  /** This disposes of the instance with the expectation that it will not be re-used */
  dispose() {
    this.fileTypes.forEach((fileType) => fileType.dispose());
    this.filePathToFileTypeCache.clear();
    this.registeredFilePaths = [];
  }

  addFiles(arg0: string[]) {
    // todo check if the changed files are a known type and might affect relationships before recalculating
    Logger.warn("LinkManager#addFiles", arg0);
    this.notifyFileRelationshipsUpdated();
    throw new Error("Method not implemented.");
  }

  removeFiles(arg0: string[]) {
    // todo check if the changed files are a known type and might affect relationships before recalculating
    Logger.warn("LinkManager#removeFiles", arg0);
    this.notifyFileRelationshipsUpdated();
    throw new Error("Method not implemented.");
  }

  updateConfig(newConfig: MainConfig) {
    Logger.warn("LinkManager#updateConfig", newConfig);
    const configHasChanged = !mainConfigsAreEqual(this.config, newConfig);

    if (!configHasChanged) {
      return;
    }

    this.notifyFileRelationshipsUpdated();
    throw new Error("Method not implemented.");
  }
}