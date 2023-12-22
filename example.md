## File Jumper

Type: `object`

Main configuration

Properties:

- `fileJumper.fileTypes` (type: `FileTypesMap`) - **REQUIRED** - Defines the file types in a project that will be evaluated for co-location linking.

**NOTE** The property keys are the names of the file type matched by the pattern, which will be used in the UI

- `fileJumper.autoJump` (type: `boolean`) - Whether to automatically jump to the file when there is only one match
- `fileJumper.ignorePatterns` (type: `array`) - Defines the RegEx patterns of files to ignore when determining file links
- `fileJumper.showDebugLogs` (type: `boolean`) - Whether to show logs in the output channel

## FileTypesMap

Type: `object`

Defines the file types in a project that will be evaluated for co-location linking.

**NOTE** The property keys are the names of the file type matched by the pattern, which will be used in the UI

Properties:

- With name matching regex `.+` (type: `FileType`) - Defines a file type, which represents a group of files that serve a specific purpose, e.g. test files, and different file types can then be linked together.

## FileType

Type: `object`

Defines a file type, which represents a group of files that serve a specific purpose, e.g. test files, and different file types can then be linked together.

Properties:

- `icon` (type: `string`) - **REQUIRED** - An icon character (e.g. an emoji) to show as badges in the file explorer on files related to this type of file
- `patterns` (type: `array`) - **REQUIRED** - RegEx patterns (case insensitive) that should match relevant files and capture the part of the path that will be constant for sibling pattern group items (aka the topic).

The topic capture group is defined as a group named 'topic' (for example `\\/(test|tests)\\/(?<topic>.+)\\.test\\.ts$`).

**NOTES**

1. This should only match 1 related file type, if multiple can be matched then they should be defined as separate types.
2. This will be used to evaluate files and also folder paths, so an extension should be included if possible to prevent matching folders.
3. The patterns are evaluated in the order they are defined, so more specific patterns should be defined first.
4. The patterns are evaluated against the full path, not relative to the workspace root.
5. The patterns are case sensitive, so `(?i)` is not required.
6. Paths are normalised to use "/".

For structures which repeat folder paths in different locations, a prefix can also be captured which will be used for matching related files e.g. `(?<prefix>.*)\\/(test|tests)\\/(?<topic>.+)\\.test\\.ts$`

- `onlyLinkTo` (type: `array`) - (**OPTIONAL**) The names of other file types that this file type produces links to.

By default (ie when not defined), all file types can be linked to all other file types.

**NOTE** Setting this to an empty array will prevent this file type from being related to any other file types, ie it will not have shortcuts from it but other file types can have shortcuts to it

- `onlyLinkFrom` (type: `array`) - (**OPTIONAL**) The names of other file types that can link to this file type.

By default (when not defined), all file types can be linked to all other file types.

**NOTE** Setting this to an empty array will prevent other files from linking to this file type, ie it will not have shortcuts to it but it can have shortcuts to other file types

- `ignoreNonAlphaNumericCharacters` (type: `boolean`) - (**OPTIONAL**) Whether to ignore non-alphanumeric characters when matching file name topics.

By default (when not defined), non-alphanumeric characters are not ignored.

**NOTE** This is useful for matching files with names that include special characters, such as `@` or `-`

- `creationPatterns` (type: `array`) - [No description provided.]
