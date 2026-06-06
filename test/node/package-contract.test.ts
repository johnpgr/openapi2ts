import {execSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
import {test} from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');

test('package.json has zero published dependencies', () => {
    const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
    assert.deepEqual(pkg.dependencies ?? {}, {});
    assert.equal(Object.keys(pkg.peerDependencies ?? {}).length, 1);
    assert.ok(pkg.peerDependencies.typescript);
});

test('package.json ships raw TypeScript without lib/ build', () => {
    const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
    assert.equal(pkg.main, './src/index.ts');
    assert.equal(pkg.bin['openapi2ts'], './src/cli/index.ts');
    assert.equal(pkg.scripts.build, undefined);
});

test('src/ contains no babel, ramda, yaml, yargs, or ts-node imports', () => {
    const hits = execSync(`rg -l "babel|ramda|js-yaml|yargs|ts-node" "${join(root, 'src')}" || true`, {
        encoding: 'utf8'
    }).trim();
    assert.equal(hits, '', `Forbidden imports found in: ${hits}`);
});
