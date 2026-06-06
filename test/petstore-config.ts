import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Openapi2tsConfig } from "../src/index.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function createPetstoreConfig(outputDirPath: string) {
    return {
        generates: [
            {
                type: "openapiClient",
                document: {
                    source: {
                        type: "file",
                        path: path.join(__dirname, "fixtures/petstore.json"),
                    },
                },
                outputDirPath: path.join(__dirname, outputDirPath),
                client: {
                    name: "PetStoreApiClient",
                    baseUrl: "https://petstore.swagger.io/v2",
                },
                operations: {
                    showDeprecatedWarnings: true,
                },
                core: { cleanupFiles: true },
                models: { cleanupFiles: true },
                services: { cleanupFiles: true },
            },
        ],
    } satisfies Openapi2tsConfig;
}
