import { describe, it, assert } from "vitest";
import FileType from "./FileType";
import type { KeyPath } from "../types";

describe("FileType", () => {
  function createFileTypeWithRegisteredFiles(): FileType {
    const fileType = new FileType({
      name: "test",
      marker: "🧪",
      regexs: ["\\/test\\/(.*)\\.test\\.ts"],
    });
    fileType.registerPaths([
      "/test/relatedFile0.test.ts",
      "/test/dir1/relatedFile1.test.ts",
      "/test/dir1/dir2/relatedFile2.test.ts",
    ]);
    return fileType;
  }

  describe("#getRelatedFile", () => {
    it("should return the related file", () => {
      const fileType = createFileTypeWithRegisteredFiles();

      assert.deepStrictEqual(
        fileType.getRelatedFile("dir1/relatedFile1" as KeyPath),
        {
          typeName: "test",
          marker: "🧪",
          fullPath: "/test/dir1/relatedFile1.test.ts",
        },
        "related file should be found",
      );

      assert.deepStrictEqual(
        fileType.getRelatedFile("dir1/dir2/relatedFile2" as KeyPath),
        {
          typeName: "test",
          marker: "🧪",
          fullPath: "/test/dir1/dir2/relatedFile2.test.ts",
        },
        "related file should be found",
      );
    });

    it("should return undefined if the file is not related", () => {
      const fileType = createFileTypeWithRegisteredFiles();
      const relatedFile = fileType.getRelatedFile("dir1/otherFile.ts" as KeyPath);
      assert.isUndefined(relatedFile, "related file should not be found");
    });
  });

  describe("#matches", () => {
    it("should return true if the file is related", () => {
      const fileType = createFileTypeWithRegisteredFiles();
      assert.isTrue(fileType.matches("/test/dir1/relatedFile1.test.ts"), "file should match");
    });

    it("should return false if the file is not related", () => {
      const fileType = createFileTypeWithRegisteredFiles();
      assert.isFalse(fileType.matches("/test/dir1/otherFile.ts"), "file should not match");
    });
  });

  describe("#getKeyPath", () => {
    it("should return the key path if the file matches", () => {
      const fileType = createFileTypeWithRegisteredFiles();
      assert.strictEqual(
        fileType.getKeyPath("/test/dir1/relatedFile1.test.ts"),
        "dir1/relatedFile1",
        "key path should be found",
      );
    });

    it("should return undefined if the file does not match", () => {
      const fileType = createFileTypeWithRegisteredFiles();
      assert.isUndefined(
        fileType.getKeyPath("/test/dir1/otherFile.ts"),
        "key path should not be found",
      );
    });

    it("can determine key path using a named regex group with the name 'key'", function () {
      const fileType = new FileType({
        name: "test",
        marker: "🧪",
        regexs: ["\\/(test|src)\\/(?<key>.*)\\.test\\.ts"],
      });
      assert.strictEqual(
        fileType.getKeyPath("/test/dir1/relatedFile1.test.ts"),
        "dir1/relatedFile1",
        "key path should be found",
      );
    });

    it("supports multiple regex", () => {
      const fileType = new FileType({
        name: "test",
        marker: "🧪",
        regexs: ["\\/test\\/(.*)\\.test\\.ts", "\\/test\\/(.*)\\.spec\\.ts"],
      });
      assert.strictEqual(
        fileType.getKeyPath("/test/dir1/relatedFile1.test.ts"),
        "dir1/relatedFile1",
        "key path should be found",
      );
      assert.strictEqual(
        fileType.getKeyPath("/test/dir1/relatedFile1.spec.ts"),
        "dir1/relatedFile1",
        "key path should be found",
      );
    });

    it("supports multiple regex with named capture groups", () => {
      const fileType = new FileType({
        name: "test",
        marker: "🧪",
        regexs: [
          "\\/(test|src)\\/(?<key>.*)\\.test\\.ts",
          "\\/(test|src)\\/(?<key>.*)\\.spec\\.ts",
        ],
      });
      assert.strictEqual(
        fileType.getKeyPath("/test/dir1/relatedFile1.test.ts"),
        "dir1/relatedFile1",
        "key path should be found",
      );
      assert.strictEqual(
        fileType.getKeyPath("/test/dir1/relatedFile1.spec.ts"),
        "dir1/relatedFile1",
        "key path should be found",
      );
    });
  });

  describe("#reset", () => {
    it("should clear the registered files", () => {
      const fileType = createFileTypeWithRegisteredFiles();

      const validKeyPath = "dir1/relatedFile1" as KeyPath;
      const matchingFullPath = "/test/dir1/relatedFile1.test.ts";

      assert.deepStrictEqual(
        fileType.getRelatedFile(validKeyPath),
        {
          typeName: "test",
          marker: "🧪",
          fullPath: "/test/dir1/relatedFile1.test.ts",
        },
        "related file should be found",
      );
      assert.isTrue(fileType.matches(matchingFullPath), "file should match");

      fileType.reset();

      assert.isUndefined(fileType.getRelatedFile(validKeyPath), "related file should not be found");
      assert.isTrue(fileType.matches(matchingFullPath), "file should still match after reset");
    });
  });

  describe("#canRelateTo", () => {
    const srcFileType = new FileType({
      name: "src",
      marker: "📁",
      regexs: ["\\/src\\/(.*)\\.ts"],
    });

    const testFileType = new FileType({
      name: "test",
      marker: "🧪",
      regexs: ["\\/test\\/(.*)\\.test\\.ts"],
    });

    it("should relate to all file types if no onlyLinkTo is specified", () => {
      const fileTypeWithDefault = new FileType({
        name: "other",
        marker: "🧪",
        regexs: ["other"],
      });
      assert.isTrue(fileTypeWithDefault.canRelateTo(srcFileType), "relates to src file type");
      assert.isTrue(fileTypeWithDefault.canRelateTo(testFileType), "relates to test file type");
    });

    it("should only return true if the file type matches the defined only link to constraint", () => {
      const fileTypeOnlyLinkingToSrc = new FileType({
        name: "other",
        marker: "🧪",
        regexs: ["other"],
        onlyLinkTo: ["src"],
      });
      assert.isTrue(fileTypeOnlyLinkingToSrc.canRelateTo(srcFileType), "relates to src file type");
      assert.isFalse(
        fileTypeOnlyLinkingToSrc.canRelateTo(testFileType),
        "does not relate to test file type",
      );
    });

    it("does not relate to any file type if the onlyLinkTo constraint is an empty array", () => {
      const fileType = new FileType({
        name: "other",
        marker: "🧪",
        regexs: ["other"],
        onlyLinkTo: [],
      });
      assert.isFalse(fileType.canRelateTo(srcFileType), "does not relate to src file");
      assert.isFalse(fileType.canRelateTo(testFileType), "does not relate to test file");
    });
  });
});
