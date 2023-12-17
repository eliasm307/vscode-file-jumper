// @ts-check
/* eslint-disable no-console */
console.log("START sync-readme.js");

const fs = require("fs");
const path = require("path");
const escapeRegExp = require("lodash.escaperegexp");
const packageJson = require("../../package.json");

async function main() {
  const rootDir = path.join(__dirname, "..", "..");
  const readmePath = path.join(rootDir, "README.md");
  const readmeText = fs.readFileSync(readmePath, "utf8");

  const jsonschema2md = await import("json-schema-to-markdown").then((m) => m.default);

  const markdown = jsonschema2md(packageJson.contributes.configuration);
  console.log("jsonschema2md", markdown);

  fs.writeFileSync(path.join(rootDir, "example.md"), markdown || "", "utf8");

  const latestFilesWatcherExcludeConfig = {
    "files.watcherExclude": packageJson.contributes.configurationDefaults["files.watcherExclude"],
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
    console.log("No files.watcherExclude code block found in README.md using regex:\n", regex);
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

  const { spawn } = require("child_process");
  // eslint-disable-next-line no-inner-declarations
  async function runGit(args, options) {
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
