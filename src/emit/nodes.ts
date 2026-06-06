import ts from './load-typescript.ts';
import { finalizeExpression, finalizeObjectBindingPattern, finalizeType } from './compat.ts';
import type { CompatExpression, CompatType, MutableAssignmentPattern, MutableObjectExpression, MutableObjectPattern } from './compat.ts';

const RESERVED_WORDS = new Set([
    'break',
    'case',
    'catch',
    'continue',
    'debugger',
    'default',
    'delete',
    'do',
    'else',
    'finally',
    'for',
    'function',
    'if',
    'in',
    'instanceof',
    'new',
    'return',
    'switch',
    'this',
    'throw',
    'try',
    'typeof',
    'var',
    'void',
    'while',
    'with',
    'class',
    'const',
    'enum',
    'export',
    'extends',
    'import',
    'super',
    'implements',
    'interface',
    'let',
    'package',
    'private',
    'protected',
    'public',
    'static',
    'yield'
]);

export function isValidIdentifier(name: string, allowReserved = true): boolean {
    if (!/^(?:[$_\p{ID_Start}])(?:[$_\u200C\u200D\p{ID_Continue}])*$/u.test(name)) {
        return false;
    }
    return allowReserved || !RESERVED_WORDS.has(name);
}

export function identifier(name: string): ts.Identifier {
    return ts.factory.createIdentifier(name);
}

export function stringLiteral(value: string): ts.StringLiteral {
    return ts.factory.createStringLiteral(value);
}

export function numericLiteral(value: number): ts.NumericLiteral {
    return ts.factory.createNumericLiteral(value);
}

export function booleanLiteral(value: boolean): ts.BooleanLiteral {
    return value ? ts.factory.createTrue() : ts.factory.createFalse();
}

export function nullLiteral(): ts.NullLiteral {
    return ts.factory.createNull();
}

export function objectPropertyKey(id: string | number): ts.PropertyName {
    return typeof id === 'number'
        ? ts.factory.createNumericLiteral(id)
        : isValidIdentifier(id, false)
          ? ts.factory.createIdentifier(id)
          : ts.factory.createStringLiteral(id);
}

export function arrayExpression(elements: readonly CompatExpression[]): ts.ArrayLiteralExpression {
    return ts.factory.createArrayLiteralExpression(elements.map(finalizeExpression));
}

export function objectExpression(
    properties: readonly ts.ObjectLiteralElementLike[] = []
): MutableObjectExpression {
    return {kind: 'ObjectExpression', properties: [...properties]};
}

export function objectProperty(
    key: ts.PropertyName,
    value: CompatExpression | ts.Identifier,
    _computed?: boolean,
    shorthand?: boolean
): ts.ObjectLiteralElementLike {
    const finalized = finalizeExpression(value as CompatExpression);
    if (shorthand && ts.isIdentifier(key) && ts.isIdentifier(finalized)) {
        return ts.factory.createShorthandPropertyAssignment(key);
    }
    return ts.factory.createPropertyAssignment(key, finalized);
}

export function objectPattern(_properties: unknown[] = []): MutableObjectPattern {
    return {kind: 'ObjectPattern', properties: []};
}

export function objectPatternProperty(
    key: ts.PropertyName,
    value: ts.Identifier | MutableAssignmentPattern,
    _computed?: boolean,
    shorthand?: boolean
): MutableObjectPattern['properties'][number] {
    return {key, value, shorthand};
}

export {assignmentPattern} from './compat.ts';

export function setPropertyReturnType(property: ts.PropertyDeclaration, type: CompatType): ts.PropertyDeclaration {
    return ts.factory.updatePropertyDeclaration(
        property,
        property.modifiers,
        property.name,
        property.questionToken,
        finalizeType(type),
        property.initializer
    );
}
export function logicalExpression(
    operator: '||' | '&&' | '??',
    left: ts.Expression,
    right: ts.Expression
): ts.BinaryExpression {
    const operatorToken =
        operator === '||'
            ? ts.SyntaxKind.BarBarToken
            : operator === '&&'
              ? ts.SyntaxKind.AmpersandAmpersandToken
              : ts.SyntaxKind.QuestionQuestionToken;
    return ts.factory.createBinaryExpression(left, operatorToken, right);
}

export function memberExpression(
    object: CompatExpression,
    property: ts.Identifier | ts.StringLiteral
): ts.PropertyAccessExpression | ts.ElementAccessExpression {
    const finalizedObject = finalizeExpression(object);
    if (ts.isStringLiteral(property)) {
        return ts.factory.createElementAccessExpression(finalizedObject, property);
    }
    return ts.factory.createPropertyAccessExpression(finalizedObject, property);
}

export function thisExpression(): ts.ThisExpression {
    return ts.factory.createThis();
}

export function callExpression(
    callee: CompatExpression,
    args: readonly CompatExpression[],
    typeParameters?: readonly CompatType[] | {params: readonly CompatType[]}
): ts.CallExpression {
    const typeArgs = typeParameters
        ? 'params' in typeParameters
            ? typeParameters.params.map(finalizeType)
            : typeParameters.map(finalizeType)
        : undefined;
    return ts.factory.createCallExpression(
        finalizeExpression(callee),
        typeArgs,
        args.map(finalizeExpression)
    );
}

export function newExpression(
    callee: CompatExpression,
    args: readonly CompatExpression[]
): ts.NewExpression {
    return ts.factory.createNewExpression(finalizeExpression(callee), undefined, args.map(finalizeExpression));
}

export function returnStatement(expression: CompatExpression): ts.ReturnStatement {
    return ts.factory.createReturnStatement(finalizeExpression(expression));
}

export function expressionStatement(expression: CompatExpression): ts.ExpressionStatement {
    return ts.factory.createExpressionStatement(finalizeExpression(expression));
}

export function blockStatement(statements: readonly ts.Statement[]): ts.Block {
    return ts.factory.createBlock([...statements], true);
}

export function spreadElement(expression: ts.Expression): ts.SpreadAssignment {
    return ts.factory.createSpreadAssignment(expression);
}

export function parameterDeclaration(
    name: ts.Identifier,
    type?: CompatType,
    optional?: boolean,
    initializer?: CompatExpression
): ts.ParameterDeclaration {
    return ts.factory.createParameterDeclaration(
        undefined,
        undefined,
        name,
        optional ? ts.factory.createToken(ts.SyntaxKind.QuestionToken) : undefined,
        type === undefined ? undefined : finalizeType(type),
        initializer === undefined ? undefined : finalizeExpression(initializer)
    );
}
export function createPatternParameter(pattern: MutableObjectPattern, initializer?: CompatExpression): ts.ParameterDeclaration {
    return ts.factory.createParameterDeclaration(
        undefined,
        undefined,
        finalizeObjectBindingPattern(pattern),
        undefined,
        pattern.typeAnnotation,
        initializer === undefined ? undefined : finalizeExpression(initializer)
    );
}

export function arrowFunctionExpression(
    params: MutableObjectPattern,
    body: ts.Block | ts.Expression,
    defaultParameterInitializer?: CompatExpression
): ts.ArrowFunction;
export function arrowFunctionExpression(
    params: readonly ts.ParameterDeclaration[],
    body: ts.Block | ts.Expression,
    defaultParameterInitializer?: CompatExpression
): ts.ArrowFunction;
export function arrowFunctionExpression(
    params: readonly ts.ParameterDeclaration[] | MutableObjectPattern,
    body: ts.Block | ts.Expression,
    defaultParameterInitializer?: CompatExpression
): ts.ArrowFunction {
    const parameters = Array.isArray(params)
        ? [...params]
        : [createPatternParameter(params as MutableObjectPattern, defaultParameterInitializer ? finalizeExpression(defaultParameterInitializer) : undefined)];
    return ts.factory.createArrowFunction(undefined, undefined, parameters, undefined, undefined, body);
}

export function functionDeclaration(
    name: ts.Identifier,
    params: readonly ts.ParameterDeclaration[],
    body: ts.Block
): ts.FunctionDeclaration {
    return ts.factory.createFunctionDeclaration(undefined, undefined, name, undefined, [...params], undefined, body);
}

export type ClassBody = ts.ClassElement[];

export function classBody(body: readonly ts.ClassElement[]): ClassBody {
    return [...body];
}

export function classProperty(
    key: ts.Identifier,
    value?: ts.Expression | ts.ArrowFunction,
    modifiers?: readonly ts.Modifier[]
): ts.PropertyDeclaration {
    return ts.factory.createPropertyDeclaration(
        modifiers ? [...modifiers] : undefined,
        key,
        undefined,
        undefined,
        value
    );
}

export function classMethod(
    kind: 'constructor' | 'method' | 'get' | 'set',
    key: ts.Identifier,
    params: readonly ts.ParameterDeclaration[],
    body: ts.Block,
    _computed?: boolean,
    isStatic?: boolean
): ts.MethodDeclaration | ts.ConstructorDeclaration {
    const modifiers: ts.Modifier[] = [];
    if (isStatic) {
        modifiers.push(ts.factory.createModifier(ts.SyntaxKind.StaticKeyword));
    }
    if (kind === 'constructor') {
        return ts.factory.createConstructorDeclaration(modifiers, [...params], body);
    }
    if (kind === 'get') {
        modifiers.push(ts.factory.createModifier(ts.SyntaxKind.GetKeyword as ts.ModifierSyntaxKind));
    }
    if (kind === 'set') {
        modifiers.push(ts.factory.createModifier(ts.SyntaxKind.SetKeyword as ts.ModifierSyntaxKind));
    }
    return ts.factory.createMethodDeclaration(
        modifiers,
        undefined,
        key,
        undefined,
        undefined,
        [...params],
        undefined,
        body
    );
}

export function classDeclaration(
    id: ts.Identifier,
    superClass?: ts.Expression | ts.Identifier,
    body?: ClassBody
): ts.ClassDeclaration {
    const heritage =
        superClass !== undefined
            ? [ts.factory.createHeritageClause(ts.SyntaxKind.ExtendsKeyword, [ts.factory.createExpressionWithTypeArguments(superClass, undefined)])]
            : undefined;
    return ts.factory.createClassDeclaration(undefined, id, undefined, heritage, body ? [...body] : []);
}

export interface ImportDefaultSpecifierLike {
    type: 'ImportDefaultSpecifier';
    local: ts.Identifier;
}

export function importSpecifier(
    imported: ts.Identifier,
    local: ts.Identifier,
    isTypeOnly = false
): ts.ImportSpecifier {
    const spec = ts.factory.createImportSpecifier(isTypeOnly, imported, local);
    if (isTypeOnly) {
        Object.defineProperty(spec, 'importKind', {value: 'type'});
    }
    return spec;
}

export function importDefaultSpecifier(local: ts.Identifier): ImportDefaultSpecifierLike {
    return {type: 'ImportDefaultSpecifier', local};
}

export function importNamespaceSpecifier(local: ts.Identifier): ts.NamespaceImport {
    return ts.factory.createNamespaceImport(local);
}

export function isImportDefaultSpecifier(
    value: unknown
): value is ImportDefaultSpecifierLike {
    return (
        typeof value === 'object' &&
        value !== null &&
        (value as ImportDefaultSpecifierLike).type === 'ImportDefaultSpecifier'
    );
}

export function importDeclaration(
    specifiers: readonly (ts.ImportSpecifier | ts.NamespaceImport | ImportDefaultSpecifierLike)[],
    source: ts.StringLiteral,
    importKind?: 'type' | 'value'
): ts.ImportDeclaration {
    const isTypeOnly = importKind === 'type';
    let importClause: ts.ImportClause;
    if (specifiers.length === 1 && isImportDefaultSpecifier(specifiers[0])) {
        importClause = ts.factory.createImportClause(isTypeOnly, specifiers[0].local, undefined);
    } else if (specifiers.length === 1 && ts.isNamespaceImport(specifiers[0] as ts.Node)) {
        importClause = ts.factory.createImportClause(isTypeOnly, undefined, specifiers[0] as ts.NamespaceImport);
    } else {
        const namedImports = specifiers.filter((specifier): specifier is ts.ImportSpecifier =>
            ts.isImportSpecifier(specifier as ts.Node)
        );
        importClause = ts.factory.createImportClause(
            isTypeOnly,
            undefined,
            ts.factory.createNamedImports(namedImports)
        );
    }
    const declaration = ts.factory.createImportDeclaration(undefined, importClause, source, undefined);
    if (isTypeOnly) {
        Object.defineProperty(declaration, 'importKind', {value: 'type'});
    }
    return declaration;
}

export function exportSpecifier(local: ts.Identifier, exported?: ts.Identifier): ts.ExportSpecifier {
    return ts.factory.createExportSpecifier(false, exported ?? local, local);
}

function withExportModifier(node: ts.Declaration): ts.Statement {
    const exportMod = ts.factory.createModifier(ts.SyntaxKind.ExportKeyword);
    if (ts.isClassDeclaration(node)) {
        return ts.factory.updateClassDeclaration(
            node,
            [exportMod, ...(node.modifiers ?? [])],
            node.name,
            node.typeParameters,
            node.heritageClauses,
            node.members
        );
    }
    if (ts.isFunctionDeclaration(node)) {
        return ts.factory.updateFunctionDeclaration(
            node,
            [exportMod, ...(node.modifiers ?? [])],
            node.asteriskToken,
            node.name,
            node.typeParameters,
            node.parameters,
            node.type,
            node.body
        );
    }
    if (ts.isTypeAliasDeclaration(node)) {
        return ts.factory.updateTypeAliasDeclaration(
            node,
            [exportMod, ...(node.modifiers ?? [])],
            node.name,
            node.typeParameters,
            node.type
        );
    }
    if (ts.isInterfaceDeclaration(node)) {
        return ts.factory.updateInterfaceDeclaration(
            node,
            [exportMod, ...(node.modifiers ?? [])],
            node.name,
            node.typeParameters,
            node.heritageClauses,
            node.members
        );
    }
    throw new Error(`Cannot export node kind ${ts.SyntaxKind[node.kind]}`);
}

export function exportNamedDeclaration(
    declaration?: ts.Declaration | null,
    specifiers?: readonly ts.ExportSpecifier[],
    exportKind?: 'type' | 'value'
): ts.Statement {
    if (specifiers && specifiers.length > 0) {
        return ts.factory.createExportDeclaration(
            undefined,
            exportKind === 'type',
            ts.factory.createNamedExports([...specifiers])
        );
    }
    if (declaration) {
        return withExportModifier(declaration);
    }
    throw new Error('exportNamedDeclaration requires declaration or specifiers');
}

export function tsStringKeyword(): ts.KeywordTypeNode {
    return ts.factory.createKeywordTypeNode(ts.SyntaxKind.StringKeyword);
}

export function tsNumberKeyword(): ts.KeywordTypeNode {
    return ts.factory.createKeywordTypeNode(ts.SyntaxKind.NumberKeyword);
}

export function tsBooleanKeyword(): ts.KeywordTypeNode {
    return ts.factory.createKeywordTypeNode(ts.SyntaxKind.BooleanKeyword);
}

export function tsUnknownKeyword(): ts.KeywordTypeNode {
    return ts.factory.createKeywordTypeNode(ts.SyntaxKind.UnknownKeyword);
}

export function tsNeverKeyword(): ts.KeywordTypeNode {
    return ts.factory.createKeywordTypeNode(ts.SyntaxKind.NeverKeyword);
}

export function tsNullKeyword(): ts.LiteralTypeNode {
    return ts.factory.createLiteralTypeNode(ts.factory.createNull());
}

export function tsVoidKeyword(): ts.KeywordTypeNode {
    return ts.factory.createKeywordTypeNode(ts.SyntaxKind.VoidKeyword);
}

export function tsUndefinedKeyword(): ts.KeywordTypeNode {
    return ts.factory.createKeywordTypeNode(ts.SyntaxKind.UndefinedKeyword);
}

export function tsLiteralType(literal: ts.LiteralExpression | ts.BooleanLiteral): ts.LiteralTypeNode {
    return ts.factory.createLiteralTypeNode(literal);
}

export function tsTypeAnnotation(type: CompatType): ts.TypeNode {
    return finalizeType(type);
}

export function tsArrayType(elementType: CompatType): ts.ArrayTypeNode {
    return ts.factory.createArrayTypeNode(finalizeType(elementType));
}

export function tsTupleType(elementTypes: readonly CompatType[]): ts.TupleTypeNode {
    return ts.factory.createTupleTypeNode(elementTypes.map(finalizeType));
}

export function tsRestType(type: CompatType): ts.RestTypeNode {
    return ts.factory.createRestTypeNode(finalizeType(type));
}

export function tsIntersectionType(types: readonly CompatType[] = []): import('./compat').MutableIntersectionType {
    return {kind: 'IntersectionType', types: types.map(finalizeType)};
}

export function tsUnionType(types: readonly CompatType[] = []): import('./compat').MutableUnionType {
    return {kind: 'UnionType', types: types.map(finalizeType)};
}

export function tsTypeLiteral(members: readonly ts.TypeElement[] = []): import('./compat').MutableTypeLiteral {
    return {kind: 'TypeLiteral', members: [...members]};
}

export function tsTypeReference(
    typeName: ts.EntityName,
    typeParameters?: ts.TypeNode[] | {params: readonly ts.TypeNode[]}
): ts.TypeReferenceNode {
    const typeArgs = Array.isArray(typeParameters)
        ? typeParameters
        : typeParameters?.params;
    return ts.factory.createTypeReferenceNode(typeName, typeArgs);
}

export function tsQualifiedName(left: ts.EntityName, right: ts.Identifier): ts.QualifiedName {
    return ts.factory.createQualifiedName(left, right);
}

export function tsPropertySignature(
    key: ts.PropertyName,
    typeAnnotation?: CompatType,
    optional?: boolean
): ts.PropertySignature {
    return ts.factory.createPropertySignature(
        undefined,
        key,
        optional ? ts.factory.createToken(ts.SyntaxKind.QuestionToken) : undefined,
        typeAnnotation === undefined ? undefined : finalizeType(typeAnnotation)
    );
}

export function tsIndexSignature(
    keyName: string,
    keyType: CompatType,
    valueType: CompatType
): ts.IndexSignatureDeclaration {
    return ts.factory.createIndexSignature(
        undefined,
        [
            ts.factory.createParameterDeclaration(
                undefined,
                undefined,
                identifier(keyName),
                undefined,
                finalizeType(keyType),
                undefined
            )
        ],
        finalizeType(valueType)
    );
}

export type InterfaceBody = readonly ts.TypeElement[];

export function tsInterfaceDeclaration(
    id: ts.Identifier,
    typeParameters: ts.TypeParameterDeclaration[] | null,
    heritageClauses: ts.HeritageClause[] | null,
    body: InterfaceBody
): ts.InterfaceDeclaration {
    return ts.factory.createInterfaceDeclaration(undefined, id, typeParameters ?? undefined, heritageClauses ?? undefined, [...body]);
}

export function tsInterfaceBody(members: readonly ts.TypeElement[]): InterfaceBody {
    return [...members];
}

export function tsTypeAliasDeclaration(
    id: ts.Identifier,
    typeParameters: ts.TypeParameterDeclaration[] | null,
    type: CompatType
): ts.TypeAliasDeclaration {
    return ts.factory.createTypeAliasDeclaration(undefined, id, typeParameters ?? undefined, finalizeType(type));
}

export function tsExpressionWithTypeArguments(
    expression: ts.Expression,
    typeParameters?: ts.TypeNode[] | {params: readonly ts.TypeNode[]}
): ts.ExpressionWithTypeArguments {
    const typeArgs = Array.isArray(typeParameters)
        ? typeParameters
        : typeParameters?.params;
    return ts.factory.createExpressionWithTypeArguments(expression, typeArgs);
}

export function tsTypeParameterInstantiation(params: readonly CompatType[]): {params: ts.TypeNode[]} {
    return {params: params.map(finalizeType)};
}

export function attachTypeAnnotation(
    node: ts.ParameterDeclaration,
    typeAnnotation: CompatType
): ts.ParameterDeclaration {
    return ts.factory.updateParameterDeclaration(
        node,
        node.modifiers,
        node.dotDotDotToken,
        node.name,
        node.questionToken,
        finalizeType(typeAnnotation),
        node.initializer
    );
}

export function attachOptionalParameter(
    node: ts.ParameterDeclaration,
    optional: boolean
): ts.ParameterDeclaration {
    return ts.factory.updateParameterDeclaration(
        node,
        node.modifiers,
        node.dotDotDotToken,
        node.name,
        optional ? ts.factory.createToken(ts.SyntaxKind.QuestionToken) : undefined,
        node.type,
        node.initializer
    );
}

export function program(statements: readonly ts.Statement[]): ts.Statement[] {
    return [...statements];
}

export type Expression = CompatExpression;
export type Statement = ts.Statement;
export type TSType = CompatType;
export type TSTypeAnnotation = ts.TypeNode;
export type Identifier = ts.Identifier;
export type StringLiteral = ts.StringLiteral;
export type NumericLiteral = ts.NumericLiteral;
export type ImportDeclaration = ts.ImportDeclaration;
export type ExportNamedDeclaration = ts.Statement;
export type ClassProperty = ts.PropertyDeclaration;
export type ClassMethod = ts.MethodDeclaration | ts.ConstructorDeclaration;
export type TSUnionType = ts.UnionTypeNode | import('./compat').MutableUnionType;
export type TSIntersectionType = ts.IntersectionTypeNode | import('./compat').MutableIntersectionType;
export type TSTypeLiteral = ts.TypeLiteralNode | import('./compat').MutableTypeLiteral;
export type TSPropertySignature = ts.PropertySignature;
