// @ts-check

import * as fs from "fs";
import * as path from "path";
// @ts-expect-error [no .d.ts]
import * as escapeRegExp from "lodash.escaperegexp";
import type { SpawnOptions } from "child_process";
import { spawn } from "child_process";
import { compile } from "json-schema-to-typescript";
import type { VSCodeJsonSchema } from "./utils/json-schema-to-markdown";
import jsonSchemaToMarkdown from "./utils/json-schema-to-markdown";
import { contributes as vsCodeContributions } from "../../package.json";

/* eslint-disable no-console */
console.log("START sync-readme.js");

async function main() {
  const rootDir = path.join(__dirname, "..", "..");
  const readmePath = path.join(rootDir, "README.md");
  const readmeText = fs.readFileSync(readmePath, "utf8");

  const markdownDocs = jsonSchemaToMarkdown(vsCodeContributions.configuration as VSCodeJsonSchema, {
    rootHeadingLevel: 3,
  });
  // console.log("jsonSchemaToMarkdown", markdown);

  let overallTsTypesText = await compile(vsCodeContributions.configuration as any, "Settings", {
    bannerComment: "",
    format: true,
    ignoreMinAndMaxItems: true,
    unreachableDefinitions: true,
    style: {
      bracketSpacing: false,
      printWidth: 120,
      semi: true,
      singleQuote: false,
      tabWidth: 2,
      trailingComma: "all",
      useTabs: false,
    },
  });

  // add a newline after each type
  overallTsTypesText = overallTsTypesText.replace(/^}$/gm, "}\n").trim().replaceAll("export ", "");

  const output = [
    `## Configuration Overview`,
    "",
    // `This is the configuration for the [VSCode extension](https://marketplace.visualstudio.com/items?itemName=eamodio.gitlens)`,
    // "",
    // `> **Note:** This file is generated from the [package.json](../../package.json) file. Do not edit it directly.`,
    // "",
    // `## Settings`,
    // "",
    "```ts",
    overallTsTypesText,
    "```",
    "",
    markdownDocs,
  ].join("\n");

  fs.writeFileSync(path.join(rootDir, "example.md"), output, "utf8");

  const latestFilesWatcherExcludeConfig = {
    "files.watcherExclude": vsCodeContributions.configurationDefaults["files.watcherExclude"],
  };

  if (!latestFilesWatcherExcludeConfig || !Object.keys(latestFilesWatcherExcludeConfig).length) {
    throw Error("No files.watcherExclude config found in package.json");
  }

  const BLOCK_START_COMMENT =
    "<!-- START AUTO-GENERATED: files.watcherExclude default code block -->";
  const BLOCK_END_COMMENT = "<!-- END AUTO-GENERATED: files.watcherExclude default code block -->";

  const regex = new RegExp(
    `${escapeRegExp(BLOCK_START_COMMENT)}.+${escapeRegExp(BLOCK_END_COMMENT)}`,
    "s",
  );

  if (!regex.test(readmeText)) {
    console.error("No files.watcherExclude code block found in README.md using regex:\n", regex);
    throw Error("No files.watcherExclude code block found in README.md");
  }

  const newReadmeText = readmeText.replace(
    regex,
    [
      BLOCK_START_COMMENT,
      "",
      "```json",
      JSON.stringify(latestFilesWatcherExcludeConfig, null, 2),
      "```",
      "",
      BLOCK_END_COMMENT,
    ].join("\n"),
  );

  if (newReadmeText === readmeText) {
    console.log("No changes to README.md");
    return;
  }

  console.log("Changes found, updating README.md...");
  fs.writeFileSync(readmePath, newReadmeText, "utf8");

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

  console.log("Running git add/commit for README changes...");
  await runGit(["add", "README.md"], { cwd: rootDir });
  await runGit(["commit", "-m", "Auto-Update README"], { cwd: rootDir });
}

main()
  .then(() => console.log("END sync-readme.js"))
  .catch((error) => {
    console.error("ERROR sync-readme.js", error);
    process.exit(1);
  });
