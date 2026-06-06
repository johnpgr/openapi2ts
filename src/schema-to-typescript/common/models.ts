import path from 'path';
import { exportNamedDeclaration, identifier, isTSIndexSignature, isTSIntersectionType, isTSTypeLiteral, program, tsExpressionWithTypeArguments, tsInterfaceBody, tsInterfaceDeclaration, tsTypeAliasDeclaration, tsTypeParameterInstantiation, tsTypeReference } from '../../emit/index.ts';
import type { ExportNamedDeclaration, TSType } from '../../emit/index.ts';
import ts from 'typescript';
import {groupBy} from '../../utils/collections.ts';
import {createBinaryTypeGetter} from './binary.ts';
import type { OpenApiSchema } from '../../schemas/common.ts';
import { openApiHttpMethods } from '../../schemas/openapi.ts';
import type { OpenApiPaths } from '../../schemas/openapi.ts';
import { addDependencyImport, collectSchemaDependencies, extendDependenciesAndGetResult, generateTsImports } from '../../utils/dependencies.ts';
import type { DependencyImports } from '../../utils/dependencies.ts';
import { resolveJsDocWithHook, resolveWithHook } from '../../utils/hooks.ts';
import { attachJsDocComment, extractJsDoc, renderJsDoc } from '../../utils/jsdoc.ts';
import type { JsDocRenderConfig } from '../../utils/jsdoc.ts';
import {getRelativeImportPath} from '../../utils/paths.ts';
import {applyEntityNameCase, formatFilename} from '../../utils/string-utils.ts';
import type { ExtractedTags } from '../../utils/tags.ts';
import { generateSchemaType, renderTypeScript } from '../common.ts';
import type { CommentsRenderConfig, OpenApiSchemaFieldPathItem } from '../common.ts';
import type { ClientGenerationResultFile } from '../config.ts';
import type { GenerateModelJsDoc, OpenApiClientCustomizableBinaryType, OpenApiClientGeneratorConfig } from '../openapi-to-typescript-client.ts';

export interface ModelImportInfo {
    modelName: string;
    schemaName: string;
    importPath: string;
}
export type ModelsIndex = Record<string, ModelImportInfo>;
export type GetModelData = (schemaName: string) => ModelImportInfo;

interface GeneratedModels {
    files: ClientGenerationResultFile[];
    modelsIndex: ModelsIndex;
}

interface SchemaInfo {
    tagNames: Set<string>;
    dependencies: string[];
    schema: OpenApiSchema;
}

interface FinalSchemaInfo {
    schemaName: string;
    modelName: string;
    scope: string;
    dependencies: string[];
    schema: OpenApiSchema;
}

interface TypeLiteralLike {
    members: ts.TypeElement[];
}

interface IntersectionTypeLike {
    types: TSType[];
}

function generateTypeExport({
    modelName,
    schemaName,
    getModelName,
    schema,
    generateJsDoc,
    binaryTypes,
    importPath,
    jsDocRenderConfig
}: {
    modelName: string;
    schemaName: string;
    getModelName: (name: string) => string;
    schema: OpenApiSchema;
    generateJsDoc?: GenerateModelJsDoc;
    binaryTypes: OpenApiClientCustomizableBinaryType[];
    importPath: string;
    jsDocRenderConfig: JsDocRenderConfig;
}) {
    const dependencyImports: DependencyImports = {};
    const getBinaryType = createBinaryTypeGetter(binaryTypes, importPath, dependencyImports);
    const schemaType = generateSchemaType({
        schema,
        getTypeName: getModelName,
        getBinaryType,
        processJsDoc:
            generateJsDoc &&
            ((jsdoc, schemaEntity, fieldPath: OpenApiSchemaFieldPathItem[]) =>
                resolveJsDocWithHook(jsdoc, generateJsDoc, {schema: schemaEntity, schemaName, fieldPath}))
    });

    const jsdoc = resolveJsDocWithHook(extractJsDoc(schema), generateJsDoc, {
        schemaName,
        fieldPath: [],
        schema
    });
    return {
        result: attachJsDocComment(
            exportNamedDeclaration(createModelDeclaration(modelName, schemaType)),
            renderJsDoc(jsdoc, jsDocRenderConfig)
        ),
        dependencyImports
    };
}

function createModelDeclaration(modelName: string, schemaType: TSType) {
    if (isTSTypeLiteral(schemaType)) {
        const typeLiteral = schemaType as TypeLiteralLike;
        return tsInterfaceDeclaration(identifier(modelName), null, null, tsInterfaceBody(typeLiteral.members));
    }
    return createRecordInterfaceDeclaration(modelName, schemaType) ?? tsTypeAliasDeclaration(identifier(modelName), null, schemaType);
}

function createRecordInterfaceDeclaration(modelName: string, schemaType: TSType) {
    if (!isTSIntersectionType(schemaType)) {
        return undefined;
    }
    const intersectionType = schemaType as IntersectionTypeLike;
    if (intersectionType.types.length !== 2) {
        return undefined;
    }
    const [interfaceBody, additionalProperties] = intersectionType.types;
    if (
        !isTSTypeLiteral(interfaceBody) ||
        !isTSTypeLiteral(additionalProperties) ||
        (additionalProperties as TypeLiteralLike).members.length !== 1
    ) {
        return undefined;
    }
    const interfaceType = interfaceBody as TypeLiteralLike;
    const additionalPropertiesType = additionalProperties as TypeLiteralLike;
    const additionalPropertiesMember = additionalPropertiesType.members[0];
    if (!isTSIndexSignature(additionalPropertiesMember)) {
        return undefined;
    }
    return tsInterfaceDeclaration(
        identifier(modelName),
        null,
        [
            ts.factory.createHeritageClause(ts.SyntaxKind.ExtendsKeyword, [
                tsExpressionWithTypeArguments(
                    identifier('Record'),
                    tsTypeParameterInstantiation([
                        additionalPropertiesMember.parameters[0].type!,
                        additionalPropertiesMember.type
                    ])
                )
            ])
        ],
        tsInterfaceBody(interfaceType.members)
    );
}

export const defaultModelsRelativeDirPath = 'models';

function collectOperationSchemas(paths: OpenApiPaths) {
    const schemas: OpenApiSchema[] = [];
    for (const pathSchema of Object.values(paths)) {
        for (const method of openApiHttpMethods) {
            if (!Object.prototype.hasOwnProperty.call(pathSchema, method)) {
                continue;
            }
            const operation = pathSchema[method]!;
            for (const parameter of operation.parameters ?? []) {
                if (parameter.schema) {
                    schemas.push(parameter.schema);
                }
            }
            for (const mediaType of Object.values(operation.requestBody?.content ?? {})) {
                if (mediaType.schema) {
                    schemas.push(mediaType.schema);
                }
            }
            for (const response of Object.values(operation.responses ?? {})) {
                for (const mediaType of Object.values(response.content ?? {})) {
                    if (mediaType.schema) {
                        schemas.push(mediaType.schema);
                    }
                }
            }
        }
    }
    return schemas;
}

function collectSchemaInfoForTag(tagName: string, paths: OpenApiPaths, schemaInfos: Record<string, SchemaInfo>) {
    function collectDependenciesFor(name: string, schema: OpenApiSchema) {
        if (schemaInfos[name]) {
            schemaInfos[name].tagNames.add(tagName);
            return;
        }
        schemaInfos[name] = {
            dependencies: [],
            tagNames: new Set([tagName]),
            schema
        };
        for (const [depName, depSchema] of Object.entries(collectSchemaDependencies(schema))) {
            schemaInfos[name].dependencies.push(depName);
            collectDependenciesFor(depName, depSchema);
        }
    }

    for (const [name, schema] of Object.entries(collectSchemaDependencies({oneOf: collectOperationSchemas(paths)}))) {
        collectDependenciesFor(name, schema);
    }
}

function buildFinalSchemaInfos({
    schemaInfos,
    defaultScope,
    getModelName
}: {
    schemaInfos: Record<string, SchemaInfo>;
    defaultScope: string;
    getModelName: (schemaName: string) => string;
}) {
    const finalSchemaInfos: Record<string, FinalSchemaInfo> = {};

    for (const [schemaName, {dependencies, tagNames, schema}] of Object.entries(schemaInfos)) {
        const scope: string = tagNames.size > 1 ? defaultScope : tagNames.values().next().value!;
        finalSchemaInfos[schemaName] = {
            schemaName,
            modelName: getModelName(schemaName),
            dependencies,
            schema,
            scope
        };
    }

    return finalSchemaInfos;
}

function addModelDependencyImports({
    dependencies,
    finalSchemaInfos,
    scope,
    filename,
    relativeDirPath,
    filenameFormat,
    dependencyImports
}: {
    dependencies: string[];
    finalSchemaInfos: Record<string, FinalSchemaInfo>;
    scope: string;
    filename: string;
    relativeDirPath: string;
    filenameFormat: NonNullable<OpenApiClientGeneratorConfig['models']>['filenameFormat'];
    dependencyImports: DependencyImports;
}) {
    for (const dependency of dependencies) {
        const depInfo = finalSchemaInfos[dependency];
        if (depInfo.scope === scope) {
            continue;
        }
        const depPath = getRelativeImportPath(
            filename,
            path.join(relativeDirPath, formatFilename(depInfo.scope, filenameFormat))
        );
        addDependencyImport(dependencyImports, depPath, depInfo.modelName, {
            kind: 'type',
            entity: {name: depInfo.modelName}
        });
    }
}

export function generateModels({
    extractedTags,
    modelsConfig: {
        filenameFormat,
        relativeDirPath = defaultModelsRelativeDirPath,
        defaultScope = 'common',
        generateName,
        generateJsDoc
    } = {},
    binaryTypes,
    jsDocRenderConfig,
    commentsConfig
}: {
    extractedTags: ExtractedTags;
    modelsConfig: OpenApiClientGeneratorConfig['models'];
    binaryTypes: OpenApiClientCustomizableBinaryType[];
    jsDocRenderConfig: JsDocRenderConfig;
    commentsConfig: CommentsRenderConfig;
}): GeneratedModels {
    const files: ClientGenerationResultFile[] = [];
    const modelsIndex: ModelsIndex = {};

    const schemaInfos: Record<string, SchemaInfo> = {};

    for (const [tagName, paths] of Object.entries(extractedTags.taggedPaths)) {
        collectSchemaInfoForTag(tagName, paths, schemaInfos);
    }

    function getModelName(schemaName: string) {
        const suggestedName = applyEntityNameCase(schemaName, 'pascalCase');
        return resolveWithHook(suggestedName, generateName, {suggestedName, schemaName});
    }

    collectSchemaInfoForTag(defaultScope, extractedTags.rest, schemaInfos);

    const finalSchemaInfos = buildFinalSchemaInfos({schemaInfos, defaultScope, getModelName});

    const schemasByScopes = groupBy(
        Object.values(finalSchemaInfos).sort((a, b) => a.modelName.localeCompare(b.modelName)),
        ({scope}) => scope
    );

    for (const [scope, fileSchemaInfos] of Object.entries(schemasByScopes)) {
        const filename = path.join('.', relativeDirPath, formatFilename(scope, {...filenameFormat, extension: '.ts'}));
        const dependencyImports: DependencyImports = {};
        const exports: ExportNamedDeclaration[] = [];
        const importPath = path.join(relativeDirPath, formatFilename(scope, filenameFormat));
        for (const {dependencies, modelName, schemaName, schema} of fileSchemaInfos) {
            addModelDependencyImports({
                dependencies,
                finalSchemaInfos,
                scope,
                filename,
                relativeDirPath,
                filenameFormat,
                dependencyImports
            });
            exports.push(
                extendDependenciesAndGetResult(
                    generateTypeExport({
                        modelName,
                        schemaName,
                        getModelName,
                        schema,
                        generateJsDoc,
                        binaryTypes,
                        importPath,
                        jsDocRenderConfig
                    }),
                    dependencyImports
                )
            );
            modelsIndex[schemaName] = {
                modelName,
                schemaName,
                importPath
            };
        }
        files.push({
            filename,
            data: renderTypeScript(program([...generateTsImports(dependencyImports), ...exports]), commentsConfig)
        });
    }

    return {files, modelsIndex};
}
