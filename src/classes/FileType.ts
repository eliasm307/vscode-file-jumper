/* eslint-disable no-console */
import type { KeyPath, RelatedFileData } from "../types";
import type { FileTypeConfig } from "../utils/config";

export default class FileType {
  private readonly regex: RegExp;

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
   * @key full file name
   *
   * @remark cache not cleared on reset as it doesn't affect behaviour
   */
  private readonly keyPathCache: Map<string, KeyPath> = new Map();

  constructor(public readonly config: FileTypeConfig) {
    this.regex = new RegExp(config.regex);
    this.onlyLinkToTypeNamesSet = config.onlyLinkTo ? new Set(config.onlyLinkTo) : undefined;
  }

  matches(filePath: string): boolean {
    const cachedResult = this.regexMatchCache.get(filePath);
    if (typeof cachedResult === "boolean") {
      console.log("FileType#matches using cache", {
        name: this.config.name,
        filePath,
        cachedResult,
      });
      return cachedResult;
    }
    const isMatch = this.regex.test(filePath);
    this.regexMatchCache.set(filePath, isMatch);
    return isMatch;
  }

  getRelatedFile(keyPath: KeyPath): RelatedFileData | undefined {
    const fullPath = this.keyPathToFullPathMap.get(keyPath);
    if (!fullPath) {
      console.warn("FileType#getRelatedFile", `No file found for keyPath: ${keyPath}`, {
        name: this.config.name,
      });
      return;
    }

    const relatedFile = {
      typeName: this.config.name,
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
          name: this.config.name,
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
    return this.onlyLinkToTypeNamesSet.has(otherFileType.config.name);
  }

  public getKeyPath(filePath: string): KeyPath | undefined {
    const cachedKeyPath = this.keyPathCache.get(filePath);
    if (cachedKeyPath) {
      console.log("FileType#getKeyPath using cache", {
        name: this.config.name,
        filePath,
        cachedKeyPath,
      });
      return cachedKeyPath;
    }

    const regexMatch = filePath.match(this.regex);
    const keyPath = (regexMatch?.groups?.key || regexMatch?.[1]) as KeyPath | undefined;
    if (keyPath) {
      this.keyPathCache.set(filePath, keyPath);
    }
    console.log("FileType#getKeyPath", { name: this.config.name, filePath, keyPath });
    return keyPath;
  }

  reset() {
    this.keyPathToFullPathMap.clear();
  }
}
