import ts from 'typescript';
import type { ClassMethod, ClassProperty } from '../emit/nodes.ts';

export function makeProtected(entity: ClassProperty | ClassMethod): ClassProperty | ClassMethod {
    const protectedMod = ts.factory.createModifier(ts.SyntaxKind.ProtectedKeyword);
    if (ts.isPropertyDeclaration(entity)) {
        return ts.factory.updatePropertyDeclaration(
            entity,
            [protectedMod, ...(entity.modifiers ?? [])],
            entity.name,
            entity.questionToken,
            entity.type,
            entity.initializer
        );
    }
    if (ts.isMethodDeclaration(entity)) {
        return ts.factory.updateMethodDeclaration(
            entity,
            [protectedMod, ...(entity.modifiers ?? [])],
            entity.asteriskToken,
            entity.name,
            entity.questionToken,
            entity.typeParameters,
            entity.parameters,
            entity.type,
            entity.body
        );
    }
    if (ts.isConstructorDeclaration(entity)) {
        return ts.factory.updateConstructorDeclaration(
            entity,
            [protectedMod, ...(entity.modifiers ?? [])],
            entity.parameters,
            entity.body
        );
    }
    return entity;
}
