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
    fileType.addPaths(["/test/file0.test.ts", "/test/dir1/file1.test.ts", "/test/dir1/dir2/file2.test.ts"]);
    return fileType;
  }

  afterEach(() => {
    fileType.dispose();
  });

  describe("#getLinkedFilesFromKeyPath", () => {
    it("should return the linked file", () => {
      fileType = createFileTypeWithRegisteredFiles();

      assert.deepStrictEqual(
        fileType.getLinkedFilesFromKeyPath("dir1/file1" as KeyPath),
        [
          {
            typeName: "test",
            marker: "🧪",
            fullPath: "/test/dir1/file1.test.ts",
          },
        ],
        "linked file should be found",
      );

      assert.deepStrictEqual(
        fileType.getLinkedFilesFromKeyPath("dir1/dir2/file2" as KeyPath),
        [
          {
            typeName: "test",
            marker: "🧪",
            fullPath: "/test/dir1/dir2/file2.test.ts",
          },
        ],
        "linked file should be found",
      );
    });

    it("should return undefined if the file is not linked", () => {
      fileType = createFileTypeWithRegisteredFiles();
      const linkedFiles = fileType.getLinkedFilesFromKeyPath("dir1/otherFile.ts" as KeyPath);
      assert.deepStrictEqual(linkedFiles, [], "linked file should not be found");
    });

    it("allows matching to multiple files", () => {
      fileType = new FileType({
        name: "Source",
        marker: "💻",
        patterns: ["\\/src\\/(.*)\\.mjs$", "\\/src\\/(.*)\\.(service\\.js|types\\.d\\.ts|styles\\.css)$"],
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
        fileType.getLinkedFilesFromKeyPath("dir1/file0" as KeyPath),
        [
          {
            typeName: "Source",
            marker: "💻",
            fullPath: "/src/dir1/file0.mjs",
          },
          {
            typeName: "Source",
            marker: "💻",
            fullPath: "/src/dir1/file0.service.js",
          },
          {
            typeName: "Source",
            marker: "💻",
            fullPath: "/src/dir1/file0.types.d.ts",
          },
          {
            typeName: "Source",
            marker: "💻",
            fullPath: "/src/dir1/file0.styles.css",
          },
        ],
        "linked files should be found",
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

  describe("#getKeyPath", () => {
    it("should return the key path if the file matches", () => {
      fileType = createFileTypeWithRegisteredFiles();
      assert.strictEqual(fileType.getKeyPath("/test/dir1/file1.test.ts"), "dir1/file1", "key path should be found");
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
      assert.strictEqual(fileType.getKeyPath("/test/dir1/file1.test.ts"), "dir1/file1", "key path should be found");
    });

    it("supports multiple regex", () => {
      fileType = new FileType({
        name: "test",
        marker: "🧪",
        patterns: ["\\/test\\/(.*)\\.test\\.ts", "\\/test\\/(.*)\\.spec\\.ts"],
      });
      assert.strictEqual(fileType.getKeyPath("/test/dir1/file1.test.ts"), "dir1/file1", "key path should be found");
      assert.strictEqual(fileType.getKeyPath("/test/dir1/file1.spec.ts"), "dir1/file1", "key path should be found");
    });

    it("supports multiple regex with named capture groups", () => {
      fileType = new FileType({
        name: "test",
        marker: "🧪",
        patterns: ["\\/(test|src)\\/(?<key>.*)\\.test\\.ts", "\\/(test|src)\\/(?<key>.*)\\.spec\\.ts"],
      });
      assert.strictEqual(fileType.getKeyPath("/test/dir1/file1.test.ts"), "dir1/file1", "key path should be found");
      assert.strictEqual(fileType.getKeyPath("/test/dir1/file1.spec.ts"), "dir1/file1", "key path should be found");
    });
  });

  describe("#dispose", () => {
    it("should clear the registered files", () => {
      fileType = createFileTypeWithRegisteredFiles();

      const validKeyPath = "dir1/file1" as KeyPath;
      const matchingFullPath = "/test/dir1/file1.test.ts";

      assert.deepStrictEqual(
        fileType.getLinkedFilesFromKeyPath(validKeyPath),
        [{ typeName: "test", marker: "🧪", fullPath: "/test/dir1/file1.test.ts" }],
        "linked file should be found",
      );
      assert.strictEqual(fileType.getKeyPath(matchingFullPath), "dir1/file1", "file should match");

      fileType.dispose();

      assert.deepStrictEqual(fileType.getLinkedFilesFromKeyPath(validKeyPath), [], "linked file should not be found");
      assert.strictEqual(fileType.getKeyPath(matchingFullPath), "dir1/file1", "file should still match after");
    });
  });

  describe("#removePaths", () => {
    const validKeyPath0 = "file0" as KeyPath;
    const fullPath0 = "/test/file0.test.ts";
    const validKeyPath1 = "dir1/file1" as KeyPath;
    const fullPath1 = "/test/dir1/file1.test.ts";
    const validKeyPath2 = "dir1/dir2/file2" as KeyPath;
    const fullPath2 = "/test/dir1/dir2/file2.test.ts";

    function assertFile0IsRegistered(expectRegistered: boolean): void {
      if (expectRegistered) {
        assert.deepStrictEqual(
          fileType.getLinkedFilesFromKeyPath(validKeyPath0),
          [{ typeName: "test", marker: "🧪", fullPath: fullPath0 }],
          "linked file0 should be found",
        );
      } else {
        assert.deepStrictEqual(
          fileType.getLinkedFilesFromKeyPath(validKeyPath0),
          [],
          "linked file0 should not be found",
        );
      }
    }

    function assertFile1IsRegistered(expectRegistered: boolean): void {
      if (expectRegistered) {
        assert.deepStrictEqual(
          fileType.getLinkedFilesFromKeyPath(validKeyPath1),
          [{ typeName: "test", marker: "🧪", fullPath: fullPath1 }],
          "linked file1 should be found",
        );
      } else {
        assert.deepStrictEqual(
          fileType.getLinkedFilesFromKeyPath(validKeyPath1),
          [],
          "linked file1 should not be found",
        );
      }
    }

    function assertFile2IsRegistered(expectRegistered: boolean): void {
      if (expectRegistered) {
        assert.deepStrictEqual(
          fileType.getLinkedFilesFromKeyPath(validKeyPath2),
          [{ typeName: "test", marker: "🧪", fullPath: fullPath2 }],
          "linked file2 should be found",
        );
      } else {
        assert.deepStrictEqual(
          fileType.getLinkedFilesFromKeyPath(validKeyPath2),
          [],
          "linked file2 should not be found",
        );
      }
    }

    it("can handle being called with unregistered files", () => {
      fileType = createFileTypeWithRegisteredFiles();

      fileType.removePaths(["/test/dir1/unknown.ts"]); // ie should not throw
    });

    it("can de-register registered files", () => {
      fileType = createFileTypeWithRegisteredFiles();

      // file 1 should be found
      assertFile0IsRegistered(true);
      assert.strictEqual(fileType.getKeyPath(fullPath1), "dir1/file1", "file1 should have keypath");

      // file 2 should be found
      assertFile2IsRegistered(true);
      assert.strictEqual(fileType.getKeyPath(fullPath2), "dir1/dir2/file2", "file2 should have keypath");

      // de-register file 1
      fileType.removePaths([fullPath1]);

      // file 1 should not be found anymore
      assertFile1IsRegistered(false);

      // file 2 should still be found
      assertFile2IsRegistered(true);
      assert.strictEqual(fileType.getKeyPath(fullPath2), "dir1/dir2/file2", "file2 should still have keypath");

      // de-register file 2
      fileType.removePaths([fullPath2]);

      // file 2 should not be found anymore
      assertFile2IsRegistered(false);
      assert.strictEqual(
        fileType.getKeyPath(fullPath2),
        "dir1/dir2/file2",
        "file2 should still have keypath after reset",
      );
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
