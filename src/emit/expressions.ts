import ts from 'typescript';
import {objectPropertyKey} from './nodes.ts';

export function valueToExpression(value: unknown): ts.Expression {
    if (typeof value === 'string') {
        return ts.factory.createStringLiteral(value);
    }
    if (typeof value === 'number') {
        return ts.factory.createNumericLiteral(value);
    }
    if (typeof value === 'boolean') {
        return value ? ts.factory.createTrue() : ts.factory.createFalse();
    }
    if (value === null) {
        return ts.factory.createNull();
    }
    if (Array.isArray(value)) {
        return ts.factory.createArrayLiteralExpression(value.map(valueToExpression));
    }
    if (typeof value === 'object') {
        return ts.factory.createObjectLiteralExpression(
            Object.entries(value as Record<string, unknown>).map(([key, entryValue]) =>
                ts.factory.createPropertyAssignment(objectPropertyKey(key), valueToExpression(entryValue))
            )
        );
    }
    return ts.factory.createNull();
}
