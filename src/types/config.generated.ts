namespace RawConfig {

/**
 * This interface was referenced by `GroupFormats`'s JSON-Schema definition
 * via the `patternProperty` ".+".
 */
export type FormatType = "lowercase" | "UPPERCASE" | "PascalCase" | "camelCase" | "snake_case" | "kebab-case";

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
 * This interface was referenced by `FileTypesMap`'s JSON-Schema definition
 * via the `patternProperty` ".+".
 */
export type FileType = {
  icon: string;
  /**
   * @minItems 1
   */
  patterns: string[];
  onlyLinkTo?: string[];
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

export type GroupFormats = Record<string, FormatType>;

}

export default RawConfig;
