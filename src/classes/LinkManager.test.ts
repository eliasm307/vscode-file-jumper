/* eslint-disable no-console */

import fs from "fs";
import pathModule from "path";
import { afterEach, assert, describe, it, vitest } from "vitest";
import LinkManager from "./LinkManager";
import type { DecorationData, LinkedFileData } from "../types";
import type { RawMainConfig } from "../utils/config";

describe("LinkManager", () => {
  let linkManager: LinkManager;

  const TEST_MAIN_CONFIG: RawMainConfig = {
    fileTypes: [
      {
        name: "Source",
        icon: "💻",
        patterns: ["\\/src\\/(?<topic>.+)\\.ts$"],
      },
      {
        name: "Test",
        icon: "🧪",
        patterns: ["\\/(test|tests)\\/(?<topic>.+)\\.test\\.ts$"],
      },
      {
        name: "Documentation",
        icon: "📖",
        patterns: ["\\/(docs|docs)\\/(?<topic>.+)\\.md$"],
        onlyLinkTo: ["Source"],
      },
      {
        name: "Build Output",
        icon: "📦",
        patterns: ["\\/dist\\/(?<topic>.+)\\.js$"],
        onlyLinkFrom: ["Source"],
      },
    ],
    ignorePatterns: ["\\/node_modules\\/"],
  };

  function createInstanceWithDefaultTestContext() {
    const manager = new LinkManager();
    manager.setContext({
      config: TEST_MAIN_CONFIG,
      paths: [
        // ignored files
        "/root/node_modules/package/src/classes/Entity.ts",
        "/root/node_modules/package/test/classes/Entity.test.ts",
        "/root/node_modules/package/docs/classes/Entity.md",

        // non-ignored files
        "/root/dist/classes/Entity.js",
        "/root/src/classes/Entity.ts",
        "/root/src/classes/Entity2.ts",
        "/root/src/classes/Entity3.ts",
        "/root/test/classes/Entity.test.ts",
        "/root/test/classes/Entity2.test.ts",
        "/root/docs/classes/Entity.md",
        "/root/unknown/file/path.ts",
        "/root/src/unknown/file/path.ts",
      ],
    });
    return manager;
  }

  const TEST_FILE_TYPE_NAMES = ["Source", "Test", "Documentation", "Build Output"] as const;
  type TestFileTypeName = (typeof TEST_FILE_TYPE_NAMES)[number];

  function assertDecorationDataForPath({
    path,
    expected,
  }: {
    path: string;
    expected: Record<TestFileTypeName, DecorationData | undefined>;
  }) {
    const actual = TEST_FILE_TYPE_NAMES.reduce(
      (out, fileTypeName) => {
        out[fileTypeName] = linkManager.getFileTypeDecoratorData({ path, fileTypeName });
        return out;
      },
      {} as Record<TestFileTypeName, DecorationData | undefined>,
    );

    assert.deepStrictEqual(actual, expected, `Decoration data for "${path}" is correct`);
  }

  afterEach(() => {
    linkManager.revertToInitial();
    // @ts-expect-error [allowed on after each to prevent re-use]
    linkManager = undefined;
  });

  describe("#autoJumpEnabled", () => {
    it("should return false by default", () => {
      linkManager = new LinkManager();
      assert.isFalse(linkManager.autoJumpEnabled, "autoJumpEnabled default");
    });

    it("follows given context", () => {
      linkManager = new LinkManager();

      linkManager.setContext({
        config: {
          ...TEST_MAIN_CONFIG,
          autoJump: true,
        },
        paths: [],
      });
      assert.isTrue(linkManager.autoJumpEnabled, "autoJumpEnabled is true after setting to true");

      linkManager.setContext({
        config: {
          ...TEST_MAIN_CONFIG,
          autoJump: false,
        },
        paths: [],
      });
      assert.isFalse(
        linkManager.autoJumpEnabled,
        "autoJumpEnabled is false after setting to false again",
      );
    });
  });

  describe("#notificationsAllowed", () => {
    it("should return false by default", () => {
      linkManager = new LinkManager();
      assert.isFalse(linkManager.notificationsAllowed, "notificationsAllowed default");
    });

    it("follows given context", () => {
      linkManager = new LinkManager();

      linkManager.setContext({
        config: {
          ...TEST_MAIN_CONFIG,
          allowNotifications: true,
        },
        paths: [],
      });
      assert.isTrue(
        linkManager.notificationsAllowed,
        "notificationsAllowed is true after setting to true",
      );

      linkManager.setContext({
        config: {
          ...TEST_MAIN_CONFIG,
          allowNotifications: false,
        },
        paths: [],
      });
      assert.isFalse(
        linkManager.notificationsAllowed,
        "notificationsAllowed is false after setting to false again",
      );
    });
  });

  describe("meta data functionality", () => {
    it("returns the correct file meta data with all related file decorations", () => {
      linkManager = createInstanceWithDefaultTestContext();
      const path = "/root/src/classes/Entity.ts";
      assert.deepStrictEqual(linkManager.getLinkedFilesFromPath(path), [
        {
          typeName: "Test",
          icon: "🧪",
          fullPath: "/root/test/classes/Entity.test.ts",
        },
        {
          typeName: "Documentation",
          icon: "📖",
          fullPath: "/root/docs/classes/Entity.md",
        },
        {
          typeName: "Build Output",
          icon: "📦",
          fullPath: "/root/dist/classes/Entity.js",
        },
      ]);

      assertDecorationDataForPath({
        path,
        expected: {
          Source: undefined, // no decoration for own file type
          Test: {
            badgeText: "🧪",
            tooltip: "🧪 Test",
          },
          Documentation: {
            badgeText: "📖",
            tooltip: "📖 Documentation",
          },

          "Build Output": {
            badgeText: "📦",
            tooltip: "📦 Build Output",
          },
        },
      });
    });

    it("returns the correct file meta data with all related file decorations and is not case sensitive", () => {
      linkManager = createInstanceWithDefaultTestContext();
      const path = "/ROOT/src/classes/Entity.ts";
      assert.deepStrictEqual(linkManager.getLinkedFilesFromPath(path), [
        {
          typeName: "Test",
          icon: "🧪",
          fullPath: "/root/test/classes/Entity.test.ts",
        },
        {
          typeName: "Documentation",
          icon: "📖",
          fullPath: "/root/docs/classes/Entity.md",
        },
        {
          typeName: "Build Output",
          icon: "📦",
          fullPath: "/root/dist/classes/Entity.js",
        },
      ]);

      assertDecorationDataForPath({
        path,
        expected: {
          Source: undefined, // no decoration for own file type
          Test: {
            badgeText: "🧪",
            tooltip: "🧪 Test",
          },
          Documentation: {
            badgeText: "📖",
            tooltip: "📖 Documentation",
          },

          "Build Output": {
            badgeText: "📦",
            tooltip: "📦 Build Output",
          },
        },
      });
    });

    it("returns correct decorations when a path is not linked to all available file types", () => {
      linkManager = createInstanceWithDefaultTestContext();
      const path = "/root/test/classes/Entity2.test.ts";

      assert.deepStrictEqual(linkManager.getLinkedFilesFromPath(path), [
        {
          typeName: "Source",
          icon: "💻",
          fullPath: "/root/src/classes/Entity2.ts",
        },
        // no Documentation or Build Output
      ]);

      assertDecorationDataForPath({
        path,
        expected: {
          Source: {
            badgeText: "💻",
            tooltip: "💻 Source",
          },
          Test: undefined, // no decoration for own file type
          Documentation: undefined,
          "Build Output": undefined,
        },
      });
    });

    it("returns correct file meta data when file is not linked to all other possible types via onlyLinkTo", () => {
      linkManager = createInstanceWithDefaultTestContext();
      const path = "/root/docs/classes/Entity.md";

      assert.deepStrictEqual(
        linkManager.getLinkedFilesFromPath(path),
        [
          {
            typeName: "Source",
            icon: "💻",
            fullPath: "/root/src/classes/Entity.ts",
          },
        ],
        "correct related files found",
      );

      assertDecorationDataForPath({
        path,
        expected: {
          Source: {
            badgeText: "💻",
            tooltip: "💻 Source",
          },
          Test: undefined, // source has link to this but not docs
          Documentation: undefined, // no decoration for own file type
          "Build Output": undefined, // source has link to this but not docs
        },
      });
    });

    it("allows files to link to other files that dont link back to them, except if they use onlyLinkFrom", () => {
      linkManager = createInstanceWithDefaultTestContext();
      const path = "/root/test/classes/Entity.test.ts";

      assert.deepStrictEqual(
        linkManager.getLinkedFilesFromPath(path),
        [
          {
            typeName: "Source",
            icon: "💻",
            fullPath: "/root/src/classes/Entity.ts",
          },
          {
            typeName: "Documentation", // docs dont link to tests but tests link to docs due to onlyLinkFrom
            icon: "📖",
            fullPath: "/root/docs/classes/Entity.md",
          },
          // no Build Output as it is only linked from source
        ],
        "correct related files found",
      );

      assertDecorationDataForPath({
        path,
        expected: {
          Source: {
            badgeText: "💻",
            tooltip: "💻 Source",
          },
          Test: undefined, // no decoration for own file type
          Documentation: {
            badgeText: "📖",
            tooltip: "📖 Documentation",
          },
          "Build Output": undefined, // can only be linked from source
        },
      });
    });

    function assertPathHasNoLinksOrDecoration(path: string): void {
      assert.deepStrictEqual(linkManager.getLinkedFilesFromPath(path), [], "has no linked files");

      assertDecorationDataForPath({
        path,
        expected: {
          Source: undefined,
          Test: undefined,
          Documentation: undefined,
          "Build Output": undefined,
        },
      });
    }

    it("does not return file meta data for a file that is ignored", () => {
      linkManager = createInstanceWithDefaultTestContext();
      const path = "/root/node_modules/package/src/classes/Entity.ts";

      assertPathHasNoLinksOrDecoration(path);
    });

    it("returns correct file meta data with no related files", () => {
      linkManager = createInstanceWithDefaultTestContext();
      const path = "/root/test/classes/Entity3.ts";

      assertPathHasNoLinksOrDecoration(path);
    });

    it("should return undefined if the file exists but is an unknown type", () => {
      linkManager = createInstanceWithDefaultTestContext();
      const path = "/root/unknown/file/path.ts";

      assertPathHasNoLinksOrDecoration(path);
    });

    it("should return undefined if the file is not registered/doesn't exist", () => {
      linkManager = createInstanceWithDefaultTestContext();
      const path = "/root/i-dont-exist/file/path.ts";

      assertPathHasNoLinksOrDecoration(path);
    });

    it("allows linking to multiple related files of the same type", () => {
      linkManager = new LinkManager();
      linkManager.setContext({
        config: {
          fileTypes: [
            {
              name: "Source",
              icon: "💻",
              patterns: ["\\/src\\/(?<topic>.+)\\.ts$"],
            },
            {
              name: "Test",
              icon: "🧪",
              patterns: [
                "\\/test\\/(?<topic>.+)\\.test\\.ts$",
                "\\/test\\/(?<topic>.+)\\.spec\\.ts$",
              ],
            },
            {
              name: "Build Output",
              icon: "📦",
              patterns: [
                "\\/dist\\/(?<topic>.+)\\.map\\.js$",
                "\\/dist\\/(?<topic>.+)\\.json$",
                "\\/dist\\/(?<topic>.+)\\.js$",
              ],
              onlyLinkFrom: ["Source"],
            },
          ],
          ignorePatterns: ["\\/node_modules\\/"],
        },
        paths: [
          "/root/src/classes/Entity.ts",
          "/root/src/classes/Entity2.ts",
          "/root/test/classes/Entity.test.ts",
          "/root/test/classes/Entity.spec.ts",
          "/root/test/classes/Entity2.test.ts",
          "/root/dist/classes/Entity.js",
          "/root/dist/classes/Entity.map.js",
          "/root/dist/classes/Entity.json",
        ],
      });

      const path = "/root/src/classes/Entity.ts";

      assert.deepStrictEqual(linkManager.getLinkedFilesFromPath(path), [
        {
          typeName: "Test",
          icon: "🧪",
          fullPath: "/root/test/classes/Entity.test.ts",
        },
        {
          typeName: "Test",
          icon: "🧪",
          fullPath: "/root/test/classes/Entity.spec.ts",
        },
        {
          typeName: "Build Output",
          icon: "📦",
          fullPath: "/root/dist/classes/Entity.js",
        },
        {
          typeName: "Build Output",
          icon: "📦",
          fullPath: "/root/dist/classes/Entity.map.js",
        },
        {
          typeName: "Build Output",
          icon: "📦",
          fullPath: "/root/dist/classes/Entity.json",
        },
      ]);

      assertDecorationDataForPath({
        path,
        expected: {
          Source: undefined, // no decoration for own file type
          Test: {
            badgeText: "🧪",
            tooltip: "🧪 Test",
          },
          "Build Output": {
            badgeText: "📦",
            tooltip: "📦 Build Output",
          },
          Documentation: undefined,
        },
      });
    });

    it("limits icons to 1 character", () => {
      linkManager = new LinkManager();
      linkManager.setContext({
        config: {
          fileTypes: [
            {
              name: "Source",
              icon: "💻💻",
              patterns: ["\\/src\\/(?<topic>.+)\\.ts$"],
            },
            {
              name: "Test",
              icon: "🧪🧪🧪",
              patterns: ["\\/(test|tests)\\/(?<topic>.+)\\.test\\.ts$"],
            },
          ],
          ignorePatterns: ["\\/node_modules\\/"],
        },
        paths: ["/root/src/classes/Entity.ts", "/root/test/classes/Entity.test.ts"],
      });

      assert.deepStrictEqual(
        linkManager.getLinkedFilesFromPath("/root/src/classes/Entity.ts"),
        [
          {
            typeName: "Test",
            icon: "🧪",
            fullPath: "/root/test/classes/Entity.test.ts",
          },
        ],
        "should only use the first character of the test icon",
      );

      assert.deepStrictEqual(
        linkManager.getLinkedFilesFromPath("/root/test/classes/Entity.test.ts"),
        [
          {
            typeName: "Source",
            icon: "💻",
            fullPath: "/root/src/classes/Entity.ts",
          },
        ],
        "should only use the first character of the source icon",
      );
    });
  });

  describe("#reset", () => {
    it("should reset all file types", () => {
      linkManager = createInstanceWithDefaultTestContext();
      linkManager.modifyFilesAndNotify({
        addPaths: [
          "/root/src/classes/Entity.ts",
          "/root/test/classes/Entity.test.ts",
          "/root/test/classes/Entity2.test.ts",
          "/root/docs/classes/Entity.md",
          "/root/unknown/file/path.ts",
          "/root/src/unknown/file/path.ts",
        ],
      });

      const sourcePath = "/root/src/classes/Entity.ts";

      assert.isTrue(
        linkManager.getLinkedFilesFromPath(sourcePath).length > 0,
        "Files related to Source file should be found",
      );

      linkManager.revertToInitial();

      assert.isTrue(
        linkManager.getLinkedFilesFromPath(sourcePath).length === 0,
        "Files related to Source file should not be found after reset",
      );
    });
  });

  describe("#getPathsWithRelatedFiles", () => {
    it("should return all files that have related files", () => {
      linkManager = new LinkManager();
      linkManager.setContext({
        config: TEST_MAIN_CONFIG,
        paths: [
          // ignored files
          "/root/node_modules/package/src/classes/Entity.ts",
          "/root/node_modules/package/test/classes/Entity.test.ts",
          "/root/node_modules/package/docs/classes/Entity.md",

          // non-ignored files
          "/root/src/classes/Entity.ts",
          "/root/src/classes/EntityNoLinks2.ts",
          "/root/test/classes/Entity.test.ts",
          "/root/test/classes/EntityNoLinks1.test.ts",
          "/root/docs/classes/Entity.md",
          "/root/docs/classes/EntityNoLinks3.md",
          "/root/unknown/file/path.ts",
          "/root/src/unknown/file/path.ts",
        ],
      });

      assert.deepStrictEqual(
        linkManager.getAllPathsWithOutgoingLinks(),
        [
          "/root/src/classes/Entity.ts",
          "/root/test/classes/Entity.test.ts",
          "/root/docs/classes/Entity.md",
        ],
        "correct files found",
      );
    });
  });

  type FileLinksExpectationMap = Record<string, LinkedFileData[]>;

  function assertFileLinks(expected: FileLinksExpectationMap, message: string) {
    const actual = Object.fromEntries(
      linkManager
        .getAllPathsWithOutgoingLinks()
        .map((path) => [path, linkManager.getLinkedFilesFromPath(path)]),
    );

    assert.deepStrictEqual(actual, expected, message);
  }

  describe("context update handling", () => {
    function assertFileModification(config: {
      initial: {
        paths: string[];
        links: FileLinksExpectationMap;
      };
      fileModifications: {
        addPaths?: string[];
        removePaths?: string[];
      };
      expect: {
        links: FileLinksExpectationMap;
        pathsEmitted: string[] | null;
        pathsEmittedAfterUndo: string[] | null;
      };
    }): void {
      const mainConfig = TEST_MAIN_CONFIG;
      linkManager = new LinkManager();
      linkManager.setContext({
        config: mainConfig,
        paths: config.initial.paths,
      });

      assertFileLinks(config.initial.links, "initial linked files");

      // when a file is added VS Code will get the decorations for the new files before the file watcher
      // has notified us of the new file, so doing the same here to simulate that as this caused bugs previously due to caching
      config.fileModifications.addPaths?.forEach((path) => {
        mainConfig.fileTypes.forEach((fileType) => {
          linkManager.getFileTypeDecoratorData({ fileTypeName: fileType.name, path });
        });
      });

      const linksUpdatedHandler = vitest.fn<[string[] | null]>();
      linkManager.setOnFileLinksUpdatedHandler(linksUpdatedHandler);
      linkManager.modifyFilesAndNotify(config.fileModifications);

      assertFileLinks(config.expect.links, "linked files after modifications");

      assert.deepStrictEqual(
        linksUpdatedHandler.mock.calls,
        [[config.expect.pathsEmitted]],
        "linksUpdatedHandler called with correct paths",
      );
      linksUpdatedHandler.mockClear();

      // undo modifications
      linkManager.modifyFilesAndNotify({
        addPaths: config.fileModifications.removePaths,
        removePaths: config.fileModifications.addPaths,
      });

      assertFileLinks(config.initial.links, "linked files after undoing modifications");

      assert.deepStrictEqual(
        linksUpdatedHandler.mock.calls,
        [[config.expect.pathsEmittedAfterUndo]],
        "linksUpdatedHandler called with correct paths after undoing modifications",
      );
    }

    it("can add multiple paths and notifies of changed paths", () => {
      assertFileModification({
        initial: {
          paths: [
            // "/root/src/classes/Entity.ts", // not added
            "/root/test/classes/Entity.test.ts",
            "/root/test/classes/Entity2.test.ts",
            "/root/docs/classes/Entity.md",
            // "/root/dist/classes/Entity.js", // not added
            "/root/unknown/file/path.ts",
            "/root/src/unknown/file/path.ts",
          ],
          links: {
            "/root/test/classes/Entity.test.ts": [
              { fullPath: "/root/docs/classes/Entity.md", icon: "📖", typeName: "Documentation" },
            ],
          },
        },
        fileModifications: {
          addPaths: ["/root/src/classes/Entity.ts", "/root/dist/classes/Entity.js"],
        },
        expect: {
          links: {
            "/root/dist/classes/Entity.js": [
              { icon: "💻", fullPath: "/root/src/classes/Entity.ts", typeName: "Source" },
              { icon: "🧪", fullPath: "/root/test/classes/Entity.test.ts", typeName: "Test" },
              { icon: "📖", fullPath: "/root/docs/classes/Entity.md", typeName: "Documentation" },
            ],
            "/root/docs/classes/Entity.md": [
              { icon: "💻", fullPath: "/root/src/classes/Entity.ts", typeName: "Source" },
            ],
            "/root/src/classes/Entity.ts": [
              { icon: "🧪", fullPath: "/root/test/classes/Entity.test.ts", typeName: "Test" },
              { icon: "📖", fullPath: "/root/docs/classes/Entity.md", typeName: "Documentation" },
              { icon: "📦", fullPath: "/root/dist/classes/Entity.js", typeName: "Build Output" },
            ],
            "/root/test/classes/Entity.test.ts": [
              { icon: "💻", fullPath: "/root/src/classes/Entity.ts", typeName: "Source" },
              { icon: "📖", fullPath: "/root/docs/classes/Entity.md", typeName: "Documentation" },
            ],
          },
          pathsEmitted: [
            "/root/src/classes/Entity.ts",
            "/root/dist/classes/Entity.js",
            "/root/test/classes/Entity.test.ts",
            "/root/docs/classes/Entity.md",
          ],
          pathsEmittedAfterUndo: [
            "/root/test/classes/Entity.test.ts",
            "/root/docs/classes/Entity.md",
          ],
        },
      });
    });

    it("can remove paths and notifies of changed paths", () => {
      assertFileModification({
        initial: {
          paths: [
            "/root/src/classes/Entity.ts",
            "/root/test/classes/Entity.test.ts",
            "/root/test/classes/Entity2.test.ts",
            "/root/docs/classes/Entity.md",
            "/root/dist/classes/Entity.js",
            "/root/unknown/file/path.ts",
            "/root/src/unknown/file/path.ts",
          ],
          links: {
            "/root/dist/classes/Entity.js": [
              { fullPath: "/root/src/classes/Entity.ts", icon: "💻", typeName: "Source" },
              { fullPath: "/root/test/classes/Entity.test.ts", icon: "🧪", typeName: "Test" },
              { fullPath: "/root/docs/classes/Entity.md", icon: "📖", typeName: "Documentation" },
            ],
            "/root/docs/classes/Entity.md": [
              { fullPath: "/root/src/classes/Entity.ts", icon: "💻", typeName: "Source" },
            ],
            "/root/src/classes/Entity.ts": [
              { fullPath: "/root/test/classes/Entity.test.ts", icon: "🧪", typeName: "Test" },
              { fullPath: "/root/docs/classes/Entity.md", icon: "📖", typeName: "Documentation" },
              { fullPath: "/root/dist/classes/Entity.js", icon: "📦", typeName: "Build Output" },
            ],
            "/root/test/classes/Entity.test.ts": [
              { fullPath: "/root/src/classes/Entity.ts", icon: "💻", typeName: "Source" },
              { fullPath: "/root/docs/classes/Entity.md", icon: "📖", typeName: "Documentation" },
            ],
          },
        },
        fileModifications: {
          removePaths: ["/root/src/classes/Entity.ts"],
        },
        expect: {
          links: {
            "/root/dist/classes/Entity.js": [
              // asserts source file link was removed
              { fullPath: "/root/test/classes/Entity.test.ts", icon: "🧪", typeName: "Test" },
              { fullPath: "/root/docs/classes/Entity.md", icon: "📖", typeName: "Documentation" },
            ],
            // asserts documentation file has no links after source file removal
            // asserts source file not listed as having links
            "/root/test/classes/Entity.test.ts": [
              // asserts source file link was removed
              { fullPath: "/root/docs/classes/Entity.md", icon: "📖", typeName: "Documentation" },
            ],
          },
          pathsEmitted: [
            "/root/test/classes/Entity.test.ts",
            "/root/docs/classes/Entity.md",
            "/root/dist/classes/Entity.js",
          ],
          pathsEmittedAfterUndo: [
            "/root/src/classes/Entity.ts",
            "/root/test/classes/Entity.test.ts",
            "/root/docs/classes/Entity.md",
            "/root/dist/classes/Entity.js",
          ],
        },
      });
    });

    it("can rename paths from having no links to some links and notifies of changed paths", () => {
      assertFileModification({
        initial: {
          paths: ["/root/src/classes/Entity2.ts", "/root/test/classes/Entity.test.ts"],
          links: {},
        },
        fileModifications: {
          removePaths: ["/root/src/classes/Entity2.ts"],
          addPaths: ["/root/src/classes/Entity.ts"],
        },
        expect: {
          links: {
            "/root/src/classes/Entity.ts": [
              { icon: "🧪", fullPath: "/root/test/classes/Entity.test.ts", typeName: "Test" },
            ],
            "/root/test/classes/Entity.test.ts": [
              { icon: "💻", fullPath: "/root/src/classes/Entity.ts", typeName: "Source" },
            ],
          },
          pathsEmitted: ["/root/src/classes/Entity.ts", "/root/test/classes/Entity.test.ts"],
          pathsEmittedAfterUndo: [
            "/root/src/classes/Entity2.ts",
            "/root/test/classes/Entity.test.ts",
          ],
        },
      });
    });

    it("can rename paths from having some links to no links and notifies of changed paths", () => {
      assertFileModification({
        initial: {
          paths: ["/root/src/classes/Entity.ts", "/root/test/classes/Entity.test.ts"],
          links: {
            "/root/src/classes/Entity.ts": [
              { icon: "🧪", fullPath: "/root/test/classes/Entity.test.ts", typeName: "Test" },
            ],
            "/root/test/classes/Entity.test.ts": [
              { icon: "💻", fullPath: "/root/src/classes/Entity.ts", typeName: "Source" },
            ],
          },
        },
        fileModifications: {
          removePaths: ["/root/src/classes/Entity.ts"],
          addPaths: ["/root/src/classes/Entity2.ts"],
        },
        expect: {
          links: {},
          pathsEmitted: ["/root/src/classes/Entity2.ts", "/root/test/classes/Entity.test.ts"],
          pathsEmittedAfterUndo: [
            "/root/src/classes/Entity.ts",
            "/root/test/classes/Entity.test.ts",
          ],
        },
      });
    });

    it("can rename paths to change links and notifies of changed paths", () => {
      assertFileModification({
        initial: {
          paths: [
            "/root/src/classes/Entity.ts",
            "/root/test/classes/Entity.test.ts",
            "/root/test/classes/Entity2.test.ts",
          ],
          links: {
            "/root/src/classes/Entity.ts": [
              { icon: "🧪", fullPath: "/root/test/classes/Entity.test.ts", typeName: "Test" },
            ],
            "/root/test/classes/Entity.test.ts": [
              { icon: "💻", fullPath: "/root/src/classes/Entity.ts", typeName: "Source" },
            ],
          },
        },
        fileModifications: {
          removePaths: ["/root/src/classes/Entity.ts"],
          addPaths: ["/root/src/classes/Entity2.ts"],
        },
        expect: {
          links: {
            "/root/src/classes/Entity2.ts": [
              { icon: "🧪", fullPath: "/root/test/classes/Entity2.test.ts", typeName: "Test" },
            ],
            "/root/test/classes/Entity2.test.ts": [
              { icon: "💻", fullPath: "/root/src/classes/Entity2.ts", typeName: "Source" },
            ],
          },
          pathsEmitted: [
            "/root/src/classes/Entity2.ts",
            "/root/test/classes/Entity2.test.ts",
            "/root/test/classes/Entity.test.ts",
          ],
          pathsEmittedAfterUndo: [
            "/root/src/classes/Entity.ts",
            "/root/test/classes/Entity.test.ts",
            "/root/test/classes/Entity2.test.ts",
          ],
        },
      });
    });

    it("can handle folder removal and notifies of changed paths", () => {
      linkManager = new LinkManager();
      linkManager.setContext({
        config: TEST_MAIN_CONFIG,
        paths: ["/root/src/classes/Entity.ts", "/root/test/classes/Entity.test.ts"],
      });

      assertFileLinks(
        {
          "/root/src/classes/Entity.ts": [
            { icon: "🧪", fullPath: "/root/test/classes/Entity.test.ts", typeName: "Test" },
          ],
          "/root/test/classes/Entity.test.ts": [
            { icon: "💻", fullPath: "/root/src/classes/Entity.ts", typeName: "Source" },
          ],
        },
        "initial linked files",
      );

      const linksUpdatedHandler = vitest.fn<[string[] | null]>();
      linkManager.setOnFileLinksUpdatedHandler(linksUpdatedHandler);
      linkManager.modifyFilesAndNotify({ removePaths: ["/root/src/classes"] }); // will delete source file

      assertFileLinks({}, "linked files after modifications");

      assert.deepStrictEqual(
        linksUpdatedHandler.mock.calls,
        [[["/root/test/classes/Entity.test.ts"]]],
        "linksUpdatedHandler called with correct paths",
      );
      linksUpdatedHandler.mockClear();

      // re-add file
      linkManager.modifyFilesAndNotify({ addPaths: ["/root/src/classes/Entity.ts"] });

      assertFileLinks(
        {
          "/root/src/classes/Entity.ts": [
            { icon: "🧪", fullPath: "/root/test/classes/Entity.test.ts", typeName: "Test" },
          ],
          "/root/test/classes/Entity.test.ts": [
            { icon: "💻", fullPath: "/root/src/classes/Entity.ts", typeName: "Source" },
          ],
        },
        "linked files after re-adding file",
      );

      // this is to check the test file was not deleted and can still be linked if the source file is re-added
      assert.deepStrictEqual(
        linksUpdatedHandler.mock.calls,
        [[["/root/src/classes/Entity.ts", "/root/test/classes/Entity.test.ts"]]],
        "linksUpdatedHandler called with correct paths",
      );
    });

    it("does nothing when deleted folder partially matches an existing folder", () => {
      linkManager = new LinkManager();
      linkManager.setContext({
        config: TEST_MAIN_CONFIG,
        paths: ["/root/src/classes/Entity.ts", "/root/test/classes/Entity.test.ts"],
      });

      const INITIAL_FILE_LINKS: FileLinksExpectationMap = {
        "/root/src/classes/Entity.ts": [
          { icon: "🧪", fullPath: "/root/test/classes/Entity.test.ts", typeName: "Test" },
        ],
        "/root/test/classes/Entity.test.ts": [
          { icon: "💻", fullPath: "/root/src/classes/Entity.ts", typeName: "Source" },
        ],
      };

      assertFileLinks(INITIAL_FILE_LINKS, "initial linked files");

      const linksUpdatedHandler = vitest.fn<[string[] | null]>();
      linkManager.setOnFileLinksUpdatedHandler(linksUpdatedHandler);
      linkManager.modifyFilesAndNotify({ removePaths: ["/root/src/class"] }); // will delete source file

      assertFileLinks(INITIAL_FILE_LINKS, "linked files not changed");

      assert.deepStrictEqual(linksUpdatedHandler.mock.calls, [], "linksUpdatedHandler not called");
    });

    it("does nothing if files with unknown types are added, removed, or renamed", () => {
      linkManager = new LinkManager();
      linkManager.setContext({
        config: TEST_MAIN_CONFIG,
        paths: [
          "/root/src/classes/Entity.ts",
          "/root/test/classes/Entity.test.ts",
          "/root/test/classes/Entity2.test.ts",
          "/root/docs/classes/Entity.md",
          "/root/dist/classes/Entity.js",
          "/root/unknown/file/path.ts",
          "/root/src/unknown/file/path.ts",
        ],
      });

      const initialFileLinks = {
        "/root/dist/classes/Entity.js": [
          { fullPath: "/root/src/classes/Entity.ts", icon: "💻", typeName: "Source" },
          { fullPath: "/root/test/classes/Entity.test.ts", icon: "🧪", typeName: "Test" },
          { fullPath: "/root/docs/classes/Entity.md", icon: "📖", typeName: "Documentation" },
        ],
        "/root/docs/classes/Entity.md": [
          { fullPath: "/root/src/classes/Entity.ts", icon: "💻", typeName: "Source" },
        ],
        "/root/src/classes/Entity.ts": [
          { fullPath: "/root/test/classes/Entity.test.ts", icon: "🧪", typeName: "Test" },
          { fullPath: "/root/docs/classes/Entity.md", icon: "📖", typeName: "Documentation" },
          { fullPath: "/root/dist/classes/Entity.js", icon: "📦", typeName: "Build Output" },
        ],
        "/root/test/classes/Entity.test.ts": [
          { fullPath: "/root/src/classes/Entity.ts", icon: "💻", typeName: "Source" },
          { fullPath: "/root/docs/classes/Entity.md", icon: "📖", typeName: "Documentation" },
        ],
      };

      assertFileLinks(initialFileLinks, "linked files found");

      const linksUpdatedHandler = vitest.fn<[string[] | null]>();
      linkManager.setOnFileLinksUpdatedHandler(linksUpdatedHandler);

      linkManager.modifyFilesAndNotify({
        removePaths: ["/root/unknown/file/path.ts"],
        addPaths: ["/root/unknown/file/path2.ts"],
      });

      assertFileLinks(initialFileLinks, "linked files unchanged");
      assert.deepStrictEqual(linksUpdatedHandler.mock.calls, [], "linksUpdatedHandler not called");
    });

    it("can update context", () => {
      linkManager = new LinkManager();

      const paths = [
        "/root/node_modules/package/src/classes/Entity.ts",
        "/root/node_modules/package/test/classes/Entity.test.ts",
        "/root/src/classes/Entity.ts",
        "/root/test/classes/Entity.test.ts",
        "/root/test/classes/Entity2.test.ts",
        "/root/docs/classes/Entity.md",
        "/root/dist/classes/Entity.js",
        "/root/other/classes/Entity.ts",
        "/root/unknown/file/path.ts",
        "/root/unknown/dir/file/path.ts",
      ];

      linkManager.setContext({
        config: TEST_MAIN_CONFIG,
        paths,
      });

      const initialFileLinks = {
        "/root/dist/classes/Entity.js": [
          { fullPath: "/root/src/classes/Entity.ts", icon: "💻", typeName: "Source" },
          { fullPath: "/root/test/classes/Entity.test.ts", icon: "🧪", typeName: "Test" },
          { fullPath: "/root/docs/classes/Entity.md", icon: "📖", typeName: "Documentation" },
        ],
        "/root/docs/classes/Entity.md": [
          { fullPath: "/root/src/classes/Entity.ts", icon: "💻", typeName: "Source" },
        ],
        "/root/src/classes/Entity.ts": [
          { fullPath: "/root/test/classes/Entity.test.ts", icon: "🧪", typeName: "Test" },
          { fullPath: "/root/docs/classes/Entity.md", icon: "📖", typeName: "Documentation" },
          { fullPath: "/root/dist/classes/Entity.js", icon: "📦", typeName: "Build Output" },
        ],
        "/root/test/classes/Entity.test.ts": [
          { fullPath: "/root/src/classes/Entity.ts", icon: "💻", typeName: "Source" },
          { fullPath: "/root/docs/classes/Entity.md", icon: "📖", typeName: "Documentation" },
        ],
      };

      assertFileLinks(initialFileLinks, "initial linked files found");

      const linksUpdatedHandler = vitest.fn<[string[] | null]>();
      linkManager.setOnFileLinksUpdatedHandler(linksUpdatedHandler);

      linkManager.setContext({
        config: {
          fileTypes: [
            {
              name: "Source",
              icon: "💻",
              patterns: ["(?<prefix>.*)\\/src\\/(?<topic>.+)\\.ts$"],
            },
            {
              name: "Test",
              icon: "🧪",
              patterns: ["(?<prefix>.*)\\/(test|tests)\\/(?<topic>.+)\\.test\\.ts$"],
            },
            // add new type
            {
              name: "Other",
              icon: "🆕",
              patterns: ["(?<prefix>.*)\\/other\\/(?<topic>.+)\\.ts$"],
            },
          ],
          ignorePatterns: [], // includes node_modules
          autoJump: true,
        },
        paths,
      });

      assertFileLinks(
        {
          // previously ignored file is now linked
          "/root/node_modules/package/src/classes/Entity.ts": [
            {
              fullPath: "/root/node_modules/package/test/classes/Entity.test.ts",
              icon: "🧪",
              typeName: "Test",
            },
          ],
          // previously ignored file is now linked
          "/root/node_modules/package/test/classes/Entity.test.ts": [
            {
              fullPath: "/root/node_modules/package/src/classes/Entity.ts",
              icon: "💻",
              typeName: "Source",
            },
          ],
          // new file type files have links
          "/root/other/classes/Entity.ts": [
            {
              fullPath: "/root/src/classes/Entity.ts",
              icon: "💻",
              typeName: "Source",
            },
            {
              fullPath: "/root/test/classes/Entity.test.ts",
              icon: "🧪",
              typeName: "Test",
            },
          ],
          "/root/src/classes/Entity.ts": [
            {
              fullPath: "/root/test/classes/Entity.test.ts",
              icon: "🧪",
              typeName: "Test",
            },
            // new file type added
            {
              fullPath: "/root/other/classes/Entity.ts",
              icon: "🆕",
              typeName: "Other",
            },
          ],
          "/root/test/classes/Entity.test.ts": [
            {
              fullPath: "/root/src/classes/Entity.ts",
              icon: "💻",
              typeName: "Source",
            },
            // new file type added
            {
              fullPath: "/root/other/classes/Entity.ts",
              icon: "🆕",
              typeName: "Other",
            },
          ],
        },
        "file links updated after context change",
      );
      assert.deepStrictEqual(
        linksUpdatedHandler.mock.calls,
        [[null]],
        "linksUpdatedHandler called to update all paths after context change",
      );
      linksUpdatedHandler.mockClear();

      // Revert context change
      linkManager.setContext({
        config: TEST_MAIN_CONFIG,
        paths,
      });

      assertFileLinks(initialFileLinks, "file links updated after context reverted");
      assert.deepStrictEqual(
        linksUpdatedHandler.mock.calls,
        [[null]],
        "linksUpdatedHandler called to update all paths after context reverted",
      );
    });

    it("does nothing if context is unchanged", () => {
      const paths = [
        "/root/node_modules/package/src/classes/Entity.ts",
        "/root/node_modules/package/test/classes/Entity.test.ts",
        "/root/src/classes/Entity.ts",
        "/root/test/classes/Entity.test.ts",
        "/root/test/classes/Entity2.test.ts",
        "/root/docs/classes/Entity.md",
        "/root/dist/classes/Entity.js",
        "/root/other/classes/Entity.ts",
        "/root/unknown/file/path.ts",
        "/root/unknown/dir/file/path.ts",
      ];

      const initialFileLinks = {
        "/root/dist/classes/Entity.js": [
          { fullPath: "/root/src/classes/Entity.ts", icon: "💻", typeName: "Source" },
          { fullPath: "/root/test/classes/Entity.test.ts", icon: "🧪", typeName: "Test" },
          { fullPath: "/root/docs/classes/Entity.md", icon: "📖", typeName: "Documentation" },
        ],
        "/root/docs/classes/Entity.md": [
          { fullPath: "/root/src/classes/Entity.ts", icon: "💻", typeName: "Source" },
        ],
        "/root/src/classes/Entity.ts": [
          { fullPath: "/root/test/classes/Entity.test.ts", icon: "🧪", typeName: "Test" },
          { fullPath: "/root/docs/classes/Entity.md", icon: "📖", typeName: "Documentation" },
          { fullPath: "/root/dist/classes/Entity.js", icon: "📦", typeName: "Build Output" },
        ],
        "/root/test/classes/Entity.test.ts": [
          { fullPath: "/root/src/classes/Entity.ts", icon: "💻", typeName: "Source" },
          { fullPath: "/root/docs/classes/Entity.md", icon: "📖", typeName: "Documentation" },
        ],
      };

      linkManager = new LinkManager();
      linkManager.setContext({ config: TEST_MAIN_CONFIG, paths });

      assertFileLinks(initialFileLinks, "initial linked files found");

      const linksUpdatedHandler = vitest.fn<[string[] | null]>();
      linkManager.setOnFileLinksUpdatedHandler(linksUpdatedHandler);

      linkManager.setContext({ config: TEST_MAIN_CONFIG, paths });

      assertFileLinks(initialFileLinks, "file links unchanged");
      assert.deepStrictEqual(linksUpdatedHandler.mock.calls, [], "linksUpdatedHandler not called");
    });
  });

  describe("performance", () => {
    const config: RawMainConfig = {
      fileTypes: [
        {
          name: "Source",
          icon: "💻",
          patterns: ["(?<!\\/tests\\/)lib\\/(?<topic>.+)\\.(js|jsx|ts|tsx)$"],
        },
        {
          name: "Test",
          icon: "🧪",
          patterns: ["(?<=\\/tests\\/)lib\\/(?<topic>.+)\\.(js|jsx|ts|tsx)$"],
        },
        {
          name: "Documentation",
          icon: "📙",
          patterns: ["\\/docs\\/src\\/(?<topic>.+)\\.md$"],
        },
      ],
      ignorePatterns: ["\\/node_modules\\/"],
    };

    type PathToDecorationsMap = Record<string, DecorationData[] | null>;

    it("should be fast and accurate", () => {
      const eslintPathsPath = pathModule.join(
        __dirname,
        "LinkManagerTestData/eslint-project-files.json",
      );
      const eslintPaths = JSON.parse(fs.readFileSync(eslintPathsPath, "utf8")) as string[];
      const fileCount = eslintPaths.length;
      console.log(`Testing ${fileCount} Eslint files`);

      let actualDecorationsMap: PathToDecorationsMap = {};
      Array(3) // running this multiple times to see if it gets slower
        .fill(0)
        .forEach((_, i) => {
          console.log("Running test", i);
          linkManager = new LinkManager();

          // add all the files
          let startTime = Date.now();
          linkManager.setContext({ config, paths: eslintPaths });
          const addPathsDurationMs = Date.now() - startTime;

          console.log("#setContext actually took", addPathsDurationMs, "ms");
          assert.isBelow(addPathsDurationMs, 100, `time (ms) to add ${fileCount} files`);

          // get the decorations for all the files

          actualDecorationsMap = {};
          startTime = Date.now();
          eslintPaths.forEach((path) => {
            TEST_FILE_TYPE_NAMES.forEach((fileTypeName) => {
              const decoration = linkManager.getFileTypeDecoratorData({ path, fileTypeName });
              if (decoration) {
                const pathDecorations = actualDecorationsMap[path] || [];
                pathDecorations.push(decoration);
                actualDecorationsMap[path] = pathDecorations;
              }
            });
          });
          const getDecorationsDurationMs = Date.now() - startTime;
          console.log("#getDecorations actually took", getDecorationsDurationMs, "ms");
          assert.isBelow(
            getDecorationsDurationMs,
            150,
            `time (ms) to get decorations for ${fileCount} files`,
          );

          linkManager.revertToInitial();

          console.log("-".repeat(30), "\n");
        });

      // assert that the actual decorations match the snapshot
      const expectedDecorationsPath = pathModule.join(
        __dirname,
        "LinkManagerTestData/expected-eslint-project-decorations.json",
      );
      const expectedDecorationsSnapshotExists = fs.existsSync(expectedDecorationsPath);
      if (expectedDecorationsSnapshotExists) {
        const actualDecorationsPath = pathModule.join(
          __dirname,
          "LinkManagerTestData/actual-eslint-project-decorations.json",
        );
        fs.writeFileSync(actualDecorationsPath, JSON.stringify(actualDecorationsMap, null, 2));
        const expectedDecorationsMap: PathToDecorationsMap = JSON.parse(
          fs.readFileSync(expectedDecorationsPath, "utf8"),
        );

        // using deep strict equal produces unhelpful diff because the data is large, so we do a manual comparison for each item
        Object.entries(expectedDecorationsMap).forEach(([path, expectedFileDecorations]) => {
          const actualFileDecorations = actualDecorationsMap[path];
          assert.isDefined(actualFileDecorations, `actual decorations for ${path} should exist`);
          assert.deepStrictEqual(
            actualFileDecorations,
            expectedFileDecorations,
            `decorations for "${path}" should match expected`,
          );
        });

        // asserting the total count after so we see any differences first
        assert.strictEqual(
          Object.keys(actualDecorationsMap).length,
          Object.keys(expectedDecorationsMap).length,
          "same number of files should be decorated",
        );
        // create the snapshot file
      } else {
        fs.writeFileSync(
          expectedDecorationsPath,
          JSON.stringify(actualDecorationsMap, null, 2),
          "utf8",
        );
        assert.fail("eslint decorations snapshot file created");
      }
    });
  });

  it("supports matching with a common prefix", () => {
    linkManager = new LinkManager();
    linkManager.setContext({
      config: {
        fileTypes: [
          {
            name: "Source",
            icon: "💻",
            patterns: ["(?<prefix>.*)\\/src\\/(?<topic>.+)\\.ts$"],
          },
          {
            name: "Test",
            icon: "🧪",
            patterns: ["(?<prefix>.*)\\/(test|tests)\\/(?<topic>.+)\\.test\\.ts$"],
          },
        ],
        ignorePatterns: [],
      },
      paths: [
        // app 1 files
        "/root/app1/src/classes/Entity.ts",
        "/root/app1/test/classes/Entity.test.ts",
        "/root/app1/test/classes/Entity2.test.ts",
        "/root/app1/docs/classes/Entity.md",
        "/root/app1/dist/classes/Entity.js",

        // app 2 files (same structure)
        "/root/app2/src/classes/Entity.ts",
        "/root/app2/test/classes/Entity.test.ts",
        "/root/app2/test/classes/Entity2.test.ts",
        "/root/app2/docs/classes/Entity.md",
        "/root/app2/dist/classes/Entity.js",

        // unknown files
        "/root/unknown/file/path.ts",
        "/root/src/unknown/file/path.ts",
      ],
    });

    assertFileLinks(
      {
        // asserts app1 files linked to app1 files only
        "/root/app1/src/classes/Entity.ts": [
          {
            fullPath: "/root/app1/test/classes/Entity.test.ts",
            icon: "🧪",
            typeName: "Test",
          },
        ],
        "/root/app1/test/classes/Entity.test.ts": [
          {
            fullPath: "/root/app1/src/classes/Entity.ts",
            icon: "💻",
            typeName: "Source",
          },
        ],

        // asserts app2 files linked to app2 files only
        "/root/app2/src/classes/Entity.ts": [
          {
            fullPath: "/root/app2/test/classes/Entity.test.ts",
            icon: "🧪",
            typeName: "Test",
          },
        ],
        "/root/app2/test/classes/Entity.test.ts": [
          {
            fullPath: "/root/app2/src/classes/Entity.ts",
            icon: "💻",
            typeName: "Source",
          },
        ],
      },
      "linked files found",
    );
  });

  describe("ignoreNonAlphaNumericCharacters option", () => {
    it("does not ignore non-alphanumeric characters by default", () => {
      linkManager = new LinkManager();
      linkManager.setContext({
        config: {
          fileTypes: [
            {
              name: "Source",
              icon: "💻",
              patterns: ["(?<prefix>.*)\\/src\\/(?<topic>.+)\\.ts$"],
            },
            {
              name: "Styles",
              icon: "💄",
              patterns: ["(?<prefix>.*)\\/styles\\/(?<topic>.+)\\.css$"],
            },
          ],
          ignorePatterns: [],
        },
        paths: [
          "/root/app/src/components/SomeControl.ts",
          "/root/app/styles/components/some-control.css",
        ],
      });

      assertFileLinks({}, "no links by default without option");
    });

    it("ignores non-alphanumeric characters with option", () => {
      linkManager = new LinkManager();
      linkManager.setContext({
        config: {
          fileTypes: [
            {
              name: "Source",
              icon: "💻",
              patterns: ["(?<prefix>.*)\\/src\\/(?<topic>.+)\\.ts$"],
            },
            {
              name: "Styles",
              icon: "💄",
              patterns: ["(?<prefix>.*)\\/styles\\/(?<topic>.+)\\.css$"],
              ignoreNonAlphaNumericCharacters: true,
            },
          ],
          ignorePatterns: [],
        },
        paths: [
          "/root/app/src/components/SomeControl.ts",
          "/root/app/styles/components/some-control.css",
        ],
      });

      assertFileLinks(
        {
          "/root/app/src/components/SomeControl.ts": [
            {
              fullPath: "/root/app/styles/components/some-control.css",
              icon: "💄",
              typeName: "Styles",
            },
          ],
          "/root/app/styles/components/some-control.css": [
            {
              fullPath: "/root/app/src/components/SomeControl.ts",
              icon: "💻",
              typeName: "Source",
            },
          ],
        },
        "finds links with option",
      );
    });
  });

  describe(LinkManager.prototype.getAllPathsWithPossibleCreationsEntries.name, () => {
    it("should return all paths with possible creations entries", () => {
      linkManager = new LinkManager();
      linkManager.setContext({
        config: {
          fileTypes: [
            {
              name: "Source",
              icon: "💻",
              patterns: ["\\/src\\/(?<topic>.+)\\.ts$"],
              creationPatterns: [
                {
                  name: "Test",
                  icon: "🧪",
                  pathTransformations: [
                    {
                      searchRegex: "\\/src\\/",
                      replacementText: "/test/",
                    },
                    {
                      searchRegex: "\\.ts$",
                      replacementText: ".test.ts",
                    },
                  ],
                },
              ],
            },
            {
              name: "Test",
              icon: "🧪",
              patterns: ["\\/(test|tests)\\/(?<topic>.+)\\.test\\.ts$"],
              creationPatterns: [
                {
                  name: "Source",
                  icon: "💻",
                  pathTransformations: [
                    {
                      searchRegex: "\\/test\\/",
                      replacementText: "/src/",
                    },
                    {
                      searchRegex: "\\.test\\.ts$",
                      replacementText: ".ts",
                    },
                  ],
                },
              ],
            },
            {
              name: "Documentation",
              icon: "📖",
              patterns: ["\\/(docs|docs)\\/(?<topic>.+)\\.md$"],
              onlyLinkTo: ["Source"],
            },
          ],
          ignorePatterns: ["\\/node_modules\\/"],
        },
        paths: [
          "/root/src/classes/Entity.ts",
          "/root/test/classes/Entity.test.ts",
          "/root/docs/classes/Entity.md",
          "/root/unknown/file/path.ts",
        ],
      });

      assert.deepStrictEqual(
        linkManager.getAllPathsWithPossibleCreationsEntries(),
        [
          [
            "/root/src/classes/Entity.ts",
            [
              {
                fullPath: "/root/test/classes/Entity.test.ts",
                icon: "🧪",
                initialContentSnippet: undefined,
                name: "Test",
              },
            ],
          ],
          [
            "/root/test/classes/Entity.test.ts",
            [
              {
                fullPath: "/root/src/classes/Entity.ts",
                icon: "💻",
                initialContentSnippet: undefined,
                name: "Source",
              },
            ],
          ],
        ],
        "correct file creations proposed",
      );
    });
  });
});
