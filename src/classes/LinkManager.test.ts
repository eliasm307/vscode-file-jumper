/* eslint-disable no-console */

import { describe, it, assert, afterEach, beforeEach } from "vitest";
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

  function registerDefaultFiles() {
    linkManager.addPathsAndNotify([
      // ignored files
      "/root/node_modules/package/src/classes/Entity.ts",
      "/root/node_modules/package/test/classes/Entity.test.ts",
      "/root/node_modules/package/docs/classes/Entity.md",

      // non-ignored files
      "/root/dist/classes/Entity.js",
      "/root/src/classes/Entity.ts",
      "/root/test/classes/Entity.test.ts",
      "/root/test/classes/Entity2.test.ts",
      "/root/docs/classes/Entity.md",
      "/root/unknown/file/path.ts",
      "/root/src/unknown/file/path.ts",
    ]);
  }

  afterEach(() => {
    linkManager?.revertToInitial();
  });

  describe("meta data functionality", () => {
    beforeEach(() => {});

    it("returns the correct file meta data with all related files", () => {
      linkManager = createDefaultTestInstance();
      registerDefaultFiles();
      const path = "/root/src/classes/Entity.ts";
      assert.deepStrictEqual(linkManager.getFilesLinkedFromPath(path), [
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

      const actualFileTypes = linkManager.getFileTypes();
      assert.deepStrictEqual(actualFileTypes, [], "returns correct file types");
      assert.deepStrictEqual(
        linkManager.getFileTypeDecoratorData({ path, decoratorFileType: actualFileTypes[0] }),
        {
          badgeText: "🧪📖📦",
          tooltip: "Links: Test + Documentation + Build Output",
        },
        "correct related file markers found",
      );
    });

    it("returns the correct file meta data with all related files, using helpers", () => {
      linkManager = createDefaultTestInstance();
      registerDefaultFiles();
      const path = "/root/src/classes/Entity.ts";
      assert.deepStrictEqual(linkManager.getFilesLinkedFromPath(path), [
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
    });

    it("returns correct file meta data with no related files", () => {
      linkManager = createDefaultTestInstance();
      registerDefaultFiles();
      const path = "/root/test/classes/Entity2.test.ts";
      const fileMetaData = linkManager.getFileMetaData(path);
      assert.strictEqual(fileMetaData?.fileType.name, "Test", "Test file type should be found");
      assert.deepStrictEqual(fileMetaData?.linkedFiles, [], "No related files should be found");
      assert.isUndefined(linkManager.getDecorationData(path), "no decoration data when no related files found");
    });

    it("returns correct file meta data when file is not related to all other possible types via onlyLinkTo", () => {
      linkManager = createDefaultTestInstance();
      registerDefaultFiles();
      const path = "/root/docs/classes/Entity.md";
      const fileMetaData = linkManager.getFileMetaData(path);
      assert.strictEqual(fileMetaData?.fileType.name, "Documentation", "correct file type found");
      assert.deepStrictEqual(
        fileMetaData?.linkedFiles,
        [
          {
            typeName: "Source",
            marker: "💻",
            fullPath: "/root/src/classes/Entity.ts",
          },
        ],
        "correct related files found",
      );
      assert.deepStrictEqual(
        linkManager.getDecorationData(path),
        {
          badgeText: "💻",
          tooltip: "Links: Source",
        },
        "correct related file markers found with partial links",
      );
    });

    it("allows files to link to other files that dont link back to them, except if they use onlyLinkFrom", () => {
      linkManager = createDefaultTestInstance();
      registerDefaultFiles();
      const testFileMetaData = linkManager.getFileMetaData("/root/test/classes/Entity.test.ts");
      assert.strictEqual(testFileMetaData?.fileType.name, "Test", "Test file type should be found");
      assert.deepStrictEqual(testFileMetaData?.linkedFiles, [
        {
          typeName: "Source",
          marker: "💻",
          fullPath: "/root/src/classes/Entity.ts",
        },
        {
          typeName: "Documentation", // docs dont link back to tests
          marker: "📖",
          fullPath: "/root/docs/classes/Entity.md",
        },
      ]);
    });

    it("does not return meta data for ignored file", () => {
      linkManager = createDefaultTestInstance();
      registerDefaultFiles();
      const ignoredFileMetaData = linkManager.getFileMetaData("/root/node_modules/package/src/classes/Entity.ts");
      assert.isUndefined(ignoredFileMetaData, "Ignored file should not be found");
    });

    it("should return undefined if the file doesn't exist/isn't registered", () => {
      linkManager = createDefaultTestInstance();
      registerDefaultFiles();
      const unknownFileMetaData = linkManager.getFileMetaData("/root/unknown/file/path.ts");
      assert.isUndefined(unknownFileMetaData, "Unknown file should not be found");
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
      const fileMetaData = linkManager.getFileMetaData(path);
      assert.strictEqual(fileMetaData?.fileType.name, "Source", "Correct file type should be found");
      assert.deepStrictEqual(fileMetaData?.linkedFiles, [
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
      assert.deepStrictEqual(
        linkManager.getDecorationData(path),
        {
          badgeText: "🧪📦",
          tooltip: "Links: Test + Build Output",
        },
        "correct related file markers found with single entry for multiple linked files",
      );
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
        linkManager.getFilesLinkedFromPath(sourcePath).length > 0,
        "Files related to Source file should be found",
      );

      linkManager.revertToInitial();

      assert.isTrue(
        linkManager.getFilesLinkedFromPath(sourcePath).length === 0,
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

    type DecorationsMap = Record<string, DecorationData | null>;

    it("should be fast and accurate", async () => {
      const eslintPathsPath = pathModule.join(__dirname, "LinkManagerTestData/eslint-project-files.json");
      const eslintPaths = JSON.parse(fs.readFileSync(eslintPathsPath, "utf8")) as string[];
      const fileCount = eslintPaths.length;
      console.log(`Testing ${fileCount} Eslint files`);

      let actualDecorations: DecorationsMap = {};
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

          actualDecorations = {};
          startTime = Date.now();
          eslintPaths.forEach((path) => {
            const decoration = linkManager.getDecorationData(path);
            if (decoration) {
              actualDecorations[path] = decoration;
            }
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
        fs.writeFileSync(actualDecorationsPath, JSON.stringify(actualDecorations, null, 2));
        const expectedDecorations: DecorationsMap = JSON.parse(fs.readFileSync(expectedDecorationsPath, "utf8"));
        assert.deepStrictEqual(actualDecorations, expectedDecorations, "eslint decorations should match expected");

        // create the snapshot file
      } else {
        fs.writeFileSync(expectedDecorationsPath, JSON.stringify(actualDecorations, null, 2), "utf8");
        assert.fail("eslint decorations snapshot file created");
      }
    });
  });
});
