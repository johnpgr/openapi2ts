import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Openapi2tsConfig } from "../src/index.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default {
    generates: [
        {
            type: "openapiClient",
            document: {
                source: {
                    type: "url",
                    url: "http://127.0.0.1:8000/api/schema/?format=json",
                },
            },
            outputDirPath: path.join(__dirname, "snapshots/url-test"),
            client: {
                name: "ApiClient",
                baseUrl: "/api",
            },
            operations: {
                showDeprecatedWarnings: true,
            },
            core: {
                cleanupFiles: true,
            },
            models: {
                cleanupFiles: true,
            },
            services: {
                cleanupFiles: true,
            },
        },
    ],
} satisfies Openapi2tsConfig;
