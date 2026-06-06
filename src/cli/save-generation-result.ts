import fs from 'fs';
import path from 'path';
import type { ClientGenerationResultFile } from '../schema-to-typescript/config.ts';
import {indexGenerationResultFiles, readExistingGenerationResultFile, resolveGenerationResultFile} from './generation-result-files.ts';

export async function saveGenerationResult({
    files,
    outputDirPath,
    cleanupDirectories
}: {
    files: ClientGenerationResultFile[];
    outputDirPath: string;
    cleanupDirectories: string[];
}) {
    const filesIndex = indexGenerationResultFiles(files, outputDirPath);
    await Promise.all([
        ...cleanupDirectories.map(async (directoryRelativePath) => {
            const directoryPath = path.resolve(outputDirPath, directoryRelativePath);
            for (const filename of await fs.promises.readdir(directoryPath)) {
                const fullFilename = path.resolve(directoryPath, filename);
                if (!Object.prototype.hasOwnProperty.call(filesIndex, fullFilename)) {
                    console.log('[deleted] ' + fullFilename);
                    await fs.promises.rm(fullFilename, {recursive: true});
                }
            }
        }),
        ...files.map(async ({filename, data}) => {
            const fullFilename = resolveGenerationResultFile(outputDirPath, filename);
            try {
                const existingFile = await readExistingGenerationResultFile(fullFilename);
                if (existingFile.data === data) {
                    console.log('[no change] ' + fullFilename);
                    return;
                }
                await fs.promises.writeFile(fullFilename, data);
                console.log(`[${existingFile.exists ? 'updated' : 'created'}] ${fullFilename}`);
            } catch (e) {
                throw new Error(`Could not save file "${fullFilename}": ${e instanceof Error ? e.message : e}.`);
            }
        })
    ]);
}
