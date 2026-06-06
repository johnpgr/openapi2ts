/**
 * Regenerates golden snapshots using a local checkout of mdevils/api-typescript-generator.
 * Run from openapi2ts/: node scripts/generate-snapshots.mjs
 */
import {spawnSync} from 'node:child_process';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';

const openapi2tsRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const referenceRoot = join(openapi2tsRoot, '..', 'api-typescript-generator');
const configPath = join(openapi2tsRoot, 'test', 'snapshot-config.ts');

const result = spawnSync(
    'node',
    [join(referenceRoot, 'lib/cli/index.js'), 'generate', configPath],
    {
        cwd: openapi2tsRoot,
        stdio: 'inherit'
    }
);

process.exit(result.status ?? 1);
