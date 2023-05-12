import { describe, it, assert } from "vitest";
import FileType from "./FileType";
import type { KeyPath } from "../types";

describe("FileType", () => {
  function createFileTypeWithRegisteredFiles(): FileType {
    const fileType = new FileType({
      name: "test",
      marker: "🧪",
      regex: "\\/test\\/(.*)\\.test\\.ts",
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
});
