export function cloneJson<T>(value: T): T {
    return structuredClone(value);
}

export function omit<T extends Record<string, unknown>, K extends keyof T>(
    obj: T,
    keys: readonly K[]
): Omit<T, K> {
    const result = {...obj};
    for (const key of keys) {
        delete result[key];
    }
    return result;
}

export function indexBy<T>(items: readonly T[], keyFn: (item: T) => string): Record<string, T> {
    const result: Record<string, T> = {};
    for (const item of items) {
        const key = keyFn(item);
        if (!(key in result)) {
            result[key] = item;
        }
    }
    return result;
}

export function groupBy<T>(items: readonly T[], keyFn: (item: T) => string): Record<string, T[]> {
    const result: Record<string, T[]> = {};
    for (const item of items) {
        const key = keyFn(item);
        (result[key] ??= []).push(item);
    }
    return result;
}

export function uniq<T>(items: readonly T[]): T[] {
    return [...new Set(items)];
}

export function uniqBy<T>(items: readonly T[], keyFn: (item: T) => string): T[] {
    const seen = new Set<string>();
    const result: T[] = [];
    for (const item of items) {
        const key = keyFn(item);
        if (!seen.has(key)) {
            seen.add(key);
            result.push(item);
        }
    }
    return result;
}

export function deepEqual(a: unknown, b: unknown): boolean {
    if (Object.is(a, b)) {
        return true;
    }
    if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') {
        return false;
    }
    if (Array.isArray(a) && Array.isArray(b)) {
        if (a.length !== b.length) {
            return false;
        }
        for (let i = 0; i < a.length; i++) {
            if (!deepEqual(a[i], b[i])) {
                return false;
            }
        }
        return true;
    }
    if (Array.isArray(a) || Array.isArray(b)) {
        return false;
    }
    const aObj = a as Record<string, unknown>;
    const bObj = b as Record<string, unknown>;
    const aKeys = Object.keys(aObj);
    const bKeys = Object.keys(bObj);
    if (aKeys.length !== bKeys.length) {
        return false;
    }
    for (const key of aKeys) {
        if (!Object.prototype.hasOwnProperty.call(bObj, key) || !deepEqual(aObj[key], bObj[key])) {
            return false;
        }
    }
    return true;
}
