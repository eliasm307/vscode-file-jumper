import startCase from "lodash/startCase";
import camelCase from "lodash/camelCase";
import snakeCase from "lodash/snakeCase";
import kebabCase from "lodash/kebabCase";
import type { PathTransformation } from "../types";
import type RawConfig from "../types/config.generated";

export type FileTypeConfig = RawConfig.FileType & {
  name: string;
  // icon: string;
  // patterns: string[];
  // /**
  //  * The names of other file types that this file type can produces links to
  //  *
  //  * @remark By default (when not defined), all file types can be linked to all other file types
  //  *
  //  * @remark Setting this to an empty array will prevent this file type from being related to any other file types, ie it will not have shortcuts from it but other file types can have shortcuts to it
  //  */
  // onlyLinkTo?: string[];
  // /**
  //  * The names of other file types that can link to this file type
  //  *
  //  * @remark By default (when not defined), all file types can be linked to all other file types
  //  *
  //  * @remark Setting this to an empty array will prevent other files from linking to this file type, ie it will not have shortcuts to it but it can have shortcuts to other file types
  //  */
  // onlyLinkFrom?: string[];
  // ignoreNonAlphaNumericCharacters?: boolean;
  // creationPatterns?: CreationPatternConfig[];
};

export type CreationPatternConfig = RawConfig.CreationPattern & {
  // name: string;
  // icon?: string;
  // pathTransformations: PathTransformationConfig[];
  // /**
  //  * Either a string as an existing snippet name
  //  * or an array of strings as lines of a snippet body
  //  */
  // initialContentSnippet?: string[] | string;
};

// type PathTransformationConfig = {
//   testRegex?: string;
//   searchRegex: string;
//   searchRegexFlags?: string;
//   replacementText: string;
// };

export type RawMainConfig = {
  fileTypes: FileTypeConfig[];
  ignorePatterns: string[];
  showDebugLogs?: RawConfig.FileJumper["fileJumper.showDebugLogs"];
  autoJump?: RawConfig.FileJumper["fileJumper.autoJump"];
};

export function formatRawFileTypesConfig(
  /**
   * This is the raw config that is passed in from the user as an object so names are unique
   * but an array is more convenient for the rest of the code
   *
   * @key file type name
   */
  rawFileTypesConfig: RawConfig.FileJumper["fileJumper.fileTypes"] | undefined,
): FileTypeConfig[] {
  if (!rawFileTypesConfig) {
    // apply default config
    // ! don't define this in the "default" for the JSON schema, as this means it will be merged into the custom user config
    // ! we only want to apply this default config if the user has not defined any config
    return [
      {
        name: "Source",
        icon: "💻",
        patterns: [
          "(?<prefix>.+)\\/src\\/(?!\\.test\\.|\\.spec\\.)(?<topic>.+)\\.(js|jsx|ts|tsx)$",
        ],
      },
      {
        name: "Test",
        icon: "🧪",
        patterns: ["(?<prefix>.+)\\/test\\/(?<topic>.+)\\.(test|spec)\\.(js|jsx|ts|tsx)$"],
      },
    ];
  }

  return Object.entries(rawFileTypesConfig).map(([name, rawFileTypeConfig]) => {
    return {
      ...rawFileTypeConfig,
      name, // name is not in the raw config, so we add it here
      // we expect these to be defined but we add defaults just in case, as the JSON schema does not enforce them
      icon: rawFileTypeConfig.icon ?? "❓",
      patterns: rawFileTypeConfig.patterns ?? [],
    };
  });
}

export function formatRawIgnorePatternsConfig(
  rawConfig: RawConfig.FileJumper["fileJumper.ignorePatterns"] | undefined,
): string[] {
  if (!rawConfig) {
    return ["\\/node_modules\\/"]; // default ignore node_modules
  }
  return rawConfig;
}

export function mainConfigsAreEqual(
  a: RawMainConfig | undefined,
  b: RawMainConfig | undefined,
): boolean {
  return !!a && JSON.stringify(a) === JSON.stringify(b);
}

/**
 * This focuses on issues the JSON schema cant catch, important, or are easy to validate
 *
 * @remark This produces a clearer message in the editor about an issue which prevents the extension working
 * compared to the JSON schema warnings shown only when the settings are open
 */
export function getIssuesWithMainConfig(mainConfig: RawMainConfig): string[] {
  const issues: string[] = [];

  if (mainConfig.fileTypes.length < 2) {
    issues.push("There must be at least 2 file types defined");
  }

  return issues;
}

/**
 * @remark This does not verify that the output path is a valid path
 */
export function applyPathTransformations({
  sourcePath,
  transformations,
}: {
  sourcePath: string;
  transformations: PathTransformation[];
}): string {
  return transformations.reduce((output, transformation) => {
    if (transformation.testRegex && !transformation.testRegex.test(output)) {
      return output; // transformation should not be applied to this path
    }

    if (!transformation.groupFormats) {
      if (typeof transformation.replacementText !== "string") {
        return output;
      }
      // no group formats, so just replace the search regex with the replacement text
      return output.replace(transformation.searchRegex, transformation.replacementText);
    }

    if (typeof transformation.replacementText === "string") {
      // replace groups with placeholders, so we can format the groups later
      const formattedReplacementText = transformation.replacementText.replace(
        /(\$\d+)/,
        (match) => {
          const groupIndex = match.replace("$", "");
          const { start, end } = createGroupPlaceholderMarkers(Number(groupIndex));
          return `${start}${match}${end}`;
        },
      );

      output = output.replace(transformation.searchRegex, formattedReplacementText);

      // replace group placeholders with actual group values and formats
      return output.replace(
        /<<GROUP-(\d+)>>(.*)<%<%GROUP-\1>>/g,
        (textWithMarkers, groupIndex: string, text: string) => {
          const targetGroupFormat = transformation.groupFormats?.[Number(groupIndex)];
          if (!targetGroupFormat) {
            return text;
          }
          return applyFormat(text, targetGroupFormat);
        },
      );
    }

    const execResult = transformation.searchRegex.exec(output);
    if (!execResult) {
      return output;
    }

    // no replacement text, so just replace groups with their formatted values
    // NOTE: replacing backwards so the indices of the groups don't change as we replace them
    for (let i = execResult.length - 1; i >= 1; i--) {
      const originalText = execResult[i];
      const targetFormat = transformation.groupFormats[i];
      const formattedText = applyFormat(originalText, targetFormat);
      const [startIndex, endIndex] = execResult.indices![i];
      output = output.slice(0, startIndex) + formattedText + output.slice(endIndex);
    }

    return output;
  }, sourcePath);
}

function createGroupPlaceholderMarkers(index: number): { start: string; end: string } {
  return {
    start: `<<GROUP-${index}>>`,
    end: `<%<%GROUP-${index}>>`,
  };
}

type FormatType = RawConfig.GroupFormats[string];

function applyFormat(rawText: string, targetFormat: FormatType): string {
  // NOTE: rawText could be multiple segments of a path, so we need to apply the format to each segment to maintain the path structure
  return rawText.replace(/\w+/g, (segment) => {
    switch (targetFormat) {
      case "lowercase":
        return segment.toLowerCase();

      case "UPPERCASE":
        return segment.toUpperCase();

      case "PascalCase":
        return startCase(segment).replace(/\s/g, "");

      case "camelCase":
        return camelCase(segment);

      case "snake_case":
        return snakeCase(segment);

      case "kebab-case":
        return kebabCase(segment);

      default: {
        targetFormat satisfies never;
        throw new Error(`Unknown format type: ${targetFormat}`);
      }
    }
  });
}
