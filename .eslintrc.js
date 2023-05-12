const ecmConfig = require("@eliasm307/config/eslint")({ withPrettier: true });

module.exports = {
  ...ecmConfig,
  root: true,
  parserOptions: {
    ...ecmConfig.parserOptions,
    sourceType: "module",
  },
  ignorePatterns: ["out", "dist", "**/*.d.ts"],
};
