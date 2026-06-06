import assert from 'node:assert/strict';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {test} from 'node:test';
import {
    buildQuickConfig,
    DEFAULT_CONFIG_FILES,
    discoverConfigFile,
    parseCliArgs
} from '../../src/cli/args.ts';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '../..');

function success(result: ReturnType<typeof parseCliArgs>) {
    assert.equal(result.kind, 'success');
    return result as Extract<typeof result, {kind: 'success'}>;
}

test('parseCliArgs: generate <config>', () => {
    const result = success(parseCliArgs(['generate', 'openapi2ts.config.ts']));
    assert.equal(result.command, 'generate');
    assert.equal(result.mode, 'config');
    assert.equal(result.configPath, 'openapi2ts.config.ts');
});

test('parseCliArgs: check <config>', () => {
    const result = success(parseCliArgs(['check', 'test/snapshot-config.ts']));
    assert.equal(result.command, 'check');
    assert.equal(result.mode, 'config');
    assert.equal(result.configPath, 'test/snapshot-config.ts');
});

test('parseCliArgs: generate without config uses discover mode', () => {
    const result = success(parseCliArgs(['generate']));
    assert.equal(result.mode, 'discover');
});

test('parseCliArgs: check without config uses discover mode', () => {
    const result = success(parseCliArgs(['check']));
    assert.equal(result.mode, 'discover');
});

test('parseCliArgs: help via -h', () => {
    assert.deepEqual(parseCliArgs(['-h']), {kind: 'help'});
});

test('parseCliArgs: help via --help', () => {
    assert.deepEqual(parseCliArgs(['generate', '--help']), {kind: 'help'});
});

test('parseCliArgs: quick --file --out', () => {
    const result = success(parseCliArgs(['generate', '--file', './schema.json', '--out', './src/api']));
    assert.equal(result.mode, 'quick');
    assert.equal(result.quick.file, './schema.json');
    assert.equal(result.quick.out, './src/api');
    assert.equal(result.quick.url, undefined);
});

test('parseCliArgs: quick --url -o', () => {
    const result = success(parseCliArgs(['check', '--url', 'http://example.com/openapi.json', '-o', './out']));
    assert.equal(result.command, 'check');
    assert.equal(result.mode, 'quick');
    assert.equal(result.quick.url, 'http://example.com/openapi.json');
    assert.equal(result.quick.out, './out');
});

test('parseCliArgs: quick --name and --base-url', () => {
    const result = success(
        parseCliArgs([
            'generate',
            '--file',
            './schema.json',
            '--out',
            './src/api',
            '--name',
            'PetStoreClient',
            '--base-url',
            'https://api.example.com'
        ])
    );
    assert.equal(result.quick.name, 'PetStoreClient');
    assert.equal(result.quick.baseUrl, 'https://api.example.com');
});

test('parseCliArgs: rejects config path with quick flags', () => {
    const result = parseCliArgs(['generate', 'config.ts', '--file', './schema.json', '--out', './out']);
    assert.equal(result.kind, 'error');
    assert.match((result as {message: string}).message, /cannot be combined/);
});

test('parseCliArgs: rejects --url and --file together', () => {
    const result = parseCliArgs(['generate', '--url', 'http://a', '--file', './a.json', '--out', './out']);
    assert.equal(result.kind, 'error');
    assert.match((result as {message: string}).message, /mutually exclusive/);
});

test('parseCliArgs: quick mode requires --out', () => {
    const result = parseCliArgs(['generate', '--file', './schema.json']);
    assert.equal(result.kind, 'error');
    assert.match((result as {message: string}).message, /requires --out/);
});

test('parseCliArgs: quick mode requires --url or --file', () => {
    const result = parseCliArgs(['generate', '--out', './out']);
    assert.equal(result.kind, 'error');
    assert.match((result as {message: string}).message, /requires --url or --file/);
});

test('parseCliArgs: rejects unknown flag', () => {
    const result = parseCliArgs(['generate', '--verbose']);
    assert.equal(result.kind, 'error');
    assert.match((result as {message: string}).message, /Unknown flag/);
});

test('parseCliArgs: rejects missing flag value', () => {
    const result = parseCliArgs(['generate', '--file']);
    assert.equal(result.kind, 'error');
    assert.match((result as {message: string}).message, /Missing value/);
});

test('parseCliArgs: rejects unknown command', () => {
    const result = parseCliArgs(['build']);
    assert.equal(result.kind, 'error');
    assert.match((result as {message: string}).message, /Unknown command/);
});

test('parseCliArgs: rejects extra positional arguments', () => {
    const result = parseCliArgs(['generate', 'a.ts', 'b.ts']);
    assert.equal(result.kind, 'error');
    assert.match((result as {message: string}).message, /extra arguments/);
});

test('discoverConfigFile: checks files in order', () => {
    assert.deepEqual(DEFAULT_CONFIG_FILES, [
        'openapi2ts.config.ts',
        'openapi2ts.config.mts',
        'openapi2ts.config.cts',
        'openapi2ts.config.mjs',
        'openapi2ts.config.cjs',
        'openapi2ts.config.js'
    ]);

    const existing = new Set([
        path.join('/cwd', 'openapi2ts.config.mjs'),
        path.join('/cwd', 'openapi2ts.config.js')
    ]);
    assert.equal(
        discoverConfigFile('/cwd', (filename) => existing.has(filename)),
        'openapi2ts.config.mjs'
    );
});

test('discoverConfigFile: prefers earlier match', () => {
    const existing = new Set([
        path.join('/cwd', 'openapi2ts.config.ts'),
        path.join('/cwd', 'openapi2ts.config.js')
    ]);
    assert.equal(
        discoverConfigFile('/cwd', (filename) => existing.has(filename)),
        'openapi2ts.config.ts'
    );
});

test('discoverConfigFile: returns null when none exist', () => {
    assert.equal(discoverConfigFile('/cwd', () => false), null);
});

test('buildQuickConfig: defaults and optional fields', () => {
    const fromFile = buildQuickConfig({file: './schema.json', out: './src/api'});
    assert.equal(fromFile.generates[0]?.type, 'openapiClient');
    assert.deepEqual(fromFile.generates[0]?.document.source, {type: 'file', path: './schema.json'});
    assert.equal(fromFile.generates[0]?.outputDirPath, './src/api');
    assert.deepEqual(fromFile.generates[0]?.client, {name: 'ApiClient'});

    const fromUrl = buildQuickConfig({
        url: 'http://example.com/openapi.json',
        out: './out',
        name: 'MyClient',
        baseUrl: '/api'
    });
    assert.deepEqual(fromUrl.generates[0]?.document.source, {
        type: 'url',
        url: 'http://example.com/openapi.json'
    });
    assert.deepEqual(fromUrl.generates[0]?.client, {name: 'MyClient', baseUrl: '/api'});
});

test('discoverConfigFile: finds config in repo cwd', () => {
    assert.equal(discoverConfigFile(root), null);
});
