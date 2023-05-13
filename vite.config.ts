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
      dir: ".vitest/cache",
    },
    sequence: { shuffle: true },
    typecheck: {
      checker: "tsc",
    },
  },
});
