import { isBooleanLiteral, isIdentifier, isNumericLiteral, isStringLiteral, isTSCallSignatureDeclaration, isTSConstructSignatureDeclaration, isTSIntersectionType, isTSLiteralTypeNode, isTSMethodSignature, isTSPropertySignature, isTSTypeLiteral, isTSUnionType, tsBooleanKeyword, tsIntersectionType, tsPropertySignature, tsTypeAnnotation, tsTypeLiteral, tsUnionType } from '../emit/index.ts';
import type { TSIntersectionType, TSPropertySignature, TSType, TSTypeLiteral, TSUnionType } from '../emit/index.ts';
import {cloneTypeElement, typeNodesEqual} from '../emit/print.ts';
import type { OpenApiSchema } from '../schemas/common.ts';

function flattenUnions(union: TSUnionType): TSUnionType {
    const result: TSUnionType = tsUnionType([]);
    let hasChanges = false;
    for (const type of union.types) {
        if (isTSUnionType(type)) {
            result.types.push(...flattenUnions(type).types);
            hasChanges = true;
        } else {
            result.types.push(type);
        }
    }
    if (hasChanges) {
        return result;
    }
    return union;
}

function flattenIntersections(intersection: TSIntersectionType): TSIntersectionType {
    const result: TSIntersectionType = tsIntersectionType([]);
    let hasChanges = false;
    for (const type of intersection.types) {
        if (isTSIntersectionType(type)) {
            result.types.push(...flattenIntersections(type).types);
            hasChanges = true;
        } else {
            result.types.push(type);
        }
    }
    if (hasChanges) {
        return result;
    }
    return intersection;
}

function getTypeProperties(type: TSTypeLiteral): Record<string, TSPropertySignature> {
    const result: Record<string, TSPropertySignature> = {};
    for (const property of type.members) {
        if (isTSPropertySignature(property)) {
            const key = getPropertyKey(property);
            if (key !== undefined) {
                result[key] = property;
            }
        }
    }
    return result;
}

function getPropertyKey(member: TSPropertySignature): string | undefined {
    return isIdentifier(member.name)
        ? member.name.text
        : isStringLiteral(member.name)
          ? member.name.text
          : isNumericLiteral(member.name)
            ? String(member.name.text)
            : undefined;
}

export function simplifyUnionTypeIfPossible(union: TSUnionType): TSType {
    const result: TSUnionType = tsUnionType([]);
    const itemsToProcess: TSType[] = [...flattenUnions(union).types];

    let hasChanges = false;

    while (itemsToProcess.length > 0) {
        let current = itemsToProcess.shift()!;
        for (let i = 0; i < itemsToProcess.length; i++) {
            const compared = itemsToProcess[i];
            if (typeNodesEqual(current, compared)) {
                itemsToProcess.splice(i, 1);
                i--;
                hasChanges = true;
            } else if (
                isTSLiteralTypeNode(current) &&
                isTSLiteralTypeNode(compared) &&
                isBooleanLiteral(current.literal) &&
                isBooleanLiteral(compared.literal) &&
                current.literal.kind !== compared.literal.kind
            ) {
                current = tsBooleanKeyword();
                itemsToProcess.splice(i, 1);
                i--;
                hasChanges = true;
            } else if (isTSTypeLiteral(current) && isTSTypeLiteral(compared)) {
                if (current.members.length !== compared.members.length) {
                    continue;
                }
                const currentProperties = getTypeProperties(current);
                if (Object.keys(currentProperties).length !== current.members.length) {
                    continue;
                }
                const comparedProperties = getTypeProperties(compared);
                if (Object.keys(comparedProperties).length !== compared.members.length) {
                    continue;
                }
                const currentKeys = Object.keys(currentProperties).sort();
                const comparedKeys = Object.keys(comparedProperties).sort();
                if (currentKeys.join('\0') !== comparedKeys.join('\0')) {
                    continue;
                }
                const keysWithDifferences = currentKeys.filter(
                    (key) =>
                        !typeNodesEqual(
                            currentProperties[key].type!,
                            comparedProperties[key].type!
                        )
                );
                if (keysWithDifferences.length === 1) {
                    const [keyWithDifference] = keysWithDifferences;
                    current = tsTypeLiteral(
                        current.members.map((member) => {
                            if (isTSPropertySignature(member)) {
                                const key = getPropertyKey(member);
                                if (key === keyWithDifference) {
                                    return tsPropertySignature(
                                        member.name,
                                        tsTypeAnnotation(
                                            simplifyUnionTypeIfPossible(
                                                flattenUnions(
                                                    tsUnionType([
                                                        currentProperties[keyWithDifference].type!,
                                                        comparedProperties[keyWithDifference].type!
                                                    ])
                                                )
                                            )
                                        ),
                                        member.questionToken !== undefined
                                    );
                                }
                            }
                            return member;
                        })
                    );
                    itemsToProcess.splice(i, 1);
                    i--;
                    hasChanges = true;
                }
            }
        }
        result.types.push(current);
    }
    if (result.types.length === 1) {
        return result.types[0];
    }
    if (hasChanges) {
        return result;
    }
    return union;
}

function simplePluralize(word: string): string {
    return word.endsWith('s') ? `${word}es` : `${word}s`;
}

export function getUserFreiendlySchemaName(schema: OpenApiSchema | undefined): string | undefined {
    if (schema === undefined || typeof schema === 'boolean') {
        return undefined;
    }
    if (schema.name) {
        return schema.name;
    }
    if (schema.items && schema.items !== true && schema.items.name) {
        return simplePluralize(schema.items.name);
    }
    return undefined;
}

export function mergeTypes(first: TSType, second: TSType): TSType {
    return simplifyIntersectionTypeIfPossible(tsIntersectionType([first, second]));
}

function mergeTypeLiteralsIfPossible(first: TSTypeLiteral, second: TSTypeLiteral): TSTypeLiteral | null {
    if (first.members.length === 0) {
        return second;
    }
    if (second.members.length === 0) {
        return first;
    }
    const result = tsTypeLiteral([]);
    const firstProperties = getTypeProperties(first);
    if (Object.keys(firstProperties).length !== first.members.length) {
        return null;
    }
    const secondProperties = getTypeProperties(second);
    if (Object.keys(secondProperties).length !== second.members.length) {
        return null;
    }
    for (const [key, prop] of Object.entries(firstProperties)) {
        if (Object.prototype.hasOwnProperty.call(secondProperties, key)) {
            const cloned = cloneTypeElement(prop);
            result.members.push(
                tsPropertySignature(
                    cloned.name,
                    tsTypeAnnotation(
                        mergeTypes(cloned.type!, secondProperties[key].type!)
                    ),
                    cloned.questionToken !== undefined
                )
            );
        } else {
            result.members.push(prop);
        }
    }
    return result;
}

export function simplifyIntersectionTypeIfPossible(intersection: TSIntersectionType): TSType {
    const result: TSIntersectionType = tsIntersectionType([]);
    const itemsToProcess: TSType[] = [...flattenIntersections(intersection).types];

    let hasChanges = false;

    while (itemsToProcess.length > 0) {
        let current = itemsToProcess.shift()!;
        for (let i = 0; i < itemsToProcess.length; i++) {
            const compared = itemsToProcess[i];
            if (typeNodesEqual(current, compared)) {
                itemsToProcess.splice(i, 1);
                i--;
                hasChanges = true;
            } else if (isTSTypeLiteral(current) && isTSTypeLiteral(compared)) {
                const merged = mergeTypeLiteralsIfPossible(current, compared);
                if (merged) {
                    current = merged;
                    itemsToProcess.splice(i, 1);
                    i--;
                    hasChanges = true;
                }
            }
        }
        result.types.push(current);
    }
    if (result.types.length === 1) {
        return result.types[0];
    }
    if (hasChanges) {
        return result;
    }
    return intersection;
}

export function isAssignableToEmptyObject(type: TSType): boolean {
    if (isTSTypeLiteral(type)) {
        for (const member of type.members) {
            if (isTSCallSignatureDeclaration(member) || isTSConstructSignatureDeclaration(member)) {
                return false;
            } else if ((isTSMethodSignature(member) || isTSPropertySignature(member)) && !member.questionToken) {
                return false;
            }
        }
        return true;
    } else if (isTSIntersectionType(type)) {
        return type.types.every(isAssignableToEmptyObject);
    } else if (isTSUnionType(type)) {
        return type.types.some(isAssignableToEmptyObject);
    }
    return false;
}
