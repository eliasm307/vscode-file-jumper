import type { PathKey } from "./FileType";
import { normalisePath } from "../utils";
import { mainConfigsAreEqual } from "../utils/config";
import FileType from "./FileType";
import Logger from "./Logger";
import type { FileCreationData, DecorationData, LinkedFileData, NormalisedPath } from "../types";
import type { RawMainConfig } from "../utils/config";

type OnFileLinksUpdatedHandler = (affectedPaths: string[] | null) => Promise<void>;

type FileInfo = { pathKey: PathKey; type: FileType };

type PathData = {
  file: FileInfo;
  allowedFileTypesForOutgoingLinks: FileType[];
};

export default class LinkManager {
  private readonly pathDataCache = new Map<NormalisedPath, PathData | null>();

  /**
   * This represents all the relevant paths the link manager is aware of that are of a known type
   *
   * @value is the original un-normalised path
   */
  #pathsWithKnownTypeMap = new Map<NormalisedPath, string>();

  private config: RawMainConfig | undefined;

  private fileTypes: FileType[] = [];

  private ignorePatterns: RegExp[] = [];

  private onFileLinksUpdatedHandler: OnFileLinksUpdatedHandler | undefined;

  get autoJumpEnabled(): boolean {
    return !!this.config?.autoJump;
  }

  getAllPathsWithOutgoingLinks(): string[] {
    const stopTimer = Logger.startTimer("LinkManager#getAllPathsWithOutgoingLinks");
    const paths = [...this.#pathsWithKnownTypeMap.values()].filter(
      (path) => this.getLinkedFilesFromPath(path).length,
    );
    stopTimer();
    return paths;
  }

  /**
   * @remark Returns entries as that is the most convenient format for the use case, so we avoid returning an object and having to use Object.entries
   */
  getAllPathsWithPossibleCreationsEntries(): (readonly [string, FileCreationData[]])[] {
    const stopTimer = Logger.startTimer("LinkManager#getAllPathsWithPossibleCreations");

    const pathToPossibleCreations = [...this.#pathsWithKnownTypeMap.values()]
      .map((path) => [path, this.getAllFileCreationsFrom(path)] as const)
      .filter(([, allCreations]) => allCreations.length);

    stopTimer();
    return pathToPossibleCreations;
  }

  getAllFileCreationsFrom(path: string): FileCreationData[] {
    const stopTimer = Logger.startTimer("LinkManager#getCreationPathsFrom", path);
    const pathData = this.getPathData(path);
    const creationData = pathData?.file.type.getPossibleCreationConfigs(path) || [];
    stopTimer();
    return creationData;
  }

  /**
   * Determines whether the given path should be decorated as linked to the given file type and provides the decoration if so
   */
  getFileTypeDecoratorData({
    fileTypeName,
    path,
  }: {
    fileTypeName: string;
    path: string;
  }): DecorationData | undefined {
    if (!this.pathIsRelevant(path)) {
      return;
    }

    const endTimer = Logger.startTimer(
      "Decorator#getFileTypeDecoratorData",
      `${fileTypeName}-${path}`,
    );
    try {
      const pathData = this.getPathData(path);
      if (!pathData) {
        return;
      }

      // we only get a file type if the file is linked to the given file type and so should be decorated by the file type decorator
      const linkedDecoratorFileType = pathData.allowedFileTypesForOutgoingLinks.find(
        (linkedFileType) => linkedFileType.name === fileTypeName,
      );

      const outgoingLinksToDecorate = linkedDecoratorFileType?.getFilesMatching(
        pathData.file.pathKey,
      );
      if (outgoingLinksToDecorate?.length) {
        return linkedDecoratorFileType?.getDecorationData(); // only apply allowed file type decoration if there are linked files of that type
      }

      // log timing
    } finally {
      endTimer();
    }
  }

  /**
   * Gets all the files with outgoing links from the given path
   */
  getLinkedFilesFromPath(path: string): LinkedFileData[] {
    const stopTimer = Logger.startTimer("LinkManager#getLinkedFilesFromPath", path);
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

  modifyFilesAndNotify({
    removePaths = [],
    addPaths = [],
  }: {
    removePaths?: string[];
    addPaths?: string[];
  }) {
    Logger.info("#modifyFilesAndNotify", { removePaths, addPaths });

    const key = JSON.stringify({ removePaths, addPaths }, null, 2);
    const endTimerAndLog = Logger.startTimer("#modifyFilesAndNotify", key);
    try {
      removePaths = this.resolveDeletedPaths(removePaths);
      const relevantPathsRemoved = removePaths.filter((path) => this.pathIsRelevant(path));
      const relevantPathsAdded = addPaths.filter((path) => this.pathIsRelevant(path));
      const relevantFilesAffectedCount = relevantPathsRemoved.length + relevantPathsAdded.length;
      if (!relevantFilesAffectedCount) {
        return; // no known file types were affected so no need to update
      }

      this.applyPathRemovals(relevantPathsRemoved);
      this.applyPathAdditions(relevantPathsAdded);

      const indirectlyAffectedPaths = this.getIndirectlyAffectedPaths([
        ...relevantPathsAdded,
        ...relevantPathsRemoved,
      ]);
      const affectedPaths = [...relevantPathsAdded, ...indirectlyAffectedPaths];

      Logger.info("#renameFilesAndNotify", {
        resolvedRemovePaths: removePaths,
        relevantPathsRemoved,
        addPaths,
        relevantPathsAdded,
        indirectlyAffectedPaths,
        affectedPaths,
      });

      this.notifyFileLinksUpdated(affectedPaths);
    } finally {
      endTimerAndLog();
    }
  }

  /** This reverts the instance to its initial state */
  revertToInitial() {
    this.fileTypes.forEach((fileType) => fileType.dispose());
    this.fileTypes = [];
    this.#pathsWithKnownTypeMap.clear();
    this.pathDataCache.clear();
  }

  /**
   * We need to do a full refresh here as the config change could also change what files we consider "relevant"
   * so we need to re-evaluate the entire workspace
   */
  setContext(newContext: { config: RawMainConfig; paths: string[] }) {
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

  /**
   * @remark Replaces the previous handler if one was set
   */
  setOnFileLinksUpdatedHandler(handler: OnFileLinksUpdatedHandler): void {
    this.onFileLinksUpdatedHandler = handler;
  }

  private applyConfig(config: RawMainConfig): void {
    Logger.info("#applyConfig", config);
    this.config = this.formatConfig(config);
    this.fileTypes.forEach((fileType) => fileType.dispose());
    this.fileTypes = this.config.fileTypes.map((fileTypeConfig) => new FileType(fileTypeConfig));
    this.ignorePatterns = this.config.ignorePatterns.map((pattern) => new RegExp(pattern, "i"));
  }

  private applyPathAdditions(paths: Set<string> | string[]) {
    const pathsCount = Array.isArray(paths) ? paths.length : paths.size;
    if (!pathsCount) {
      return;
    }
    Logger.info("#applyPathAdditions", paths);
    paths.forEach((path) => this.#pathsWithKnownTypeMap.set(normalisePath(path), path));
    this.fileTypes.forEach((fileType) => fileType.addPaths(paths));
  }

  private applyPathRemovals(paths: string[]) {
    if (!paths.length) {
      return;
    }
    Logger.info("#applyPathRemovals", paths);
    paths.forEach((path) => this.#pathsWithKnownTypeMap.delete(normalisePath(path)));
    this.fileTypes.forEach((fileType) => fileType.removePaths(paths));
  }

  private formatConfig(config: RawMainConfig): RawMainConfig {
    return {
      ...config,
      fileTypes: config.fileTypes.map((fileTypeConfig) => ({
        ...fileTypeConfig,
        // limit to 1 icon so VS code decorations dont throw (max is 2 chars)
        // need to use Array.from to handle special characters like emoji properly (str[0] doesn't work)
        icon: Array.from(fileTypeConfig.icon)[0],
      })),
    };
  }

  /**
   * @remark This used to be cached however there weren't any significant performance gains
   * so decided to simplify until there is a need for it
   */
  private getFileInfo(path: NormalisedPath): FileInfo | undefined {
    Logger.count("LinkManager#getFileInfo CALLED");
    if (!this.pathIsRelevant(path)) {
      return;
    }
    for (const type of this.fileTypes) {
      const pathKey = type.getPathKeyFromPath(path);
      if (pathKey) {
        return { type, pathKey };
      }
    }
  }

  private getIndirectlyAffectedPaths(pathsModified: string[]): string[] {
    return pathsModified
      .flatMap((path) => this.getLinkedFilesFromPath(path))
      .map((file) => file.fullPath);
  }

  /**
   * This gets called multiple times for the same file for different file type decorators
   * so effectiveness of cache depends on how many file types and files matching file types we have
   * Keeping cache to optimise large codebases and to also minimise delay showing quick pick options
   */
  private getPathData(path: string): PathData | null | undefined {
    Logger.count("LinkManager#getPathData CALLED");
    const normalisedPath = normalisePath(path);
    const cached = this.pathDataCache.get(normalisedPath);
    if (typeof cached !== "undefined") {
      Logger.count("LinkManager#getPathData CACHE HIT");
      return cached;
    }
    Logger.count("LinkManager#getPathData CACHE MISS");

    const targetFile = this.getFileInfo(normalisedPath);
    if (!targetFile) {
      Logger.count("LinkManager#getPathData: NO TARGET FILE");
      /*
      When a file is created VS Code tries to get its decorations before the file watcher has had a chance to add it to the list of known files
      so a new file wont have file info here, so we dont do negative caching as it will be a hit next time
      */
      // this.pathDataCache.set(normalisedPath, null);
      return; // file is not of a known type
    }

    const allowedFileTypesForOutgoingLinks = this.fileTypes
      .filter((fileType) => fileType.name !== targetFile.type.name) // prevent a file type from being related to itself
      .filter((fileType) => targetFile.type.allowsLinksTo(fileType))
      .filter((fileType) => fileType.allowsLinksFrom(targetFile.type));

    const metaData: PathData = { file: targetFile, allowedFileTypesForOutgoingLinks };
    this.pathDataCache.set(normalisedPath, metaData);
    return metaData;
  }

  private notifyFileLinksUpdated(affectedPaths: string[] | null) {
    if (affectedPaths?.length) {
      affectedPaths = [...new Set(affectedPaths)]; // remove duplicates
    }
    void this.onFileLinksUpdatedHandler?.(affectedPaths);
  }

  /**
   * This gets called a lot but its not cached because it is called on initial load and when files/workspaces change
   * which means an event that causes this to be called has new paths and that means lots of cache misses
   * so the caching overhead isn't worth it
   */
  private pathIsRelevant(path: string): boolean {
    const shouldBeIgnored = this.ignorePatterns.some((regex) => regex.test(path));
    if (shouldBeIgnored) {
      return false;
    }
    const isKnownFileTypePath = this.fileTypes.some((fileType) => fileType.matches(path));
    return isKnownFileTypePath;
  }

  private resolveDeletedPaths(paths: string[]): string[] {
    return paths.flatMap((path) => {
      const mightHaveBeenAFolder = !path.split("/").at(-1)?.includes(".");
      if (mightHaveBeenAFolder) {
        const folderChildPaths = [...this.#pathsWithKnownTypeMap.values()].filter((knownFilePath) =>
          knownFilePath.startsWith(`${path}/`),
        );
        Logger.info("#applyPathRemovals", { folderPath: path, folderChildPath: folderChildPaths });
        return folderChildPaths;
      }
      return path;
    });
  }
}
