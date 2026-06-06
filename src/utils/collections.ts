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

