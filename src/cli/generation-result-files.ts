import fs from 'fs';
import path from 'path';
import {indexBy} from '../utils/collections.ts';
import type { ClientGenerationResultFile } from '../schema-to-typescript/config.ts';

export function resolveGenerationResultFile(outputDirPath: string, filename: string) {
    return path.resolve(outputDirPath, filename);
}

export function indexGenerationResultFiles(files: ClientGenerationResultFile[], outputDirPath: string) {
    return indexBy(files, ({filename}) => resolveGenerationResultFile(outputDirPath, filename));
}

export async function readExistingGenerationResultFile(fullFilename: string) {
    try {
        return {
            exists: true,
            data: await fs.promises.readFile(fullFilename, 'utf8')
        };
    } catch (e) {
        return {
            exists: false,
            data: undefined
        };
    }
}
