// todo test

export type FileTypeConfig = {
  name: string;
  marker: string;
  regex: string[];
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
  ignoreRegexs: string[];
};

export function mainConfigsAreEqual(a: MainConfig, b: MainConfig): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/** This focuses on issues the JSON schema cant catch */
export function getIssuesWithMainConfig(mainConfig: MainConfig): string[] {
  const issues: string[] = [];

  if (mainConfig.fileTypes.length < 2) {
    issues.push("There must be at least 2 file types defined");
  }

  const usedFileTypeNamesSet = new Set<string>();
  const duplicatedFileTypeNamesSet = new Set<string>();
  mainConfig.fileTypes.forEach((fileTypeConfig) => {
    const isUsed = usedFileTypeNamesSet.has(fileTypeConfig.name);
    if (isUsed) {
      duplicatedFileTypeNamesSet.add(fileTypeConfig.name);
    }
    usedFileTypeNamesSet.add(fileTypeConfig.name);
  });

  if (duplicatedFileTypeNamesSet.size) {
    const duplicatedFileTypeNames = Array.from(duplicatedFileTypeNamesSet).join(", ");
    issues.push(`The following file type names are not unique: ${duplicatedFileTypeNames}`);
  }

  return issues;
}
