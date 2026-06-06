import ts from 'typescript';

export interface MutableObjectExpression {
    kind: 'ObjectExpression';
    properties: ts.ObjectLiteralElementLike[];
}

export interface MutableObjectPattern {
    kind: 'ObjectPattern';
    properties: MutableBindingProperty[];
    typeAnnotation?: ts.TypeNode;
}

export interface MutableBindingProperty {
    key: ts.PropertyName;
    value: ts.Identifier | ts.ObjectBindingPattern | MutableAssignmentPattern;
    shorthand?: boolean;
}

export interface MutableAssignmentPattern {
    kind: 'AssignmentPattern';
    left: ts.ObjectBindingPattern | ts.Identifier;
    right: ts.Expression;
}

export interface MutableUnionType {
    kind: 'UnionType';
    types: CompatType[];
}

export interface MutableIntersectionType {
    kind: 'IntersectionType';
    types: CompatType[];
}

export interface MutableTypeLiteral {
    kind: 'TypeLiteral';
    members: ts.TypeElement[];
}

export type CompatExpression = ts.Expression | MutableObjectExpression | MutableAssignmentPattern;
export type CompatType = ts.TypeNode | MutableUnionType | MutableIntersectionType | MutableTypeLiteral;

function isMutableObjectExpression(value: unknown): value is MutableObjectExpression {
    return typeof value === 'object' && value !== null && (value as MutableObjectExpression).kind === 'ObjectExpression';
}

function isMutableObjectPattern(value: unknown): value is MutableObjectPattern {
    return typeof value === 'object' && value !== null && (value as MutableObjectPattern).kind === 'ObjectPattern';
}

function isMutableAssignmentPattern(value: unknown): value is MutableAssignmentPattern {
    return typeof value === 'object' && value !== null && (value as MutableAssignmentPattern).kind === 'AssignmentPattern';
}

export function isMutableUnionType(value: unknown): value is MutableUnionType {
    return typeof value === 'object' && value !== null && (value as MutableUnionType).kind === 'UnionType';
}

export function isMutableIntersectionType(value: unknown): value is MutableIntersectionType {
    return typeof value === 'object' && value !== null && (value as MutableIntersectionType).kind === 'IntersectionType';
}

export function isMutableTypeLiteral(value: unknown): value is MutableTypeLiteral {
    return typeof value === 'object' && value !== null && (value as MutableTypeLiteral).kind === 'TypeLiteral';
}

export function assignmentPattern(
    left: ts.ObjectBindingPattern | ts.Identifier | MutableObjectPattern,
    right: CompatExpression
): MutableAssignmentPattern {
    if (isMutableObjectPattern(left)) {
        return {
            kind: 'AssignmentPattern',
            left: finalizeObjectBindingPattern(left),
            right: finalizeExpression(right)
        };
    }
    return {
        kind: 'AssignmentPattern',
        left,
        right: finalizeExpression(right)
    };
}

export function finalizeObjectBindingPattern(pattern: MutableObjectPattern): ts.ObjectBindingPattern {
    return ts.factory.createObjectBindingPattern(
        pattern.properties.map((property) => {
            if (isMutableAssignmentPattern(property.value)) {
                const bindingName = property.value.left;
                return ts.factory.createBindingElement(
                    undefined,
                    ts.isIdentifier(property.key) && property.key.text !== (bindingName as ts.Identifier).text
                        ? property.key
                        : undefined,
                    ts.isIdentifier(bindingName) ? bindingName : bindingName,
                    property.value.right
                );
            }
            if (property.shorthand && ts.isIdentifier(property.key)) {
                return ts.factory.createBindingElement(undefined, undefined, property.key, undefined);
            }
            return ts.factory.createBindingElement(undefined, property.key, property.value as ts.BindingName, undefined);
        })
    );
}

export function finalizeExpression(expression: CompatExpression): ts.Expression {
    if (isMutableObjectExpression(expression)) {
        return ts.factory.createObjectLiteralExpression(expression.properties);
    }
    if (isMutableAssignmentPattern(expression)) {
        throw new Error('AssignmentPattern must be used inside an ObjectPattern property');
    }
    return expression;
}

export function finalizeType(type: CompatType): ts.TypeNode {
    if (isMutableUnionType(type)) {
        return ts.factory.createUnionTypeNode(type.types.map((member) => finalizeType(member)));
    }
    if (isMutableIntersectionType(type)) {
        return ts.factory.createIntersectionTypeNode(type.types.map((member) => finalizeType(member)));
    }
    if (isMutableTypeLiteral(type)) {
        return ts.factory.createTypeLiteralNode(type.members);
    }
    return type;
}
