import type { DecorationData, LinkedFileData } from "../types";
import type { FileTypeConfig } from "../utils/config";
import Logger from "./Logger";

// ! this should only be created from this file so it can be changed without affecting the rest of the code
export type PathKey = string & { __brand: "pathKey" };

export default class FileType {
  readonly name: string;

  private readonly patterns: RegExp[];

  private readonly onlyLinkToTypeNamesSet?: Set<string>;

  private readonly onlyLinkFromTypeNamesSet?: Set<string>;

  /**
   * @remark this does affect behaviour, so it is cleared on reset
   */
  private readonly pathKeyToFullPathsMap: Map<string, Set<string>> = new Map();

  /**
   * @key full file path
   *
   * @remark cache not cleared on reset as its not context specific and doesn't affect behaviour
   * @remark `null` means this was executed and no path key found
   */
  private readonly fullPathToPathKeyCache: Map<string, PathKey | null> = new Map();

  constructor(private readonly config: FileTypeConfig) {
    this.patterns = config.patterns.map((pattern) => new RegExp(pattern));
    this.onlyLinkToTypeNamesSet = config.onlyLinkTo && new Set(config.onlyLinkTo);
    this.onlyLinkFromTypeNamesSet = config.onlyLinkFrom && new Set(config.onlyLinkFrom);

    this.name = config.name;
  }

  /**
   * @remark this was cached initially, assuming regex could have performance cost depending on how complex it was
   * but there weren't significant observed performance gains so decided to simplify until it actually becomes a problem
   */
  matches(path: string): boolean {
    return this.patterns.some((regex) => regex.test(path));
  }

  getFilesMatching(pathKey: PathKey): LinkedFileData[] {
    const fullPathsSet = this.pathKeyToFullPathsMap.get(pathKey);
    const fullPathsArray = fullPathsSet ? [...fullPathsSet] : [];
    return fullPathsArray.map((fullPath) => ({
      typeName: this.name,
      icon: this.config.icon,
      fullPath,
    }));
  }

  addPaths(paths: Set<string> | string[]): void {
    paths.forEach((fullPath) => {
      const pathKey = this.getPathKeyFromPath(fullPath);
      if (!pathKey) {
        return; // not a valid path for this file type
      }
      Logger.info(`Registering path key "${pathKey}" for file type "${this.name}", from "${fullPath}"`);
      const fullPathsSet = this.pathKeyToFullPathsMap.get(pathKey) || new Set();
      fullPathsSet.add(fullPath);
      this.pathKeyToFullPathsMap.set(pathKey, fullPathsSet);
    });
  }

  removePaths(paths: string[]) {
    paths.forEach((fullPath) => {
      const pathKey = this.getPathKeyFromPath(fullPath);
      if (!pathKey) {
        return;
      }
      Logger.info(`Removing path key "${pathKey}" for file type "${this.name}", from "${fullPath}"`);
      const existingFullPathsSet = this.pathKeyToFullPathsMap.get(pathKey);
      if (!existingFullPathsSet) {
        return;
      }
      existingFullPathsSet.delete(fullPath);
      if (!existingFullPathsSet.size) {
        this.pathKeyToFullPathsMap.delete(pathKey);
      }
    });
  }

  allowsLinksTo(otherFileType: FileType): unknown {
    // defaults to all file types can link to all other file types
    return !this.onlyLinkToTypeNamesSet || this.onlyLinkToTypeNamesSet.has(otherFileType.name);
  }

  allowsLinksFrom(otherFileType: FileType): unknown {
    // defaults to all file types can be linked from all other file types
    return !this.onlyLinkFromTypeNamesSet || this.onlyLinkFromTypeNamesSet.has(otherFileType.name);
  }

  /**
   * @remark
   * This was measured to be a performance bottleneck, ie it gets called hundreds of times with the same paths
   * and the caching makes a difference
   */
  getPathKeyFromPath(path: string): PathKey | null | undefined {
    const cachedPathKey = this.fullPathToPathKeyCache.get(path);
    if (typeof cachedPathKey !== "undefined") {
      return cachedPathKey;
    }
    for (const regex of this.patterns) {
      const regexMatch = path.match(regex);
      const pathTopic = regexMatch?.groups?.topic;
      if (pathTopic) {
        const pathKey = this.createPathKey({ topic: pathTopic, prefix: regexMatch?.groups?.prefix });
        this.fullPathToPathKeyCache.set(path, pathKey);
        return pathKey;
      }
    }
    this.fullPathToPathKeyCache.set(path, null);
  }

  private createPathKey({ topic, prefix }: { prefix?: string; topic: string }): PathKey {
    if (!prefix) {
      return topic as PathKey;
    }
    return `${prefix}|${topic}` as PathKey;
  }

  dispose() {
    this.pathKeyToFullPathsMap.clear();
    this.fullPathToPathKeyCache.clear();
  }

  getDecorationData(): DecorationData {
    return {
      badgeText: this.config.icon,
      tooltip: `${this.config.icon} ${this.name}`,
    };
  }
}
