export type {
    Openapi2tsConfig,
    CommonOpenApiClientGeneratorConfig,
    CommonApiToTypescriptGeneratorSource,
    CommonOpenApiClientGeneratorConfigDocument,
    OpenApiDocumentPatchSchema,
    OpenApiDocumentPatchOperation,
    OpenApiDocumentPatchPathItem,
    OpenApiDocumentPatchTags,
    CommonOpenApiClientGeneratorConfigDocumentPatch,
    OpenApiDocumentPatchAllSchemas,
    OpenApiDocumentPatchDocument,
} from "./schema-to-typescript/config.ts";
export type { JsDocBlockTag, JsDocBlock } from "./utils/jsdoc.ts";
export type { FilenameFormat, EntityNameCase } from "./utils/string-utils.ts";
export {
    stringIndexSignature,
    type OpenApiSchemaFieldPathItem,
} from "./schema-to-typescript/common.ts";
