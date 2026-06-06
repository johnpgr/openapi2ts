import { indexBy } from "./collections.ts";
import { openApiHttpMethods } from "../schemas/openapi.ts";
import type { OpenApiDocument, OpenApiPaths, OpenApiTag } from "../schemas/openapi.ts";

export interface ExtractedTags {
    taggedPaths: Record<string, OpenApiPaths>;
    rest: OpenApiPaths;
    tags: Record<string, OpenApiTag>;
}

export function extractTags(openApiDocument: OpenApiDocument): ExtractedTags {
    const taggedPaths: Record<string, OpenApiPaths> = {};
    const rest: OpenApiPaths = {};
    const tagIndex = indexBy(openApiDocument.tags ?? [], ({ name }) => name);
    const tags: Record<string, OpenApiTag> = {};
    for (const [path, pathSchema] of Object.entries(openApiDocument.paths ?? {}).sort(([a], [b]) =>
        a.localeCompare(b),
    )) {
        for (const method of openApiHttpMethods) {
            if (!Object.prototype.hasOwnProperty.call(pathSchema, method)) {
                continue;
            }
            const operation = pathSchema[method]!;
            if (operation.tags && operation.tags.length > 0) {
                for (const tagName of operation.tags.sort((a, b) => a.localeCompare(b))) {
                    taggedPaths[tagName] = taggedPaths[tagName] ?? {};
                    taggedPaths[tagName][path] = taggedPaths[tagName][path] ?? {
                        summary: pathSchema.summary,
                        description: pathSchema.description,
                        parameters: pathSchema.parameters,
                    };
                    taggedPaths[tagName][path][method] = operation;
                    if (!tags[tagName]) {
                        tags[tagName] = tagIndex[tagName];
                    }
                }
            }
        }
    }
    return { taggedPaths, rest, tags };
}
