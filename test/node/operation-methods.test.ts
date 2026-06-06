import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {test} from 'node:test';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '../..');

test('generated service methods annotate arrow function return types', () => {
    const petService = readFileSync(
        path.join(root, 'test/snapshots/petstore/services/pet-service.ts'),
        'utf8'
    );
    assert.match(petService, /addPet = async .*?: Promise<void> => \{/s);
    assert.doesNotMatch(petService, /: Promise<\w+> = \(/);
});
