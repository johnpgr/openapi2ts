import fs from 'fs';
import path from 'path';
import {fileURLToPath} from 'url';
import { formatFilename } from '../../utils/string-utils.ts';
import type { FilenameFormat } from '../../utils/string-utils.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
import type { CommentsRenderConfig } from '../common.ts';
import type { ClientGenerationResultFile } from '../config.ts';
import type { OpenApiClientGeneratorConfig } from '../openapi-to-typescript-client.ts';

const IMPORT_PATH_RE = /from ['"]\.\/([^'"]+)['"]/g;

function processCoreFile(
    code: string,
    filenameFormat: FilenameFormat | undefined,
    commentsConfig: CommentsRenderConfig
): string {
    let result = code.replace(/\r\n/g, '\n');
    result = result.replace(IMPORT_PATH_RE, (_match, importPath: string) => {
        const baseName = importPath.replace(/\.tsx?$/, '');
        return `from './${formatFilename(baseName, filenameFormat)}'`;
    });
    if (commentsConfig.leadingComment) {
        result =
            commentsConfig.leadingComment
                .split('\n')
                .map((line) => `// ${line.trim()}`)
                .join('\n') +
            '\n' +
            result;
    }
    if (commentsConfig.trailingComment) {
        result =
            result +
            '\n' +
            commentsConfig.trailingComment
                .split('\n')
                .map((line) => `// ${line.trim()}`)
                .join('\n') +
            '\n';
    }
    return result;
}

export const defaultCoreRelativeDirPath = 'core';

async function readCoreTemplate(
    templateName: string,
    {
        filenameFormat,
        relativeDirPath = defaultCoreRelativeDirPath
    }: OpenApiClientGeneratorConfig['core'] = {},
    commentsConfig: CommentsRenderConfig
): Promise<{
    importPath: string;
    filename: string;
    data: string;
}> {
    const importPath = path.join(relativeDirPath, formatFilename(templateName, filenameFormat));
    const filename = path.join(relativeDirPath, formatFilename(templateName, {...filenameFormat, extension: '.ts'}));
    const data = processCoreFile(
        await fs.promises.readFile(path.join(__dirname, 'core', `${templateName}.ts`), 'utf8'),
        filenameFormat,
        commentsConfig
    );
    return {importPath, filename, data};
}

export async function generateCommonHttpClient(
    coreConfig: OpenApiClientGeneratorConfig['core'] = {},
    commentsConfig: CommentsRenderConfig
): Promise<{
    importPath: string;
    className: string;
    classOptionsName: string;
    errorClassName: string;
    file: ClientGenerationResultFile;
}> {
    const {importPath, filename, data} = await readCoreTemplate('common-http-client', coreConfig, commentsConfig);
    return {
        className: 'CommonHttpClient',
        classOptionsName: 'CommonHttpClientOptions',
        errorClassName: 'CommonHttpClientError',
        importPath,
        file: {filename, data}
    };
}

export async function generateCommonHttpService(
    coreConfig: OpenApiClientGeneratorConfig['core'] = {},
    commentsConfig: CommentsRenderConfig
): Promise<{
    importPath: string;
    className: string;
    file: ClientGenerationResultFile;
}> {
    const {importPath, filename, data} = await readCoreTemplate('common-http-service', coreConfig, commentsConfig);
    return {
        importPath,
        className: 'CommonHttpService',
        file: {filename, data}
    };
}
