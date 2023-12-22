## Configuration Overview

```ts
/**
 * Main configuration
 */
export interface FileJumperConfiguration {
  "fileJumper.fileTypes": FileTypesMap;
  "fileJumper.autoJump"?: boolean;
  "fileJumper.ignorePatterns"?: string[];
  "fileJumper.showDebugLogs"?: boolean;
}

export interface FileTypesMap {
  [k: string]: FileType;
}

/**
 * This interface was referenced by `FileTypesMap`'s JSON-Schema definition
 * via the `patternProperty` ".+".
 */
export interface FileType {
  icon: string;
  /**
   * @minItems 1
   */
  patterns: string[];
  onlyLinkTo?: string[];
  onlyLinkFrom?: string[];
  ignoreNonAlphaNumericCharacters?: boolean;
  creationPatterns?: CreationPattern[];
}

export interface CreationPattern {
  name: string;
  icon?: string;
  /**
   * @minItems 1
   */
  pathTransformations: {
    testRegex?: string;
    searchRegex: string;
    searchRegexFlags?: string;
    replacementText: string;
  }[];
  initialContentSnippet?: string | string[];
}
```

### <ins>FileJumperConfiguration</ins>

Type: `object`

Main configuration

#### Property - `fileJumper.fileTypes` (**REQUIRED**)

Type: `FileTypesMap`

Defines the file types in a project that will be evaluated for co-location linking.

**NOTE** The property keys are the names of the file type matched by the pattern, which will be used in the UI

#### Property - `fileJumper.autoJump` (**OPTIONAL**)

Type: `boolean`

Whether to automatically jump to the file when there is only one match

#### Property - `fileJumper.ignorePatterns` (**OPTIONAL**)

Type: `array`

Defines the RegEx patterns of files to ignore when determining file links

#### Property - `fileJumper.showDebugLogs` (**OPTIONAL**)

Type: `boolean`

Whether to show logs in the output channel



### <ins>FileTypesMap</ins>

Type: `object`

Defines the file types in a project that will be evaluated for co-location linking.

**NOTE** The property keys are the names of the file type matched by the pattern, which will be used in the UI

#### Property with name matching regex `.+`

Type: `FileType`

Defines a file type, which represents a group of files that serve a specific purpose, e.g. test files, and different file types can then be linked together.



### <ins>FileType</ins>

Type: `object`

Defines a file type, which represents a group of files that serve a specific purpose, e.g. test files, and different file types can then be linked together.

#### Property - `icon` (**REQUIRED**)

Type: `string`

An icon character (e.g. an emoji) to show as badges in the file explorer on files related to this type of file

#### Property - `patterns` (**REQUIRED**)

Type: `array`

RegEx patterns (case insensitive) that should match relevant files and capture the part of the path that will be constant for sibling pattern group items (aka the topic).

The topic capture group is defined as a group named 'topic' (for example `\\/(test|tests)\\/(?<topic>.+)\\.test\\.ts$`).

**NOTES**
1. This should only match 1 related file type, if multiple can be matched then they should be defined as separate types.
2. This will be used to evaluate files and also folder paths, so an extension should be included if possible to prevent matching folders.
3. The patterns are evaluated in the order they are defined, so more specific patterns should be defined first.
4. The patterns are evaluated against the full path, not relative to the workspace root.
5. The patterns are case sensitive, so `(?i)` is not required.
6. Paths are normalised to use "/".

For structures which repeat folder paths in different locations, a prefix can also be captured which will be used for matching related files e.g. `(?<prefix>.*)\\/(test|tests)\\/(?<topic>.+)\\.test\\.ts$`

#### Property - `onlyLinkTo` (**OPTIONAL**)

Type: `array`

(**OPTIONAL**) The names of other file types that this file type produces links to.

By default (ie when not defined), all file types can be linked to all other file types.

**NOTE** Setting this to an empty array will prevent this file type from being related to any other file types, ie it will not have shortcuts from it but other file types can have shortcuts to it

#### Property - `onlyLinkFrom` (**OPTIONAL**)

Type: `array`

(**OPTIONAL**) The names of other file types that can link to this file type.

By default (when not defined), all file types can be linked to all other file types.

**NOTE** Setting this to an empty array will prevent other files from linking to this file type, ie it will not have shortcuts to it but it can have shortcuts to other file types

#### Property - `ignoreNonAlphaNumericCharacters` (**OPTIONAL**)

Type: `boolean`

(**OPTIONAL**) Whether to ignore non-alphanumeric characters when matching file name topics.

By default (when not defined), non-alphanumeric characters are not ignored.

**NOTE** This is useful for matching files with names that include special characters, such as `@` or `-`

#### Property - `creationPatterns` (**OPTIONAL**)

Type: `array`

(**OPTIONAL**) Defines the creation patterns for this file type, which will be used to generate new files.

**NOTE** The creation patterns are evaluated in the order they are defined.

