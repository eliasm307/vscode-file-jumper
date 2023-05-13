import { describe, it, assert, afterEach } from "vitest";
import CoLocator from "./CoLocator";

describe("CoLocator", () => {
  let coLocator: CoLocator;

  function createCoLocator() {
    return new CoLocator({
      fileGroups: [
        {
          name: "Default",
          types: [
            {
              name: "Source",
              marker: "💻",
              regex: "\\/src\\/(.*)\\.ts$",
            },
            {
              name: "Test",
              marker: "🧪",
              regex: "\\/test\\/(.*)\\.ts$",
            },
          ],
        },
      ],
      ignoreRegexs: [],
    });
  }

  afterEach(() => {
    coLocator.reset();
  });

  describe("#initWorkspaceFiles", () => {
    it("should register files", () => {
      // todo
    });
  });

  describe("#getFileType", () => {
    it("returns the correct file type", () => {
      coLocator = createCoLocator();
      const sourceFileType = coLocator.getFileType("/src/classes/CoLocator.ts");
      assert.strictEqual(sourceFileType?.config.name, "Source", "Source file type should be found");

      const testFileType = coLocator.getFileType("/test/classes/CoLocator.test.ts");
      assert.strictEqual(testFileType?.config.name, "Test", "Test file type should be found");
    });

    it("should return undefined if the file type is not found", () => {
      coLocator = createCoLocator();

      const unknownFileType = coLocator.getFileType("/unknown/file/path.ts");
      assert.isUndefined(unknownFileType, "Unknown file type should not be found");
    });
  });

  describe("#reset", () => {
    it("should reset all file types", () => {
      // todo
    });
  });
});
