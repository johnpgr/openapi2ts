#!/usr/bin/env node
import * as fs from 'fs';
import path from 'path';
import {pathToFileURL} from 'url';
import {buildQuickConfig, CLI_USAGE, discoverConfigFile, parseCliArgs} from './args.ts';
import {compareGenerationResult} from './compare-generation-result.ts';
import {saveGenerationResult} from './save-generation-result.ts';
import {defaultCoreRelativeDirPath} from '../schema-to-typescript/common/client-core.ts';
import {defaultModelsRelativeDirPath} from '../schema-to-typescript/common/models.ts';
import {defaultServicesRelativeDirPath} from '../schema-to-typescript/common/services.ts';
import type { Openapi2tsConfig, CommonOpenApiClientGeneratorConfig } from '../schema-to-typescript/config.ts';
import { openapiToTypescriptClient } from '../schema-to-typescript/openapi-to-typescript-client.ts';
import type { OpenApiClientGeneratorConfig } from '../schema-to-typescript/openapi-to-typescript-client.ts';
import {loadOpenApiDocument} from '../schemas/load-open-api-document.ts';

function printHelp(): void {
    process.stdout.write(CLI_USAGE);
}

async function loadConfigModule(fullFilename: string): Promise<Record<string, unknown>> {
    const moduleUrl = pathToFileURL(fullFilename).href;
    const dynamicImport = new Function('url', 'return import(url)') as (url: string) => Promise<Record<string, unknown>>;
    return dynamicImport(moduleUrl);
}

async function loadConfig(filename: string): Promise<Openapi2tsConfig> {
    const fullFilename = path.resolve(process.cwd(), filename);
    if (!fs.existsSync(fullFilename)) {
        throw new Error(`Could not find configuration file: ${fullFilename}`);
    }
    try {
        const configImport = await loadConfigModule(fullFilename);
        let config: unknown = 'default' in configImport ? configImport.default : configImport;
        if (typeof config === 'function') {
            config = await config();
        }
        return config as Openapi2tsConfig;
    } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        throw new Error(
            `Could not load configuration file: ${fullFilename}\n${message}\n` +
                'Config must use erasable TypeScript only (no enums, namespaces, parameter properties, or decorators).'
        );
    }
}

function getCleanupDirectories(generateConfig: OpenApiClientGeneratorConfig & CommonOpenApiClientGeneratorConfig) {
    return [
        ...(generateConfig.models?.cleanupFiles
            ? [generateConfig.models?.relativeDirPath ?? defaultModelsRelativeDirPath]
            : []),
        ...(generateConfig.services && generateConfig.services?.cleanupFiles
            ? [generateConfig.services?.relativeDirPath ?? defaultServicesRelativeDirPath]
            : []),
        ...(generateConfig.core?.cleanupFiles
            ? [generateConfig.core?.relativeDirPath ?? defaultCoreRelativeDirPath]
            : [])
    ];
}

async function resolveConfig(parsed: Extract<ReturnType<typeof parseCliArgs>, {kind: 'success'}>): Promise<Openapi2tsConfig> {
    if (parsed.mode === 'quick') {
        return buildQuickConfig(parsed.quick);
    }
    const configPath =
        parsed.mode === 'config' ? parsed.configPath : discoverConfigFile(process.cwd());
    if (!configPath) {
        throw new Error(
            'No configuration file found in the current working directory.\n' +
                'Create openapi2ts.config.ts or pass a config path, or use --url/--file with --out.'
        );
    }
    return loadConfig(configPath);
}

async function main() {
    const parsed = parseCliArgs(process.argv.slice(2));
    if (parsed.kind === 'help') {
        printHelp();
        return;
    }
    if (parsed.kind === 'error') {
        process.stderr.write(`${parsed.message}\n\n`);
        printHelp();
        process.exit(1);
    }

    const config: Openapi2tsConfig = await resolveConfig(parsed);
    for (const generateConfig of config.generates) {
        if (generateConfig.type !== 'openapiClient') {
            continue;
        }
        const document = await loadOpenApiDocument(generateConfig.document);
        const files = (await openapiToTypescriptClient({document, generateConfig})).files;
        if (parsed.command === 'generate') {
            const allDirectories = new Set<string>();
            for (const {filename} of files) {
                allDirectories.add(path.dirname(path.resolve(generateConfig.outputDirPath, filename)));
            }
            for (const directoryPath of allDirectories) {
                await fs.promises.mkdir(directoryPath, {recursive: true});
            }
            await saveGenerationResult({
                files,
                outputDirPath: generateConfig.outputDirPath,
                cleanupDirectories: getCleanupDirectories(generateConfig)
            });
        } else {
            if (
                !(await compareGenerationResult({
                    files,
                    outputDirPath: generateConfig.outputDirPath,
                    cleanupDirectories: getCleanupDirectories(generateConfig)
                }))
            ) {
                process.stderr.write(
                    'Generated files are not up to date. Please run "openapi2ts generate" to update them.\n'
                );
                process.exit(1);
            }
        }
    }
}

main().catch((e) => {
    process.stderr.write(`${e instanceof Error ? e.message : e}\n`);
    process.exit(1);
});
