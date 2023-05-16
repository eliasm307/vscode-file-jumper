import type { KeyPath, LinkedFileData } from "../types";
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

  getLinkedFiles(keyPath: KeyPath): LinkedFileData[] {
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

  /**
   * @remark This was cached initially however there wasn't a significant performance improvement so decided to simplify
   */
  public getKeyPath(path: string): KeyPath | null | undefined {
    for (const regex of this.patterns) {
      const regexMatch = path.match(regex);
      const keyPath = (regexMatch?.groups?.key || regexMatch?.[1]) as KeyPath | undefined;
      if (keyPath) {
        return keyPath;
      }
    }
  }

  reset() {
    this.keyPathToFullPathsMap.clear();
  }

  dispose(): void {
    this.reset();
  }
}
