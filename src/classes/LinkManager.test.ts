/* eslint-disable no-console */

import { describe, it, assert, afterEach } from "vitest";
import fs from "fs";
import pathModule from "path";
import LinkManager from "./LinkManager";
import type { DecorationData } from "../types";

describe("LinkManager", () => {
  let linkManager: LinkManager;

  function createDefaultTestInstance() {
    return new LinkManager({
      fileTypes: [
        {
          name: "Source",
          marker: "💻",
          patterns: ["\\/src\\/(.*)\\.ts$"],
        },
        {
          name: "Test",
          marker: "🧪",
          patterns: ["\\/(test|tests)\\/(?<key>.*)\\.test\\.ts$"],
        },
        {
          name: "Documentation",
          marker: "📖",
          patterns: ["\\/(docs|docs)\\/(?<key>.*)\\.md$"],
          onlyLinkTo: ["Source"],
        },
        {
          name: "Build Output",
          marker: "📦",
          patterns: ["\\/dist\\/(.*)\\.js$"],
          onlyLinkFrom: ["Source"],
        },
      ],
      ignorePatterns: ["\\/node_modules\\/"],
      showDebugLogs: false,
    });
  }

  const TEST_FILE_TYPE_NAMES = ["Source", "Test", "Documentation", "Build Output"] as const;
  type TestFileTypeName = (typeof TEST_FILE_TYPE_NAMES)[number];

  function assertDecorationDataForPath({
    path,
    expected,
  }: {
    path: string;
    expected: Record<TestFileTypeName, DecorationData | undefined>;
  }) {
    const actual = TEST_FILE_TYPE_NAMES.reduce((out, fileTypeName) => {
      out[fileTypeName] = linkManager.getFileTypeDecoratorData({ path, fileTypeName });
      return out;
    }, {} as Record<TestFileTypeName, DecorationData | undefined>);

    assert.deepStrictEqual(actual, expected, `Decoration data for "${path}" is correct`);
  }

  function registerDefaultFiles() {
    linkManager.addPathsAndNotify([
      // ignored files
      "/root/node_modules/package/src/classes/Entity.ts",
      "/root/node_modules/package/test/classes/Entity.test.ts",
      "/root/node_modules/package/docs/classes/Entity.md",

      // non-ignored files
      "/root/dist/classes/Entity.js",
      "/root/src/classes/Entity.ts",
      "/root/src/classes/Entity2.ts",
      "/root/src/classes/Entity3.ts",
      "/root/test/classes/Entity.test.ts",
      "/root/test/classes/Entity2.test.ts",
      "/root/docs/classes/Entity.md",
      "/root/unknown/file/path.ts",
      "/root/src/unknown/file/path.ts",
    ]);
  }

  afterEach(() => {
    linkManager?.revertToInitial();
    linkManager = undefined as any; // prevent re-use
  });

  describe("meta data functionality", () => {
    it("returns the correct file meta data with all related file decorations", () => {
      linkManager = createDefaultTestInstance();
      registerDefaultFiles();
      const path = "/root/src/classes/Entity.ts";
      assert.deepStrictEqual(linkManager.getLinkedFilesFromPath(path), [
        {
          typeName: "Test",
          marker: "🧪",
          fullPath: "/root/test/classes/Entity.test.ts",
        },
        {
          typeName: "Documentation",
          marker: "📖",
          fullPath: "/root/docs/classes/Entity.md",
        },
        {
          typeName: "Build Output",
          marker: "📦",
          fullPath: "/root/dist/classes/Entity.js",
        },
      ]);

      assertDecorationDataForPath({
        path,
        expected: {
          Source: undefined, // no decoration for own file type
          Test: {
            badgeText: "🧪",
            tooltip: "🧪 Test",
          },
          Documentation: {
            badgeText: "📖",
            tooltip: "📖 Documentation",
          },

          "Build Output": {
            badgeText: "📦",
            tooltip: "📦 Build Output",
          },
        },
      });
    });

    it("returns correct decorations when a path is not linked to all available file types", () => {
      linkManager = createDefaultTestInstance();
      registerDefaultFiles();
      const path = "/root/test/classes/Entity2.test.ts";

      assert.deepStrictEqual(linkManager.getLinkedFilesFromPath(path), [
        {
          typeName: "Source",
          marker: "💻",
          fullPath: "/root/src/classes/Entity2.ts",
        },
        // no Documentation or Build Output
      ]);

      assertDecorationDataForPath({
        path,
        expected: {
          Source: {
            badgeText: "💻",
            tooltip: "💻 Source",
          },
          Test: undefined, // no decoration for own file type
          Documentation: undefined,
          "Build Output": undefined,
        },
      });
    });

    it("returns correct file meta data when file is not linked to all other possible types via onlyLinkTo", () => {
      linkManager = createDefaultTestInstance();
      registerDefaultFiles();
      const path = "/root/docs/classes/Entity.md";

      assert.deepStrictEqual(
        linkManager.getLinkedFilesFromPath(path),
        [
          {
            typeName: "Source",
            marker: "💻",
            fullPath: "/root/src/classes/Entity.ts",
          },
        ],
        "correct related files found",
      );

      assertDecorationDataForPath({
        path,
        expected: {
          Source: {
            badgeText: "💻",
            tooltip: "💻 Source",
          },
          Test: undefined, // source has link to this but not docs
          Documentation: undefined, // no decoration for own file type
          "Build Output": undefined, // source has link to this but not docs
        },
      });
    });

    it("allows files to link to other files that dont link back to them, except if they use onlyLinkFrom", () => {
      linkManager = createDefaultTestInstance();
      registerDefaultFiles();
      const path = "/root/test/classes/Entity.test.ts";

      assert.deepStrictEqual(
        linkManager.getLinkedFilesFromPath(path),
        [
          {
            typeName: "Source",
            marker: "💻",
            fullPath: "/root/src/classes/Entity.ts",
          },
          {
            typeName: "Documentation", // docs dont link to tests but tests link to docs due to onlyLinkFrom
            marker: "📖",
            fullPath: "/root/docs/classes/Entity.md",
          },
          // no Build Output as it is only linked from source
        ],
        "correct related files found",
      );

      assertDecorationDataForPath({
        path,
        expected: {
          Source: {
            badgeText: "💻",
            tooltip: "💻 Source",
          },
          Test: undefined, // no decoration for own file type
          Documentation: {
            badgeText: "📖",
            tooltip: "📖 Documentation",
          },
          "Build Output": undefined, // can only be linked from source
        },
      });
    });

    function assertPathHasNoLinksOrDecoration(path: string): void {
      assert.deepStrictEqual(linkManager.getLinkedFilesFromPath(path), []);

      assertDecorationDataForPath({
        path,
        expected: {
          Source: undefined,
          Test: undefined,
          Documentation: undefined,
          "Build Output": undefined,
        },
      });
    }

    it("does not return file meta data for a file that is ignored", () => {
      linkManager = createDefaultTestInstance();
      registerDefaultFiles();
      const path = "/root/node_modules/package/src/classes/Entity.ts";

      assertPathHasNoLinksOrDecoration(path);
    });

    it("returns correct file meta data with no related files", () => {
      linkManager = createDefaultTestInstance();
      registerDefaultFiles();
      const path = "/root/test/classes/Entity3.ts";

      assertPathHasNoLinksOrDecoration(path);
    });

    it("should return undefined if the file exists but is an unknown type", () => {
      linkManager = createDefaultTestInstance();
      registerDefaultFiles();
      const path = "/root/unknown/file/path.ts";

      assertPathHasNoLinksOrDecoration(path);
    });

    it("should return undefined if the file is not registered/doesn't exist", () => {
      linkManager = createDefaultTestInstance();
      registerDefaultFiles();
      const path = "/root/i-dont-exist/file/path.ts";

      assertPathHasNoLinksOrDecoration(path);
    });

    it("allows linking to multiple related files of the same type", () => {
      linkManager = new LinkManager({
        fileTypes: [
          {
            name: "Source",
            marker: "💻",
            patterns: ["\\/src\\/(.*)\\.ts$"],
          },
          {
            name: "Test",
            marker: "🧪",
            patterns: ["\\/test\\/(.*)\\.test\\.ts$", "\\/test\\/(.*)\\.spec\\.ts$"],
          },
          {
            name: "Build Output",
            marker: "📦",
            patterns: ["\\/dist\\/(.*)\\.map\\.js$", "\\/dist\\/(.*)\\.json$", "\\/dist\\/(.*)\\.js$"],
            onlyLinkFrom: ["Source"],
          },
        ],
        ignorePatterns: ["\\/node_modules\\/"],
        showDebugLogs: false,
      });
      linkManager.addPathsAndNotify([
        "/root/src/classes/Entity.ts",
        "/root/src/classes/Entity2.ts",
        "/root/test/classes/Entity.test.ts",
        "/root/test/classes/Entity.spec.ts",
        "/root/test/classes/Entity2.test.ts",
        "/root/dist/classes/Entity.js",
        "/root/dist/classes/Entity.map.js",
        "/root/dist/classes/Entity.json",
      ]);

      const path = "/root/src/classes/Entity.ts";

      assert.deepStrictEqual(linkManager.getLinkedFilesFromPath(path), [
        {
          typeName: "Test",
          marker: "🧪",
          fullPath: "/root/test/classes/Entity.test.ts",
        },
        {
          typeName: "Test",
          marker: "🧪",
          fullPath: "/root/test/classes/Entity.spec.ts",
        },
        {
          typeName: "Build Output",
          marker: "📦",
          fullPath: "/root/dist/classes/Entity.js",
        },
        {
          typeName: "Build Output",
          marker: "📦",
          fullPath: "/root/dist/classes/Entity.map.js",
        },
        {
          typeName: "Build Output",
          marker: "📦",
          fullPath: "/root/dist/classes/Entity.json",
        },
      ]);

      assertDecorationDataForPath({
        path,
        expected: {
          Source: undefined, // no decoration for own file type
          Test: {
            badgeText: "🧪",
            tooltip: "🧪 Test",
          },
          "Build Output": {
            badgeText: "📦",
            tooltip: "📦 Build Output",
          },
          Documentation: undefined,
        },
      });
    });
  });

  describe("#reset", () => {
    it("should reset all file types", () => {
      linkManager = createDefaultTestInstance();
      linkManager.addPathsAndNotify([
        "/root/src/classes/Entity.ts",
        "/root/test/classes/Entity.test.ts",
        "/root/test/classes/Entity2.test.ts",
        "/root/docs/classes/Entity.md",
        "/root/unknown/file/path.ts",
        "/root/src/unknown/file/path.ts",
      ]);

      const sourcePath = "/root/src/classes/Entity.ts";

      assert.isTrue(
        linkManager.getLinkedFilesFromPath(sourcePath).length > 0,
        "Files related to Source file should be found",
      );

      linkManager.revertToInitial();

      assert.isTrue(
        linkManager.getLinkedFilesFromPath(sourcePath).length === 0,
        "Files related to Source file should not be found after reset",
      );
    });
  });

  describe("#getPathsWithRelatedFiles", () => {
    it("should return all files that have related files", () => {
      linkManager = createDefaultTestInstance();
      linkManager.addPathsAndNotify([
        // ignored files
        "/root/node_modules/package/src/classes/Entity.ts",
        "/root/node_modules/package/test/classes/Entity.test.ts",
        "/root/node_modules/package/docs/classes/Entity.md",

        // non-ignored files
        "/root/src/classes/Entity.ts",
        "/root/src/classes/EntityNoLinks2.ts",
        "/root/test/classes/Entity.test.ts",
        "/root/test/classes/EntityNoLinks1.test.ts",
        "/root/docs/classes/Entity.md",
        "/root/docs/classes/EntityNoLinks3.md",
        "/root/unknown/file/path.ts",
        "/root/src/unknown/file/path.ts",
      ]);

      assert.deepStrictEqual(
        linkManager.getAllPathsWithOutgoingLinks(),
        ["/root/src/classes/Entity.ts", "/root/test/classes/Entity.test.ts", "/root/docs/classes/Entity.md"],
        "correct files found",
      );
    });
  });

  describe("performance", () => {
    function createEslintLinkManager() {
      return new LinkManager({
        fileTypes: [
          {
            name: "Source",
            marker: "💻",
            patterns: ["(?<!\\/tests\\/)lib\\/(.*)\\.(js|jsx|ts|tsx)$"],
          },
          {
            name: "Test",
            marker: "🧪",
            patterns: ["(?<=\\/tests\\/)lib\\/(.*)\\.(js|jsx|ts|tsx)$"],
          },
          {
            name: "Documentation",
            marker: "📙",
            patterns: ["\\/docs\\/src\\/(.+)\\.md$"],
          },
        ],
        ignorePatterns: ["\\/node_modules\\/"],
        showDebugLogs: false,
      });
    }

    type PathToDecorationsMap = Record<string, DecorationData[] | null>;

    it("should be fast and accurate", async () => {
      const eslintPathsPath = pathModule.join(__dirname, "LinkManagerTestData/eslint-project-files.json");
      const eslintPaths = JSON.parse(fs.readFileSync(eslintPathsPath, "utf8")) as string[];
      const fileCount = eslintPaths.length;
      console.log(`Testing ${fileCount} Eslint files`);

      let actualDecorationsMap: PathToDecorationsMap = {};
      Array(3)
        .fill(0)
        .forEach((_, i) => {
          console.log("Running test", i);
          linkManager = createEslintLinkManager();

          // add all the files
          let startTime = Date.now();
          linkManager.addPathsAndNotify(eslintPaths);
          const addPathsDurationMs = Date.now() - startTime;

          console.log(`#addPathsAndNotify actually took`, addPathsDurationMs, `ms`);
          assert.isBelow(addPathsDurationMs, 50, `should take less than 50ms to add ${fileCount} files`);

          // get the decorations for all the files

          actualDecorationsMap = {};
          startTime = Date.now();
          eslintPaths.forEach((path) => {
            TEST_FILE_TYPE_NAMES.forEach((fileTypeName) => {
              const decoration = linkManager.getFileTypeDecoratorData({ path, fileTypeName });
              if (decoration) {
                const pathDecorations = actualDecorationsMap[path] || [];
                pathDecorations.push(decoration);
                actualDecorationsMap[path] = pathDecorations;
              }
            });
          });
          const getDecorationsDurationMs = Date.now() - startTime;
          console.log(`#getDecorations actually took`, getDecorationsDurationMs, `ms`);
          assert.isBelow(
            getDecorationsDurationMs,
            100,
            `should take less than 100ms to get decorations for ${fileCount} files`,
          );

          linkManager.revertToInitial();

          console.log("-".repeat(30), "\n");
        });

      // assert that the actual decorations match the snapshot
      const expectedDecorationsPath = pathModule.join(
        __dirname,
        "LinkManagerTestData/expected-eslint-project-decorations.json",
      );
      const expectedDecorationsSnapshotExists = fs.existsSync(expectedDecorationsPath);
      if (expectedDecorationsSnapshotExists) {
        const actualDecorationsPath = pathModule.join(
          __dirname,
          "LinkManagerTestData/actual-eslint-project-decorations.json",
        );
        fs.writeFileSync(actualDecorationsPath, JSON.stringify(actualDecorationsMap, null, 2));
        const expectedDecorationsMap: PathToDecorationsMap = JSON.parse(
          fs.readFileSync(expectedDecorationsPath, "utf8"),
        );

        // using deep strict equal produces unhelpful diff because the data is large, so we do a manual comparison for each item
        Object.entries(expectedDecorationsMap).forEach(([path, expectedFileDecorations]) => {
          const actualFileDecorations = actualDecorationsMap[path];
          assert.isDefined(actualFileDecorations, `actual decorations for ${path} should exist`);
          assert.deepStrictEqual(
            actualFileDecorations,
            expectedFileDecorations,
            `decorations for "${path}" should match expected`,
          );
        });

        // asserting the total count after so we see any differences first
        assert.strictEqual(
          Object.keys(actualDecorationsMap).length,
          Object.keys(expectedDecorationsMap).length,
          "same number of files should be decorated",
        );
        // create the snapshot file
      } else {
        fs.writeFileSync(expectedDecorationsPath, JSON.stringify(actualDecorationsMap, null, 2), "utf8");
        assert.fail("eslint decorations snapshot file created");
      }
    });
  });
});
