import path from 'path';
import { blockStatement, classBody, classDeclaration, classMethod, exportNamedDeclaration, identifier, importDeclaration, importNamespaceSpecifier, importSpecifier, program, stringLiteral } from '../../emit/index.ts';
import type { ImportDeclaration } from '../../emit/index.ts';
import type { GetModelData } from './models.ts';
import {generateOperationMethods} from './operation-methods.ts';
import { openApiHttpMethods } from '../../schemas/openapi.ts';
import type { OpenApiPaths, OpenApiTag } from '../../schemas/openapi.ts';
import {makeProtected} from '../../utils/ast.ts';
import {generateTsImports} from '../../utils/dependencies.ts';
import { resolveJsDocWithHook, resolveWithHook } from '../../utils/hooks.ts';
import { attachJsDocComment, renderJsDoc } from '../../utils/jsdoc.ts';
import type { JsDocBlock, JsDocRenderConfig } from '../../utils/jsdoc.ts';
import {getRelativeImportPath} from '../../utils/paths.ts';
import { applyEntityNameCase, formatFilename } from '../../utils/string-utils.ts';
import type { FilenameFormat } from '../../utils/string-utils.ts';
import { renderTypeScript } from '../common.ts';
import type { CommentsRenderConfig } from '../common.ts';
import type { ClientGenerationResultFile } from '../config.ts';
import type { GenerateOperationName, OpenApiClientGeneratorConfig, GenerateOperationJsDoc, OpenApiClientCustomizableBinaryType } from '../openapi-to-typescript-client.ts';

const defaultServiceFilenameFormat: FilenameFormat = {
    postfix: '-service',
    filenameCase: 'kebabCase'
};

export interface GeneratedServicesImportInfo {
    name: string;
    importPath: string;
    tag: string;
    jsdoc: JsDocBlock;
}

export interface GeneratedServices {
    files: ClientGenerationResultFile[];
    services: GeneratedServicesImportInfo[];
    deprecatedOperations: {[methodAndPath: string]: string};
}

export const defaultServicesRelativeDirPath = 'services';

export function generateServices({
    taggedPaths,
    tags,
    commonHttpClientImportPath,
    commonHttpServiceImportPath,
    commonHttpServiceClassName,
    servicesConfig: {
        filenameFormat,
        relativeDirPath = defaultServicesRelativeDirPath,
        generateName,
        generateJsDoc
    } = {},
    operationsConfig,
    getModelData,
        binaryTypes,
    jsDocRenderConfig,
    commentsConfig
}: {
    taggedPaths: Record<string, OpenApiPaths>;
    tags: Record<string, OpenApiTag>;
    servicesConfig: Exclude<OpenApiClientGeneratorConfig['services'], boolean>;
    commonHttpClientImportPath: string;
    commonHttpServiceClassName: string;
    commonHttpServiceImportPath: string;
    operationsConfig?: OpenApiClientGeneratorConfig['operations'];
    generateOperationName?: GenerateOperationName;
    generateOperationJsDoc?: GenerateOperationJsDoc;
    getModelData: GetModelData;
        binaryTypes: OpenApiClientCustomizableBinaryType[];
    jsDocRenderConfig: JsDocRenderConfig;
    commentsConfig: CommentsRenderConfig;
}): GeneratedServices {
    const commonHttpClientImportName = 'commonHttpClient';
    const files: ClientGenerationResultFile[] = [];
    const services: GeneratedServicesImportInfo[] = [];
    const deprecatedOperations: {[methodAndPath: string]: string} = {};
    for (const [tag, paths] of Object.entries(taggedPaths)) {
        const importPath = path.join(
            relativeDirPath,
            formatFilename(tag, {...defaultServiceFilenameFormat, ...filenameFormat})
        );
        const suggestedName = applyEntityNameCase(tag + '-service', 'pascalCase');
        const tagInfo = tags[tag] ?? {name: tag};
        const serviceName = resolveWithHook(suggestedName, generateName, {
            suggestedName,
            tag: tagInfo,
            paths
        });

        let jsdoc: JsDocBlock = {
            description: tagInfo.description,
            tags: []
        };
        if (
            Object.values(paths).every((path) =>
                openApiHttpMethods.every((method) => !path[method] || path[method]?.deprecated)
            )
        ) {
            jsdoc.tags.push({name: 'deprecated'});
        }
        jsdoc = resolveJsDocWithHook(jsdoc, generateJsDoc, {serviceName, tag: tagInfo, paths});

        services.push({
            name: serviceName,
            tag,
            importPath,
            jsdoc
        });

        const serviceMethods = generateOperationMethods({
            paths,
            serviceName,
            operationsConfig,
            getModelData,
                        commonHttpClientImportName,
            operationImportPath: importPath,
            binaryTypes,
            jsDocRenderConfig
        });
        const serviceClassBody = classBody([...serviceMethods.methods]);

        Object.assign(
            deprecatedOperations,
            Object.fromEntries(
                Object.entries(serviceMethods.deprecatedOperations).map(([methodAndPath, operationName]) => [
                    methodAndPath,
                    `${applyEntityNameCase(tag, 'camelCase')}.${operationName}`
                ])
            )
        );

        const classObj = classDeclaration(
            identifier(serviceName),
            identifier(commonHttpServiceClassName),
            serviceClassBody
        );
        const imports: ImportDeclaration[] = [
            importDeclaration(
                [importNamespaceSpecifier(identifier(commonHttpClientImportName))],
                stringLiteral(getRelativeImportPath(importPath, commonHttpClientImportPath))
            ),
            importDeclaration(
                [importSpecifier(identifier(commonHttpServiceClassName), identifier(commonHttpServiceClassName))],
                stringLiteral(getRelativeImportPath(importPath, commonHttpServiceImportPath))
            ),
            ...generateTsImports(serviceMethods.dependencyImports)
        ];
        files.push({
            filename: path.join(
                relativeDirPath,
                formatFilename(tag, {...defaultServiceFilenameFormat, ...filenameFormat, extension: '.ts'})
            ),
            data: renderTypeScript(
                program([
                    ...imports,
                    attachJsDocComment(exportNamedDeclaration(classObj), renderJsDoc(jsdoc, jsDocRenderConfig))
                ]),
                commentsConfig
            )
        });
    }
    return {files, services, deprecatedOperations};
}
