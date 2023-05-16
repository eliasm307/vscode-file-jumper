import type { KeyPath, RelatedFileData } from "../types";
import type { FileTypeConfig } from "../utils/config";
import Logger from "./Logger";

export default class FileType {
  public readonly name: string;

  private readonly patterns: RegExp[];

  private readonly onlyLinkToTypeNamesSet?: Set<string>;

  private readonly onlyLinkFromTypeNamesSet?: Set<string>;

  /**
   * @remark this does affect behaviour, so it is cleared on reset
   */
  private readonly keyPathToFullPathsMap: Map<string, Set<string>> = new Map();

  /**
   * Regex can be expensive to run repeatedly depending on how complex the pattern is, so cache the result
   *
   * @remark cache not cleared on reset as it is not context specific and doesn't affect behaviour
   */
  // todo investigate if this is actually worth it
  private readonly regexTestCache: Map<string, boolean> = new Map();

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

  matches(path: string): boolean {
    const cachedResult = this.regexTestCache.get(path);
    if (typeof cachedResult === "boolean") {
      return cachedResult;
    }
    const isMatch = this.patterns.some((regex) => regex.test(path));
    this.regexTestCache.set(path, isMatch);
    return isMatch;
  }

  getRelatedFiles(keyPath: KeyPath): RelatedFileData[] {
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
        return;
      }
      Logger.info(`Registering keypath "${keyPath}" for file type "${this.name}", from "${fullPath}"`);
      const existingFullPathsSet = this.keyPathToFullPathsMap.get(keyPath) || new Set();
      existingFullPathsSet.add(fullPath);
      this.keyPathToFullPathsMap.set(keyPath, existingFullPathsSet);
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

  public getKeyPath(path: string): KeyPath | null | undefined {
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

  reset() {
    this.keyPathToFullPathsMap.clear();
  }

  dispose(): void {
    this.reset();
    this.regexTestCache.clear();
    this.fullPathToKeyPathCache.clear();
  }
}
