import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    exclude: ["node_modules/**/*", "**/exampleStructure/**/*", "out/**/*", "**/test/**/*"],
    /** @see https://vitest.dev/api/mock.html#mockrestore */
    restoreMocks: true,
    chaiConfig: {
      includeStack: true,
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
