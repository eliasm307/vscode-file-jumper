// todo test

export type FileTypeConfig = {
  name: string;
  marker: string;
  patterns: string[];
  /**
   * The names of other file types that this file type produces links to
   *
   * @remark By default (when not defined), all file types can be linked to all other file types
   *
   * @remark Setting this to an empty array will prevent this file type from being related to any other file types, ie it will not have shortcuts from it but other file types can have shortcuts to it
   */
  onlyLinkTo?: string[];
};

export type MainConfig = {
  fileTypes: FileTypeConfig[];
  ignorePatterns: string[];
  showDebugLogs: boolean;
};

/**
 * This is the raw config that is passed in from the user as an object so names are unique
 * but an array is more convenient for the rest of the code
 *
 * @key file type name
 */
type RawFileTypesConfig = Record<string, Omit<FileTypeConfig, "name">>;

export function formatRawFileTypesConfig(rawConfig: RawFileTypesConfig | undefined): FileTypeConfig[] {
  if (!rawConfig) {
    // apply default config
    // ! dont define this in the "default" for the JSON schema, as this means it will be merged into the custom user config
    // ! we only want to apply this default config if the user has not defined any config
    return [
      {
        name: "Source",
        marker: "💻",
        patterns: ["\\/src\\/(?!\\.test\\.|\\.spec\\.)(.+)\\.(js|jsx|ts|tsx)$"],
      },
      {
        name: "Test",
        marker: "🧪",
        patterns: ["\\/test\\/(.+)\\.(test|spec)\\.(js|jsx|ts|tsx)$"],
      },
    ];
  }
  return Object.entries(rawConfig).map(([name, rawFileTypeConfig]) => {
    return {
      ...rawFileTypeConfig,
      name, // name is not in the raw config, so we add it here
    };
  });
}

export function formatRawIgnorePatternsConfig(rawConfig: string[] | undefined): string[] {
  if (!rawConfig) {
    return ["\\/node_modules\\/"]; // default ignore node_modules
  }
  return rawConfig;
}

export function mainConfigsAreEqual(a: MainConfig, b: MainConfig): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/**
 * This focuses on issues the JSON schema cant catch, important, or are easy to validate
 *
 * @remark This produces a clearer message in the editor about an issue which prevents the extension working
 * compared to the JSON schema warnings shown only when the settings are open
 */
export function getIssuesWithMainConfig(mainConfig: MainConfig): string[] {
  const issues: string[] = [];

  if (mainConfig.fileTypes.length < 2) {
    issues.push("There must be at least 2 file types defined");
  }

  return issues;
}
