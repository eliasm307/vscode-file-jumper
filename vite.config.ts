import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    exclude: ["node_modules/**/*", "**/exampleStructure/**/*", "out/**/*", "**/test/**/*"],
    clearMocks: true,
    chaiConfig: {
      showDiff: true,
      includeStack: true,
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
      thresholdAutoUpdate: true,
    },
  },
});
