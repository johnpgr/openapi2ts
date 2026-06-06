import { arrayExpression, booleanLiteral, identifier, isValidIdentifier, nullLiteral, numericLiteral, objectExpression, objectProperty, objectPropertyKey, stringLiteral, tsArrayType, tsBooleanKeyword, tsIndexSignature, tsIntersectionType, tsLiteralType, tsNeverKeyword, tsNullKeyword, tsNumberKeyword, tsPropertySignature, tsRestType, tsStringKeyword, tsTupleType, tsTypeAnnotation, tsTypeLiteral, tsTypeReference, tsUnionType, tsUnknownKeyword, attachTypeAnnotation } from '../emit/index.ts';
import type { Expression, Identifier, NumericLiteral, Statement, StringLiteral, TSType, TSTypeAnnotation } from '../emit/index.ts';
import { printStatements } from '../emit/print.ts';
import type { CommentsRenderConfig } from '../emit/print.ts';
import type { OpenApiClientGeneratorConfig } from './openapi-to-typescript-client.ts';
import { extendSchema } from '../schemas/common.ts';
import type { OpenApiExample, OpenApiExpandedSchema, OpenApiSchema, OpenApiSchemaPrimitiveValue } from '../schemas/common.ts';
import {cleanupSchema} from '../utils/cleanup-schema.ts';
import { attachJsDocComment, extractJsDoc, renderJsDoc } from '../utils/jsdoc.ts';
import type { JsDocBlock, JsDocRenderConfig } from '../utils/jsdoc.ts';
import {applyEntityNameCase} from '../utils/string-utils.ts';
import {simplifyIntersectionTypeIfPossible, simplifyUnionTypeIfPossible} from '../utils/type-utils.ts';

export {objectPropertyKey};

export const stringIndexSignature = Symbol('stringIndexSignature');

export type OpenApiSchemaFieldPathItem = string | typeof stringIndexSignature;

export interface GenerateSchemaTypeParams {
    schema: OpenApiSchema;
    getTypeName: (name: string, schema: OpenApiSchema) => string;
    getBinaryType: () => TSType;
    expand?: boolean;
    processJsDoc?: (jsdoc: JsDocBlock, entity: OpenApiSchema, path: OpenApiSchemaFieldPathItem[]) => JsDocBlock;
    processJsDocPath?: OpenApiSchemaFieldPathItem[];
    jsDocRenderConfig?: JsDocRenderConfig;
}

export function generateSchemaType({
    schema: originalSchema,
    getTypeName,
    expand = false,
    processJsDoc,
    processJsDocPath,
    getBinaryType,
    jsDocRenderConfig
}: GenerateSchemaTypeParams): TSType {
    const schema = cleanupSchema(originalSchema);
    const commonSchemaGenerationOptions = {
        getTypeName,
        getBinaryType,
        processJsDoc,
        processJsDocPath,
        jsDocRenderConfig
    };
    if (schema === true) {
        return tsUnknownKeyword();
    }
    if (schema === false) {
        return tsNeverKeyword();
    }
    if (schema.nullable) {
        return simplifyUnionTypeIfPossible(
            tsUnionType([
                generateSchemaType({
                    schema: Object.assign({}, schema, {nullable: false}),
                    ...commonSchemaGenerationOptions
                }),
                tsNullKeyword()
            ])
        );
    }
    if (!expand && isNamedSchema(schema)) {
        return tsTypeReference(identifier(getTypeName(schema.name, schema)));
    }
    if (Array.isArray(schema.type)) {
        const {type: _type, ...flatSchema} = schema;
        return simplifyUnionTypeIfPossible(
            tsUnionType(
                schema.type.map((schemaType) =>
                    generateSchemaType({schema: {...flatSchema, type: schemaType}, ...commonSchemaGenerationOptions})
                )
            )
        );
    }
    if ('oneOf' in schema && schema.oneOf) {
        const {oneOf: _oneOf, ...flatSchema} = schema;
        return simplifyUnionTypeIfPossible(
            tsUnionType(
                schema.oneOf.map((subSchema) =>
                    generateSchemaType({schema: extendSchema(flatSchema, subSchema), ...commonSchemaGenerationOptions})
                )
            )
        );
    }
    if ('anyOf' in schema && schema.anyOf) {
        const {anyOf: _anyOf, ...flatSchema} = schema;
        return simplifyUnionTypeIfPossible(
            tsUnionType(
                schema.anyOf.map((subSchema) =>
                    generateSchemaType({schema: extendSchema(flatSchema, subSchema), ...commonSchemaGenerationOptions})
                )
            )
        );
    }
    if ('allOf' in schema && schema.allOf) {
        const {allOf: _allOf, ...flatSchema} = schema;
        return simplifyIntersectionTypeIfPossible(
            tsIntersectionType(
                schema.allOf.map((subSchema) =>
                    generateSchemaType({schema: extendSchema(flatSchema, subSchema), ...commonSchemaGenerationOptions})
                )
            )
        );
    }
    if (schema.const !== undefined) {
        return primitiveValueToType(schema.const);
    }
    if (schema.enum !== undefined) {
        return simplifyUnionTypeIfPossible(tsUnionType(schema.enum.map(primitiveValueToType)));
    }
    if (schema.type === 'null') {
        return tsNullKeyword();
    }
    if (schema.type === 'string') {
        if (schema.format === 'binary') {
            return getBinaryType();
        }
        return tsStringKeyword();
    }
    if (schema.type === 'boolean') {
        return tsBooleanKeyword();
    }
    if (schema.type === 'number' || schema.type === 'integer') {
        return tsNumberKeyword();
    }
    if (schema.type === 'array') {
        if (schema.prefixItems) {
            return tsTupleType([
                ...schema.prefixItems.map((item) =>
                    generateSchemaType({schema: item, ...commonSchemaGenerationOptions})
                ),
                ...(schema.items !== false
                    ? [
                          tsRestType(
                              tsArrayType(
                                  generateSchemaType({
                                      schema: schema.items ?? true,
                                      ...commonSchemaGenerationOptions
                                  })
                              )
                          )
                      ]
                    : [])
            ]);
        }
        return tsArrayType(generateSchemaType({schema: schema.items ?? true, ...commonSchemaGenerationOptions}));
    }
    if (schema.type === 'object') {
        const objectIntersection: TSType[] = [];

        if (schema.properties) {
            const requiredFieldsIndex = (schema.required ?? []).reduce(
                (res, fieldName) => {
                    res[fieldName] = true;
                    return res;
                },
                {} as Record<string, boolean>
            );
            objectIntersection.push(
                tsTypeLiteral(
                    Object.entries(schema.properties).map(([fieldName, fieldSchema]) => {
                        let jsdoc = extractJsDoc(fieldSchema);
                        const currentProcessJsDocPath = (processJsDocPath ?? []).concat(fieldName);
                        if (processJsDoc) {
                            jsdoc = processJsDoc(jsdoc, fieldSchema, currentProcessJsDocPath);
                        }
                        return attachJsDocComment(
                            tsPropertySignature(
                                objectPropertyKey(fieldName),
                                tsTypeAnnotation(
                                    generateSchemaType({
                                        schema: fieldSchema,
                                        ...commonSchemaGenerationOptions,
                                        processJsDocPath: currentProcessJsDocPath
                                    })
                                ),
                                !requiredFieldsIndex[fieldName]
                            ),
                            renderJsDoc(jsdoc, jsDocRenderConfig)
                        );
                    })
                )
            );
        }

        const additionalProperties = schema.additionalProperties ?? true;
        if (additionalProperties !== false) {
            let keyName = 'key';
            if (typeof additionalProperties === 'object' && additionalProperties.title) {
                keyName = applyEntityNameCase(additionalProperties.title, 'camelCase');
            }
            let jsdoc = extractJsDoc(additionalProperties);
            const currentProcessJsDocPath = (processJsDocPath ?? []).concat(stringIndexSignature);
            if (processJsDoc) {
                jsdoc = processJsDoc(jsdoc, additionalProperties, currentProcessJsDocPath);
            }
            objectIntersection.push(
                tsTypeLiteral([
                    attachJsDocComment(
                        tsIndexSignature(
                            keyName,
                            tsStringKeyword(),
                            generateSchemaType({
                                schema: additionalProperties,
                                ...commonSchemaGenerationOptions,
                                processJsDocPath: currentProcessJsDocPath
                            })
                        ),
                        renderJsDoc(jsdoc, jsDocRenderConfig)
                    )
                ])
            );
        }

        if (objectIntersection.length === 0) {
            return tsTypeLiteral([]);
        }

        return simplifyIntersectionTypeIfPossible(tsIntersectionType(objectIntersection));
    }
    return tsUnknownKeyword();
}

export function unionTypeIfNecessary(types: TSType[]): TSType {
    return types.length > 1 ? tsUnionType(types) : types[0];
}

export interface AnnotatedApiEntity {
    title?: string;
    description?: string;
    example?: unknown;
    examples?: Record<string, OpenApiExample>;
    deprecated?: boolean;
}

export function primitiveValueToType(value: OpenApiSchemaPrimitiveValue): TSType {
    if (typeof value === 'string') {
        return tsLiteralType(stringLiteral(value));
    }
    if (typeof value === 'number') {
        return tsLiteralType(numericLiteral(value));
    }
    if (typeof value === 'boolean') {
        return tsLiteralType(booleanLiteral(value));
    }
    return tsNullKeyword();
}

export function valueToAstExpression(value: unknown): Expression {
    if (typeof value === 'string') {
        return stringLiteral(value);
    }
    if (typeof value === 'number') {
        return numericLiteral(value);
    }
    if (typeof value === 'boolean') {
        return booleanLiteral(value);
    }
    if (value === null) {
        return nullLiteral();
    }
    if (Array.isArray(value)) {
        return arrayExpression(value.map(valueToAstExpression));
    }
    if (typeof value === 'object') {
        return objectExpression(
            Object.entries(value).map(([key, entryValue]) =>
                objectProperty(objectPropertyKey(key), valueToAstExpression(entryValue))
            )
        );
    }
    return nullLiteral();
}

export function isNamedSchema(schema: OpenApiSchema): schema is OpenApiExpandedSchema & {name: string} {
    return typeof schema !== 'boolean' && schema.name !== undefined;
}

export {attachTypeAnnotation};

export type {CommentsRenderConfig};

export function renderTypeScript(statements: Statement[], commentsConfig: CommentsRenderConfig = {}): string {
    return printStatements(statements, commentsConfig);
}

export function isValidIdentifierName(name: string, allowReserved?: boolean): boolean {
    return isValidIdentifier(name, allowReserved);
}
