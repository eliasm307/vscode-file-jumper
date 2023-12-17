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

export default function jsonSchemaToMarkdown(schema: VSCodeJsonSchema): string {
  const pendingSchemas = [schema];
  const sectionsText: string[] = [];

  while (pendingSchemas.length) {
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

  const propertySections = Object.entries(properties || {}).map(
    ([propertyName, propertySchema]) => {
      const isRequired = required?.includes(propertyName);
      const propertyTitle = isRequired ? `**\`${propertyName}\`**` : `\`${propertyName}\``;
      const propertyType = getSchemaTypeText(propertySchema, context);
      return `- ${propertyTitle} (type: \`${propertyType}\`) - ${getSchemaDescription(
        propertySchema,
      )}`;
    },
  );

  return [
    `Type: \`object\``,
    "",
    getSchemaDescription(schema),
    "",
    "Properties:",
    ...propertySections,
  ].join("\n");
}

function serializePrimitiveSchema(schema: VSCodeJsonSchema): string {
  return [`Type: \`${schema.type}\``, "", getSchemaDescription(schema)].join("\n");
}

function getSchemaTypeText(schema: VSCodeJsonSchema, context: Context): string {
  if (schema.title) {
    if (isComplexSchema(schema)) {
      // scheduleSchemaForSerialization(childSchema, context);
    }
    return schema.title;
  }

  if (schema.oneOf) {
    return schema.oneOf
      .filter(isTruthy)
      .filter(isObject)
      .map((childSchema) => {
        if (childSchema.title) {
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
        if (childSchema.title) {
          scheduleSchemaForSerialization(childSchema, context);
          return childSchema.title;
        }
        return childSchema.type;
      })
      .join(" | ");
  }

  if (Array.isArray(schema.type)) {
    return schema.type.join(" | ");
  }

  return schema.type || "Unknown";
}

function scheduleSchemaForSerialization(schema: VSCodeJsonSchema, context: Context): void {
  if (schema.title && isComplexSchema(schema)) {
    context.pendingSchemas.push(schema);
  }
}

function isComplexSchema(schema: VSCodeJsonSchema): boolean {
  return schema.type === "object" || schema.type === "array";
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
