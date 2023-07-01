import type { DecorationData, LinkedFileData, NormalisedPath } from "../types";
import { normalisePath } from "../utils";
import Logger from "./Logger";

import type { FileTypeConfig } from "../utils/config";
// ! this should only be created from this file so it can be changed without affecting the rest of the code
/**
 * This is the key used to compare whether files of different types are linked to each other
 */
export type PathKey = string & { __brand: "pathKey" };

export default class FileType {
  /**
   * @key full file path
   *
   * @remark cache not cleared on reset as its not context specific and doesn't affect behaviour
   * @remark `null` means this was executed and no path key found
   */
  private readonly fullPathToPathKeyCache: Map<NormalisedPath, PathKey | null> = new Map();

  private readonly onlyLinkFromTypeNamesSet?: Set<string>;

  private readonly onlyLinkToTypeNamesSet?: Set<string>;

  /**
   * @remark this does affect behaviour, so it is cleared on reset
   */
  private readonly pathKeyToFullPathsMap: Map<string, Set<string>> = new Map();

  private readonly patterns: RegExp[];

  private ignoreNonAlphaNumericCharacters: boolean;

  readonly name: string;

  constructor(private readonly config: FileTypeConfig) {
    this.patterns = config.patterns.map((pattern) => new RegExp(pattern, "i"));
    this.onlyLinkToTypeNamesSet = config.onlyLinkTo && new Set(config.onlyLinkTo);
    this.onlyLinkFromTypeNamesSet = config.onlyLinkFrom && new Set(config.onlyLinkFrom);
    this.name = config.name;
    this.ignoreNonAlphaNumericCharacters = !!config.ignoreNonAlphaNumericCharacters;
  }

  addPaths(paths: Set<string> | string[]): void {
    paths.forEach((path) => {
      const pathKey = this.getPathKeyFromPath(normalisePath(path));
      if (!pathKey) {
        return; // not a valid path for this file type
      }
      Logger.info(`Adding path key "${pathKey}" for file type "${this.name}", from "${path}"`);
      const fullPathsSet = this.pathKeyToFullPathsMap.get(pathKey) || new Set();
      fullPathsSet.add(path);
      Logger.info(
        `Files for path key "${pathKey}" for file type "${this.name}": ${[...fullPathsSet].join(
          ", ",
        )}`,
      );
      this.pathKeyToFullPathsMap.set(pathKey, fullPathsSet);
    });
  }

  allowsLinksFrom(otherFileType: FileType): unknown {
    // defaults to all file types can be linked from all other file types
    return !this.onlyLinkFromTypeNamesSet || this.onlyLinkFromTypeNamesSet.has(otherFileType.name);
  }

  allowsLinksTo(otherFileType: FileType): unknown {
    // defaults to all file types can link to all other file types
    return !this.onlyLinkToTypeNamesSet || this.onlyLinkToTypeNamesSet.has(otherFileType.name);
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

  getFilesMatching(pathKey: PathKey): LinkedFileData[] {
    const fullPathsSet = this.pathKeyToFullPathsMap.get(pathKey);
    const fullPathsArray = fullPathsSet ? [...fullPathsSet] : [];
    return fullPathsArray.map((fullPath) => ({
      typeName: this.name,
      icon: this.config.icon,
      fullPath,
    }));
  }

  /**
   * @remark
   * This was measured to be a performance bottleneck, ie it gets called hundreds of times with the same paths
   * and the caching makes a difference
   */
  getPathKeyFromPath(path: string): PathKey | null | undefined {
    Logger.count("FileType#getPathKeyFromPath CALLED");
    const normalisedPath = normalisePath(path);
    const cachedPathKey = this.fullPathToPathKeyCache.get(normalisedPath);
    if (typeof cachedPathKey !== "undefined") {
      Logger.count("FileType#getPathKeyFromPath CACHE HIT");
      return cachedPathKey;
    }
    Logger.count("FileType#getPathKeyFromPath CACHE MISS");

    for (const regex of this.patterns) {
      const regexMatch = path.match(regex);
      const pathTopic = regexMatch?.groups?.topic;
      if (pathTopic) {
        const pathKey = this.createPathKey({
          topic: pathTopic,
          prefix: regexMatch?.groups?.prefix,
        });
        this.fullPathToPathKeyCache.set(normalisedPath, pathKey);
        return pathKey;
      }
    }

    // no match, the path cannot produce a path key in the future so we cache the negative result
    this.fullPathToPathKeyCache.set(normalisedPath, null);
  }

  /**
   * This gets called a lot but the results are not cached at this level but instead at the LinkManager level
   */
  matches(path: string): boolean {
    return this.patterns.some((regex) => regex.test(path));
  }

  removePaths(paths: string[]) {
    paths.forEach((path) => {
      const pathKey = this.getPathKeyFromPath(normalisePath(path));
      if (!pathKey) {
        return;
      }

      Logger.info(`Removing path key "${pathKey}" for file type "${this.name}", from "${path}"`);
      const existingFullPathsSet = this.pathKeyToFullPathsMap.get(pathKey);
      if (!existingFullPathsSet) {
        return; // nothing to remove
      }

      existingFullPathsSet.delete(path);
      Logger.info(
        `Files for path key "${pathKey}" for file type "${this.name}": ${[
          ...existingFullPathsSet,
        ].join(", ")}`,
      );
      if (!existingFullPathsSet.size) {
        this.pathKeyToFullPathsMap.delete(pathKey);
      }
    });
  }

  private createPathKey({ topic, prefix }: { prefix?: string; topic: string }): PathKey {
    // regex is case insensitive so we need to normalise the topic
    topic = topic.toLowerCase();
    if (this.ignoreNonAlphaNumericCharacters) {
      // this needs to include "/" as it is used as a path separator
      topic = topic.replace(/[^a-zA-Z0-9/]/g, "");
    }
    if (!prefix) {
      return topic as PathKey;
    }
    return `${prefix}|${topic}` as PathKey;
  }
}
