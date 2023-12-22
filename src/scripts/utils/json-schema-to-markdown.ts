import type { JSONSchema7 } from "json-schema";
import { isTruthy } from "../../utils";

type Options = {
  rootHeadingLevel: number;
};

type Context = {
  pendingSchemas: VSCodeJsonSchema[];
  parentPath: string[];
  options: Options;
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

export default function jsonSchemaToMarkdown(schema: VSCodeJsonSchema, options: Options): string {
  const sectionsText: string[] = [];
  const pendingSchemas = [schema];
  while (pendingSchemas.length) {
    sectionsText.push(
      serializeSchemaSection(pendingSchemas.pop()!, {
        pendingSchemas,
        parentPath: [],
        options,
      }),
    );
  }

  return sectionsText.join("\n\n");
}

function serializeSchemaSection(schema: VSCodeJsonSchema, context: Context): string {
  if (!schema.title) {
    throw new Error(`Schema title is undefined`);
  }
  if (!schema.description && !schema.markdownDescription) {
    throw new Error(`Schema description is undefined, for schema with title "${schema.title}"`);
  }

  let sectionText: string[];

  const sectionContext: Context = {
    ...context,
    parentPath: [...context.parentPath, schema.title],
  };
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
  // NOTE: this is to match TS types output
  const sectionTitle = schema.title.replace(/\s/g, "");
  return [`${sectionHeadingHashes} <ins>${sectionTitle}</ins>`, "", ...sectionText]
    .map((text) => text.trim())
    .join("\n");
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
  return description;
}

function serializeObjectSchema(schema: VSCodeJsonSchema, context: Context): string[] {
  const { properties, required } = schema;

  const propertyHeadingHashes = "#".repeat(context.options.rootHeadingLevel + 1);

  const propertyTexts = Object.entries(properties || {}).map(([propertyName, propertySchema]) => {
    const isRequired = required?.includes(propertyName);
    const propertyTitle = `\`${propertyName}\``;
    const propertyContext: Context = {
      ...context,
      parentPath: [...context.parentPath, propertyName],
    };
    const propertyType = getSchemaTypeText(propertySchema, propertyContext);
    const description = getSchemaDescription(propertySchema, propertyContext);
    const requiredText = isRequired ? "(**REQUIRED**)" : "(**OPTIONAL**)";
    return [
      `${propertyHeadingHashes} Property - ${propertyTitle} ${requiredText}`,
      "",
      `Type: \`${propertyType}\``,
      "",
      description,
      "",
    ];
  });

  const patternPropertyTexts = Object.entries(schema.patternProperties || {}).map(
    ([pattern, patternSchema]) => {
      const propertyContext: Context = {
        ...context,
        parentPath: [...context.parentPath, pattern],
      };
      const propertyType = getSchemaTypeText(patternSchema, propertyContext);
      const description = getSchemaDescription(patternSchema, propertyContext);
      return [
        `${propertyHeadingHashes} Property with name matching regex \`${pattern}\``,
        "",
        `Type: \`${propertyType}\``,
        "",
        description,
        "",
      ];
    },
  );

  return [
    `Type: \`object\``,
    "",
    getSchemaDescription(schema, context),
    "",
    ...propertyTexts,
    ...patternPropertyTexts,
    "",
  ].flat();
}

function serializePrimitiveSchema(schema: VSCodeJsonSchema, context: Context): string[] {
  return [`Type: \`${schema.type}\``, "", getSchemaDescription(schema, context)];
}

function getSchemaTypeText(schema: VSCodeJsonSchema, context: Context): string {
  if (schema.oneOf) {
    return schema.oneOf
      .filter(isTruthy)
      .filter(isObject)
      .map((childSchema) => {
        if (isComplexSchema(childSchema, context)) {
          scheduleSchemaForSerialization(childSchema, context);
          return childSchema.title;
        }
        return childSchema.type;
      })
      .join(" | ");
  }

  if (schema.anyOf) {
    return schema.anyOf
      .filter(isTruthy)
      .filter(isObject)
      .map((childSchema) => {
        if (isComplexSchema(childSchema, context)) {
          scheduleSchemaForSerialization(childSchema, context);
          return childSchema.title;
        }
        return childSchema.type;
      })
      .join(" | ");
  }

  if (isComplexSchema(schema, context)) {
    scheduleSchemaForSerialization(schema, context);
    return schema.title;
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

function serializeArraySchema(schema: VSCodeJsonSchema, context: Context): string[] {
  if (!schema.items) {
    throw new Error("Array schema must have items");
  }

  const arrayContext: Context = {
    ...context,
    parentPath: [...context.parentPath, "[]"],
  };
  const itemType = getSchemaTypeText(schema.items, arrayContext);
  return [`Type: \`${itemType}[]\``, "", getSchemaDescription(schema, arrayContext)];
}

function isObject<T>(value: T): value is Extract<T, object> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
