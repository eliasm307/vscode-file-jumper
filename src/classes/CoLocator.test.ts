import { describe, it, assert, afterEach, beforeEach } from "vitest";
import CoLocator from "./CoLocator";

describe("CoLocator", () => {
  let coLocator: CoLocator;

  function createDefaultTestCoLocator() {
    return new CoLocator({
      fileTypes: [
        {
          name: "Source",
          marker: "💻",
          regex: ["\\/src\\/(.*)\\.ts$"],
        },
        {
          name: "Test",
          marker: "🧪",
          regex: ["\\/(test|tests)\\/(?<key>.*)\\.test\\.ts$"],
        },
        {
          name: "Documentation",
          marker: "📖",
          regex: ["\\/(docs|docs)\\/(?<key>.*)\\.md$"],
          onlyLinkTo: ["Source"],
        },
      ],
      ignoreRegexs: ["\\/node_modules\\/"],
    });
  }

  afterEach(() => {
    coLocator?.dispose();
  });

  describe("#getFileType", () => {
    it("returns the correct file type", () => {
      coLocator = createDefaultTestCoLocator();
      const sourceFileType = coLocator.getFileType("/src/classes/CoLocator.ts");
      assert.strictEqual(sourceFileType?.name, "Source", "Source file type should be found");

      const testFileType = coLocator.getFileType("/test/classes/CoLocator.test.ts");
      assert.strictEqual(testFileType?.name, "Test", "Test file type should be found");

      const docsFileType = coLocator.getFileType("/docs/classes/CoLocator.md");
      assert.strictEqual(docsFileType?.name, "Documentation", "Docs file type should be found");
    });

    it("should return undefined if the file type is not found", () => {
      coLocator = createDefaultTestCoLocator();

      const unknownFileType = coLocator.getFileType("/unknown/file/path.ts");
      assert.isUndefined(unknownFileType, "Unknown file type should not be found");
    });
  });

  describe("meta data functionality", () => {
    beforeEach(() => {
      coLocator = createDefaultTestCoLocator();
      coLocator.registerFiles([
        // ignored files
        "/root/node_modules/package/src/classes/Entity.ts",
        "/root/node_modules/package/test/classes/Entity.test.ts",
        "/root/node_modules/package/docs/classes/Entity.md",

        // non-ignored files
        "/root/src/classes/Entity.ts",
        "/root/test/classes/Entity.test.ts",
        "/root/test/classes/Entity2.test.ts",
        "/root/docs/classes/Entity.md",
        "/root/unknown/file/path.ts",
        "/root/src/unknown/file/path.ts",
      ]);
    });

    it("returns the correct file meta data with all related files", () => {
      const filePath = "/root/src/classes/Entity.ts";
      const sourceFileMetaData = coLocator.getFileMetaData(filePath);
      assert.strictEqual(
        sourceFileMetaData?.fileType.name,
        "Source",
        "Source file type should be found",
      );
      assert.deepStrictEqual(sourceFileMetaData?.relatedFiles, [
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
      ]);
      assert.deepStrictEqual(
        coLocator.getDecorationData(filePath),
        {
          badgeText: "🧪📖",
          tooltip: "Links: Test + Documentation",
        },
        "correct related file markers found",
      );
    });

    it("returns the correct file meta data with all related files, using helpers", () => {
      const filePath = "/root/src/classes/Entity.ts";
      assert.strictEqual(
        coLocator.getFileType(filePath)?.name,
        "Source",
        "Source file type should be found",
      );
      assert.deepStrictEqual(coLocator.getRelatedFiles(filePath), [
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
      ]);
    });

    it("returns correct file meta data with no related files", () => {
      const filePath = "/root/test/classes/Entity2.test.ts";
      const fileMetaData = coLocator.getFileMetaData(filePath);
      assert.strictEqual(fileMetaData?.fileType.name, "Test", "Test file type should be found");
      assert.deepStrictEqual(fileMetaData?.relatedFiles, [], "No related files should be found");
      assert.isUndefined(
        coLocator.getDecorationData(filePath),
        "no decoration data when no related files found",
      );
    });

    it("returns correct file meta data when file is not related to all other possible types", () => {
      const filePath = "/root/docs/classes/Entity.md";
      const fileMetaData = coLocator.getFileMetaData(filePath);
      assert.strictEqual(fileMetaData?.fileType.name, "Documentation", "correct file type found");
      assert.deepStrictEqual(
        fileMetaData?.relatedFiles,
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
        coLocator.getDecorationData(filePath),
        {
          badgeText: "💻",
          tooltip: "Links: Source",
        },
        "correct related file markers found with partial relationship",
      );
    });

    it("allows files to link to other files that dont link back to them", () => {
      const testFileMetaData = coLocator.getFileMetaData("/root/test/classes/Entity.test.ts");
      assert.strictEqual(testFileMetaData?.fileType.name, "Test", "Test file type should be found");
      assert.deepStrictEqual(testFileMetaData?.relatedFiles, [
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
      const ignoredFileMetaData = coLocator.getFileMetaData(
        "/root/node_modules/package/src/classes/Entity.ts",
      );
      assert.isUndefined(ignoredFileMetaData, "Ignored file should not be found");
    });

    it("should return undefined if the file doesn't exist/isn't registered", () => {
      const unknownFileMetaData = coLocator.getFileMetaData("/root/unknown/file/path.ts");
      assert.isUndefined(unknownFileMetaData, "Unknown file should not be found");
    });
  });

  describe("#reset", () => {
    it("should reset all file types", () => {
      coLocator = createDefaultTestCoLocator();
      coLocator.registerFiles([
        "/root/src/classes/Entity.ts",
        "/root/test/classes/Entity.test.ts",
        "/root/test/classes/Entity2.test.ts",
        "/root/docs/classes/Entity.md",
        "/root/unknown/file/path.ts",
        "/root/src/unknown/file/path.ts",
      ]);

      const sourceFilePath = "/root/src/classes/Entity.ts";

      assert.isTrue(
        coLocator.getRelatedFiles(sourceFilePath).length > 0,
        "Files related to Source file should be found",
      );

      coLocator.reset();

      assert.isTrue(
        coLocator.getRelatedFiles(sourceFilePath).length === 0,
        "Files related to Source file should not be found after reset",
      );
    });
  });

  describe("#getFilePathsWithRelatedFiles", () => {
    it("should return all files that have related files", () => {
      coLocator = createDefaultTestCoLocator();
      coLocator.registerFiles([
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
        coLocator.getFilePathsWithRelatedFiles(),
        [
          "/root/src/classes/Entity.ts",
          "/root/test/classes/Entity.test.ts",
          "/root/docs/classes/Entity.md",
        ],
        "correct files found",
      );
    });
  });
});
