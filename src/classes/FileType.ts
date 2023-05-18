import type { DecorationData, KeyPath, LinkedFileData } from "../types";
import type { FileTypeConfig } from "../utils/config";
import Logger from "./Logger";

export default class FileType {
  readonly name: string;

  private readonly patterns: RegExp[];

  private readonly onlyLinkToTypeNamesSet?: Set<string>;

  private readonly onlyLinkFromTypeNamesSet?: Set<string>;

  /**
   * @remark this does affect behaviour, so it is cleared on reset
   */
  private readonly keyPathToFullPathsMap: Map<string, Set<string>> = new Map();

  /**
   * @key full file path
   *
   * @remark cache not cleared on reset as its not context specific and doesn't affect behaviour
   * @remark `null` means this was executed and no keypath found
   */
  private readonly fullPathToKeyPathCache: Map<string, KeyPath | null> = new Map();

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

  getLinkedFilesFromKeyPath(keyPath: KeyPath): LinkedFileData[] {
    const fullPathsSet = this.keyPathToFullPathsMap.get(keyPath);
    const fullPathsArray = fullPathsSet ? [...fullPathsSet] : [];
    return fullPathsArray.map((fullPath) => ({
      typeName: this.name,
      marker: this.config.marker,
      fullPath,
    }));
  }

  addPaths(paths: Set<string> | string[]): void {
    paths.forEach((fullPath) => {
      const keyPath = this.getKeyPath(fullPath);
      if (!keyPath) {
        return; // not a valid path for this file type
      }
      Logger.info(`Registering keypath "${keyPath}" for file type "${this.name}", from "${fullPath}"`);
      const fullPathsSet = this.keyPathToFullPathsMap.get(keyPath) || new Set();
      fullPathsSet.add(fullPath);
      this.keyPathToFullPathsMap.set(keyPath, fullPathsSet);
    });
  }

  removePaths(paths: string[]) {
    paths.forEach((fullPath) => {
      const keyPath = this.getKeyPath(fullPath);
      if (!keyPath) {
        return;
      }
      Logger.info(`De-registering keypath "${keyPath}" for file type "${this.name}", from "${fullPath}"`);
      const existingFullPathsSet = this.keyPathToFullPathsMap.get(keyPath);
      if (!existingFullPathsSet) {
        return;
      }
      existingFullPathsSet.delete(fullPath);
      if (!existingFullPathsSet.size) {
        this.keyPathToFullPathsMap.delete(keyPath);
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
  getKeyPath(path: string): KeyPath | null | undefined {
    const cachedKeyPath = this.fullPathToKeyPathCache.get(path);
    if (typeof cachedKeyPath !== "undefined") {
      return cachedKeyPath;
    }
    for (const regex of this.patterns) {
      const regexMatch = path.match(regex);
      const keyPath = (regexMatch?.groups?.key || regexMatch?.[1]) as KeyPath | undefined;
      if (keyPath) {
        this.fullPathToKeyPathCache.set(path, keyPath);
        return keyPath;
      }
    }
    this.fullPathToKeyPathCache.set(path, null);
  }

  dispose() {
    this.keyPathToFullPathsMap.clear();
    this.fullPathToKeyPathCache.clear();
  }

  getDecorationData(): DecorationData {
    return {
      badgeText: this.config.marker,
      tooltip: `${this.config.marker} ${this.name}`,
    };
  }
}
