import * as fs from "fs/promises";
import * as path from "path";
import type { SpawnOptions } from "child_process";
import { spawn } from "child_process";
import { compile } from "json-schema-to-typescript";
import { ESLint } from "eslint";
import type { VSCodeJsonSchema } from "./utils/json-schema-to-markdown";
import jsonSchemaToMarkdown from "./utils/json-schema-to-markdown";
import { contributes as vsCodeContributions } from "../../package.json";
// eslint-disable-next-line @typescript-eslint/prefer-ts-expect-error
// @ts-ignore [missing declaration]
import prettierConfig from "../../.prettierrc.cjs";

/* eslint-disable no-console */
console.log("START sync-readme.js");

const ROOT_DIR = path.join(__dirname, "..", "..");
const CONFIGURATION_DOCS_FILE_PATH = path.join(ROOT_DIR, "CONFIGURATION.md");
const GENERATED_TYPES_FILE_PATH = path.join(ROOT_DIR, "src/types/config.generated.ts");

main()
  .then(() => console.log("END sync-readme.js"))
  .catch((error) => {
    console.error("ERROR sync-readme.js", error);
    process.exit(1);
  });

async function main() {
  // generate types and documentation from the configuration
  const { documentationTypes, sourceCodeTypes } = await generateTypesFromConfig();
  const newConfigDocsText = generateConfigMarkdownDocumentation({ documentationTypes });

  // save the generated content to a files
  const results = await Promise.all([
    writeSourceCodeTypesFile(sourceCodeTypes),
    writeConfigDocumentationFile(newConfigDocsText),
  ]);

  if (!results.some(Boolean)) {
    console.log("No changes to documentation or types");
    return;
  }

  console.log("Running git add/commit for generated file changes...");
  await runGit(["add", "."], { cwd: ROOT_DIR });
  await runGit(["commit", "-m", "Re-generate files"], { cwd: ROOT_DIR });
}

async function runGit(args: string[], options: SpawnOptions) {
  return new Promise((resolve, reject) => {
    const git = spawn("git", args, options);
    git.on("close", (code) => {
      if (code === 0) {
        resolve(null);
      } else {
        reject(new Error(`git exited with code ${code}`));
      }
    });
  });
}

function generateConfigMarkdownDocumentation({
  documentationTypes,
}: {
  documentationTypes: string;
}) {
  return [
    "<!-- **Note:** This file is generated from the `package.json` file. Do not edit this manually, instead update package.json.-->",
    "",
    `# FileJumper Configuration`,
    "",
    `This is documentation for the configuration for the [FileJumper VSCode extension](https://marketplace.visualstudio.com/items?itemName=ecm.file-jumper)`,
    "",
    `## Types Summary`,
    "",
    "```ts",
    documentationTypes,
    "```",
    "",
    `## Details`,
    "",
    generateMarkdownDocs(),
    "", // should end with new line
  ].join("\n");
}

function generateMarkdownDocs() {
  const rootHeadingLevel = 3;
  const extensionConfiguration = jsonSchemaToMarkdown(
    vsCodeContributions.configuration as VSCodeJsonSchema,
    {
      rootHeadingLevel,
    },
  );
  const watcherExcludeConfigurationDocs = jsonSchemaToMarkdown(
    {
      type: "object",
      title: "files.watcherExclude",
      markdownDescription: [
        "For handling file system changes, the extension uses the VSCode file watcher to watch files in a workspace, however this can be resource intensive if there are a lot of files.",
        "",
        "This setting defines the files and folders to exclude from the file watcher, to improve performance. Note, this is a native VS Code setting and is not specific to this extension. See the defaults for this option in the [VS Code Default Config](https://code.visualstudio.com/docs/getstarted/settings#_default-settings).",
        "",
        "The option format is an object where the keys are glob patterns to ignore and the keys are booleans defining whether to ignore the patterns.",
        "",
      ].join("\n"),
      patternProperties: {
        ".*": {
          description: "Whether the file watcher should ignore the pattern.",
          type: "boolean",
        },
      },
      default: vsCodeContributions.configurationDefaults["files.watcherExclude"],
    } as VSCodeJsonSchema,
    {
      rootHeadingLevel,
    },
  );

  return [extensionConfiguration, watcherExcludeConfigurationDocs].join("\n\n").trim();
}

async function generateTypesFromConfig() {
  let documentationTypes = await compile(vsCodeContributions.configuration as any, "Settings", {
    bannerComment: "",
    format: true,
    ignoreMinAndMaxItems: true,
    unreachableDefinitions: true,
    style: prettierConfig,
  });

  // add a newline after each type
  documentationTypes = documentationTypes.replace(/^}$/gm, "}\n").trim();

  const sourceCodeTypes = [
    "namespace RawConfig {",
    "",
    documentationTypes,
    "",
    "}",
    "",
    "export default RawConfig;",
  ].join("\n");

  // remove the export keywords
  documentationTypes = documentationTypes.replaceAll("export ", "");

  return { documentationTypes, sourceCodeTypes };
}

async function writeSourceCodeTypesFile(newTypesText: string): Promise<boolean> {
  const currentTypesText = await getFileContents(GENERATED_TYPES_FILE_PATH);
  if (newTypesText === currentTypesText) {
    console.log("No changes to types");
    return false;
  }

  await fs.writeFile(GENERATED_TYPES_FILE_PATH, newTypesText, "utf8");
  await lint(GENERATED_TYPES_FILE_PATH);
  return true;
}

async function lint(filePath: string) {
  const eslint = new ESLint({ fix: true });
  const results = await eslint.lintFiles(filePath);
  await ESLint.outputFixes(results);
  const formatter = await eslint.loadFormatter("stylish");
  const resultText = formatter.format(results);
  console.log(resultText);
}

async function writeConfigDocumentationFile(newConfigDocsText: string): Promise<boolean> {
  const currentConfigDocsText = await getFileContents(CONFIGURATION_DOCS_FILE_PATH);
  if (newConfigDocsText === currentConfigDocsText) {
    console.log("No changes to documentation");
    return false;
  }

  console.log("Changes found, updating documentation...");
  await fs.writeFile(CONFIGURATION_DOCS_FILE_PATH, newConfigDocsText, "utf8");
  return true;
}

async function getFileContents(filePath: string): Promise<string> {
  try {
    const content = await fs.readFile(filePath, "utf8");
    return content;
  } catch (error) {
    return "";
  }
}
