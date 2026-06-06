import {
    arrayExpression,
    booleanLiteral,
    identifier,
    nullLiteral,
    numericLiteral,
    objectExpression,
    objectProperty,
    objectPropertyKey,
    stringLiteral,
    tsArrayType,
    tsBooleanKeyword,
    tsIndexSignature,
    tsIntersectionType,
    tsLiteralType,
    tsNeverKeyword,
    tsNullKeyword,
    tsNumberKeyword,
    tsPropertySignature,
    tsRestType,
    tsStringKeyword,
    tsTupleType,
    tsTypeAnnotation,
    tsTypeLiteral,
    tsTypeReference,
    tsUnionType,
    tsUnknownKeyword,
    attachTypeAnnotation,
} from "../emit/index.ts";
import type {
    Expression,
    Statement,
    TSType,
} from "../emit/index.ts";
import { printStatements } from "../emit/print.ts";
import type { CommentsRenderConfig } from "../emit/print.ts";
import { extendSchema } from "../schemas/common.ts";
import type {
    OpenApiExample,
    OpenApiExpandedSchema,
    OpenApiSchema,
    OpenApiSchemaPrimitiveValue,
} from "../schemas/common.ts";
import { cleanupSchema } from "../utils/cleanup-schema.ts";
import { attachJsDocComment, extractJsDoc, renderJsDoc } from "../utils/jsdoc.ts";
import type { JsDocBlock, JsDocRenderConfig } from "../utils/jsdoc.ts";
import { applyEntityNameCase } from "../utils/string-utils.ts";
import {
    simplifyIntersectionTypeIfPossible,
    simplifyUnionTypeIfPossible,
} from "../utils/type-utils.ts";

export { objectPropertyKey };

export const stringIndexSignature = Symbol("stringIndexSignature");

export type OpenApiSchemaFieldPathItem = string | typeof stringIndexSignature;

export interface GenerateSchemaTypeParams {
    schema: OpenApiSchema;
    getTypeName: (name: string, schema: OpenApiSchema) => string;
    getBinaryType: () => TSType;
    expand?: boolean;
    processJsDoc?: (
        jsdoc: JsDocBlock,
        entity: OpenApiSchema,
        path: OpenApiSchemaFieldPathItem[],
    ) => JsDocBlock;
    processJsDocPath?: OpenApiSchemaFieldPathItem[];
    jsDocRenderConfig?: JsDocRenderConfig;
}

type GenerateSchemaTypeContext = Omit<GenerateSchemaTypeParams, "schema" | "expand">;

export function generateSchemaType({
    schema: originalSchema,
    getTypeName,
    expand = false,
    processJsDoc,
    processJsDocPath,
    getBinaryType,
    jsDocRenderConfig,
}: GenerateSchemaTypeParams): TSType {
    const schema = cleanupSchema(originalSchema);
    const context = {
        getTypeName,
        getBinaryType,
        processJsDoc,
        processJsDocPath,
        jsDocRenderConfig,
    };
    if (schema === true) {
        return tsUnknownKeyword();
    }
    if (schema === false) {
        return tsNeverKeyword();
    }
    if (schema.nullable) {
        return generateNullableSchemaType(schema, context);
    }
    if (!expand && isNamedSchema(schema)) {
        return tsTypeReference(identifier(getTypeName(schema.name, schema)));
    }
    if (Array.isArray(schema.type)) {
        return generateSchemaTypeUnion(
            schema,
            context,
            schema.type.map((schemaType) => ({ type: schemaType })),
        );
    }
    if ("oneOf" in schema && schema.oneOf) {
        return generateSchemaTypeUnion(schema, context, schema.oneOf, "oneOf");
    }
    if ("anyOf" in schema && schema.anyOf) {
        return generateSchemaTypeUnion(schema, context, schema.anyOf, "anyOf");
    }
    if ("allOf" in schema && schema.allOf) {
        return generateSchemaTypeIntersection(schema, context);
    }
    if (schema.const !== undefined) {
        return primitiveValueToType(schema.const);
    }
    if (schema.enum !== undefined) {
        return simplifyUnionTypeIfPossible(tsUnionType(schema.enum.map(primitiveValueToType)));
    }
    if (schema.type === "null") {
        return tsNullKeyword();
    }
    if (schema.type === "string") {
        if (schema.format === "binary") {
            return getBinaryType();
        }
        return tsStringKeyword();
    }
    if (schema.type === "boolean") {
        return tsBooleanKeyword();
    }
    if (schema.type === "number" || schema.type === "integer") {
        return tsNumberKeyword();
    }
    if (schema.type === "array") {
        return generateArraySchemaType(schema, context);
    }
    if (schema.type === "object") {
        return generateObjectSchemaType(schema, context);
    }
    return tsUnknownKeyword();
}

function generateNullableSchemaType(
    schema: OpenApiExpandedSchema,
    context: GenerateSchemaTypeContext,
): TSType {
    return simplifyUnionTypeIfPossible(
        tsUnionType([
            generateSchemaType({
                schema: Object.assign({}, schema, { nullable: false }),
                ...context,
            }),
            tsNullKeyword(),
        ]),
    );
}

function generateSchemaTypeUnion(
    schema: OpenApiExpandedSchema,
    context: GenerateSchemaTypeContext,
    subSchemas: OpenApiSchema[],
    compositionKey?: "oneOf" | "anyOf",
): TSType {
    const flatSchema = { ...schema };
    if (compositionKey) {
        delete flatSchema[compositionKey];
    } else {
        delete flatSchema.type;
    }
    return simplifyUnionTypeIfPossible(
        tsUnionType(
            subSchemas.map((subSchema) =>
                generateSchemaType({ schema: extendSchema(flatSchema, subSchema), ...context }),
            ),
        ),
    );
}

function generateSchemaTypeIntersection(
    schema: OpenApiExpandedSchema,
    context: GenerateSchemaTypeContext,
): TSType {
    const { allOf: _allOf, ...flatSchema } = schema;
    return simplifyIntersectionTypeIfPossible(
        tsIntersectionType(
            (schema.allOf ?? []).map((subSchema) =>
                generateSchemaType({ schema: extendSchema(flatSchema, subSchema), ...context }),
            ),
        ),
    );
}

function generateArraySchemaType(
    schema: OpenApiExpandedSchema,
    context: GenerateSchemaTypeContext,
): TSType {
    if (!schema.prefixItems) {
        return tsArrayType(generateSchemaType({ schema: schema.items ?? true, ...context }));
    }
    return tsTupleType([
        ...schema.prefixItems.map((item) => generateSchemaType({ schema: item, ...context })),
        ...(schema.items !== false
            ? [
                  tsRestType(
                      tsArrayType(
                          generateSchemaType({
                              schema: schema.items ?? true,
                              ...context,
                          }),
                      ),
                  ),
              ]
            : []),
    ]);
}

function generateObjectSchemaType(
    schema: OpenApiExpandedSchema,
    context: GenerateSchemaTypeContext,
): TSType {
    const objectIntersection = [
        ...(schema.properties ? [generateObjectPropertiesType(schema, context)] : []),
        ...generateAdditionalPropertiesTypes(schema, context),
    ];

    if (objectIntersection.length === 0) {
        return tsTypeLiteral([]);
    }

    return simplifyIntersectionTypeIfPossible(tsIntersectionType(objectIntersection));
}

function generateObjectPropertiesType(
    schema: OpenApiExpandedSchema,
    context: GenerateSchemaTypeContext,
): TSType {
    const requiredFieldsIndex = (schema.required ?? []).reduce(
        (res, fieldName) => {
            res[fieldName] = true;
            return res;
        },
        {} as Record<string, boolean>,
    );
    return tsTypeLiteral(
        Object.entries(schema.properties ?? {}).map(([fieldName, fieldSchema]) => {
            const currentProcessJsDocPath = (context.processJsDocPath ?? []).concat(fieldName);
            const jsdoc = processSchemaJsDoc(fieldSchema, currentProcessJsDocPath, context);
            return attachJsDocComment(
                tsPropertySignature(
                    objectPropertyKey(fieldName),
                    tsTypeAnnotation(
                        generateSchemaType({
                            schema: fieldSchema,
                            ...context,
                            processJsDocPath: currentProcessJsDocPath,
                        }),
                    ),
                    !requiredFieldsIndex[fieldName],
                ),
                renderJsDoc(jsdoc, context.jsDocRenderConfig),
            );
        }),
    );
}

function generateAdditionalPropertiesTypes(
    schema: OpenApiExpandedSchema,
    context: GenerateSchemaTypeContext,
): TSType[] {
    const additionalProperties = schema.additionalProperties ?? true;
    if (additionalProperties === false) {
        return [];
    }
    const keyName =
        typeof additionalProperties === "object" && additionalProperties.title
            ? applyEntityNameCase(additionalProperties.title, "camelCase")
            : "key";
    const currentProcessJsDocPath = (context.processJsDocPath ?? []).concat(stringIndexSignature);
    const jsdoc = processSchemaJsDoc(additionalProperties, currentProcessJsDocPath, context);
    return [
        tsTypeLiteral([
            attachJsDocComment(
                tsIndexSignature(
                    keyName,
                    tsStringKeyword(),
                    generateSchemaType({
                        schema: additionalProperties,
                        ...context,
                        processJsDocPath: currentProcessJsDocPath,
                    }),
                ),
                renderJsDoc(jsdoc, context.jsDocRenderConfig),
            ),
        ]),
    ];
}

function processSchemaJsDoc(
    schema: OpenApiSchema,
    path: OpenApiSchemaFieldPathItem[],
    { processJsDoc }: GenerateSchemaTypeContext,
) {
    const jsdoc = extractJsDoc(schema);
    return processJsDoc ? processJsDoc(jsdoc, schema, path) : jsdoc;
}

export interface AnnotatedApiEntity {
    title?: string;
    description?: string;
    example?: unknown;
    examples?: Record<string, OpenApiExample>;
    deprecated?: boolean;
}

function primitiveValueToType(value: OpenApiSchemaPrimitiveValue): TSType {
    if (typeof value === "string") {
        return tsLiteralType(stringLiteral(value));
    }
    if (typeof value === "number") {
        return tsLiteralType(numericLiteral(value));
    }
    if (typeof value === "boolean") {
        return tsLiteralType(booleanLiteral(value));
    }
    return tsNullKeyword();
}

export function valueToAstExpression(value: unknown): Expression {
    if (typeof value === "string") {
        return stringLiteral(value);
    }
    if (typeof value === "number") {
        return numericLiteral(value);
    }
    if (typeof value === "boolean") {
        return booleanLiteral(value);
    }
    if (value === null) {
        return nullLiteral();
    }
    if (Array.isArray(value)) {
        return arrayExpression(value.map(valueToAstExpression));
    }
    if (typeof value === "object") {
        return objectExpression(
            Object.entries(value).map(([key, entryValue]) =>
                objectProperty(objectPropertyKey(key), valueToAstExpression(entryValue)),
            ),
        );
    }
    return nullLiteral();
}

export function isNamedSchema(
    schema: OpenApiSchema,
): schema is OpenApiExpandedSchema & { name: string } {
    return typeof schema !== "boolean" && schema.name !== undefined;
}

export { attachTypeAnnotation };

export type { CommentsRenderConfig };

export function renderTypeScript(
    statements: Statement[],
    commentsConfig: CommentsRenderConfig = {},
): string {
    return printStatements(statements, commentsConfig);
}
