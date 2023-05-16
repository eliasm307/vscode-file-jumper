import type { MockedObject } from "vitest";
import { describe, vitest, afterEach, beforeEach, assert, it } from "vitest";
import type { LogOutputChannel } from "./Logger";
import Logger from "./Logger";

describe("Logger", () => {
  let consoleStubs: MockedObject<Pick<Console, "info" | "warn" | "error">>;

  function createStubbedLogOutputChannel(): MockedObject<LogOutputChannel> {
    return {
      info: vitest.fn(),
      warn: vitest.fn(),
      error: vitest.fn(),
    };
  }

  function createExoticObject() {
    return {
      number: 1,
      string: "test",
      boolean: true,
      array: [1, 2, 3],
      object: {
        number: 1,
        string: "test",
        boolean: true,
        array: [1, 2, 3],
        promise: Promise.resolve(),
      },
      map: new Map<string, unknown>([
        ["number", 1],
        ["string", "test"],
        ["boolean", true],
        ["array", [1, 2, 3]],
        ["object", { number: 1, string: "test", boolean: true, array: [1, 2, 3] }],
      ]),
      set: new Set([1, 2, 3]),
      date: new Date(0),
      regexp: /test/,
      error: new Error("test"),
      function: () => {},
      symbol: Symbol("test"),
      undef: undefined,
      promise: Promise.resolve(),
    };
  }

  const EXPECTED_SERIALIZED_EXOTIC_OBJECT = [
    "{",
    '  "number": 1,',
    '  "string": "test",',
    '  "boolean": true,',
    '  "array": [',
    "    1,",
    "    2,",
    "    3",
    "  ],",
    '  "object": {',
    '    "number": 1,',
    '    "string": "test",',
    '    "boolean": true,',
    '    "array": [',
    "      1,",
    "      2,",
    "      3",
    "    ],",
    '    "promise": "[Promise]"',
    "  },",
    '  "map": {',
    '    "number": 1,',
    '    "string": "test",',
    '    "boolean": true,',
    '    "array": [',
    "      1,",
    "      2,",
    "      3",
    "    ],",
    '    "object": {',
    '      "number": 1,',
    '      "string": "test",',
    '      "boolean": true,',
    '      "array": [',
    "        1,",
    "        2,",
    "        3",
    "      ]",
    "    }",
    "  },",
    '  "set": [',
    "    1,",
    "    2,",
    "    3",
    "  ],",
    '  "date": "1970-01-01T00:00:00.000Z",',
    '  "regexp": "/test/",',
    '  "error": "Error(\\"test\\")",',
    '  "function": "[Function]",',
    '  "symbol": "Symbol(\\"test\\")",',
    '  "undef": "undefined",',
    '  "promise": "[Promise]"',
    "}",
  ].join("\n");

  beforeEach(() => {
    consoleStubs = {
      info: vitest.fn(),
      warn: vitest.fn(),
      error: vitest.fn(),
    };
    vitest.spyOn(global.console, "info").mockImplementation(consoleStubs.info);
    vitest.spyOn(global.console, "warn").mockImplementation(consoleStubs.warn);
    vitest.spyOn(global.console, "error").mockImplementation(consoleStubs.error);
  });

  afterEach(() => {
    Logger.reset();
  });

  describe("#log", () => {
    it("does not log if logger is disabled", () => {
      Logger.log("test", "test2", 1, true);
      assert.deepStrictEqual(consoleStubs.info.mock.calls, [], "console.log should not be called");
    });

    it("does not log if no arguments are provided", () => {
      Logger.setEnabled(true);
      Logger.log();
      assert.deepStrictEqual(consoleStubs.info.mock.calls, [], "console.log should not be called");
    });

    it("logs if logger is enabled", () => {
      Logger.setEnabled(true);
      Logger.log("test", "test2", 1, true);
      assert.deepStrictEqual(consoleStubs.info.mock.calls, [["[co-locate]", "test", "test2", "1", "true"]], "console.log should be called");
    });

    it("logs to outputChannel if provided", () => {
      Logger.setEnabled(true);
      const outputChannel = createStubbedLogOutputChannel();
      Logger.setOutputChannel(outputChannel);
      Logger.log("test", "test2", "1", "true");

      assert.deepStrictEqual(
        outputChannel.info.mock.calls,
        [["[co-locate]", "test", "test2", "1", "true", "\n"]],
        "outputChannel.info should be called",
      );
    });

    it("can log exotic objects to console and output channel", () => {
      Logger.setEnabled(true);
      const outputChannelStubs = createStubbedLogOutputChannel();
      Logger.setOutputChannel(outputChannelStubs);
      Logger.log(createExoticObject());
      assert.deepStrictEqual(
        consoleStubs.info.mock.calls,
        [["[co-locate]", EXPECTED_SERIALIZED_EXOTIC_OBJECT]],
        "console.log should be called",
      );
      assert.deepStrictEqual(
        outputChannelStubs.info.mock.calls,
        [["[co-locate]", EXPECTED_SERIALIZED_EXOTIC_OBJECT, "\n"]],
        "outputChannel.info should be called",
      );
    });
  });
});
