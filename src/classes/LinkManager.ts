import type { PathKey } from "./FileType";
import FileType from "./FileType";
import type { DecorationData, LinkedFileData, NormalisedPath } from "../types";
import type { MainConfig } from "../utils/config";
import { mainConfigsAreEqual } from "../utils/config";
import Logger from "./Logger";
import { normalisePath } from "../utils";

type OnFileLinksUpdatedHandler = (affectedPaths: string[] | null) => void;

type FileInfo = { pathKey: PathKey; type: FileType };

type PathData = {
  file: FileInfo;
  allowedFileTypesForOutgoingLinks: FileType[];
};

export default class LinkManager {
  private fileTypes: FileType[] = [];

  private ignorePatterns: RegExp[] = [];

  /**
   * This represents all the relevant paths the link manager is aware of that are of a known type
   *
   * @value is the original un-normalised path
   */
  #pathsWithKnownTypeMap: Map<NormalisedPath, string> = new Map();

  readonly #pathDataCache: Map<NormalisedPath, PathData | null> = new Map();

  private onFileLinksUpdatedHandler: OnFileLinksUpdatedHandler | undefined;

  private config: MainConfig | undefined;

  private applyConfig(config: MainConfig): void {
    Logger.info("#applyConfig", config);
    this.config = config;
    this.fileTypes.forEach((fileType) => fileType.dispose());
    this.fileTypes = config.fileTypes.map((fileTypeConfig) => new FileType(fileTypeConfig));
    this.ignorePatterns = config.ignorePatterns.map((pattern) => new RegExp(pattern, "i"));
  }

  /**
   * @remark Replaces the previous handler if one was set
   */
  setOnFileLinksUpdatedHandler(handler: OnFileLinksUpdatedHandler): void {
    this.onFileLinksUpdatedHandler = handler;
  }

  private getIndirectlyAffectedPaths(pathsModified: string[]): string[] {
    return pathsModified.flatMap((path) => this.getLinkedFilesFromPath(path)).map((file) => file.fullPath);
  }

  modifyFilesAndNotify({ removePaths = [], addPaths = [] }: { removePaths?: string[]; addPaths?: string[] }) {
    const endTimerAndLog = Logger.startTimer(`#modifyFilesAndNotify(\nadd=[${addPaths}],\nremove=[${removePaths}]\n)`);
    try {
      const relevantPathsRemoved = removePaths.filter((path) => this.pathIsRelevant(path));
      const relevantPathsAdded = addPaths.filter((path) => this.pathIsRelevant(path));
      const relevantFilesAffected = relevantPathsRemoved.length || relevantPathsAdded.length;
      if (!relevantFilesAffected) {
        return; // no known file types were affected so no need to update
      }

      this.applyPathRemovals(relevantPathsRemoved);
      this.applyPathAdditions(relevantPathsAdded);

      const indirectlyAffectedPaths = this.getIndirectlyAffectedPaths([...relevantPathsAdded, ...relevantPathsRemoved]);
      const affectedPaths = [...relevantPathsAdded, ...indirectlyAffectedPaths];

      Logger.info("#renameFilesAndNotify", { removePaths, addPaths, indirectlyAffectedPaths, affectedPaths });

      this.notifyFileLinksUpdated(affectedPaths);
    } finally {
      endTimerAndLog();
    }
  }

  private applyPathAdditions(paths: Set<string> | string[]) {
    paths.forEach((path) => this.#pathsWithKnownTypeMap.set(normalisePath(path), path));
    this.fileTypes.forEach((fileType) => fileType.addPaths(paths));
  }

  private applyPathRemovals(paths: string[]) {
    paths.forEach((path) => this.#pathsWithKnownTypeMap.delete(normalisePath(path)));
    this.fileTypes.forEach((fileType) => fileType.removePaths(paths));
  }

  private notifyFileLinksUpdated(affectedPaths: string[] | null) {
    if (affectedPaths?.length) {
      affectedPaths = [...new Set(affectedPaths)]; // remove duplicates
    }
    this.onFileLinksUpdatedHandler?.(affectedPaths);
  }

  /**
   * @remark this gets called rarely, only when files are added or removed so doesn't need to be cached
   */
  private pathIsRelevant(path: string): boolean {
    const shouldBeIgnored = this.ignorePatterns.some((regex) => regex.test(path));
    if (shouldBeIgnored) {
      return false;
    }
    const isKnownFileTypePath = this.fileTypes.some((fileType) => fileType.matches(path));
    return isKnownFileTypePath;
  }

  /**
   * Determines whether the given path should be decorated as linked to the given file type and provides the decoration if so
   */
  getFileTypeDecoratorData({ fileTypeName, path }: { fileTypeName: string; path: string }): DecorationData | undefined {
    const endTimer = Logger.startTimer(`${fileTypeName}Decorator#getFileTypeDecoratorData: ${path} `);
    try {
      const pathData = this.getPathData(path);
      if (!pathData) {
        return;
      }

      // we only get a file type if the file is linked to the given file type and so should be decorated by the file type decorator
      const linkedDecoratorFileType = pathData.allowedFileTypesForOutgoingLinks.find(
        (linkedFileType) => linkedFileType.name === fileTypeName,
      );

      const outgoingLinksToDecorate = linkedDecoratorFileType?.getFilesMatching(pathData.file.pathKey);
      if (outgoingLinksToDecorate?.length) {
        return linkedDecoratorFileType?.getDecorationData(); // only apply allowed file type decoration if there are linked files of that type
      }

      // log timing
    } finally {
      endTimer();
    }
  }

  /**
   * @remark This used to be cached however there weren't any significant performance gains
   * so decided to simplify until there is a need for it
   */
  private getFileInfo(path: NormalisedPath): FileInfo | undefined {
    if (!this.#pathsWithKnownTypeMap.has(path)) {
      return; // we don't know about this path so we can't get any file info
    }
    for (const type of this.fileTypes) {
      const pathKey = type.getPathKeyFromPath(path);
      if (pathKey) {
        return { type, pathKey };
      }
    }
  }

  private getPathData(path: string): PathData | null | undefined {
    // this gets called multiple times for the same file for different file type decorators so caching makes sense
    // also means we minimise delay showing quick pick options
    const normalisedPath = normalisePath(path);
    const cached = this.#pathDataCache.get(normalisedPath);
    if (typeof cached !== "undefined") {
      return cached;
    }

    const targetFile = this.getFileInfo(normalisedPath);
    if (!targetFile) {
      this.#pathDataCache.set(normalisedPath, null);
      return; // file is not of a known type
    }

    const allowedFileTypesForOutgoingLinks = this.fileTypes
      .filter((fileType) => fileType.name !== targetFile.type.name) // prevent a file type from being related to itself
      .filter((fileType) => targetFile.type.allowsLinksTo(fileType))
      .filter((fileType) => fileType.allowsLinksFrom(targetFile.type));

    const metaData: PathData = { file: targetFile, allowedFileTypesForOutgoingLinks };
    this.#pathDataCache.set(normalisedPath, metaData);
    return metaData;
  }

  /**
   * Gets all the files with outgoing links from the given path
   */
  getLinkedFilesFromPath(path: string): LinkedFileData[] {
    const stopTimer = Logger.startTimer(`LinkManager#getLinkedFilesFromPath: ${path}`);
    try {
      const pathData = this.getPathData(path);
      if (!pathData) {
        return [];
      }
      return pathData.allowedFileTypesForOutgoingLinks.flatMap((fileType) => {
        return fileType.getFilesMatching(pathData.file.pathKey);
      });

      // log timing
    } finally {
      stopTimer();
    }
  }

  getAllPathsWithOutgoingLinks(): string[] {
    const stopTimer = Logger.startTimer("LinkManager#getAllPathsWithOutgoingLinks");
    const paths = [...this.#pathsWithKnownTypeMap.values()].filter((path) => this.getLinkedFilesFromPath(path).length);
    stopTimer();
    return paths;
  }

  /** This reverts the instance to its initial state */
  revertToInitial() {
    this.fileTypes.forEach((fileType) => fileType.dispose());
    this.fileTypes = [];
    this.#pathsWithKnownTypeMap.clear();
    this.#pathDataCache.clear();
  }

  /**
   * We need to do a full refresh here as the config change could also change what files we consider "relevant"
   * so we need to re-evaluate the entire workspace
   */
  setContext(newContext: { config: MainConfig; paths: string[] }) {
    const configHasChanged = !mainConfigsAreEqual(this.config, newContext.config);
    if (!configHasChanged) {
      return;
    }
    Logger.warn("LinkManager#updateConfig", newContext.config);
    this.revertToInitial();
    this.applyConfig(newContext.config);

    const relevantPaths = newContext.paths.filter((path) => this.pathIsRelevant(path));
    this.applyPathAdditions(relevantPaths);

    // need to do a full refresh as the list of relevant files might have changed
    this.notifyFileLinksUpdated(null);
  }
}
