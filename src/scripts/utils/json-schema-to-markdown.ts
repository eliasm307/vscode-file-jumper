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
  patternProperties?: Record<string, VSCodeJsonSchema>;
  items?: VSCodeJsonSchema;
};

type VSCodeComplexJsonSchema = VSCodeJsonSchema & {
  title: string;
  type: "object";
};

export default function jsonSchemaToMarkdown(schema: VSCodeJsonSchema): string {
  const sectionsText: string[] = [];
  const pendingSchemas = [schema];
  while (pendingSchemas.length) {
    // console.log("pendingSchemas", pendingSchemas);
    // console.log("sectionsText", sectionsText);
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
    throw new Error(`Schema title is undefined`);
  }
  if (!schema.description && !schema.markdownDescription) {
    throw new Error(`Schema description is undefined, for schema with title "${schema.title}"`);
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
    const propertyTitle = `\`${propertyName}\``;
    const propertyType = getSchemaTypeText(propertySchema, {
      ...context,
      parentPath: [...context.parentPath, propertyName],
    });
    const description = getSchemaDescription(propertySchema);
    const requiredText = isRequired ? " - **REQUIRED**" : "";
    return `- ${propertyTitle} (type: \`${propertyType}\`)${requiredText} - ${description}`;
  });

  const patternPropertyTexts = Object.entries(schema.patternProperties || {}).map(
    ([pattern, patternSchema]) => {
      const propertyTitle = `With name matching regex \`${pattern}\``;
      const propertyType = getSchemaTypeText(patternSchema, {
        ...context,
        parentPath: [...context.parentPath, pattern],
      });
      const description = getSchemaDescription(patternSchema);
      return `- ${propertyTitle} (type: \`${propertyType}\`) - ${description}`;
    },
  );

  return [
    `Type: \`object\``,
    "",
    getSchemaDescription(schema),
    "",
    "Properties:",
    ...propertyTexts,
    ...patternPropertyTexts,
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

  return schema.type || "Unknown";
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
  const { markdownDescription, description, items } = schema;
  if (!items) {
    throw new Error("Array schema must have items");
  }
  const itemType = getSchemaTypeText(items, {
    ...context,
    parentPath: [...context.parentPath, "[]"],
  });

  return `Type: \`${itemType}[]\`\n\n${markdownDescription || description || DEFAULT_DESCRIPTION}`;
}

function isObject<T>(value: T): value is Extract<T, object> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
