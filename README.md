# File Jumper 🦘: Intelligent File Navigation for VSCode

File Jumper is a handy VSCode extension that simplifies navigation between related files in your workspace. It detects and helps you quickly jump to associated files, based on your own rules, making your workflow more efficient.

![Example usages of File Jumper from file explorer and tab title](images/Code_OE6e7ystam.gif)

## Key features

- 🚀 Dynamically detects related files based on user configuration.
- 👁️ Visualizes related files with customizable icons, e.g. whether a file has tests.
- 🔄 Updates file links when workspace folders, files, or configuration changes.
- 🎨 Uses customizable RegEx patterns to accommodate complex folder structures and relations.

Try File Jumper today and experience a smoother, more connected file navigation experience in VSCode! 🚀

# Installation

Install the extension from the [VSCode Marketplace](https://marketplace.visualstudio.com/items?itemName=ecm.file-jumper) or by searching for "File Jumper" in the VSCode extensions panel.

# Configuration

Customize the extension's behavior by modifying the following settings in your VSCode `settings.json`.

The extension will automatically detect changes to the configuration and update the file links accordingly.

![Example of extension reacting to configuration updates](images/Code_vnZxRMrpTg.gif)

### **Patterns and Links**

The extension requires defined RegEx patterns to capture specific named groups from file paths which will be used to determine if files of different types are related. The named groups that can be matched are:

- `topic`: This represents the part of the file path that is repeated for related files. For example, a file `src/components/Button.ts`, the topic could be `components/Button` which could be used to match a test file `test/components/Button.test.ts`. The example configuration below shows example file type definitions that can achieve this link.
- `prefix`: (**OPTIONAL**) This represents the the root path and can be used to differentiate between files with a similar structure but from different root folders (e.g. a mono-repo) e.g. `packages/PackageA/src/components/Button.ts` and `packages/PackageB/test/components/Button.test.ts` would have a link if a prefix capture group is not defined. If your project does not have this structure, you can omit this capture group.

Multiple patterns can be defined and these are evaluated in the given order, where the first match is used. This allows for more complex folder structures and exceptions to rules to be supported. This means more specific patterns should be defined first so they can match their specific cases before more general patterns are evaluated.

The extension will automatically link all files of different types that resolve to the same topic and prefix (if defined). You can customise which files can link to/from other files by using the `onlyLinkTo` and `onlyLinkFrom` properties.

**NOTE**: Path comparisons are case-insensitive.

**NOTE**: For building Regex patterns easily try [RegExr](https://regexr.com/) which has a handy cheat sheet, live evaluation, and lets you test your patterns against multiple strings (paths) at the same time.

## files.watcherExclude

**Default**:

<!-- START AUTO-GENERATED: files.watcherExclude default code block -->

```json
{
  "files.watcherExclude": {
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
}
```

<!-- END AUTO-GENERATED: files.watcherExclude default code block -->

# Usage

To use File Jumper, simply right-click on a file in the file explorer panel or on a file tab which has one of the icons from your configuration (which shows it has links to other files) and select "Jump to...".

You'll be presented with a list of related files, which you can quickly filter and select. The chosen file will open in a new tab.

# Realistic Examples

## Eslint

The [Eslint](https://github.com/eslint/eslint) project has the perfect structure to demonstrate the power of File Jumper. It is very organised and consistently named with:

- a `lib` folder containing the source code
- a `tests` folder containing the tests
- a `docs` folder containing the documentation

Where the file structure in those root folders are the same, except for the prefix, which makes it easy to define patterns for linking those files together.

Here is an example configuration for the Eslint project (note: the prefix capture group isn't required here as the file structure isn't nested):

```json
{
  "fileJumper.fileTypes": {
    "Source Code": {
      "icon": "💻",
      "patterns": ["(?<!\\/tests\\/)lib\\/(?<topic>.+)\\.(js|jsx|ts|tsx)$"]
    },
    "Test Code": {
      "icon": "🧪",
      "patterns": ["(?<=\\/tests\\/)lib\\/(?<topic>.+)\\.(js|jsx|ts|tsx)$"]
    },
    "Documentation": {
      "icon": "📃",
      "patterns": ["\\/docs\\/src\\/(?<topic>.+)\\.md$"]
    }
  }
}
```

This configuration and the Eslint project were used to create the demos above.

This creates links between files which are visualised with icons in the file explorer as below (which also makes it easier to identify removed rules without source code or tests):

![Example links for the Eslint project](images/Code_R92Q8aQ94C.gif)

## Rxjs

The [Rxjs](https://github.com/reactivex/rxjs) project is another good example, however in this case there are some naming inconsistencies e.g. there are spec files in `spec/observables/` however the related code for these files are in `src/internal/observable/` (ie the folder goes from a plural to a singular), same issue for the `spec/schedulers/` folder also. However its not an issue and we can still create links between these files by taking advantage of the flexibility of RegEx.

Here is an example configuration for the Rxjs project (note: the prefix capture group isn't required here as the file structure isn't nested):

```json
{
  "fileJumper.fileTypes": {
    "Source Code": {
      "icon": "💻",
      "patterns": [
        "\\/src\\/internal\\/(observable|scheduler)s?\\/(?<topic>.+)\\.ts$",
        "\\/src\\/internal\\/(?<topic>.+)\\.ts$"
      ]
    },
    "Spec": {
      "icon": "🧪",
      "patterns": [
        "\\/spec\\/(observable|scheduler)s?\\/(?<topic>.+)-spec\\.ts$",
        "\\/spec\\/(?<topic>.+)-spec\\.ts$"
      ]
    }
  }
}
```

In this case we need to define multiple patterns, ie one to match the exceptions first then a fall back pattern for the normal case, which links the files as follows:

![Example links for the Rxjs project](images/Code_ueY1udfzzn.gif)

# Contributing

This project is still in its early stages and any contributions are welcome!

Contribution guide TBC

# References

- Extension icon made by Google Fonts, see [Noto Emoji](https://github.com/googlefonts/noto-emoji) ([image](https://github.com/googlefonts/noto-emoji/blob/main/png/512/emoji_u1f998.png))
