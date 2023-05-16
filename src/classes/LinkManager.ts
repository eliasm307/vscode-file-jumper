import FileType from "./FileType";
import type { DecorationData, FileMetaData, LinkedFileData } from "../types";
import type { MainConfig } from "../utils/config";
import { mainConfigsAreEqual } from "../utils/config";
import Logger from "./Logger";

export default class LinkManager {
  private fileTypes: FileType[] = [];

  private ignorePatterns: RegExp[] = [];

  private registeredPaths: Set<string> = new Set();

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
    if (includesKnownType) {
      this.applyPathAdditions(relevantFiles);
      this.notifyFileLinksUpdated();
    }
    endTimerAndLog();
  }

  private applyPathAdditions(paths: Set<string> | string[]) {
    paths.forEach((path) => this.registeredPaths.add(path));
    this.fileTypes.forEach((fileType) => fileType.addPaths(paths));
  }

  removePathsAndNotify(paths: string[]) {
    const relevantFiles = paths.filter((path) => !this.pathShouldBeIgnored(path));
    const includesKnownType = relevantFiles.some((path) => this.getFileType(path));
    if (includesKnownType) {
      this.applyPathRemovals(relevantFiles);
      this.notifyFileLinksUpdated();
    }
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

  /**
   * @remark This used to be cached however there weren't any significant performance gains
   * so decided to simplify until there is a need for it
   */
  getFileType(path: string): FileType | undefined {
    if (this.pathShouldBeIgnored(path)) {
      return;
    }
    for (const fileType of this.fileTypes) {
      if (fileType.matches(path)) {
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

    let linkedFiles: LinkedFileData[] = [];
    if (keyPath) {
      linkedFiles = this.fileTypes
        .filter((fileType) => fileType !== inputFileType) // prevent a file from being related to itself
        .filter((fileType) => inputFileType.allowsLinksTo(fileType))
        .filter((fileType) => fileType.allowsLinksFrom(inputFileType))
        .flatMap((fileType) => fileType.getLinkedFiles(keyPath));
    }

    return {
      fileType: inputFileType,
      linkedFiles,
    };
  }

  getRelatedFiles(path: string): LinkedFileData[] {
    return this.getFileMetaData(path)?.linkedFiles || [];
  }

  getPathsWithRelatedFiles(): string[] {
    return [...this.registeredPaths].filter((path) => this.getRelatedFiles(path).length);
  }

  getDecorationData(path: string): DecorationData | undefined {
    const runKey = `#getDecorationData: ${path}`;
    const endTimerAndLog = Logger.startTimer(runKey);

    try {
      const fileMetaData = this.getFileMetaData(path);
      const relatedFiles = fileMetaData?.linkedFiles;
      if (!relatedFiles?.length) {
        if (!fileMetaData) {
          Logger.warn(runKey, "Could not get metaData");
        } else if (!fileMetaData?.linkedFiles?.length) {
          Logger.warn(runKey, "No related files", {
            typeName: fileMetaData.fileType.name,
            keyPath: fileMetaData.fileType.getKeyPath(path),
            linkedFilesCount: fileMetaData.linkedFiles?.length,
          });
        } else {
          Logger.warn(runKey, "Unknown error", {
            typeName: fileMetaData.fileType.name,
            keyPath: fileMetaData.fileType.getKeyPath(path),
            linkedFilesCount: fileMetaData.linkedFiles?.length,
          });
        }
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

      Logger.info(runKey, "Found related files");

      const uniqueRelatedFileTypeNames = new Set<string>();
      relatedFiles.forEach((file) => uniqueRelatedFileTypeNames.add(file.typeName));
      const uniqueRelatedFileMarkers = new Set<string>();
      relatedFiles.forEach((file) => uniqueRelatedFileMarkers.add(file.marker));

      const decorationData: DecorationData = {
        badgeText: [...uniqueRelatedFileMarkers].join(""),
        tooltip: `Links: ${[...uniqueRelatedFileTypeNames].join(" + ")}`,
      };

      Logger.info(runKey, "Found related files details", {
        keyPath: fileMetaData?.fileType.getKeyPath(path),
        relatedFiles,
        uniqueRelatedFileTypeNames,
        uniqueRelatedFileMarkers,
        decorationData,
      });

      return decorationData;

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
    // @ts-expect-error [allowed on dispose]
    this.registeredPaths = null;
  }

  updateConfig(newConfig: MainConfig) {
    const configHasChanged = !mainConfigsAreEqual(this.config, newConfig);
    if (!configHasChanged) {
      return;
    }
    Logger.warn("LinkManager#updateConfig", newConfig);
    const initiallyRegisteredPaths = new Set(this.registeredPaths); // copy them so we can restore them later
    this.reset();
    this.applyConfig(newConfig);
    this.applyPathAdditions(initiallyRegisteredPaths); // restore the previously registered paths

    this.notifyFileLinksUpdated();
  }
}
