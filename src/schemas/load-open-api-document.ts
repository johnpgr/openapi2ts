import { resolveDocumentReferences } from "./common.ts";
import { fetchSource } from "./fetch-source.ts";
import { processOpenApiDocument } from "./openapi.ts";
import type { OpenApiDocument } from "./openapi.ts";
import { patchOpenApiDocument } from "./patch-open-api-document.ts";
import type { CommonOpenApiClientGeneratorConfigDocument } from "../schema-to-typescript/config.ts";

export async function loadOpenApiDocument(
    config: CommonOpenApiClientGeneratorConfigDocument,
): Promise<OpenApiDocument> {
    let document = (await fetchSource(config.source)) as OpenApiDocument;
    if (config.patch) {
        document = await patchOpenApiDocument(document, config.patch);
    }
    document = resolveDocumentReferences(processOpenApiDocument(document));
    return document;
}
