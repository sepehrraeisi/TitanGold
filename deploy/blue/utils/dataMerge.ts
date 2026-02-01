// Generic deep merge helper to safely overlay partial data on top of defaults.
// Arrays are replaced (not concatenated) to avoid duplicating entries.
export function deepMerge<T>(defaults: T, overrides: any): T {
    // If defaults is an array, return overrides if it is an array, else defaults
    if (Array.isArray(defaults)) {
        return (Array.isArray(overrides) ? overrides : defaults) as T;
    }

    // If defaults is a plain object, recursively merge
    if (defaults && typeof defaults === 'object') {
        const result: any = { ...defaults };
        if (overrides && typeof overrides === 'object') {
            for (const key of Object.keys(overrides)) {
                const defaultValue = (defaults as any)[key];
                const overrideValue = overrides[key];

                if (defaultValue === undefined) {
                    result[key] = overrideValue;
                } else {
                    result[key] = deepMerge(defaultValue, overrideValue);
                }
            }
        }
        return result;
    }

    // Primitive values: prefer overrides when defined
    return (overrides !== undefined ? overrides : defaults) as T;
}

// Utility to create a delay (used for retry flows)
export const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

