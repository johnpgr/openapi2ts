import ts from 'typescript';
import {isTSPropertySignature} from '../emit/type-guards.ts';
import {wordWrap} from './string-utils.ts';
import type { AnnotatedApiEntity } from '../schema-to-typescript/common.ts';
import type { OpenApiClientGeneratorConfig } from '../schema-to-typescript/openapi-to-typescript-client.ts';

function processDescription(info: string): string {
    return info
        .trim()
        .replace(/<a\s*href\s*=\s*['"]([^'"]+)['"]\s*>/g, '$1 ')
        .replace(/<br\s*\/?>/g, '\n')
        .replace(/<\/a>/g, '');
}

function stringifyExample(example: unknown): string {
    const result = JSON.stringify(example, null, 2);
    if (Array.isArray(example)) {
        return '```\n' + result + '\n```';
    }
    return result;
}

function exampleToString(example: unknown) {
    if (typeof example !== 'string') {
        return stringifyExample(example);
    }
    try {
        return stringifyExample(JSON.parse(example));
    } catch {
        return example;
    }
}

export interface JsDocBlock {
    title?: string;
    description?: string;
    tags: JsDocBlockTag[];
}

export interface JsDocBlockTag {
    name: string;
    value?: string;
}

export function extractJsDoc(entity: AnnotatedApiEntity | boolean): JsDocBlock {
    const result: JsDocBlock = {tags: []};
    if (typeof entity === 'boolean') {
        return result;
    }
    if (entity.title) {
        result.title = processDescription(entity.title);
    }
    if (entity.description) {
        result.description = processDescription(entity.description);
    }
    if (entity.deprecated) {
        result.tags.push({name: 'deprecated'});
    }
    if (entity.example !== undefined) {
        result.tags.push({name: 'example', value: '\n' + exampleToString(entity.example).trim()});
    }
    if (entity.examples !== undefined) {
        for (const [exampleName, example] of Object.entries(entity.examples)) {
            const exampleInfo = exampleName ? [exampleName] : [];
            if (example.description) {
                exampleInfo.push(example.description);
            }
            result.tags.push({
                name: 'example',
                value: `${exampleInfo.length > 0 ? ` ${exampleInfo.join('. ')}` : ''}\n${exampleToString(example.value)}`
            });
        }
    }
    return result;
}

export function renderJsDocList(items: string[]): string {
    return items.map((item) => ` * ${item.trim().replace(/\n/g, '\n   ')}`).join('\n\n');
}

function renderJsDocTagAsPlainText(tag: JsDocBlockTag): string {
    let result = `${tag.name}`;

    if (tag.value) {
        if (tag.name === 'example') {
            const value = tag.value.replace(/[\n]?$/g, '\n');
            if (value.match(/^[\n]/)) {
                if (value.match(/^\n```/)) {
                    result += `:\n${value}`;
                } else {
                    result += `:\n\`\`\`${value}\`\`\``;
                }
            } else {
                result += `:${value.replace(/^([^\n]+)\n/, ' "$1":\n```')}\`\`\``;
            }
        } else {
            result += ':';
            if (!tag.value.match(/^[\n\r \t]/)) {
                result += ' ';
            }
            result += tag.value;
        }
    }

    return result;
}

export function renderJsDocAsPlainText(jsdoc: JsDocBlock): string | null {
    const bits: string[] = [];
    const title = jsdoc.title && jsdoc.title.trim();
    if (title) {
        bits.push(title);
    }
    const description = jsdoc.description && jsdoc.description.trim();
    if (description) {
        bits.push(description);
    }
    if (jsdoc.tags.length > 0) {
        bits.push(jsdoc.tags.map(renderJsDocTagAsPlainText).join('\n'));
    }
    if (bits.length === 0) {
        return null;
    }
    return bits.join('\n\n');
}

const defaultWordWrapLineWidth = 80;

export type JsDocRenderConfig = OpenApiClientGeneratorConfig['jsDoc'];

function renderJsDocTag(tag: JsDocBlockTag): string {
    let result = `@${tag.name}`;

    if (tag.value) {
        if (!tag.value.match(/^[\n\r \t]/)) {
            result += ' ';
        }
        result += tag.value;
    }

    return result;
}

export function renderJsDoc(jsdoc: JsDocBlock, config: JsDocRenderConfig = {}): string | null {
    function processText(text: string) {
        if (config?.wordWrap !== false) {
            return wordWrap(text, config?.wordWrap?.lineLength ?? defaultWordWrapLineWidth);
        }
        return text;
    }

    const jsdocParts: string[] = [];
    const title = jsdoc.title && jsdoc.title.trim();
    if (title) {
        jsdocParts.push(processText(title));
    }
    const description = jsdoc.description && jsdoc.description.trim();
    if (description) {
        jsdocParts.push(processText(description));
    }
    if (jsdoc.tags.length > 0) {
        jsdocParts.push(jsdoc.tags.map(renderJsDocTag).join('\n'));
    }
    if (jsdocParts.length === 0) {
        return null;
    }
    return jsdocParts.join('\n\n');
}

export function attachJsDocComment<T extends ts.Node>(node: T, jsdoc: string | null): T {
    if (!jsdoc) {
        return node;
    }
    const sanitized = jsdoc.replace(/\*\//g, '* /');
    if (!sanitized.includes('\n')) {
        return ts.addSyntheticLeadingComment(
            node,
            ts.SyntaxKind.MultiLineCommentTrivia,
            `* ${sanitized} `,
            true
        ) as T;
    }
    return ts.addSyntheticLeadingComment(
        node,
        ts.SyntaxKind.MultiLineCommentTrivia,
        `*\n * ${sanitized.split('\n').join('\n * ')}\n `,
        true
    ) as T;
}

export function extractJsDocString(entity: AnnotatedApiEntity | boolean, params: JsDocBlockTag[] = []): string | null {
    const jsdoc = extractJsDoc(entity);
    jsdoc.tags = jsdoc.tags.concat(params);
    return renderJsDoc(jsdoc);
}

export function isJsDocComment(comment: string): boolean {
    return comment.startsWith('*');
}

export function parseJsDoc(comment: string): JsDocBlock {
    const lines = comment
        .replace(/(?:\r\n|\r|\n|^)\s*\* ?/g, '\n')
        .trim()
        .split(/\n/);
    const result: JsDocBlock = {tags: []};

    while (lines.length > 0) {
        const line = lines[0];
        if (!line.trim() && result.title) {
            break;
        }
        if (line.startsWith('@')) {
            break;
        }
        result.title = result.title ? `${result.title}\n${line}` : line;
        lines.shift();
    }

    while (lines.length > 0) {
        const line = lines[0];
        if (line.startsWith('@')) {
            break;
        }
        result.description = result.description ? `${result.description}\n${line}` : line;
        lines.shift();
    }

    let currentTag: JsDocBlockTag | null = null;
    while (lines.length > 0) {
        const line = lines.shift()!;
        const match = line.match(/^@(\S+)\s*(.*)?$/);
        if (match) {
            const name = match[1];
            const value = match[2] && match[2].trim();
            currentTag = {
                name,
                value: value || undefined
            };
            result.tags.push(currentTag);
        } else if (currentTag) {
            currentTag.value = currentTag.value ? `${currentTag.value}\n${line}` : line;
        } else {
            throw new Error(`Unexpected JsDoc tag: ${line}`);
        }
    }

    return result;
}

export {isTSPropertySignature};
