namespace RawConfig {

/**
 * Main configuration
 */
export type FileJumper = {
  "fileJumper.fileTypes": FileTypesMap;
  "fileJumper.autoJump"?: boolean;
  "fileJumper.ignorePatterns"?: string[];
  "fileJumper.showDebugLogs"?: boolean;
};

export type FileTypesMap = Record<string, FileType>;

/**
 * Defines a file type, which represents a group of files that serve a specific purpose, e.g. test files, and different file types can then be linked together.
 *
 * This interface was referenced by `FileTypesMap`'s JSON-Schema definition
 * via the `patternProperty` ".+".
 */
export type FileType = {
  /**
   * An icon character (e.g. an emoji) to show as badges in the file explorer on files related to this type of file
   */
  icon: string;
  /**
   * An array of RegEx patterns (case insensitive) to match relevant files and capture the topic and/or a prefix.
   *
   * @minItems 1
   */
  patterns: string[];
  /**
   * Array of other file types that this file type produces links to. By default, all file types can be linked to all other file types.
   */
  onlyLinkTo?: string[];
  /**
   * Array of other file types that can link to this file type. By default, all file types can be linked to all other file types.
   */
  onlyLinkFrom?: string[];
  ignoreNonAlphaNumericCharacters?: boolean;
  creationPatterns?: CreationPattern[];
};

export type CreationPattern = {
  name: string;
  icon?: string;
  testRegex?: string;
  /**
   * @minItems 1
   */
  pathTransformations: PathTransformation[];
  initialContentSnippet?: string | string[];
};

export type PathTransformation = {
  testRegex?: string;
  searchRegex: string;
  searchRegexFlags?: string;
  replacementText?: string;
  groupFormats?: GroupFormats;
};

/**
 * Keys are the searchRegex capture group numbers (named capture groups not supported) and the values are the standard format to apply to each group
 */
export type GroupFormats = Record<string, "lowercase" | "UPPERCASE" | "PascalCase" | "camelCase" | "snake_case" | "kebab-case">;

}

export default RawConfig;
