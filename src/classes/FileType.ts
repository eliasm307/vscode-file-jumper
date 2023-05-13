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
  private readonly regexMatchCache: Map<string, boolean> = new Map();

  /**
   * @key full file path
   *
   * @remark cache not cleared on reset as it doesn't affect behaviour
   */
  private readonly fullPathToKeyPathCache: Map<string, KeyPath> = new Map();

  constructor(private readonly config: FileTypeConfig) {
    this.regexs = config.regex.map((pattern) => new RegExp(pattern));
    this.onlyLinkToTypeNamesSet = config.onlyLinkTo && new Set(config.onlyLinkTo);
    this.name = config.name;
  }

  matches(filePath: string): boolean {
    const cachedResult = this.regexMatchCache.get(filePath);
    if (typeof cachedResult === "boolean") {
      console.log("FileType#matches using cache", {
        name: this.name,
        filePath,
        cachedResult,
      });
      return cachedResult;
    }
    const isMatch = this.regexs.some((regex) => regex.test(filePath));
    this.regexMatchCache.set(filePath, isMatch);
    return isMatch;
  }

  getRelatedFile(keyPath: KeyPath): RelatedFileData | undefined {
    const fullPath = this.keyPathToFullPathMap.get(keyPath);
    if (!fullPath) {
      console.warn("FileType#getRelatedFile", `No file found for keyPath: ${keyPath}`, {
        name: this.name,
      });
      return;
    }

    const relatedFile = {
      typeName: this.name,
      marker: this.config.marker,
      fullPath,
    };
    return relatedFile;
  }

  registerPaths(filePaths: string[]) {
    filePaths.forEach((fullPath) => {
      const keyPath = this.getKeyPath(fullPath);
      if (keyPath) {
        console.log("FileType#registerPaths registering", fullPath, {
          name: this.name,
          keyPath,
        });
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

  public getKeyPath(filePath: string): KeyPath | undefined {
    const cachedKeyPath = this.fullPathToKeyPathCache.get(filePath);
    if (cachedKeyPath) {
      console.log("FileType#getKeyPath using cache", {
        name: this.name,
        filePath,
        cachedKeyPath,
      });
      return cachedKeyPath;
    }

    for (const regex of this.regexs) {
      const regexMatch = filePath.match(regex);
      const keyPath = (regexMatch?.groups?.key || regexMatch?.[1]) as KeyPath | undefined;
      if (keyPath) {
        console.log("FileType#getKeyPath", { name: this.name, filePath, keyPath });
        this.fullPathToKeyPathCache.set(filePath, keyPath);
        return keyPath;
      }
    }
  }

  reset() {
    this.keyPathToFullPathMap.clear();
  }
}
