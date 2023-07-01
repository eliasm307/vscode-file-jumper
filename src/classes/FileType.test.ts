import { describe, it, assert, afterEach } from "vitest";
import type { PathKey } from "./FileType";
import FileType from "./FileType";

describe("FileType", () => {
  let fileType: FileType;

  function createFileTypeWithRegisteredFiles(): FileType {
    fileType = new FileType({
      name: "test",
      icon: "🧪",
      patterns: ["\\/test\\/(?<topic>.+)\\.test\\.ts"],
    });
    fileType.addPaths([
      "/test/file0.test.ts",
      "/test/dir1/file1.test.ts",
      "/test/dir1/dir2/file2.test.ts",
    ]);
    return fileType;
  }

  afterEach(() => {
    fileType.dispose();
  });

  describe(`#${FileType.prototype.getFilesMatching.name}`, () => {
    it("should return the linked file", () => {
      fileType = createFileTypeWithRegisteredFiles();

      assert.deepStrictEqual(
        fileType.getFilesMatching("dir1/file1" as PathKey),
        [
          {
            typeName: "test",
            icon: "🧪",
            fullPath: "/test/dir1/file1.test.ts",
          },
        ],
        "linked file should be found",
      );

      assert.deepStrictEqual(
        fileType.getFilesMatching("dir1/dir2/file2" as PathKey),
        [
          {
            typeName: "test",
            icon: "🧪",
            fullPath: "/test/dir1/dir2/file2.test.ts",
          },
        ],
        "linked file should be found",
      );
    });

    it("should return undefined if the file is not linked", () => {
      fileType = createFileTypeWithRegisteredFiles();
      const linkedFiles = fileType.getFilesMatching("dir1/otherFile.ts" as PathKey);
      assert.deepStrictEqual(linkedFiles, [], "linked file should not be found");
    });

    it("allows matching to multiple files", () => {
      fileType = new FileType({
        name: "Source",
        icon: "💻",
        patterns: [
          "\\/src\\/(?<topic>.+)\\.mjs$",
          "\\/src\\/(?<topic>.+)\\.(service\\.js|types\\.d\\.ts|styles\\.css)$",
        ],
      });
      fileType.addPaths([
        "/src/file0.ts",
        "/src/dir1/file0.mjs",
        "/src/dir1/file0.service.js",
        "/src/dir1/file0.types.d.ts",
        "/src/dir1/file0.styles.css",
        "/src/dir1/file1.mjs",
        "/src/dir1/dir2/file2.test.ts",
      ]);

      assert.deepStrictEqual(
        fileType.getFilesMatching("dir1/file0" as PathKey),
        [
          {
            typeName: "Source",
            icon: "💻",
            fullPath: "/src/dir1/file0.mjs",
          },
          {
            typeName: "Source",
            icon: "💻",
            fullPath: "/src/dir1/file0.service.js",
          },
          {
            typeName: "Source",
            icon: "💻",
            fullPath: "/src/dir1/file0.types.d.ts",
          },
          {
            typeName: "Source",
            icon: "💻",
            fullPath: "/src/dir1/file0.styles.css",
          },
        ],
        "linked files should be found",
      );
    });
  });

  describe(`#${FileType.prototype.getPathKeyFromPath.name}`, () => {
    it("creates path keys in lower case", () => {
      fileType = new FileType({
        name: "Source",
        icon: "💻",
        patterns: ["\\/src\\/(?<topic>.+)\\.ts$"],
      });
      assert.strictEqual(
        fileType.getPathKeyFromPath("/src/Dir1/MODULE.ts"),
        "dir1/module",
        "path key is lower case",
      );
    });

    it("includes non-alphanumeric characters in path key by default", () => {
      fileType = new FileType({
        name: "Source",
        icon: "💻",
        patterns: ["\\/src\\/(?<topic>.+)\\.ts$"],
      });
      assert.strictEqual(
        fileType.getPathKeyFromPath("/src/dir1/file-0.ts"),
        "dir1/file-0",
        "path key includes non-alphanumeric characters",
      );
    });

    it("does not include non-alphanumeric characters in path key with option", () => {
      fileType = new FileType({
        name: "Source",
        icon: "💻",
        patterns: ["\\/src\\/(?<topic>.+)\\.ts$"],
        ignoreNonAlphaNumericCharacters: true,
      });
      assert.strictEqual(
        fileType.getPathKeyFromPath("/src/dir1/file-0.ts"),
        "dir1/file0",
        "path key does not include non-alphanumeric characters",
      );
    });
  });

  describe("#matches", () => {
    it("should return true if the file is linked", () => {
      fileType = createFileTypeWithRegisteredFiles();
      assert.isTrue(fileType.matches("/test/dir1/file1.test.ts"), "file should match");
    });

    it("should return false if the file is not linked", () => {
      fileType = createFileTypeWithRegisteredFiles();
      assert.isFalse(fileType.matches("/test/dir1/otherFile.ts"), "file should not match");
    });
  });

  describe("#dispose", () => {
    it("should clear the registered files", () => {
      fileType = createFileTypeWithRegisteredFiles();

      const validKeyPath = "dir1/file1" as PathKey;

      assert.deepStrictEqual(
        fileType.getFilesMatching(validKeyPath),
        [{ typeName: "test", icon: "🧪", fullPath: "/test/dir1/file1.test.ts" }],
        "linked file should be found",
      );

      fileType.dispose();

      assert.deepStrictEqual(
        fileType.getFilesMatching(validKeyPath),
        [],
        "linked file should not be found",
      );
    });
  });

  describe("#removePaths", () => {
    const validKeyPath0 = "file0" as PathKey;
    const fullPath0 = "/test/file0.test.ts";
    const validKeyPath1 = "dir1/file1" as PathKey;
    const fullPath1 = "/test/dir1/file1.test.ts";
    const validKeyPath2 = "dir1/dir2/file2" as PathKey;
    const fullPath2 = "/test/dir1/dir2/file2.test.ts";

    function assertFile0IsRegistered(expectRegistered: boolean): void {
      if (expectRegistered) {
        assert.deepStrictEqual(
          fileType.getFilesMatching(validKeyPath0),
          [{ typeName: "test", icon: "🧪", fullPath: fullPath0 }],
          "linked file0 should be found",
        );
      } else {
        assert.deepStrictEqual(
          fileType.getFilesMatching(validKeyPath0),
          [],
          "linked file0 should not be found",
        );
      }
    }

    function assertFile1IsRegistered(expectRegistered: boolean): void {
      if (expectRegistered) {
        assert.deepStrictEqual(
          fileType.getFilesMatching(validKeyPath1),
          [{ typeName: "test", icon: "🧪", fullPath: fullPath1 }],
          "linked file1 should be found",
        );
      } else {
        assert.deepStrictEqual(
          fileType.getFilesMatching(validKeyPath1),
          [],
          "linked file1 should not be found",
        );
      }
    }

    function assertFile2IsRegistered(expectRegistered: boolean): void {
      if (expectRegistered) {
        assert.deepStrictEqual(
          fileType.getFilesMatching(validKeyPath2),
          [{ typeName: "test", icon: "🧪", fullPath: fullPath2 }],
          "linked file2 should be found",
        );
      } else {
        assert.deepStrictEqual(
          fileType.getFilesMatching(validKeyPath2),
          [],
          "linked file2 should not be found",
        );
      }
    }

    it("can handle being called with unregistered files", () => {
      fileType = createFileTypeWithRegisteredFiles();

      fileType.removePaths(["/test/dir1/unknown.ts"]); // ie should not throw
    });

    it("can remove paths", () => {
      fileType = createFileTypeWithRegisteredFiles();

      // file 1 & 2 should be found
      assertFile0IsRegistered(true);
      assertFile2IsRegistered(true);

      // de-register file 1
      fileType.removePaths([fullPath1]);

      // file 1 should not be found anymore
      assertFile1IsRegistered(false);
      // file 2 should still be found
      assertFile2IsRegistered(true);

      // de-register file 2
      fileType.removePaths([fullPath2]);

      // file 2 should not be found anymore
      assertFile2IsRegistered(false);
    });

    it("is a no-op if the file is not registered", () => {
      fileType = createFileTypeWithRegisteredFiles();

      // all files should be found
      assertFile0IsRegistered(true);
      assertFile1IsRegistered(true);
      assertFile2IsRegistered(true);

      // de-register unknown file
      fileType.removePaths(["/test/dir1/dir2/unknown.test.ts"]);

      // all files should still be found
      assertFile0IsRegistered(true);
      assertFile1IsRegistered(true);
      assertFile2IsRegistered(true);
    });
  });

  describe(`#${FileType.prototype.allowsLinksTo.name}`, () => {
    const srcFileType = new FileType({
      name: "src",
      icon: "📁",
      patterns: ["\\/src\\/(?<topic>.+)\\.ts"],
    });

    const testFileType = new FileType({
      name: "test",
      icon: "🧪",
      patterns: ["\\/test\\/(?<topic>.+)\\.test\\.ts"],
    });

    it("should relate to all file types if no onlyLinkTo is specified", () => {
      fileType = new FileType({
        name: "other",
        icon: "🧪",
        patterns: ["other"],
      });
      assert.isTrue(fileType.allowsLinksTo(srcFileType), "relates to src file type");
      assert.isTrue(fileType.allowsLinksTo(testFileType), "relates to test file type");
    });

    it("should only return true if the file type matches the defined only link to constraint", () => {
      fileType = new FileType({
        name: "other",
        icon: "🧪",
        patterns: ["other"],
        onlyLinkTo: ["src"],
      });
      assert.isTrue(fileType.allowsLinksTo(srcFileType), "relates to src file type");
      assert.isFalse(fileType.allowsLinksTo(testFileType), "does not relate to test file type");
    });

    it("does not relate to any file type if the onlyLinkTo constraint is an empty array", () => {
      fileType = new FileType({
        name: "other",
        icon: "🧪",
        patterns: ["other"],
        onlyLinkTo: [],
      });
      assert.isFalse(fileType.allowsLinksTo(srcFileType), "does not relate to src file");
      assert.isFalse(fileType.allowsLinksTo(testFileType), "does not relate to test file");
    });
  });

  describe.todo(`#${FileType.prototype.allowsLinksFrom.name}`);
});
