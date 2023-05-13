const ecmConfig = require("@eliasm307/config/eslint")({ withPrettier: true });

module.exports = {
  ...ecmConfig,
  root: true,
  parserOptions: {
    ...ecmConfig.parserOptions,
    sourceType: "module",
  },
  ignorePatterns: ["out", "dist", "**/*.d.ts"],
  rules: {
    ...ecmConfig.rules,
    "no-console": "warn",
    "import/no-unresolved": ["error", { ignore: ["vscode"] }],
  },
};
