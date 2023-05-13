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
          regex: "\\/src\\/(.*)\\.ts$",
        },
        {
          name: "Test",
          marker: "🧪",
          regex: "\\/(test|tests)\\/(?<key>.*)\\.test\\.ts$",
        },
        {
          name: "Documentation",
          marker: "📖",
          regex: "\\/(docs|docs)\\/(?<key>.*)\\.md$",
          onlyLinkTo: ["Source"],
        },
      ],
      ignoreRegexs: ["\\/node_modules\\/"],
    });
  }

  afterEach(() => {
    coLocator?.reset();
  });

  describe("#initWorkspaceFiles", () => {
    it("should register files", () => {
      assert.fail("not implemented");
    });
  });

  describe("#getFileType", () => {
    it("returns the correct file type", () => {
      coLocator = createDefaultTestCoLocator();
      const sourceFileType = coLocator.getFileType("/src/classes/CoLocator.ts");
      assert.strictEqual(sourceFileType?.config.name, "Source", "Source file type should be found");

      const testFileType = coLocator.getFileType("/test/classes/CoLocator.test.ts");
      assert.strictEqual(testFileType?.config.name, "Test", "Test file type should be found");

      const docsFileType = coLocator.getFileType("/docs/classes/CoLocator.md");
      assert.strictEqual(
        docsFileType?.config.name,
        "Documentation",
        "Docs file type should be found",
      );
    });

    it("should return undefined if the file type is not found", () => {
      coLocator = createDefaultTestCoLocator();

      const unknownFileType = coLocator.getFileType("/unknown/file/path.ts");
      assert.isUndefined(unknownFileType, "Unknown file type should not be found");
    });
  });

  describe("#getFileMetaData", () => {
    beforeEach(() => {
      coLocator = createDefaultTestCoLocator();
      coLocator.initWorkspaceFiles([
        "/root/node_modules/package/src/classes/Entity.ts",
        "/root/node_modules/package/test/classes/Entity.test.ts",
        "/root/node_modules/package/docs/classes/Entity.md",
        "/root/src/classes/Entity.ts",
        "/root/test/classes/Entity.test.ts",
        "/root/test/classes/Entity2.test.ts",
        "/root/docs/classes/Entity.md",
        "/root/unknown/file/path.ts",
        "/root/src/unknown/file/path.ts",
      ]);
    });

    it("returns the correct file meta data with all related files", () => {
      const sourceFileMetaData = coLocator.getFileMetaData("/root/src/classes/Entity.ts");
      assert.strictEqual(
        sourceFileMetaData?.fileType.config.name,
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
    });

    it("returns correct file meta data with no related files", () => {
      const testFileMetaData = coLocator.getFileMetaData("/root/test/classes/Entity2.test.ts");
      assert.strictEqual(
        testFileMetaData?.fileType.config.name,
        "Test",
        "Test file type should be found",
      );
      assert.deepStrictEqual(
        testFileMetaData?.relatedFiles,
        [],
        "No related files should be found",
      );
    });

    it("returns correct file meta data when file is not related to all other possible types", () => {
      const sourceFileMetaData = coLocator.getFileMetaData("/root/docs/classes/Entity.md");
      assert.strictEqual(
        sourceFileMetaData?.fileType.config.name,
        "Documentation",
        "correct file type found",
      );
      assert.deepStrictEqual(sourceFileMetaData?.relatedFiles, [
        {
          typeName: "Source",
          marker: "💻",
          fullPath: "/root/src/classes/Entity.ts",
        },
      ]);
    });

    it("allows files to link to other files that dont link back to them", () => {
      const testFileMetaData = coLocator.getFileMetaData("/root/test/classes/Entity.test.ts");
      assert.strictEqual(
        testFileMetaData?.fileType.config.name,
        "Test",
        "Test file type should be found",
      );
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

    it("should return undefined if the file is not found", () => {
      assert.fail("not implemented");
    });

    it("should return undefined if the file type is not found", () => {
      assert.fail("not implemented");
    });

    it("should return undefined if the file type is not registered", () => {
      assert.fail("not implemented");
    });
  });

  describe("#reset", () => {
    it("should reset all file types", () => {
      assert.fail("not implemented");
    });
  });
});
