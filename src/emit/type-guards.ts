import ts from 'typescript';
import { isMutableIntersectionType, isMutableTypeLiteral, isMutableUnionType } from './compat.ts';
import type { CompatType } from './compat.ts';

export const isIdentifier = ts.isIdentifier;
export const isStringLiteral = ts.isStringLiteral;
export const isNumericLiteral = ts.isNumericLiteral;

export function isBooleanLiteral(node: ts.Node): node is ts.BooleanLiteral {
    return node.kind === ts.SyntaxKind.TrueKeyword || node.kind === ts.SyntaxKind.FalseKeyword;
}

export const isTSUnionType = (node: CompatType): node is ts.UnionTypeNode | import('./compat.ts').MutableUnionType =>
    isMutableUnionType(node) || node.kind === ts.SyntaxKind.UnionType;
export const isTSIntersectionType = (node: CompatType): node is ts.IntersectionTypeNode | import('./compat.ts').MutableIntersectionType =>
    isMutableIntersectionType(node) || node.kind === ts.SyntaxKind.IntersectionType;
export const isTSTypeLiteral = (node: CompatType): node is ts.TypeLiteralNode | import('./compat.ts').MutableTypeLiteral =>
    isMutableTypeLiteral(node) || node.kind === ts.SyntaxKind.TypeLiteral;
export const isTSPropertySignature = (node: ts.TypeElement): node is ts.PropertySignature =>
    node.kind === ts.SyntaxKind.PropertySignature;
export const isTSIndexSignature = (node: ts.TypeElement): node is ts.IndexSignatureDeclaration =>
    node.kind === ts.SyntaxKind.IndexSignature;
export const isTSCallSignatureDeclaration = (node: ts.TypeElement): node is ts.CallSignatureDeclaration =>
    node.kind === ts.SyntaxKind.CallSignature;
export const isTSConstructSignatureDeclaration = (node: ts.TypeElement): node is ts.ConstructSignatureDeclaration =>
    node.kind === ts.SyntaxKind.ConstructSignature;
export const isTSMethodSignature = (node: ts.TypeElement): node is ts.MethodSignature =>
    node.kind === ts.SyntaxKind.MethodSignature;

export function isTSLiteralTypeNode(node: CompatType): node is ts.LiteralTypeNode {
    return !isMutableUnionType(node) && !isMutableIntersectionType(node) && !isMutableTypeLiteral(node) && node.kind === ts.SyntaxKind.LiteralType;
}
