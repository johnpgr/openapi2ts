import assert from 'node:assert/strict';
import {test} from 'node:test';
import {generateCommonHttpService} from '../../src/schema-to-typescript/common/client-core.ts';

test('generateCommonHttpService rewrites core template imports without double extension', async () => {
    const {file} = await generateCommonHttpService({}, {});
    assert.match(file.data, /from '\.\/common-http-client'/);
    assert.doesNotMatch(file.data, /common-http-client-ts/);
});
