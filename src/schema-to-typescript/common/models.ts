import path from 'path';
import { exportNamedDeclaration, identifier, isTSIndexSignature, isTSIntersectionType, isTSTypeLiteral, program, tsExpressionWithTypeArguments, tsInterfaceBody, tsInterfaceDeclaration, tsTypeAliasDeclaration, tsTypeParameterInstantiation, tsTypeReference } from '../../emit/index.ts';
import type { ExportNamedDeclaration } from '../../emit/index.ts';
import ts from '../../emit/load-typescript.ts';
import {groupBy} from '../../utils/collections.ts';
import {generateBinaryType} from './binary.ts';
import type { OpenApiSchema } from '../../schemas/common.ts';
import { openApiHttpMethods } from '../../schemas/openapi.ts';
import type { OpenApiPaths } from '../../schemas/openapi.ts';
import { addDependencyImport, collectSchemaDependencies, extendDependenciesAndGetResult, generateTsImports } from '../../utils/dependencies.ts';
import type { DependencyImports } from '../../utils/dependencies.ts';
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
    const schemaType = generateSchemaType({
        schema,
        getTypeName: getModelName,
        getBinaryType: () =>
            extendDependenciesAndGetResult(generateBinaryType(binaryTypes, importPath), dependencyImports),
        processJsDoc:
            generateJsDoc &&
            ((jsdoc, schemaEntity, fieldPath: OpenApiSchemaFieldPathItem[]) =>
                generateJsDoc({
                    suggestedJsDoc: jsdoc,
                    schema: schemaEntity,
                    schemaName,
                    fieldPath
                }))
    });

    let exportedType = isTSTypeLiteral(schemaType)
        ? tsInterfaceDeclaration(identifier(modelName), null, null, tsInterfaceBody(schemaType.members))
        : tsTypeAliasDeclaration(identifier(modelName), null, schemaType);

    if (!isTSTypeLiteral(schemaType)) {
        if (isTSIntersectionType(schemaType) && schemaType.types.length === 2) {
            const [interfaceBody, additionalProperties] = schemaType.types;
            if (
                isTSTypeLiteral(interfaceBody) &&
                isTSTypeLiteral(additionalProperties) &&
                additionalProperties.members.length === 1
            ) {
                const additionalPropertiesMember = additionalProperties.members[0];
                if (isTSIndexSignature(additionalPropertiesMember)) {
                    exportedType = tsInterfaceDeclaration(
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
                        tsInterfaceBody(interfaceBody.members)
                    );
                }
            }
        }
    }

    let jsdoc = extractJsDoc(schema);
    if (generateJsDoc) {
        jsdoc = generateJsDoc({
            suggestedJsDoc: jsdoc,
            schemaName,
            fieldPath: [],
            schema
        });
    }
    return {
        result: attachJsDocComment(exportNamedDeclaration(exportedType), renderJsDoc(jsdoc, jsDocRenderConfig)),
        dependencyImports
    };
}

export const defaultModelsRelativeDirPath = 'models';

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

    const schemaInfos: Record<string, {tagNames: Set<string>; dependencies: string[]; schema: OpenApiSchema}> = {};

    function processTag(tagName: string, paths: OpenApiPaths) {
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

        function collectAllDependencies(schemasToCollect: OpenApiSchema[]) {
            for (const [name, schema] of Object.entries(collectSchemaDependencies({oneOf: schemasToCollect}))) {
                collectDependenciesFor(name, schema);
            }
        }

        collectAllDependencies(schemas);
    }

    for (const [tagName, paths] of Object.entries(extractedTags.taggedPaths)) {
        processTag(tagName, paths);
    }

    function getModelName(schemaName: string) {
        const suggestedName = applyEntityNameCase(schemaName, 'pascalCase');
        return generateName
            ? generateName({
                  suggestedName,
                  schemaName
              })
            : suggestedName;
    }

    processTag(defaultScope, extractedTags.rest);

    const finalSchemaInfos: Record<
        string,
        {schemaName: string; modelName: string; scope: string; dependencies: string[]; schema: OpenApiSchema}
    > = {};

    for (const [schemaName, {dependencies, tagNames, schema}] of Object.entries(schemaInfos)) {
        const scope: string = tagNames.size > 1 ? defaultScope : tagNames.values().next().value!;
        const modelName = getModelName(schemaName);
        finalSchemaInfos[schemaName] = {
            schemaName,
            modelName,
            dependencies,
            schema,
            scope
        };
    }

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
