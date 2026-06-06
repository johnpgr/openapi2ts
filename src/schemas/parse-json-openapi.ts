import type { OpenApiDocument } from "./openapi.ts";

export function parseJsonOpenApiSource(text: string, sourceLabel: string): OpenApiDocument {
    try {
        return JSON.parse(text) as OpenApiDocument;
    } catch (error) {
        throw new Error(
            `Failed to parse OpenAPI JSON from "${sourceLabel}": ${error instanceof Error ? error.message : String(error)}`,
        );
    }
}
