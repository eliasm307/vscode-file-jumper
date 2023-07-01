const ecmConfig = require("@eliasm307/config/eslint")({ withPrettier: true, withReact: false });

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
    "@typescript-eslint/no-unsafe-return": "off",
  },
  settings: {
    ...ecmConfig.settings,
    "functional-core": {
      pureModules: ".*",
    },
  },
};
