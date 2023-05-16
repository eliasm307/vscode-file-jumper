import FileType from "./FileType";
import type { DecorationData, FileMetaData, LinkedFileData } from "../types";
import type { MainConfig } from "../utils/config";
import { mainConfigsAreEqual } from "../utils/config";
import Logger from "./Logger";

type OnFileLinksUpdatedHandler = (affectedPaths: string[] | null) => void;

export default class LinkManager {
  private fileTypes: FileType[] = [];

  private ignorePatterns: RegExp[] = [];

  /**
   * This represents all the relevant paths the link manager is aware of that are of a known type
   */
  private allRelevantPaths: Set<string> = new Set();

  private onFileLinksUpdatedHandlers: OnFileLinksUpdatedHandler[] = [];

  constructor(private config: MainConfig) {
    this.applyConfig(config);
  }

  onFileLinksUpdated(handler: OnFileLinksUpdatedHandler): void {
    this.onFileLinksUpdatedHandlers.push(handler);
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

  private getIndirectlyAffectedPaths(pathsModified: string[]): string[] {
    return pathsModified.flatMap((path) => this.getFilesLinkedFrom(path)).map((file) => file.fullPath);
  }

  addPathsAndNotify(paths: string[]): void {
    Logger.info("#addFiles", paths);
    const endTimerAndLog = Logger.startTimer(`#addFiles(${paths.length})`);
    const relevantPathsAdded = paths
      .filter((path) => !this.pathShouldBeIgnored(path))
      .filter((path) => this.isKnownFileTypePath(path));

    if (relevantPathsAdded.length) {
      this.applyPathAdditions(relevantPathsAdded);
      this.notifyFileLinksUpdated([...relevantPathsAdded, ...this.getIndirectlyAffectedPaths(relevantPathsAdded)]);
    }
    endTimerAndLog();
  }

  private applyPathAdditions(paths: Set<string> | string[]) {
    paths.forEach((path) => this.allRelevantPaths.add(path));
    this.fileTypes.forEach((fileType) => fileType.addPaths(paths));
  }

  removePathsAndNotify(paths: string[]) {
    const relevantPathsRemoved = paths
      .filter((path) => !this.pathShouldBeIgnored(path))
      .filter((path) => this.isKnownFileTypePath(path));

    if (relevantPathsRemoved.length) {
      this.applyPathRemovals(relevantPathsRemoved);
      const indirectlyAffectedPaths = this.getIndirectlyAffectedPaths(relevantPathsRemoved);
      this.notifyFileLinksUpdated(indirectlyAffectedPaths);
    }
  }

  private applyPathRemovals(paths: string[]) {
    paths.forEach((path) => this.allRelevantPaths.delete(path));
    this.fileTypes.forEach((fileType) => fileType.removePaths(paths));
  }

  renameFilesAndNotify({ oldPaths, newPaths }: { oldPaths: string[]; newPaths: string[] }) {
    const relevantPathsRemoved = oldPaths
      .filter((path) => !this.pathShouldBeIgnored(path))
      .filter((path) => this.isKnownFileTypePath(path));

    const relevantPathsAdded = newPaths
      .filter((path) => !this.pathShouldBeIgnored(path))
      .filter((path) => this.isKnownFileTypePath(path));

    const relevantFilesAffected = relevantPathsRemoved.length || relevantPathsAdded.length;
    if (!relevantFilesAffected) {
      return; // no known file types were affected so no need to update
    }

    this.applyPathRemovals(relevantPathsRemoved);
    this.applyPathAdditions(relevantPathsAdded);

    this.notifyFileLinksUpdated([
      ...relevantPathsAdded,
      ...this.getIndirectlyAffectedPaths([...relevantPathsAdded, ...relevantPathsRemoved]),
    ]);
  }

  private notifyFileLinksUpdated(affectedPaths: string[] | null) {
    this.onFileLinksUpdatedHandlers.forEach((handler) => handler(affectedPaths));
  }

  /**
   * @remark This used to be cached however there weren't any significant performance gains
   * so decided to simplify until there is a need for it
   */
  private getFileType(path: string): FileType | undefined {
    if (!this.pathShouldBeIgnored(path)) {
      return this.fileTypes.find((fileType) => fileType.matches(path));
    }
  }

  private isKnownFileTypePath(path: string): boolean {
    return !!this.getFileType(path);
  }

  getFileMetaData(inputPath: string): FileMetaData | undefined {
    const inputFileType = this.getFileType(inputPath);
    if (!inputFileType) {
      return; // file is not of a known type
    }

    const keyPath = inputFileType.getKeyPath(inputPath)!;

    return {
      fileType: inputFileType,
      linkedFiles: this.fileTypes
        .filter((fileType) => fileType !== inputFileType) // prevent a file from being related to itself
        .filter((fileType) => inputFileType.allowsLinksTo(fileType))
        .filter((fileType) => fileType.allowsLinksFrom(inputFileType))
        .flatMap((fileType) => fileType.getLinkedFiles(keyPath)),
    };
  }

  getFilesLinkedFrom(path: string): LinkedFileData[] {
    return this.getFileMetaData(path)?.linkedFiles || [];
  }

  getPathsWithRelatedFiles(): string[] {
    return [...this.allRelevantPaths].filter((path) => this.getFilesLinkedFrom(path).length);
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
        } else {
          Logger.warn(runKey, "No related files", {
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

  /** This reverts the instance to its initial state */
  revertToInitial() {
    this.fileTypes.forEach((fileType) => fileType.dispose());
    this.allRelevantPaths.clear();
  }

  /**
   * We need to do a full refresh here as the config change could also change what files we consider "relevant"
   * so we need to re-evaluate the entire workspace
   */
  updateConfig(newWorkspace: { config: MainConfig; paths: string[] }) {
    const configHasChanged = !mainConfigsAreEqual(this.config, newWorkspace.config);
    if (!configHasChanged) {
      return;
    }
    Logger.warn("LinkManager#updateConfig", newWorkspace.config);
    this.revertToInitial();
    this.applyConfig(newWorkspace.config);
    this.applyPathAdditions(newWorkspace.paths); // need to consider all workspace paths

    // need to do a full refresh even for paths we disregarded before
    this.notifyFileLinksUpdated(null);
  }
}
