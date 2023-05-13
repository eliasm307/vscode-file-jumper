/* eslint-disable no-console */
import type { KeyPath, RelatedFileData } from "../types";
import type { FileTypeConfig } from "../utils/config";

export default class FileType {
  private regex: RegExp;

  private keyPathToFullPathMap: Map<string, string> = new Map();

  private testCache: Map<string, boolean> = new Map();

  /**
   * @key full file name
   */
  private keyPathCache: Map<string, KeyPath> = new Map();

  constructor(public readonly config: FileTypeConfig) {
    this.regex = new RegExp(config.regex);
  }

  matches(filePath: string): boolean {
    const cachedResult = this.testCache.get(filePath);
    if (typeof cachedResult === "boolean") {
      console.log("FileType#matches using cache", {
        name: this.config.name,
        filePath,
        cachedResult,
      });
      return cachedResult;
    }
    const isMatch = this.regex.test(filePath);
    this.testCache.set(filePath, isMatch);
    console.log("FileType#matches", { name: this.config.name, filePath, isMatch });
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

  reset() {
    this.keyPathToFullPathMap.clear();
    this.testCache.clear();
    this.keyPathCache.clear();
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
}
