import fs from 'fs';
import type { CommonApiToTypescriptGeneratorSource } from '../schema-to-typescript/config.ts';
import {parseJsonOpenApiSource} from './parse-json-openapi.ts';

export async function fetchSource(source: CommonApiToTypescriptGeneratorSource): Promise<unknown> {
    if (source.type === 'url') {
        const response = await fetch(source.url);
        if (!response.ok) {
            throw new Error(`Error downloading "${source.url}": ${response.statusText}`);
        }
        return parseJsonOpenApiSource(await response.text(), source.url);
    }
    if (source.type === 'file') {
        try {
            const text = await fs.promises.readFile(source.path, 'utf8');
            return parseJsonOpenApiSource(text, source.path);
        } catch (e) {
            throw new Error(`Error reading file "${source.path}": ${e instanceof Error ? e.message : e}`);
        }
    }
    if (source.type === 'object') {
        return source.object;
    }
    if (source.type === 'string') {
        return parseJsonOpenApiSource(source.data, 'inline string source');
    }
    throw new Error(`Unknown source type: ${(source as {type: string}).type}`);
}
