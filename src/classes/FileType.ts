/* eslint-disable no-console */
import type { KeyPath, RelatedFileData } from "../types";
import type { FileTypeConfig } from "../utils/config";

export default class FileType {
  private keyPathToFullPathMap: Map<string, string> = new Map();

  private regex: RegExp;

  constructor(public readonly config: FileTypeConfig) {
    this.regex = new RegExp(config.regex);
  }

  matches(filePath: string): boolean {
    const isMatch = this.regex.test(filePath);
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
    console.log("FileType#getRelatedFile", { name: this.config.name, keyPath, relatedFile });
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
  }

  public getKeyPath(filePath: string): KeyPath | undefined {
    return filePath.match(this.regex)?.[1] as KeyPath | undefined;
  }
}
