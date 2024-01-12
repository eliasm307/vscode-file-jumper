import { assert, describe, it } from "vitest";
import type { MainConfig } from "./config";
import {
  getIssuesWithMainConfig,
  formatRawIgnorePatternsConfig,
  formatRawFileTypesConfig,
  mainConfigsAreEqual,
  applyPathTransformations,
} from "./config";
import type { PathTransformation } from "../types";

describe("config utils", () => {
  describe("#formatRawFileTypesConfig", () => {
    it("formats the raw config correctly", () => {
      const actual = formatRawFileTypesConfig({
        Source: {
          icon: "💻",
          patterns: ["sourcePattern1", "sourcePattern2", "sourcePattern3"],
        },
        Test: {
          icon: "🧪",
          patterns: ["testPattern1"],
        },
        Documentation: {
          icon: "📖",
          patterns: ["docsPattern1", "docsPattern2"],
          onlyLinkTo: ["Source"],
        },
      });

      const expected = [
        {
          name: "Source",
          icon: "💻",
          patterns: ["sourcePattern1", "sourcePattern2", "sourcePattern3"],
        },
        {
          name: "Test",
          icon: "🧪",
          patterns: ["testPattern1"],
        },
        {
          name: "Documentation",
          icon: "📖",
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
          icon: "💻",
          patterns: [
            "(?<prefix>.+)\\/src\\/(?!\\.test\\.|\\.spec\\.)(?<topic>.+)\\.(js|jsx|ts|tsx)$",
          ],
        },
        {
          name: "Test",
          icon: "🧪",
          patterns: ["(?<prefix>.+)\\/test\\/(?<topic>.+)\\.(test|spec)\\.(js|jsx|ts|tsx)$"],
        },
      ];
      assert.deepStrictEqual(
        actual,
        expectedDefault,
        "returns the defaults when config is not defined",
      );
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
      assert.deepStrictEqual(
        actual,
        expectedDefault,
        "returns the defaults when config is not defined",
      );
    });
  });

  describe("#mainConfigsAreEqual", () => {
    it("returns true when configs are equal", () => {
      const a: MainConfig = {
        fileTypes: [
          {
            name: "Source",
            icon: "💻",
            patterns: ["sourcePattern1", "sourcePattern2"],
          },
          {
            name: "Test",
            icon: "🧪",
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
            icon: "💻",
            patterns: ["sourcePattern1", "sourcePattern2"],
          },
          {
            name: "Test",
            icon: "🧪",
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
            icon: "💻",
            patterns: ["sourcePattern1", "sourcePattern2"],
          },
          {
            name: "Test",
            icon: "🧪",
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
            icon: "💻",
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
            icon: "💻",
            patterns: ["sourcePattern1", "sourcePattern2"],
          },
          {
            name: "Test",
            icon: "🧪",
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
            icon: "💻",
            patterns: ["sourcePattern1", "sourcePattern2"],
          },
        ],
        ignorePatterns: ["\\/node_modules\\/"],
        showDebugLogs: false,
      });
      assert.deepStrictEqual(
        actual,
        ["There must be at least 2 file types defined"],
        "returns an array of issues when config is invalid",
      );
    });
  });

  describe("applyPathTransformations", () => {
    it("should apply path transformations correctly", () => {
      const sourcePath = "/path/to/source/file.js";
      const transformations: PathTransformation[] = [
        {
          searchRegex: /source/,
          replacementText: "target",
        },
        {
          searchRegex: /file/,
          replacementText: "newfile",
        },
      ];

      const expected = "/path/to/target/newfile.js";
      const actual = applyPathTransformations({ sourcePath, transformations });

      assert.strictEqual(actual, expected, "should apply path transformations correctly");
    });

    it("should not apply transformation if testRegex does not match", () => {
      const sourcePath = "/path/to/source/file.js";
      const transformations: PathTransformation[] = [
        {
          searchRegex: /source/,
          replacementText: "target",
          testRegex: /other/,
        },
        {
          searchRegex: /file/,
          replacementText: "newfile",
        },
      ];

      assert.strictEqual(
        applyPathTransformations({ sourcePath, transformations }),
        "/path/to/source/newfile.js",
        "should not apply transformation if testRegex does not match",
      );
    });

    it("should apply group formats correctly", () => {
      const sourcePath = "/path/to/some_source/file.js";
      const transformations: PathTransformation[] = [
        {
          searchRegex: /\/(\w+)\/(\w+)\.js$/d,
          groupFormats: {
            1: "PascalCase",
            2: "UPPERCASE",
          },
        },
      ];

      assert.strictEqual(
        applyPathTransformations({ sourcePath, transformations }),
        "/path/to/SomeSource/FILE.js",
        "should apply group formats correctly",
      );
    });

    it("maintains special characters when applying group formats", () => {
      const sourcePath = "/path.to/some_source/file-name.js";
      const transformations: PathTransformation[] = [
        {
          searchRegex: /^(.+)$/d,
          groupFormats: {
            1: "PascalCase",
          },
        },
      ];

      assert.strictEqual(
        applyPathTransformations({ sourcePath, transformations }),
        "/Path.To/SomeSource/File-Name.Js",
        "should apply group formats correctly",
      );
    });
  });
});
