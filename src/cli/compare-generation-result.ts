import fs from 'fs';
import path from 'path';
import type { ClientGenerationResultFile } from '../schema-to-typescript/config.ts';
import {indexGenerationResultFiles, readExistingGenerationResultFile, resolveGenerationResultFile} from './generation-result-files.ts';

export async function compareGenerationResult({
    files,
    outputDirPath,
    cleanupDirectories
}: {
    files: ClientGenerationResultFile[];
    outputDirPath: string;
    cleanupDirectories: string[];
}): Promise<boolean> {
    let hasChanges = false;
    const filesIndex = indexGenerationResultFiles(files, outputDirPath);
    await Promise.all([
        ...cleanupDirectories.map(async (directoryRelativePath) => {
            const directoryPath = path.resolve(outputDirPath, directoryRelativePath);
            let filenames: string[];
            try {
                filenames = await fs.promises.readdir(directoryPath);
            } catch (e) {
                console.error(`[to-be-created] ${directoryPath}`);
                hasChanges = true;
                return;
            }
            for (const filename of filenames) {
                const fullFilename = path.resolve(directoryPath, filename);
                if (!Object.prototype.hasOwnProperty.call(filesIndex, fullFilename)) {
                    console.error(`[to-be-deleted] ${fullFilename}`);
                    hasChanges = true;
                }
            }
        }),
        ...files.map(async ({filename, data}) => {
            const fullFilename = resolveGenerationResultFile(outputDirPath, filename);
            const existingFile = await readExistingGenerationResultFile(fullFilename);
            if (existingFile.data === data) {
                return;
            }
            hasChanges = true;
            console.log(`[${existingFile.exists ? 'to-be-updated' : 'to-be-created'}] ${fullFilename}`);
        })
    ]);
    return !hasChanges;
}
