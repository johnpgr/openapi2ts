import path from 'node:path';
import {fileURLToPath} from 'node:url';
import type {Openapi2tsConfig} from '../src/index.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default {
    generates: [
        {
            type: 'openapiClient',
            document: {
                source: {
                    type: 'file',
                    path: path.join(__dirname, 'fixtures/petstore.json')
                }
            },
            outputDirPath: path.join(__dirname, 'output/openapi2ts'),
            client: {
                name: 'PetStoreApiClient',
                baseUrl: 'https://petstore.swagger.io/v2'
            },
            operations: {
                showDeprecatedWarnings: true
            },
            core: {cleanupFiles: true},
            models: {cleanupFiles: true},
            services: {cleanupFiles: true}
        }
    ]
} satisfies Openapi2tsConfig;
