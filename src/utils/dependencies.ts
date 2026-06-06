import {
    identifier,
    importDeclaration,
    importDefaultSpecifier,
    importSpecifier,
    stringLiteral,
    tsNullKeyword,
} from "../emit/index.ts";
import type { ImportDeclaration } from "../emit/index.ts";
import { omit } from "./collections.ts";
import { getRelativeImportPath } from "./paths.ts";
import { generateSchemaType, isNamedSchema } from "../schema-to-typescript/common.ts";
import type { GenerateSchemaTypeParams } from "../schema-to-typescript/common.ts";
import type { OpenApiClientExternalValueSourceImportEntity } from "../schema-to-typescript/openapi-to-typescript-client.ts";
import type { OpenApiSchema } from "../schemas/common.ts";

interface DependencyImportsEntity {
    kind: "value" | "type";
    entity: OpenApiClientExternalValueSourceImportEntity;
}

export interface DependencyImports {
    [importPath: string]: {
        [aliasName: string]: DependencyImportsEntity;
    };
}

export function collectSchemaDependencies(schema: OpenApiSchema): Record<string, OpenApiSchema> {
    if (isNamedSchema(schema)) {
        return { [schema.name]: omit({ ...schema }, ["name"]) };
    }

    const result: Record<string, OpenApiSchema> = {};
    generateSchemaType({
        schema,
        expand: true,
        getTypeName: (schemaName, subSchema) => {
            if (typeof subSchema === "object" && subSchema !== null) {
                result[schemaName] = omit({ ...subSchema }, ["name"]);
            }
            return schemaName;
        },
        getBinaryType: () => tsNullKeyword(),
    });
    return result;
}

export function generateSchemaTypeAndImports(
    params: Omit<GenerateSchemaTypeParams, "getTypeName"> & {
        sourceImportPath: string;
        getModelData(schemaName: string): { modelName: string; importPath: string };
    },
) {
    const dependencyImports: DependencyImports = {};
    const result = generateSchemaType({
        ...params,
        getTypeName: (schemaName) => {
            const { modelName, importPath } = params.getModelData(schemaName);
            addDependencyImport(
                dependencyImports,
                getRelativeImportPath(params.sourceImportPath, importPath),
                modelName,
                {
                    kind: "type",
                    entity: { name: modelName },
                },
            );
            return modelName;
        },
    });
    return { result, dependencyImports };
}

export function extendDependenciesAndGetResult<T>(
    output: { result: T; dependencyImports: DependencyImports },
    dependencyImports: DependencyImports,
): T {
    extendDependencyImports(dependencyImports, output.dependencyImports);
    return output.result;
}

export function generateTsImports(dependencyImports: DependencyImports): ImportDeclaration[] {
    const entries = Object.entries(dependencyImports).sort(([a], [b]) => a.localeCompare(b));
    const result: ImportDeclaration[] = [];
    for (const [path, imports] of entries) {
        const allTypes = Object.values(imports).every(({ kind }) => kind === "type");
        const importSpecifiers = Object.entries(imports).map(([alias, { kind, entity }]) => {
            const specifier =
                entity === "default"
                    ? importDefaultSpecifier(identifier(alias))
                    : importSpecifier(
                          identifier(entity.name),
                          identifier(entity.name),
                          !allTypes && kind === "type",
                      );
            return specifier;
        });
        const declaration = importDeclaration(
            importSpecifiers,
            stringLiteral(path),
            allTypes ? "type" : undefined,
        );
        result.push(declaration);
    }
    return result;
}

export function addDependencyImport(
    dependencyImports: DependencyImports,
    importPath: string,
    aliasName: string,
    entity: DependencyImportsEntity,
) {
    dependencyImports[importPath] || (dependencyImports[importPath] = {});
    dependencyImports[importPath][aliasName] = entity;
}

export function extendDependencyImports(
    dependencyImports: DependencyImports,
    extension: DependencyImports,
) {
    for (const [importPath, entities] of Object.entries(extension)) {
        dependencyImports[importPath] || (dependencyImports[importPath] = {});
        for (const [aliasName, entity] of Object.entries(entities)) {
            dependencyImports[importPath][aliasName] = entity;
        }
    }
}
