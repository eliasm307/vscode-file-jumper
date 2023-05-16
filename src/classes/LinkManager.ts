import FileType from "./FileType";
import type { DecorationData, FileMetaData, RelatedFileData } from "../types";
import type { MainConfig } from "../utils/config";
import { mainConfigsAreEqual } from "../utils/config";
import Logger from "./Logger";

export default class LinkManager {
  private fileTypes: FileType[] = [];

  private ignorePatterns: RegExp[] = [];

  private registeredPaths: Set<string> = new Set();

  // todo investigate if this is actually worth it
  private fullPathToFileTypeCache: Map<string, FileType> = new Map();

  constructor(
    private config: MainConfig,
    private readonly options?: {
      onFileLinksUpdated: () => void;
    },
  ) {
    this.applyConfig(config);
  }

  private applyConfig(config: MainConfig): void {
    Logger.info("#applyConfig", config);
    this.config = config;
    this.fullPathToFileTypeCache.clear();
    this.fileTypes.forEach((fileType) => fileType.dispose());
    this.fileTypes = config.fileTypes.map((fileTypeConfig) => new FileType(fileTypeConfig));
    this.ignorePatterns = config.ignorePatterns.map((pattern) => new RegExp(pattern));
  }

  private pathShouldBeIgnored(path: string): boolean {
    return this.ignorePatterns.some((regex) => regex.test(path));
  }

  addPathsAndNotify(paths: string[]): void {
    Logger.info("#addFiles", paths);
    const endTimerAndLog = Logger.startTimer(`#addFiles(${paths.length})`);
    const relevantFiles = paths.filter((path) => !this.pathShouldBeIgnored(path));
    const includesKnownType = relevantFiles.some((path) => this.getFileType(path));
    if (!includesKnownType) {
      return;
    }

    this.applyPathAdditions(relevantFiles);
    this.notifyFileLinksUpdated();
    endTimerAndLog();
  }

  private applyPathAdditions(paths: Set<string> | string[]) {
    paths.forEach((path) => this.registeredPaths.add(path));
    this.fileTypes.forEach((fileType) => fileType.addPaths(paths));
  }

  removePathsAndNotify(paths: string[]) {
    const relevantFiles = paths.filter((path) => !this.pathShouldBeIgnored(path));
    const includesKnownType = relevantFiles.some((path) => this.getFileType(path));
    if (!includesKnownType) {
      return;
    }

    this.applyPathRemovals(relevantFiles);
    this.notifyFileLinksUpdated();
  }

  private applyPathRemovals(paths: string[]) {
    paths.forEach((path) => this.registeredPaths.delete(path));
    this.fileTypes.forEach((fileType) => fileType.removePaths(paths));
  }

  renameFilesAndNotify({ oldPaths, newPaths }: { oldPaths: string[]; newPaths: string[] }) {
    const oldRelevantPaths = oldPaths.filter((path) => !this.pathShouldBeIgnored(path));
    const oldPathsIncludeKnownType = oldRelevantPaths.some((path) => this.getFileType(path));
    const newRelevantPaths = newPaths.filter((path) => !this.pathShouldBeIgnored(path));
    const newPathsIncludeKnownType = newRelevantPaths.some((path) => this.getFileType(path));
    if (!oldPathsIncludeKnownType && !newPathsIncludeKnownType) {
      return;
    }

    this.applyFileRenames({ oldPaths: oldRelevantPaths, newPaths: newRelevantPaths });
    this.notifyFileLinksUpdated();
  }

  private applyFileRenames({ oldPaths, newPaths }: { oldPaths: string[]; newPaths: string[] }) {
    this.applyPathRemovals(oldPaths);
    this.applyPathAdditions(newPaths);
  }

  /**
   * We dont bother trying to figure out the exact paths that changed to know what to update since the editor only re-renders the visible items so a full re-render is fine
   */
  private notifyFileLinksUpdated() {
    this.options?.onFileLinksUpdated();
  }

  getFileType(path: string): FileType | undefined {
    if (this.pathShouldBeIgnored(path)) {
      return;
    }

    const cachedFileType = this.fullPathToFileTypeCache.get(path);
    if (cachedFileType) {
      return cachedFileType;
    }
    for (const fileType of this.fileTypes) {
      if (fileType.matches(path)) {
        this.fullPathToFileTypeCache.set(path, fileType);
        return fileType;
      }
    }
  }

  getFileMetaData(inputPath: string): FileMetaData | undefined {
    const inputFileType = this.getFileType(inputPath);
    if (!inputFileType) {
      return; // file is not of a known type
    }
    const keyPath = inputFileType.getKeyPath(inputPath);

    let relatedFiles: RelatedFileData[] = [];
    if (keyPath) {
      relatedFiles = this.fileTypes
        .filter((fileType) => fileType !== inputFileType) // prevent a file from being related to itself
        .filter((fileType) => inputFileType.allowsLinksTo(fileType))
        .filter((fileType) => fileType.allowsLinksFrom(inputFileType))
        .flatMap((fileType) => fileType.getRelatedFiles(keyPath));
    }

    const metaData: FileMetaData = {
      fileType: inputFileType,
      relatedFiles,
    };

    return metaData;
  }

  getRelatedFiles(path: string): RelatedFileData[] {
    return this.getFileMetaData(path)?.relatedFiles || [];
  }

  getPathsWithRelatedFiles(): string[] {
    return [...this.registeredPaths].filter((path) => this.getRelatedFiles(path).length);
  }

  getDecorationData(path: string): DecorationData | undefined {
    const runKey = `#getDecorationData: ${path}`;
    const endTimerAndLog = Logger.startTimer(runKey);

    try {
      const metaData = this.getFileMetaData(path);

      const relatedFiles = metaData?.relatedFiles;
      if (!relatedFiles?.length) {
        Logger.warn(runKey, "Could not get metaData");
        // const foundRawFileType = this.config.fileTypes.find((fileType) => {
        //   return fileType.patterns.some((pattern) => {
        //     return new RegExp(pattern).test(path);
        //   });
        // });

        // const foundFileType = this.getFileType(path);
        // Logger.warn(runKey, "File type", {
        //   foundFileType,
        //   foundRawFileType,
        // });
        // if (!foundFileType) {
        //   Logger.warn(runKey, "Available file types", this.fileTypes);
        // }
        return;
      }

      const uniqueRelatedFileTypeNames = new Set<string>();
      relatedFiles.forEach((file) => uniqueRelatedFileTypeNames.add(file.typeName));
      const uniqueRelatedFileMarkers = new Set<string>();
      relatedFiles.forEach((file) => uniqueRelatedFileMarkers.add(file.marker));

      return {
        badgeText: [...uniqueRelatedFileMarkers].join(""),
        tooltip: `Links: ${[...uniqueRelatedFileTypeNames].join(" + ")}`,
      };

      // time
    } finally {
      endTimerAndLog();
    }
  }

  /** This resets the instance with the expectation that it will be re-used */
  reset() {
    // we are keeping the same fileTypes instances, so dont need to clear cache
    this.fileTypes.forEach((fileType) => fileType.reset());
    this.registeredPaths = new Set();
  }

  /** This disposes of the instance with the expectation that it will not be re-used */
  dispose() {
    this.fileTypes.forEach((fileType) => fileType.dispose());
    this.fullPathToFileTypeCache.clear();
    // @ts-expect-error [allowed on dispose]
    this.registeredPaths = null;
  }

  updateConfig(newConfig: MainConfig) {
    Logger.warn("LinkManager#updateConfig", newConfig);
    const configHasChanged = !mainConfigsAreEqual(this.config, newConfig);
    if (!configHasChanged) {
      return;
    }

    const initiallyRegisteredPaths = new Set(this.registeredPaths);
    this.reset();
    this.applyConfig(newConfig);
    this.applyPathAdditions(initiallyRegisteredPaths);

    this.notifyFileLinksUpdated();
  }
}
