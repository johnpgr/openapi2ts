import fs from 'fs';
import path from 'path';
import {fileURLToPath} from 'url';
import { formatFilename } from '../../utils/string-utils.ts';
import type { FilenameFormat } from '../../utils/string-utils.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
import { renderTypeScript } from '../common.ts';
import type { CommentsRenderConfig } from '../common.ts';
import type { ClientGenerationResultFile } from '../config.ts';
import type { GenerateCoreJsDoc, OpenApiClientGeneratorConfig } from '../openapi-to-typescript-client.ts';

const IMPORT_PATH_RE = /from ['"]\.\/([^'"]+)['"]/g;

function processCoreFile(
    code: string,
    filenameFormat: FilenameFormat | undefined,
    commentsConfig: CommentsRenderConfig,
    _generateJsDoc?: GenerateCoreJsDoc
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

export async function generateCommonHttpClient(
    {
        filenameFormat,
        relativeDirPath = defaultCoreRelativeDirPath,
        generateJsDoc
    }: OpenApiClientGeneratorConfig['core'] = {},
    commentsConfig: CommentsRenderConfig
): Promise<{
    importPath: string;
    className: string;
    classOptionsName: string;
    errorClassName: string;
    file: ClientGenerationResultFile;
}> {
    return {
        className: 'CommonHttpClient',
        classOptionsName: 'CommonHttpClientOptions',
        errorClassName: 'CommonHttpClientError',
        importPath: path.join(relativeDirPath, formatFilename('common-http-client', filenameFormat)),
        file: {
            filename: path.join(
                relativeDirPath,
                formatFilename('common-http-client', {...filenameFormat, extension: '.ts'})
            ),
            data: processCoreFile(
                await fs.promises.readFile(path.join(__dirname, 'core', 'common-http-client.ts'), 'utf8'),
                filenameFormat,
                commentsConfig,
                generateJsDoc
            )
        }
    };
}

export async function generateCommonHttpService(
    {
        filenameFormat,
        relativeDirPath = defaultCoreRelativeDirPath,
        generateJsDoc
    }: OpenApiClientGeneratorConfig['core'] = {},
    commentsConfig: CommentsRenderConfig
): Promise<{
    importPath: string;
    className: string;
    file: ClientGenerationResultFile;
}> {
    return {
        importPath: path.join(relativeDirPath, formatFilename('common-http-service', filenameFormat)),
        className: 'CommonHttpService',
        file: {
            filename: path.join(
                relativeDirPath,
                `${formatFilename('common-http-service', {...filenameFormat, extension: '.ts'})}`
            ),
            data: processCoreFile(
                await fs.promises.readFile(path.join(__dirname, 'core', 'common-http-service.ts'), 'utf8'),
                filenameFormat,
                commentsConfig,
                generateJsDoc
            )
        }
    };
}
