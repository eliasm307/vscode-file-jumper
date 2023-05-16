import { describe, it, assert } from "vitest";
import { shortenPath } from ".";

describe("utils", () => {
  describe("#shortenPath", () => {
    it("should return the path if its shorter than the max length", () => {
      const path = "src/utils/index.test.ts";
      assert.strictEqual(shortenPath(path), path);
    });

    it("should shorten the path if its longer than the max length", () => {
      const path = "src/utils/dir1/dir2/dir3/dir4/dir5/dir6/dir7/dir8/dir9/dir10/dir11/dir12/dir13/index.test.ts";
      assert.strictEqual(shortenPath(path), "src/.../dir5/dir6/dir7/dir8/dir9/dir10/dir11/dir12/dir13/index.test.ts");
    });

    it("can handle empty paths", () => {
      const path = "";
      assert.strictEqual(shortenPath(path), path);
    });
  });
});
