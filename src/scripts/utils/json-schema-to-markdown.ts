import type { JSONSchema7 } from "json-schema";
import { isTruthy } from "../../utils";

type Options = {
  rootHeadingLevel: number;
};

type Context = {
  pendingSchemas: VSCodeJsonSchema[];
  parentPath: string[];
  options: Options;
  sectionTitle: string;
};

export type VSCodeJsonSchema = JSONSchema7 & {
  markdownDescription?: string;
  properties?: Record<string, VSCodeJsonSchema>;
  patternProperties?: Record<string, VSCodeJsonSchema>;
  items?: VSCodeJsonSchema;
};

type VSCodeComplexJsonSchema = VSCodeJsonSchema & {
  title: string;
  type: "object";
};

export default function jsonSchemaToMarkdown(
  schema: VSCodeJsonSchema,
  options: Options = { rootHeadingLevel: 1 },
): string {
  const sectionsText: string[] = [];
  const pendingSchemas = [schema];
  while (pendingSchemas.length) {
    sectionsText.push(
      serializeSchemaSection(pendingSchemas.pop()!, {
        pendingSchemas,
        parentPath: [],
        options,
        sectionTitle: "Root",
      }),
    );
  }

  return sectionsText.join("\n\n").trim();
}

function serializeSchemaSection(schema: VSCodeJsonSchema, context: Context): string {
  if (!schema.title) {
    throw new Error(`Schema title is undefined`);
  }
  if (!schema.description && !schema.markdownDescription) {
    throw new Error(`Schema description is undefined, for schema with title "${schema.title}"`);
  }

  // NOTE: this is to match TS types output
  const sectionTitle = schema.title.replace(/\s/g, "");

  const sectionContext: Context = {
    ...context,
    sectionTitle,
    parentPath: [...context.parentPath, schema.title],
  };

  let sectionText: string;
  switch (schema.type) {
    case "object":
      sectionText = serializeObjectSchema(schema, sectionContext);
      break;

    case "array":
      sectionText = serializeArraySchema(schema, sectionContext);
      break;

    case "string":
    case "number":
    case "boolean":
    case "null":
      sectionText = serializePrimitiveSchema(schema, sectionContext);
      break;

    default:
      throw new Error(`Unknown schema type: ${schema.type}`);
  }

  const sectionHeadingHashes = "#".repeat(context.options.rootHeadingLevel);
  return join([
    `${sectionHeadingHashes} 🧩 <ins>${sectionTitle}</ins>`,
    "",
    sectionText,
    "",
    serialiseSchemaDefault(schema),
    "",
    serialiseSchemaExample(schema),
  ]);
}

function join(lines: string[]): string {
  return lines
    .map((s) => s.trim())
    .filter((line, i) => {
      if (i === 0) {
        return true;
      }
      // remove consecutive empty lines
      return line || lines[i - 1] !== "";
    })
    .join("\n")
    .trim();
}

function getSchemaDescription(schema: VSCodeJsonSchema, context: Context): string {
  const description = schema.markdownDescription || schema.description;
  if (!description) {
    throw new Error(
      `Schema description and markdownDescription is undefined, at path ${context.parentPath.join(
        " > ",
      )}`,
    );
  }
  return description.trim();
}

function serializeObjectSchema(schema: VSCodeJsonSchema, context: Context): string {
  const { properties, required } = schema;

  const propertyHeadingHashes = "#".repeat(context.options.rootHeadingLevel + 1);

  // serialize properties
  const propertiesText = Object.entries(properties || {})
    .map(([propertyName, propertySchema]) => {
      const isRequired = required?.includes(propertyName);
      const propertyTitle = `\`${context.sectionTitle}.${propertyName}\``;
      const propertyContext: Context = {
        ...context,
        parentPath: [...context.parentPath, propertyName],
      };
      const propertyType = getSchemaTypeText(propertySchema, propertyContext);
      const requiredText = isRequired ? "(**REQUIRED**)" : "(**OPTIONAL**)";
      return join([
        `${propertyHeadingHashes} 🅿️ Property - ${propertyTitle} ${requiredText}`,
        "",
        `Type: \`${propertyType}\``,
        "",
        getSchemaDescription(propertySchema, propertyContext),
        "",
        serialiseSchemaDefault(propertySchema),
        "",
        serialiseSchemaExample(propertySchema),
      ]);
    })
    .join("\n\n");

  // serialize patternProperties
  const patternPropertiesText = Object.entries(schema.patternProperties || {})
    .map(([pattern, patternPropertySchema]) => {
      const propertyContext: Context = {
        ...context,
        parentPath: [...context.parentPath, pattern],
      };
      const propertyType = getSchemaTypeText(patternPropertySchema, propertyContext);
      return join([
        `${propertyHeadingHashes} Any property with key matching regex \`${pattern}\``,
        "",
        `Type: \`${propertyType}\``,
        "",
        getSchemaDescription(patternPropertySchema, propertyContext),
        "",
        serialiseSchemaDefault(patternPropertySchema),
        "",
        serialiseSchemaExample(patternPropertySchema),
      ]);
    })
    .join("\n\n");

  return join([
    `Type: \`object\``,
    "",
    getSchemaDescription(schema, context),
    "",
    propertiesText,
    "",
    patternPropertiesText,
  ]);
}

function serializePrimitiveSchema(schema: VSCodeJsonSchema, context: Context): string {
  let type: string | string[] = schema.type!;
  if (schema.type === "string" && schema.enum) {
    type = schema.enum.join(" | ");
  }
  return join([
    `Type: \`${type}\``,
    "",
    getSchemaDescription(schema, context),
    "",
    serialiseSchemaDefault(schema),
    "",
    serialiseSchemaExample(schema),
  ]);
}

function getSchemaTypeText(schema: VSCodeJsonSchema, context: Context): string {
  if (schema.oneOf) {
    return schema.oneOf
      .filter(isTruthy)
      .filter(isObject)
      .map((childSchema) => {
        return getSchemaTypeText(childSchema, {
          ...context,
          parentPath: [...context.parentPath, "oneOf"],
        });
      })
      .join(" | ");
  }

  if (schema.anyOf) {
    return schema.anyOf
      .filter(isTruthy)
      .filter(isObject)
      .map((childSchema) => {
        return getSchemaTypeText(childSchema, {
          ...context,
          parentPath: [...context.parentPath, "anyOf"],
        });
      })
      .join(" | ");
  }

  if (schema.allOf) {
    return schema.allOf
      .filter(isTruthy)
      .filter(isObject)
      .map((childSchema) => {
        return getSchemaTypeText(childSchema, {
          ...context,
          parentPath: [...context.parentPath, "allOf"],
        });
      })
      .join(" & ");
  }

  if (schema.type === "array") {
    if (!schema.items) {
      throw new Error(`Array schema must have items, at path ${context.parentPath.join(" > ")}`);
    }
    const itemType = getSchemaTypeText(schema.items, {
      ...context,
      parentPath: [...context.parentPath, "[]"],
    });
    return `${itemType}[]`;
  }

  if (isComplexSchema(schema, context)) {
    scheduleSchemaForSerialization(schema, context);
    return schema.title.replace(/\s/g, ""); // NOTE: this is to match TS types output
  }

  if (Array.isArray(schema.type)) {
    return schema.type.join(" | ");
  }

  if (schema.type) {
    return schema.type;
  }

  throw new Error(`Schema type is undefined, at path ${context.parentPath.join(" > ")}`);
}

function scheduleSchemaForSerialization(schema: VSCodeComplexJsonSchema, context: Context): void {
  if (!schema.title) {
    throw new Error(`Schema title is undefined}`);
  }
  context.pendingSchemas.push(schema);
}

function isComplexSchema(
  schema: VSCodeJsonSchema,
  context: Context,
): schema is VSCodeComplexJsonSchema {
  const isComplex = schema.type === "object"; // arrays are not complex, but their items can be
  if (isComplex && !schema.title) {
    throw new Error(`Complex schema title is undefined, at path ${context.parentPath.join(" > ")}`);
  }
  return isComplex;
}

function serializeArraySchema(schema: VSCodeJsonSchema, context: Context): string {
  if (!schema.items) {
    throw new Error("Array schema must have items");
  }

  const arrayContext: Context = {
    ...context,
    parentPath: [...context.parentPath, "[]"],
  };
  const itemType = getSchemaTypeText(schema, arrayContext);
  return join([`Type: \`${itemType}\``, "", getSchemaDescription(schema, arrayContext)]);
}

function isObject<T>(value: T): value is Extract<T, object> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function serialiseSchemaExample(schema: VSCodeJsonSchema): string {
  if (!schema.examples) {
    return "";
  }

  return join([`**Example**`, "", "```json", JSON.stringify(schema.examples, null, 2), "```"]);
}

function serialiseSchemaDefault(schema: VSCodeJsonSchema): string {
  if (schema.default === undefined) {
    return "";
  }

  return join([`**Default**`, "", "```json", JSON.stringify(schema.default, null, 2), "```"]);
}
