import { describe, it, assert } from "vitest";
import type { VSCodeJsonSchema } from "./json-schema-to-markdown";
import jsonSchemaToMarkdown from "./json-schema-to-markdown";

describe.skip("json-schema-to-markdown", () => {
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
    const actual = jsonSchemaToMarkdown(schema, { rootHeadingLevel: 1 });
    assert.strictEqual(actual, formatExpectedMarkdown(expectedMarkdown));
  }

  it("can handle object schemas with primitive properties and supports defining an optional description in different ways", () => {
    assertJsonSchemaToMarkdown({
      jsonSchema: {
        title: "Root",
        type: "object",
        description: "This is a root object.",
        properties: {
          string: { type: "string", markdownDescription: "This is a string." },
          number: { type: "number", description: "This is a number." },
        },
      },
      expectedMarkdown: `
        ## Root

        Type: \`object\`

        This is a root object.

        Properties:
        - \`string\` (type: \`string\`) - This is a string.
        - \`number\` (type: \`number\`) - This is a number.
      `,
    });
  });

  it('uses "markdownDescription" over "description"', () => {
    assertJsonSchemaToMarkdown({
      jsonSchema: {
        title: "Root",
        type: "string",
        description: "This is a string description.",
        markdownDescription: "This is a string markdownDescription.",
      },
      expectedMarkdown: `
        ## Root

        Type: \`string\`

        This is a string markdownDescription.
      `,
    });
  });

  it("throws if the root schema has no title", () => {
    assert.throws(() => {
      jsonSchemaToMarkdown({
        type: "object",
        description: "This is a root object.",
        properties: {},
      });
    });
  });

  it("throws if the root schema has no description", () => {
    assert.throws(() => {
      jsonSchemaToMarkdown({
        title: "Root",
        type: "object",
        properties: {},
      });
    });
  });

  it("throws if a child object schema has no title", () => {
    assert.throws(() => {
      jsonSchemaToMarkdown({
        title: "Root",
        type: "object",
        description: "This is a root object.",
        properties: {
          child: {
            type: "object",
            description: "This is a child object.",
            properties: {},
          },
        },
      });
    });
  });

  it("shows complex property types in a separate section", () => {
    assertJsonSchemaToMarkdown({
      jsonSchema: {
        title: "Root",
        type: "object",
        description: "This is a root object.",
        properties: {
          child: {
            title: "Child",
            type: "object",
            description: "This is a child object.",
            properties: {
              string: { type: "string", description: "This is a string." },
            },
          },
        },
      },
      expectedMarkdown: `
        ## Root

        Type: \`object\`

        This is a root object.

        Properties:
        - \`child\` (type: \`Child\`) - This is a child object.

        ## Child

        Type: \`object\`

        This is a child object.

        Properties:
        - \`string\` (type: \`string\`) - [No description provided.]
      `,
    });
  });

  it("shows primitive array types inline", () => {
    assertJsonSchemaToMarkdown({
      jsonSchema: {
        title: "Root",
        type: "array",
        description: "This is an array of strings",
        items: { type: "string", description: "This is a string." },
      },
      expectedMarkdown: `
        ## Root

        Type: \`string[]\`

        This is an array of strings
      `,
    });
  });

  it("shows complex array item types in a separate section", () => {
    assertJsonSchemaToMarkdown({
      jsonSchema: {
        title: "Root",
        type: "array",
        description: "This is an array of objects.",
        items: {
          type: "object",
          title: "Child",
          description: "This is a child object.",
          properties: {
            string: { type: "string", description: "This is a string." },
          },
        },
      },
      expectedMarkdown: `
        ## Root

        Type: \`Child[]\`

        This is an array of objects.

        ## Child

        Type: \`object\`

        This is a child object.

        Properties:
        - \`string\` (type: \`string\`) - [No description provided.]
      `,
    });
  });

  it("can show objects with patternProperties", () => {
    assertJsonSchemaToMarkdown({
      jsonSchema: {
        title: "Root",
        type: "object",
        description: "This is a root object.",
        patternProperties: {
          "^foo": { type: "string", description: "This is a foo." },
          "^bar": { type: "number", markdownDescription: "This is a bar." },
        },
      },
      expectedMarkdown: `
        ## Root

        Type: \`object\`

        This is a root object.

        Properties:
        - With name matching regex \`^foo\` (type: \`string\`) - This is a foo.
        - With name matching regex \`^bar\` (type: \`number\`) - This is a bar.
      `,
    });
  });

  it("shows complex patternProperty types in a separate section", () => {
    assertJsonSchemaToMarkdown({
      jsonSchema: {
        title: "Root",
        type: "object",
        description: "This is a root object.",
        patternProperties: {
          "^foo": {
            title: "Foo",
            type: "object",
            description: "This is a foo.",
            properties: {
              string: { type: "string", description: "This is a string." },
            },
          },
        },
      },
      expectedMarkdown: `
        ## Root

        Type: \`object\`

        This is a root object.

        Properties:
        - With name matching regex \`^foo\` (type: \`Foo\`) - This is a foo.

        ## Foo

        Type: \`object\`

        This is a foo.

        Properties:
        - \`string\` (type: \`string\`) - This is a string.
      `,
    });
  });

  it("can show required properties", () => {
    assertJsonSchemaToMarkdown({
      jsonSchema: {
        title: "Root",
        type: "object",
        description: "This is a root object.",
        properties: {
          string: { type: "string", description: "This is a string." },
          number: { type: "number", description: "This is a number." },
        },
        required: ["number"],
      },
      expectedMarkdown: `
        ## Root

        Type: \`object\`

        This is a root object.

        Properties:
        - \`string\` (type: \`string\`) - [No description provided.]
        - \`number\` (type: \`number\`) - **REQUIRED** - [No description provided.]
      `,
    });
  });
});
