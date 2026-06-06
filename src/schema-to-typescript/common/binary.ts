import { identifier, tsQualifiedName, tsTypeParameterInstantiation, tsTypeReference, tsUnionType } from '../../emit/index.ts';
import type { TSType } from '../../emit/index.ts';
import ts from 'typescript';
import { addDependencyImport, extendDependenciesAndGetResult } from '../../utils/dependencies.ts';
import type { DependencyImports } from '../../utils/dependencies.ts';
import {getRelativeImportPath, isRelativeImportPath} from '../../utils/paths.ts';
import {ucFirst} from '../../utils/string-utils.ts';
import {simplifyUnionTypeIfPossible} from '../../utils/type-utils.ts';
import type { OpenApiClientCustomizableBinaryType } from '../openapi-to-typescript-client.ts';

function qualifiedTypeName(name: string | string[]): ts.EntityName {
    if (name.length === 0) {
        throw new Error('qualifiedTypeName: name is empty');
    }
    if (Array.isArray(name) && name.length > 1) {
        return tsQualifiedName(qualifiedTypeName(name.slice(0, -1)), identifier(name[name.length - 1]));
    }
    return identifier(Array.isArray(name) ? name[0] : name);
}

export function generateBinaryType(
    config: OpenApiClientCustomizableBinaryType[],
    basePath: string
): {
    result: TSType;
    dependencyImports: DependencyImports;
} {
    const dependencyImports: DependencyImports = {};
    const types: TSType[] = [];
    for (const binaryType of config) {
        if (typeof binaryType === 'string') {
            types.push(tsTypeReference(identifier(ucFirst(binaryType))));
        } else {
            const {name, source, typeParameters} = binaryType;
            let typeTemplateParameters: ReturnType<typeof tsTypeParameterInstantiation> | undefined;
            if (typeParameters) {
                const params: TSType[] = [];
                for (const typeParameter of typeParameters) {
                    params.push(
                        extendDependenciesAndGetResult(generateBinaryType([typeParameter], basePath), dependencyImports)
                    );
                }
                typeTemplateParameters = tsTypeParameterInstantiation(params);
            }
            if (source) {
                const importedEntityName = Array.isArray(name) ? name[0] : name;
                addDependencyImport(
                    dependencyImports,
                    isRelativeImportPath(source.importPath)
                        ? getRelativeImportPath(basePath, source.importPath)
                        : source.importPath,
                    importedEntityName,
                    {
                        kind: 'type',
                        entity: source.import
                    }
                );
            }
            types.push(tsTypeReference(qualifiedTypeName(name), typeTemplateParameters));
        }
    }
    return {result: simplifyUnionTypeIfPossible(tsUnionType(types)), dependencyImports};
}
