/* eslint-disable no-console */
import type { KeyPath, RelatedFileData } from "../types";
import type { FileTypeConfig } from "../utils/config";

export default class FileType {
  public readonly name: string;

  private readonly regexs: RegExp[];

  private readonly onlyLinkToTypeNamesSet?: Set<string>;

  private readonly keyPathToFullPathMap: Map<string, string> = new Map();

  /**
   * Regex can be expensive to run repeatedly depending on how complex the pattern is, so cache the result
   *
   * @remark cache not cleared on reset as it doesn't affect behaviour
   */
  // todo investigate if this is actually worth it
  private readonly regexTestCache: Map<string, boolean> = new Map();

  /**
   * @key full file path
   *
   * @remark cache not cleared on reset as it doesn't affect behaviour
   * @remark `null` means this was executed and no keypath found
   */
  private readonly fullPathToKeyPathCache: Map<string, KeyPath | null> = new Map();

  constructor(private readonly config: FileTypeConfig) {
    this.regexs = config.regexs.map((pattern) => new RegExp(pattern));
    this.onlyLinkToTypeNamesSet = config.onlyLinkTo && new Set(config.onlyLinkTo);
    this.name = config.name;
  }

  matches(filePath: string): boolean {
    const cachedResult = this.regexTestCache.get(filePath);
    if (typeof cachedResult === "boolean") {
      console.log("FileType#matches using cache", {
        name: this.name,
        filePath,
        cachedResult,
      });
      return cachedResult;
    }
    const isMatch = this.regexs.some((regex) => regex.test(filePath));
    this.regexTestCache.set(filePath, isMatch);
    return isMatch;
  }

  getRelatedFile(keyPath: KeyPath): RelatedFileData | undefined {
    const fullPath = this.keyPathToFullPathMap.get(keyPath);
    if (fullPath) {
      return {
        typeName: this.name,
        marker: this.config.marker,
        fullPath,
      };
    }
  }

  registerPaths(filePaths: string[]) {
    filePaths.forEach((fullPath) => {
      const keyPath = this.getKeyPath(fullPath);
      if (keyPath) {
        this.keyPathToFullPathMap.set(keyPath, fullPath);
      }
    });
  }

  canRelateTo(otherFileType: FileType): unknown {
    if (!this.onlyLinkToTypeNamesSet) {
      return true; // defaults to all file types can link to all other file types
    }
    return this.onlyLinkToTypeNamesSet.has(otherFileType.name);
  }

  public getKeyPath(filePath: string): KeyPath | null | undefined {
    const cachedKeyPath = this.fullPathToKeyPathCache.get(filePath);
    if (typeof cachedKeyPath !== "undefined") {
      return cachedKeyPath;
    }

    for (const regex of this.regexs) {
      const regexMatch = filePath.match(regex);
      const keyPath = (regexMatch?.groups?.key || regexMatch?.[1]) as KeyPath | undefined;
      if (keyPath) {
        this.fullPathToKeyPathCache.set(filePath, keyPath);
        return keyPath;
      }
    }

    this.fullPathToKeyPathCache.set(filePath, null);
  }

  reset() {
    this.keyPathToFullPathMap.clear();
  }

  dispose(): void {
    this.reset();
    this.regexTestCache.clear();
    this.fullPathToKeyPathCache.clear();
  }
}
