import type { JSONSchema7 } from "json-schema";
import { isTruthy } from "../../utils";

const DEFAULT_DESCRIPTION = "[No description provided.]";

type Context = {
  pendingSchemas: VSCodeJsonSchema[];
  parentPath: string[];
};

export type VSCodeJsonSchema = JSONSchema7 & {
  markdownDescription?: string;
  properties?: Record<string, VSCodeJsonSchema>;
  items?: VSCodeJsonSchema;
};

type VSCodeComplexJsonSchema = VSCodeJsonSchema & {
  title: string;
  type: "object" | "array";
};

export default function jsonSchemaToMarkdown(schema: VSCodeJsonSchema): string {
  const sectionsText: string[] = [];
  const pendingSchemas = [schema];
  while (pendingSchemas.length) {
    console.log("pendingSchemas", pendingSchemas);
    console.log("sectionsText", sectionsText);
    debugger;
    sectionsText.push(
      serializeSchemaSection(pendingSchemas.pop()!, {
        pendingSchemas,
        parentPath: [],
      }),
    );
  }

  return sectionsText.join("\n\n");
}

function serializeSchemaSection(schema: VSCodeJsonSchema, context: Context): string {
  if (!schema.title) {
    throw new Error(`Schema title is undefined}`);
  }
  if (!schema.description && !schema.markdownDescription) {
    throw new Error(`Schema description is undefined: ${schema.title}}`);
  }

  const sectionText = (() => {
    switch (schema.type) {
      case "object":
        return serializeObjectSchema(schema, {
          ...context,
          parentPath: [...context.parentPath, schema.title],
        });

      case "array":
        return serializeArraySchema(schema, {
          ...context,
          parentPath: [...context.parentPath, schema.title],
        });

      case "string":
      case "number":
      case "boolean":
      case "null":
        return serializePrimitiveSchema(schema);

      default:
        throw new Error(`Unknown schema type: ${schema.type}`);
    }
  })();

  return [`## ${schema.title}`, "", sectionText].join("\n");
}

function getSchemaDescription(schema: VSCodeJsonSchema): string {
  return schema.markdownDescription || schema.description || DEFAULT_DESCRIPTION;
}

function serializeObjectSchema(schema: VSCodeJsonSchema, context: Context): string {
  const { properties, required } = schema;

  const propertyTexts = Object.entries(properties || {}).map(([propertyName, propertySchema]) => {
    const isRequired = required?.includes(propertyName);
    const propertyTitle = isRequired ? `**\`${propertyName}\`**` : `\`${propertyName}\``;
    const propertyType = getSchemaTypeText(propertySchema, context);
    const description = getSchemaDescription(propertySchema);
    return `- ${propertyTitle} (type: \`${propertyType}\`) - ${description}`;
  });

  return [
    `Type: \`object\``,
    "",
    getSchemaDescription(schema),
    "",
    "Properties:",
    ...propertyTexts,
  ].join("\n");
}

function serializePrimitiveSchema(schema: VSCodeJsonSchema): string {
  return [`Type: \`${schema.type}\``, "", getSchemaDescription(schema)].join("\n");
}

function getSchemaTypeText(schema: VSCodeJsonSchema, context: Context): string {
  if (schema.oneOf) {
    return schema.oneOf
      .filter(isTruthy)
      .filter(isObject)
      .map((childSchema) => {
        if (isComplexSchema(childSchema)) {
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
        if (isComplexSchema(childSchema)) {
          scheduleSchemaForSerialization(childSchema, context);
          return childSchema.title;
        }
        return childSchema.type;
      })
      .join(" | ");
  }

  if (isComplexSchema(schema)) {
    scheduleSchemaForSerialization(schema, context);
    return schema.title;
  }

  if (Array.isArray(schema.type)) {
    return schema.type.join(" | ");
  }

  return schema.type || "Unknown";
}

function scheduleSchemaForSerialization(schema: VSCodeComplexJsonSchema, context: Context): void {
  if (!schema.title) {
    throw new Error(`Schema title is undefined}`);
  }
  context.pendingSchemas.push(schema);
}

function isComplexSchema(schema: VSCodeJsonSchema): schema is VSCodeComplexJsonSchema {
  const isComplex = schema.type === "object" || schema.type === "array";
  if (isComplex && !schema.title) {
    throw new Error(`Complex schema title is undefined: ${schema.type}`);
  }
  return isComplex;
}

function serializeArraySchema(schema: VSCodeJsonSchema, context: Context): string {
  const { markdownDescription, description, items } = schema;
  if (!items) {
    throw new Error("Array schema must have items");
  }
  const itemType = getSchemaTypeText(items, context);

  return `Type: \`${itemType}[]\`\n\n${markdownDescription || description || DEFAULT_DESCRIPTION}`;
}

function isObject<T>(value: T): value is Extract<T, object> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
