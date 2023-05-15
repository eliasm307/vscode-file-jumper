import { assert, describe, it } from "vitest";
import type { MainConfig } from "./config";
import { getIssuesWithMainConfig, formatRawIgnorePatternsConfig, formatRawFileTypesConfig, mainConfigsAreEqual } from "./config";

describe("config utils", () => {
  describe("#formatRawFileTypesConfig", () => {
    it("formats the raw config correctly", () => {
      const actual = formatRawFileTypesConfig({
        Source: {
          marker: "💻",
          patterns: ["sourcePattern1", "sourcePattern2", "sourcePattern3"],
        },
        Test: {
          marker: "🧪",
          patterns: ["testPattern1"],
        },
        Documentation: {
          marker: "📖",
          patterns: ["docsPattern1", "docsPattern2"],
          onlyLinkTo: ["Source"],
        },
      });

      const expected = [
        {
          name: "Source",
          marker: "💻",
          patterns: ["sourcePattern1", "sourcePattern2", "sourcePattern3"],
        },
        {
          name: "Test",
          marker: "🧪",
          patterns: ["testPattern1"],
        },
        {
          name: "Documentation",
          marker: "📖",
          patterns: ["docsPattern1", "docsPattern2"],
          onlyLinkTo: ["Source"],
        },
      ];

      assert.deepStrictEqual(actual, expected, "formats the raw config correctly");
    });

    it("returns the default file types when config is not defined", () => {
      const actual = formatRawFileTypesConfig(undefined);
      const expectedDefault = [
        {
          name: "Source",
          marker: "💻",
          patterns: ["\\/src\\/(?!\\.test\\.|\\.spec\\.)(.+)\\.(js|jsx|ts|tsx)$"],
        },
        {
          name: "Test",
          marker: "🧪",
          patterns: ["\\/test\\/(.+)\\.(test|spec)\\.(js|jsx|ts|tsx)$"],
        },
      ];
      assert.deepStrictEqual(actual, expectedDefault, "returns the defaults when config is not defined");
    });
  });

  describe("#formatRawIgnorePatternsConfig", () => {
    it("does not modify provided ignore patterns", () => {
      const actual = formatRawIgnorePatternsConfig(["ignorePattern1", "ignorePattern2"]);
      const expected = ["ignorePattern1", "ignorePattern2"];
      assert.deepStrictEqual(actual, expected, "formats the raw config correctly");
    });

    it("returns the default ignore patterns when config is not defined", () => {
      const actual = formatRawIgnorePatternsConfig(undefined);
      const expectedDefault = ["\\/node_modules\\/"];
      assert.deepStrictEqual(actual, expectedDefault, "returns the defaults when config is not defined");
    });
  });

  describe("#mainConfigsAreEqual", () => {
    it("returns true when configs are equal", () => {
      const a: MainConfig = {
        fileTypes: [
          {
            name: "Source",
            marker: "💻",
            patterns: ["sourcePattern1", "sourcePattern2"],
          },
          {
            name: "Test",
            marker: "🧪",
            patterns: ["testPattern1", "testPattern2"],
          },
        ],
        ignorePatterns: ["\\/node_modules\\/"],
        showDebugLogs: false,
      };
      const b: MainConfig = {
        fileTypes: [
          {
            name: "Source",
            marker: "💻",
            patterns: ["sourcePattern1", "sourcePattern2"],
          },
          {
            name: "Test",
            marker: "🧪",
            patterns: ["testPattern1", "testPattern2"],
          },
        ],
        ignorePatterns: ["\\/node_modules\\/"],
        showDebugLogs: false,
      };
      assert.isTrue(mainConfigsAreEqual(a, b), "returns true when configs are equal");
    });

    it("returns false when configs are not equal", () => {
      const a: MainConfig = {
        fileTypes: [
          {
            name: "Source",
            marker: "💻",
            patterns: ["sourcePattern1", "sourcePattern2"],
          },
          {
            name: "Test",
            marker: "🧪",
            patterns: ["testPattern1", "testPattern2"],
          },
        ],
        ignorePatterns: ["\\/node_modules\\/"],
        showDebugLogs: false,
      };
      const b: MainConfig = {
        fileTypes: [
          {
            name: "Source",
            marker: "💻",
            patterns: ["sourcePattern1", "sourcePattern2"],
          },
          // missing Test file type
        ],
        ignorePatterns: ["\\/node_modules\\/"],
        showDebugLogs: false,
      };
      assert.isFalse(mainConfigsAreEqual(a, b), "returns false when configs are not equal");
    });
  });

  describe("#getIssuesWithMainConfig", () => {
    it("returns an empty array when config is valid", () => {
      const actual = getIssuesWithMainConfig({
        fileTypes: [
          {
            name: "Source",
            marker: "💻",
            patterns: ["sourcePattern1", "sourcePattern2"],
          },
          {
            name: "Test",
            marker: "🧪",
            patterns: ["testPattern1", "testPattern2"],
            onlyLinkTo: ["Source"],
          },
        ],
        ignorePatterns: ["\\/node_modules\\/"],
        showDebugLogs: false,
      });
      assert.deepStrictEqual(actual, [], "returns an empty array when config is valid");
    });

    it("returns an array of issues when config is invalid", () => {
      const actual = getIssuesWithMainConfig({
        fileTypes: [
          {
            name: "Source",
            marker: "💻",
            patterns: ["sourcePattern1", "sourcePattern2"],
          },
        ],
        ignorePatterns: ["\\/node_modules\\/"],
        showDebugLogs: false,
      });
      assert.deepStrictEqual(actual, ["There must be at least 2 file types defined"], "returns an array of issues when config is invalid");
    });
  });
});
