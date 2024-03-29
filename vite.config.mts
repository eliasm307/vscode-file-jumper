import { defineConfig, configDefaults, coverageConfigDefaults } from "vitest/config";

export default defineConfig({
  test: {
    exclude: [
      ...configDefaults.exclude,
      "**/node_modules/**/*",
      "**/exampleStructure/**/*",
      "**/out/**/*",
      "**/test/**/*",
      "**/src/test/**/*", // this is more integration tests
      "**/src/vscode/*",
    ],
    /** @see https://vitest.dev/api/mock.html#mockrestore */
    restoreMocks: true,
    chaiConfig: {
      includeStack: true,
      showDiff: true,
      truncateThreshold: 0,
    },
    cache: {
      dir: "node_modules/.cache/.vitest",
    },
    sequence: { shuffle: true },
    typecheck: {
      checker: "tsc",
    },
    coverage: {
      enabled: true,
      all: false, // don't show untested files
      thresholds: { autoUpdate: true },
    },
  },
});
