import { describe, it, assert } from "vitest";
import jsonSchemaToMarkdown, { VSCodeJsonSchema } from "./json-schema-to-markdown";

describe("json-schema-to-markdown", () => {
  function formatExpectedMarkdown(text: string): string {
    const firstNonEmptyLine = text.split("\n").find((line) => line.trim()) || "";
    const firstLineSpacePrefix = firstNonEmptyLine.match(/^\s+/)?.pop() || "";
    if (!firstLineSpacePrefix) {
      return text;
    }

    const prefixRegex = new RegExp(`^${firstLineSpacePrefix}`);
    return text
      .trim()
      .split("\n")
      .map((line) => line.replace(prefixRegex, ""))
      .join("\n");
  }

  function assertJsonSchemaToMarkdown({
    jsonSchema: schema,
    expectedMarkdown,
  }: {
    jsonSchema: VSCodeJsonSchema;
    expectedMarkdown: string;
  }) {
    const actual = jsonSchemaToMarkdown(schema);
    assert.strictEqual(actual, formatExpectedMarkdown(expectedMarkdown));
  }

  it("can handle object schemas with primitive properties", () => {
    const actual = jsonSchemaToMarkdown({
      title: "Root",
      type: "object",
      description: "This is a root object.",
      properties: {
        string: { type: "string", markdownDescription: "This is a string." },
        number: { type: "number", description: "This is a number." },
        boolean: { type: "boolean" },
      },
    });
    assert.strictEqual(
      actual,
      formatExpectedMarkdown(`
        ## Root

        Type: \`object\`

        This is a root object.

        Properties:
        - \`string\` (type: \`string\`) - This is a string.
        - \`number\` (type: \`number\`) - This is a number.
        - \`boolean\` (type: \`boolean\`) - [No description provided.]
      `),
    );
  });

  it('uses "markdownDescription" over "description"', () => {
    const actual = jsonSchemaToMarkdown({
      title: "Root",
      type: "string",
      description: "This is a string description.",
      markdownDescription: "This is a string markdownDescription.",
    });
    assert.strictEqual(
      actual,
      formatExpectedMarkdown(`
        ## Root

        Type: \`string\`

        This is a string markdownDescription.
      `),
    );
  });
});
