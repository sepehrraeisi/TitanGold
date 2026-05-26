/** Safe i18n helpers for dynamic keys — never show raw HTTP text like "Not Found" in titles. */

export function safeT(t: (key: string) => string, key: string, fallbackKey = 'pipeline_health_status_unknown'): string {
    const translated = t(key);
    if (translated !== key) return translated;
    const fb = t(fallbackKey);
    return fb !== fallbackKey ? fb : key;
}

export function safeDynamicT(
    t: (key: string) => string,
    prefix: string,
    value: string,
    fallbackKey = 'pipeline_health_status_unknown',
): string {
    const normalized = String(value ?? '')
        .trim()
        .toLowerCase()
        .replace(/\s+/g, '_');
    if (!normalized) return safeT(t, fallbackKey, fallbackKey);
    return safeT(t, `${prefix}${normalized}`, fallbackKey);
}

const RAW_HTTP_PATTERNS = [
    /^not found$/i,
    /^404$/,
    /^internal server error$/i,
    /^unauthorized$/i,
    /^forbidden$/i,
];

export function formatApiErrorForUi(t: (key: string) => string, message: string | null | undefined): string {
    if (!message || !String(message).trim()) {
        return safeT(t, 'datahub_error_generic');
    }
    const raw = String(message).trim();
    if (RAW_HTTP_PATTERNS.some(p => p.test(raw))) {
        if (/not found/i.test(raw)) return safeT(t, 'datahub_error_not_found');
        if (/unauthorized/i.test(raw)) return safeT(t, 'datahub_error_unauthorized');
        if (/forbidden/i.test(raw)) return safeT(t, 'datahub_error_forbidden');
        return safeT(t, 'datahub_error_generic');
    }
    return raw;
}
