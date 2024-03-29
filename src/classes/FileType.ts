import * as pathModule from "node:path";
import type {
  FileCreationData as FileCreationConfig,
  DecorationData,
  LinkedFileData,
  NormalisedPath,
  PathTransformation,
} from "../types";
import { isTruthy, normalisePath } from "../utils";
import Logger from "./Logger";
import {
  applyPathTransformations,
  type CreationPatternConfig,
  type FileTypeConfig,
} from "../utils/config";

/**
 * This is the key used to compare whether files of different types are linked to each other
 */
// ! this should only be created from this file so it can be changed without affecting the rest of the code
export type PathKey = string & { __brand: "pathKey" };

type CreationPattern = {
  name: string;
  icon?: string;
  testRegex?: RegExp;
  pathTransformations: PathTransformation[];
  /**
   * Either a string as an existing snippet name
   * or an array of strings as lines of a snippet body
   */
  initialContentSnippet?: string[] | string;
};

export default class FileType {
  /**
   * @key full file path
   *
   * @remark cache not cleared on reset as its not context specific and doesn't affect behaviour
   * @remark `null` means this was executed and no path key found
   */
  private readonly fullPathToPathKeyCache = new Map<NormalisedPath, PathKey | null>();

  private readonly onlyLinkFromTypeNamesSet?: Set<string>;

  private readonly onlyLinkToTypeNamesSet?: Set<string>;

  /**
   * @remark this does affect behaviour, so it is cleared on reset
   */
  private readonly pathKeyToFullPathsMap = new Map<string, Set<string>>();

  private readonly patterns: RegExp[];

  private readonly creationPatterns: CreationPattern[];

  private ignoreNonAlphaNumericCharacters: boolean;

  private icon: string;

  readonly name: string;

  constructor(config: FileTypeConfig) {
    this.icon = config.icon;
    this.patterns = config.patterns.map((pattern) => new RegExp(pattern, "i"));
    this.creationPatterns = this.parseCreationPatternConfigs(config.creationPatterns);
    this.onlyLinkToTypeNamesSet = config.onlyLinkTo && new Set(config.onlyLinkTo);
    this.onlyLinkFromTypeNamesSet = config.onlyLinkFrom && new Set(config.onlyLinkFrom);
    this.name = config.name;
    this.ignoreNonAlphaNumericCharacters = !!config.ignoreNonAlphaNumericCharacters;
  }

  private parseCreationPatternConfigs(
    creationPatternConfigs: CreationPatternConfig[] | undefined = [],
  ): CreationPattern[] {
    return creationPatternConfigs.map((creationPatternConfig) => ({
      ...creationPatternConfig,
      testRegex: creationPatternConfig.testRegex
        ? new RegExp(creationPatternConfig.testRegex)
        : undefined,
      pathTransformations: creationPatternConfig.pathTransformations.map((transformation) => ({
        ...transformation,
        // NOTE: we assume this will only be used for string replace, so stateful regex flags should not cause issues when regex is reused
        searchRegex: new RegExp(
          transformation.searchRegex,
          `${transformation.searchRegexFlags || ""}${
            // NOTE: we need the "d" flag so we get indices for the replacement
            transformation.searchRegexFlags?.includes("d") ? "" : "d"
          }`,
        ),
        testRegex: transformation.testRegex ? new RegExp(transformation.testRegex) : undefined,
      })),
    }));
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
      badgeText: this.icon,
      tooltip: `${this.icon} ${this.name}`,
    };
  }

  getFilesMatching(pathKey: PathKey): LinkedFileData[] {
    const fullPathsSet = this.pathKeyToFullPathsMap.get(pathKey);
    const fullPathsArray = fullPathsSet ? [...fullPathsSet] : [];
    return fullPathsArray.map((fullPath) => ({
      typeName: this.name,
      icon: this.icon,
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
          prefix: regexMatch.groups?.prefix,
        });
        this.fullPathToPathKeyCache.set(normalisedPath, pathKey);
        return pathKey;
      }
    }

    // no match, the path cannot produce a path key in the future so we cache the negative result
    this.fullPathToPathKeyCache.set(normalisedPath, null);
  }

  /**
   * @remark This produces a raw list of possible file creations from a file, but they may be files that already exist
   *
   * @remark This assumes the source path is a valid path for this file type
   */
  getPossibleCreationConfigs(sourcePath: string): FileCreationConfig[] {
    return this.creationPatterns
      .filter((creationPattern) => creationPattern.testRegex?.test(sourcePath) ?? true)
      .map((creationPattern) => {
        const creationPath = applyPathTransformations({
          sourcePath,
          transformations: creationPattern.pathTransformations,
        });

        if (creationPath === sourcePath) {
          return; // creation not possible, no path transformation applied
        }

        // assert creation path is valid path, ie the user has not made a made a mistake with the path
        if (!pathModule.isAbsolute(creationPath)) {
          const error = `Resulting creation path "${creationPath}" from source file "${sourcePath}" with type "${
            this.name
          }" is not absolute. Creation pattern: ${JSON.stringify(creationPattern)}`;
          console.error(error);
          throw new Error(error);
        }

        return {
          name: creationPattern.name,
          icon: creationPattern.icon || "",
          fullPath: creationPath,
          initialContentSnippet: creationPattern.initialContentSnippet,
        };
      })
      .filter(isTruthy);
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
