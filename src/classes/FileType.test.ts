import { describe, it, assert, afterEach } from "vitest";
import FileType from "./FileType";
import type { KeyPath } from "../types";

describe("FileType", () => {
  let fileType: FileType;

  function createFileTypeWithRegisteredFiles(): FileType {
    fileType = new FileType({
      name: "test",
      marker: "🧪",
      patterns: ["\\/test\\/(.*)\\.test\\.ts"],
    });
    fileType.registerPaths(["/test/relatedFile0.test.ts", "/test/dir1/relatedFile1.test.ts", "/test/dir1/dir2/relatedFile2.test.ts"]);
    return fileType;
  }

  afterEach(() => {
    fileType.dispose();
  });

  describe("#getRelatedFiles", () => {
    it("should return the related file", () => {
      fileType = createFileTypeWithRegisteredFiles();

      assert.deepStrictEqual(
        fileType.getRelatedFiles("dir1/relatedFile1" as KeyPath),
        [
          {
            typeName: "test",
            marker: "🧪",
            fullPath: "/test/dir1/relatedFile1.test.ts",
          },
        ],
        "related file should be found",
      );

      assert.deepStrictEqual(
        fileType.getRelatedFiles("dir1/dir2/relatedFile2" as KeyPath),
        [
          {
            typeName: "test",
            marker: "🧪",
            fullPath: "/test/dir1/dir2/relatedFile2.test.ts",
          },
        ],
        "related file should be found",
      );
    });

    it("should return undefined if the file is not related", () => {
      fileType = createFileTypeWithRegisteredFiles();
      const relatedFiles = fileType.getRelatedFiles("dir1/otherFile.ts" as KeyPath);
      assert.deepStrictEqual(relatedFiles, [], "related file should not be found");
    });

    it("allows matching to multiple files", () => {
      fileType = new FileType({
        name: "Source",
        marker: "💻",
        patterns: ["\\/src\\/(.*)\\.mjs$", "\\/src\\/(.*)\\.(service\\.js|types\\.d\\.ts|styles\\.css)$"],
      });
      fileType.registerPaths([
        "/src/relatedFile0.ts",
        "/src/dir1/relatedFile0.mjs",
        "/src/dir1/relatedFile0.service.js",
        "/src/dir1/relatedFile0.types.d.ts",
        "/src/dir1/relatedFile0.styles.css",
        "/src/dir1/relatedFile1.mjs",
        "/src/dir1/dir2/relatedFile2.test.ts",
      ]);

      assert.deepStrictEqual(
        fileType.getRelatedFiles("dir1/relatedFile0" as KeyPath),
        [
          {
            typeName: "Source",
            marker: "💻",
            fullPath: "/src/dir1/relatedFile0.mjs",
          },
          {
            typeName: "Source",
            marker: "💻",
            fullPath: "/src/dir1/relatedFile0.service.js",
          },
          {
            typeName: "Source",
            marker: "💻",
            fullPath: "/src/dir1/relatedFile0.types.d.ts",
          },
          {
            typeName: "Source",
            marker: "💻",
            fullPath: "/src/dir1/relatedFile0.styles.css",
          },
        ],
        "related files should be found",
      );
    });
  });

  describe("#matches", () => {
    it("should return true if the file is related", () => {
      fileType = createFileTypeWithRegisteredFiles();
      assert.isTrue(fileType.matches("/test/dir1/relatedFile1.test.ts"), "file should match");
    });

    it("should return false if the file is not related", () => {
      fileType = createFileTypeWithRegisteredFiles();
      assert.isFalse(fileType.matches("/test/dir1/otherFile.ts"), "file should not match");
    });
  });

  describe("#getKeyPath", () => {
    it("should return the key path if the file matches", () => {
      fileType = createFileTypeWithRegisteredFiles();
      assert.strictEqual(fileType.getKeyPath("/test/dir1/relatedFile1.test.ts"), "dir1/relatedFile1", "key path should be found");
    });

    it("should return undefined if the file does not match", () => {
      fileType = createFileTypeWithRegisteredFiles();
      assert.isUndefined(fileType.getKeyPath("/test/dir1/otherFile.ts"), "key path should not be found");
    });

    it("can determine key path using a named regex group with the name 'key'", function () {
      fileType = new FileType({
        name: "test",
        marker: "🧪",
        patterns: ["\\/(test|src)\\/(?<key>.*)\\.test\\.ts"],
      });
      assert.strictEqual(fileType.getKeyPath("/test/dir1/relatedFile1.test.ts"), "dir1/relatedFile1", "key path should be found");
    });

    it("supports multiple regex", () => {
      fileType = new FileType({
        name: "test",
        marker: "🧪",
        patterns: ["\\/test\\/(.*)\\.test\\.ts", "\\/test\\/(.*)\\.spec\\.ts"],
      });
      assert.strictEqual(fileType.getKeyPath("/test/dir1/relatedFile1.test.ts"), "dir1/relatedFile1", "key path should be found");
      assert.strictEqual(fileType.getKeyPath("/test/dir1/relatedFile1.spec.ts"), "dir1/relatedFile1", "key path should be found");
    });

    it("supports multiple regex with named capture groups", () => {
      fileType = new FileType({
        name: "test",
        marker: "🧪",
        patterns: ["\\/(test|src)\\/(?<key>.*)\\.test\\.ts", "\\/(test|src)\\/(?<key>.*)\\.spec\\.ts"],
      });
      assert.strictEqual(fileType.getKeyPath("/test/dir1/relatedFile1.test.ts"), "dir1/relatedFile1", "key path should be found");
      assert.strictEqual(fileType.getKeyPath("/test/dir1/relatedFile1.spec.ts"), "dir1/relatedFile1", "key path should be found");
    });
  });

  describe("#reset", () => {
    it("should clear the registered files", () => {
      fileType = createFileTypeWithRegisteredFiles();

      const validKeyPath = "dir1/relatedFile1" as KeyPath;
      const matchingFullPath = "/test/dir1/relatedFile1.test.ts";

      assert.deepStrictEqual(
        fileType.getRelatedFiles(validKeyPath),
        [
          {
            typeName: "test",
            marker: "🧪",
            fullPath: "/test/dir1/relatedFile1.test.ts",
          },
        ],
        "related file should be found",
      );
      assert.isTrue(fileType.matches(matchingFullPath), "file should match");

      fileType.reset();

      assert.deepStrictEqual(fileType.getRelatedFiles(validKeyPath), [], "related file should not be found");
      assert.isTrue(fileType.matches(matchingFullPath), "file should still match after reset");
    });
  });

  describe("#canRelateTo", () => {
    const srcFileType = new FileType({
      name: "src",
      marker: "📁",
      patterns: ["\\/src\\/(.*)\\.ts"],
    });

    const testFileType = new FileType({
      name: "test",
      marker: "🧪",
      patterns: ["\\/test\\/(.*)\\.test\\.ts"],
    });

    it("should relate to all file types if no onlyLinkTo is specified", () => {
      fileType = new FileType({
        name: "other",
        marker: "🧪",
        patterns: ["other"],
      });
      assert.isTrue(fileType.allowsLinksTo(srcFileType), "relates to src file type");
      assert.isTrue(fileType.allowsLinksTo(testFileType), "relates to test file type");
    });

    it("should only return true if the file type matches the defined only link to constraint", () => {
      fileType = new FileType({
        name: "other",
        marker: "🧪",
        patterns: ["other"],
        onlyLinkTo: ["src"],
      });
      assert.isTrue(fileType.allowsLinksTo(srcFileType), "relates to src file type");
      assert.isFalse(fileType.allowsLinksTo(testFileType), "does not relate to test file type");
    });

    it("does not relate to any file type if the onlyLinkTo constraint is an empty array", () => {
      fileType = new FileType({
        name: "other",
        marker: "🧪",
        patterns: ["other"],
        onlyLinkTo: [],
      });
      assert.isFalse(fileType.allowsLinksTo(srcFileType), "does not relate to src file");
      assert.isFalse(fileType.allowsLinksTo(testFileType), "does not relate to test file");
    });
  });
});
