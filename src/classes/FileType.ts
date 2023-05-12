import type { FileTypeConfig } from "../utils/config";

export type RelatedFileData = {
  typeName: string;
  marker: string;
  fullPath: string;
};

export default class FileType {
  private keyPathToFullPathMap: Map<string, string> = new Map();

  private regex: RegExp;

  constructor(public readonly config: FileTypeConfig) {
    this.regex = new RegExp(config.regex);
  }

  matches(filePath: string): boolean {
    return this.regex.test(filePath);
  }

  getRelatedFile(keyPath: string): RelatedFileData | undefined {
    const fullPath = this.keyPathToFullPathMap.get(keyPath);
    if (!fullPath) {
      return;
    }

    return {
      typeName: this.config.name,
      marker: this.config.marker,
      fullPath,
    };
  }

  registerPaths(filePaths: string[]) {
    filePaths.forEach((fullPath) => {
      const keyPath = this.getKeyPath(fullPath);
      if (keyPath) {
        this.keyPathToFullPathMap.set(keyPath, fullPath);
      }
    });
  }

  reset() {
    this.keyPathToFullPathMap.clear();
  }

  private getKeyPath(filePath: string): string | undefined {
    return filePath.match(this.regex)?.[1];
  }
}
