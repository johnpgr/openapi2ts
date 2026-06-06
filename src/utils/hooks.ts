import type { JsDocBlock, JsDocRenderConfig } from "./jsdoc.ts";
import { renderJsDoc } from "./jsdoc.ts";

export function resolveWithHook<T, C>(suggested: T, hook: ((ctx: C) => T) | undefined, ctx: C): T {
    return hook ? hook(ctx) : suggested;
}

export function resolveJsDocWithHook<C>(
    suggestedJsDoc: JsDocBlock,
    hook: ((ctx: C & { suggestedJsDoc: JsDocBlock }) => JsDocBlock) | undefined,
    ctx: C,
): JsDocBlock {
    return hook ? hook({ ...ctx, suggestedJsDoc }) : suggestedJsDoc;
}

export function renderJsDocWithHook<C>(
    suggestedJsDoc: JsDocBlock,
    hook: ((ctx: C & { suggestedJsDoc: JsDocBlock }) => JsDocBlock) | undefined,
    ctx: C,
    jsDocRenderConfig: JsDocRenderConfig,
): string | null {
    return renderJsDoc(resolveJsDocWithHook(suggestedJsDoc, hook, ctx), jsDocRenderConfig);
}
