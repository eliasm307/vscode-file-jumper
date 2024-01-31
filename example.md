# FileJumper Configuration

## Types Summary

```ts
/**
 * Main configuration
 */
interface FileJumper {
  "fileJumper.fileTypes": FileTypesMap;
  "fileJumper.autoJump"?: boolean;
  "fileJumper.ignorePatterns"?: string[];
  "fileJumper.showDebugLogs"?: boolean;
}

interface FileTypesMap {
  [k: string]: FileType;
}

/**
 * Defines a file type, which represents a group of files that serve a specific purpose, e.g. test files, and different file types can then be linked together.
 *
 * This interface was referenced by `FileTypesMap`'s JSON-Schema definition
 * via the `patternProperty` ".+".
 */
interface FileType {
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
}

interface CreationPattern {
  name: string;
  icon?: string;
  testRegex?: string;
  /**
   * @minItems 1
   */
  pathTransformations: PathTransformation[];
  initialContentSnippet?: string | string[];
}

interface PathTransformation {
  testRegex?: string;
  searchRegex: string;
  searchRegexFlags?: string;
  replacementText?: string;
  groupFormats?: GroupFormats;
}

/**
 * Keys are the searchRegex capture group numbers (named capture groups not supported) and the values are the standard format to apply to each group
 */
interface GroupFormats {
  /**
   * The standard format to apply to the capture group
   *
   * This interface was referenced by `GroupFormats`'s JSON-Schema definition
   * via the `patternProperty` "\d+".
   */
  [k: string]: "lowercase" | "UPPERCASE" | "PascalCase" | "camelCase" | "snake_case" | "kebab-case";
}
```

## Details

### 🧩 <ins>FileJumper</ins>

Type: `object`

Main configuration.

**NOTE**: Due to a [limitation with VS Code](https://github.com/microsoft/vscode/issues/80243) settings either need to be defined as local settings for each workspace or globally in the user settings for all workspaces, not both. This is because VS Code does not allow the user settings to be overridden by workspace settings and instead deep merges workspace settings into the user settings, which might cause unexpected behavior.

If you want to use custom settings for this extension in each workspace, you will need to remove the the user settings.

#### 🅿️ Property - `FileJumper.fileJumper.fileTypes` (**REQUIRED**)

Type: `FileTypesMap`

An object that defines the file types in a project that will be evaluated for automatic linking.

**NOTE** The property keys are the names of the file type matched by the pattern, which will be used in the UI. The values are objects that define the file type's behavior.

**NOTE**: A Minimum of 2 file type definitions (properties) is required to be able to show links between files.

#### 🅿️ Property - `FileJumper.fileJumper.autoJump` (**OPTIONAL**)

Type: `boolean`

Defines whether the extension should automatically jump to the related file when only one related file is found.

**Default**

```json
true
```

#### 🅿️ Property - `FileJumper.fileJumper.ignorePatterns` (**OPTIONAL**)

Type: `string[]`

Defines the RegEx patterns of files to ignore when determining file links

**Default**

```json
[
  "\\/node_modules\\/"
]
```

**Example**

```json
{
  "fileJumper.ignorePatterns": [
    "\\/node_modules\\/",
    "\\/dist\\/"
  ]
}
```

#### 🅿️ Property - `FileJumper.fileJumper.showDebugLogs` (**OPTIONAL**)

Type: `boolean`

Whether to show logs in the output channel

**Default**

```json
false
```

### 🧩 <ins>FileTypesMap</ins>

Type: `object`

An object that defines the file types in a project that will be evaluated for automatic linking.

**NOTE** The property keys are the names of the file type matched by the pattern, which will be used in the UI. The values are objects that define the file type's behavior.

**NOTE**: A Minimum of 2 file type definitions (properties) is required to be able to show links between files.

#### Any property with key matching regex `.+`

Type: `FileType`

Defines a file type, which represents a group of files that serve a specific purpose, e.g. test files, and different file types can then be linked together.

### 🧩 <ins>FileType</ins>

Type: `object`

Defines a file type, which represents a group of files that serve a specific purpose, e.g. test files, and different file types can then be linked together.

#### 🅿️ Property - `FileType.icon` (**REQUIRED**)

Type: `string`

An icon character (e.g. an emoji) to show as badges in the file explorer on files related to this type of file

#### 🅿️ Property - `FileType.patterns` (**REQUIRED**)

Type: `string[]`

RegEx patterns (case insensitive) that should match relevant files and capture the part of the path that will be constant for sibling pattern group items (aka the topic).

This extension uses RegEx for matching file paths, instead of glob patterns, to allow for more flexibility in the rules that can be defined.

The topic capture group is defined as a group named 'topic' (for example `\\/(test|tests)\\/(?<topic>.+)\\.test\\.ts$`).

**NOTES**

1. This should only match 1 related file type, if multiple can be matched then they should be defined as separate types.
2. This will be used to evaluate files and also folder paths, so an extension should be included if possible to prevent matching folders.
3. The patterns are evaluated in the order they are defined, so more specific patterns should be defined first.
4. The patterns are evaluated against the full path, not relative to the workspace root.
5. The patterns and comparisons between paths are case insensitive.
6. Paths are normalised to use "/".

For project structures which repeat prefix folder paths in different locations (e.g. `.../projectA/src/components/Button.ts` linking to `.../projectA/tests/components/Button.test.ts` where the `.../projectA` folder path is repeated but should not link to files in `.../projectB`), a prefix can also be captured which will be used for matching related files e.g. `(?<prefix>.*)\\/(test|tests)\\/(?<topic>.+)\\.test\\.ts$`

**Patterns and Links**

The extension requires defined RegEx patterns to capture specific named groups from file paths which will be used to determine if files of different types are related. The named groups that can be matched are:

- `topic`: This represents the part of the file path that is repeated for related files. For example, a file `src/components/Button.ts`, the topic could be `components/Button` which could be used to match a test file `test/components/Button.test.ts`. The example configuration below shows example file type definitions that can achieve this link.
- `prefix`: (**OPTIONAL**) This represents the the root path and can be used to differentiate between files with a similar structure but from different root folders (e.g. a mono-repo) e.g. `packages/PackageA/src/components/Button.ts` and `packages/PackageB/test/components/Button.test.ts` would have a link if a prefix capture group is not defined. If your project does not have this structure, you can omit this capture group.

Multiple patterns can be defined and these are evaluated in the given order, where the first match is used. This allows for more complex folder structures and exceptions to rules to be supported. This means more specific patterns should be defined first so they can match their specific cases before more general patterns are evaluated.

The extension will automatically link all files of different types that resolve to the same topic and prefix (if defined). You can customise which files can link to/from other files by using the `onlyLinkTo` and `onlyLinkFrom` properties.

For building Regex patterns easily try [RegExr](https://regexr.com/) which has a handy cheat sheet, live evaluation, and lets you test your patterns against multiple strings (paths) at the same time.

**Example**

```json
{
  "fileJumper.fileTypes": {
    "Test": {
      "icon": "🧪",
      "patterns": [
        "(?<prefix>.+)\\/(test|tests)\\/(?<topic>.+)\\.(test|spec)\\.ts$"
      ]
    },
    "Source": {
      "icon": "📄",
      "patterns": [
        "(?<prefix>.+)\\/src\\/(?<topic>.+)\\.ts$"
      ]
    }
  }
}
```

#### 🅿️ Property - `FileType.onlyLinkTo` (**OPTIONAL**)

Type: `string[]`

The names of other file types that this file type produces links to.

By default (ie when not defined), all file types can be linked to all other file types.

**NOTE** Setting this to an empty array will prevent this file type from being related to any other file types, ie it will not have shortcuts from it but other file types can have shortcuts to it

#### 🅿️ Property - `FileType.onlyLinkFrom` (**OPTIONAL**)

Type: `string[]`

The names of other file types that can link to this file type.

By default (when not defined), all file types can be linked to all other file types.

**NOTE** Setting this to an empty array will prevent other files from linking to this file type, ie it will not have shortcuts to it but it can have shortcuts to other file types

#### 🅿️ Property - `FileType.ignoreNonAlphaNumericCharacters` (**OPTIONAL**)

Type: `boolean`

Whether to ignore non-alphanumeric characters when matching file name `topic` capture groups.

By default (when not defined), non-alphanumeric characters are not ignored.

**NOTE** This is useful for matching files with names that include special characters, such as `@` or `-`

This is useful for matching files with the same name but different naming styles (e.g. `kebab-case`, `camelCase`, `snake_case`).

**Default**

```json
false
```

#### 🅿️ Property - `FileType.creationPatterns` (**OPTIONAL**)

Type: `CreationPattern[]`

Defines the creation patterns for this file type, which will be used to generate new files.

**NOTE** The creation patterns are evaluated in the order they are defined.

### 🧩 <ins>CreationPattern</ins>

Type: `object`

Defines a creation pattern, which represents a way to generate new files.

#### 🅿️ Property - `CreationPattern.name` (**REQUIRED**)

Type: `string`

The name of the creation pattern, which will be used in the UI

#### 🅿️ Property - `CreationPattern.icon` (**OPTIONAL**)

Type: `string`

An icon character (e.g. an emoji) to show as badges in the file explorer on files related to this type of file

#### 🅿️ Property - `CreationPattern.testRegex` (**OPTIONAL**)

Type: `string`

A RegEx pattern that will be run against a source file path to determine if this transformation should be used.

**NOTE** RegEx is case insensitive

#### 🅿️ Property - `CreationPattern.pathTransformations` (**REQUIRED**)

Type: `PathTransformation[]`

Defines the transformations to apply to the source file path to generate the new file path.

**NOTE** The transformations are applied to the source path in the order they are defined.

#### 🅿️ Property - `CreationPattern.initialContentSnippet` (**OPTIONAL**)

Type: `string | string[]`

The [VS Code snippet](https://code.visualstudio.com/docs/editor/userdefinedsnippets) used to define the initial content of the new file, where the snippet can be defined as either:

- An inline snippet, which is defined as an array of lines
- A reference to an existing snippet, which is defined as a string with the name of the snippet

**NOTE** If the snippet is defined as an inline snippet, it can use any of the available [VS Code Snippet syntax](https://code.visualstudio.com/docs/editor/userdefinedsnippets#_snippet-syntax).

**NOTE** If the snippet is defined as a reference to an existing snippet, the snippet must be defined in your `User Snippets` correctly.

### 🧩 <ins>PathTransformation</ins>

Type: `object`

Defines a path transformation, which represents a way to transform a source file path to generate a new file path.

#### 🅿️ Property - `PathTransformation.testRegex` (**OPTIONAL**)

Type: `string`

A RegEx pattern that will be run against a source file path to determine if this transformation should be used.

#### 🅿️ Property - `PathTransformation.searchRegex` (**REQUIRED**)

Type: `string`

A RegEx pattern that will be run against a source file path along with `replacementText` to replace parts of the source file path and generate the new file path.

**NOTE** The pattern is evaluated against the full path, not relative to the workspace root.

#### 🅿️ Property - `PathTransformation.searchRegexFlags` (**OPTIONAL**)

Type: `string`

The flags to use when evaluating the `searchRegex` pattern

#### 🅿️ Property - `PathTransformation.replacementText` (**OPTIONAL**)

Type: `string`

The text to replace matched text in the source file path after the `searchRegex` is run, in order to generate the new file path.

The text can include capture groups from the `searchRegex` pattern, which will be replaced with the captured text.

#### 🅿️ Property - `PathTransformation.groupFormats` (**OPTIONAL**)

Type: `GroupFormats`

Defines the formats to apply to the capture groups from the `searchRegex` pattern, which will be used to replace the capture groups before being used in the `replacementText`.

Keys are the `searchRegex` capture group names and the values are the format to apply to each group

**NOTE** This does not support named capture groups.

**Example**

```json
{
  "searchRegex": "src\\/.+\\/(\\w+)\\/.ts$",
  "groupFormats": {
    "1": "PascalCase",
    "2": "snake_case"
  }
}
```

### 🧩 <ins>GroupFormats</ins>

Type: `object`

Defines the formats to apply to the capture groups from the `searchRegex` pattern, which will be used to replace the capture groups before being used in the `replacementText`.

Keys are the `searchRegex` capture group names and the values are the format to apply to each group

**NOTE** This does not support named capture groups.

#### Any property with key matching regex `\d+`

Type: `string`

The standard format to apply to the capture group

**Example**

```json
{
  "searchRegex": "src\\/.+\\/(\\w+)\\/.ts$",
  "groupFormats": {
    "1": "PascalCase",
    "2": "snake_case"
  }
}
```

### 🧩 <ins>files.watcherExclude</ins>

Type: `object`

For handling file system changes, the extension uses the VSCode file watcher to watch files in a workspace, however this can be resource intensive if there are a lot of files.

This setting defines the files and folders to exclude from the file watcher, to improve performance. Note, this is a native VS Code setting and is not specific to this extension. See the defaults for this option in the [VS Code Default Config](https://code.visualstudio.com/docs/getstarted/settings#_default-settings).

The option format is an object where the keys are glob patterns to ignore and the keys are booleans defining whether to ignore the patterns.

#### Any property with key matching regex `.*`

Type: `boolean`

Whether the file watcher should ignore the pattern.

**Default**

```json
{
  "**/.git/objects/**": true,
  "**/.git/subtree-cache/**": true,
  "**/.hg/store/**": true,
  "**/node_modules/**": true,
  "**/dist/**": true,
  "**/out/**": true,
  "**/build/**": true,
  "**/coverage/**": true,
  "**/.next/**": true,
  "**/.yarn/**": true
}
```
