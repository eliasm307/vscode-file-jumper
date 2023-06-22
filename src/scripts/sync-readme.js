console.log("START sync-readme.js");

const fs = require("fs");
const path = require("path");
const escapeRegExp = require("lodash.escaperegexp");

const readmePath = path.join(__dirname, "..", "..", "README.md");
const readmeText = fs.readFileSync(readmePath, "utf8");

const packageJsonPath = path.join(__dirname, "..", "..", "package.json");
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));

const latestFilesWatcherExcludeConfig = {
  "files.watcherExclude":
    packageJson.contributes.configurationDefaults["files.watcherExclude"],
};

if (
  !latestFilesWatcherExcludeConfig ||
  !Object.keys(latestFilesWatcherExcludeConfig).length
) {
  throw Error("No files.watcherExclude config found in package.json");
}

const BLOCK_START_COMMENT =
  "<!-- START AUTO-GENERATED: files.watcherExclude default code block -->";
const BLOCK_END_COMMENT =
  "<!-- END AUTO-GENERATED: files.watcherExclude default code block -->";

const regex = new RegExp(
  `${escapeRegExp(BLOCK_START_COMMENT)}.+${escapeRegExp(BLOCK_END_COMMENT)}`,
  "s",
);

if (!regex.test(readmeText)) {
  console.log(
    "No files.watcherExclude code block found in README.md using regex:\n",
    regex,
  );
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

fs.writeFileSync(readmePath, newReadmeText, "utf8");

console.log("END sync-readme.js");
