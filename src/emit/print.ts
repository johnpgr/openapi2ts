import ts from 'typescript';
import { finalizeType } from './compat.ts';
import type { CompatType } from './compat.ts';

export interface CommentsRenderConfig {
    leadingComment?: string;
    trailingComment?: string;
}

function formatLineComments(comment: string, position: 'leading' | 'trailing'): string {
    return comment
        .split('\n')
        .map((line) => `//${position === 'leading' ? ' ' : ' '}${line.trim()}`)
        .join('\n');
}

export function printStatements(statements: readonly ts.Statement[], commentsConfig: CommentsRenderConfig = {}): string {
    const sourceFile = ts.factory.createSourceFile(
        [...statements],
        ts.factory.createToken(ts.SyntaxKind.EndOfFileToken),
        ts.NodeFlags.None
    );
    const printer = ts.createPrinter({newLine: ts.NewLineKind.LineFeed});
    let result = printer.printFile(sourceFile);
    if (commentsConfig.leadingComment) {
        result = formatLineComments(commentsConfig.leadingComment, 'leading') + '\n' + result;
    }
    if (commentsConfig.trailingComment) {
        result = result + '\n' + formatLineComments(commentsConfig.trailingComment, 'trailing') + '\n';
    }
    return result;
}

export function printTypeNode(type: ts.TypeNode): string {
    const printer = ts.createPrinter({newLine: ts.NewLineKind.LineFeed});
    const alias = ts.factory.createTypeAliasDeclaration(undefined, '_', undefined, type);
    const sourceFile = ts.factory.createSourceFile(
        [alias],
        ts.factory.createToken(ts.SyntaxKind.EndOfFileToken),
        ts.NodeFlags.None
    );
    const text = printer.printNode(ts.EmitHint.Unspecified, alias, sourceFile);
    return text.replace(/^type _ = /, '').replace(/;\s*$/, '').trim();
}

export function typeNodesEqual(a: CompatType, b: CompatType): boolean {
    return printTypeNode(finalizeType(a)) === printTypeNode(finalizeType(b));
}

export function cloneTypeElement<T extends ts.TypeElement>(element: T): T {
    const printer = ts.createPrinter({newLine: ts.NewLineKind.LineFeed});
    const sourceFile = ts.factory.createSourceFile(
        [],
        ts.factory.createToken(ts.SyntaxKind.EndOfFileToken),
        ts.NodeFlags.None
    );
    const text = printer.printNode(ts.EmitHint.Unspecified, element, sourceFile);
    const parsed = ts.createSourceFile('clone.ts', `type T = { ${text} };`, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
    const typeLiteral = (parsed.statements[0] as ts.TypeAliasDeclaration).type as ts.TypeLiteralNode;
    return typeLiteral.members[0] as T;
}

export function cloneTypeLiteral(typeLiteral: ts.TypeLiteralNode | import('./compat').MutableTypeLiteral): ts.TypeLiteralNode {
    const finalized = finalizeType(typeLiteral);
    const printer = ts.createPrinter({newLine: ts.NewLineKind.LineFeed});
    const alias = ts.factory.createTypeAliasDeclaration(undefined, '_', undefined, finalized);
    const sourceFile = ts.factory.createSourceFile(
        [alias],
        ts.factory.createToken(ts.SyntaxKind.EndOfFileToken),
        ts.NodeFlags.None
    );
    const text = printer.printNode(ts.EmitHint.Unspecified, alias, sourceFile);
    const parsed = ts.createSourceFile('clone.ts', text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
    return (parsed.statements[0] as ts.TypeAliasDeclaration).type as ts.TypeLiteralNode;
}
