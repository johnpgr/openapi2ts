import assert from 'node:assert/strict';
import {test} from 'node:test';
import {
    identifier,
    numericLiteral,
    stringLiteral,
    tsLiteralType,
    tsPropertySignature,
    tsTypeAnnotation,
    tsTypeLiteral,
    tsUnionType
} from '../../src/emit/index.ts';
import {finalizeType, isMutableUnionType} from '../../src/emit/compat.ts';
import {printTypeNode} from '../../src/emit/print.ts';
import {simplifyUnionTypeIfPossible} from '../../src/utils/type-utils.ts';

function printCompatType(type: ReturnType<typeof simplifyUnionTypeIfPossible>): string {
    const finalized = finalizeType(type);
    if (isMutableUnionType(type)) {
        return type.types.map((member) => printTypeNode(finalizeType(member))).join(' | ');
    }
    return printTypeNode(finalized);
}

function responseBranch(mediaType: string, body = 'Blob') {
    return tsTypeLiteral([
        tsPropertySignature(identifier('status'), tsTypeAnnotation(tsLiteralType(numericLiteral(200)))),
        tsPropertySignature(identifier('mediaType'), tsTypeAnnotation(tsLiteralType(stringLiteral(mediaType)))),
        tsPropertySignature(identifier('body'), tsTypeAnnotation(identifier(body)))
    ]);
}

test('simplifyUnionTypeIfPossible preserves status literal when merging media types', () => {
    const simplified = simplifyUnionTypeIfPossible(
        tsUnionType([
            responseBranch('application/vnd.oai.openapi'),
            responseBranch('application/yaml')
        ])
    );
    const printed = printCompatType(simplified);
    assert.match(printed, /status:\s*200/);
    assert.doesNotMatch(printed, /status:\s*;/);
    assert.match(printed, /application\/vnd\.oai\.openapi/);
    assert.match(printed, /application\/yaml/);
});

test('simplifyUnionTypeIfPossible handles schema endpoint response variants', () => {
    const simplified = simplifyUnionTypeIfPossible(
        tsUnionType([
            responseBranch('application/vnd.oai.openapi'),
            responseBranch('application/yaml'),
            responseBranch('application/vnd.oai.openapi+json', '{ [key: string]: unknown }'),
            responseBranch('application/json', '{ [key: string]: unknown }')
        ])
    );
    const printed = printCompatType(simplified);
    assert.doesNotMatch(printed, /status:\s*;/);
});
