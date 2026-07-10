/**
 * DH-DATASOURCES-P2 — Normalize URLs for duplicate detection among data_sources.
 */

const TRACKING_PARAMS = new Set([
    'utm_source',
    'utm_medium',
    'utm_campaign',
    'utm_term',
    'utm_content',
    'fbclid',
    'gclid',
]);

const URL_BEARING_TYPES = new Set(['rss', 'web', 'api']);

export function isUrlBearingSourceType(type) {
    return URL_BEARING_TYPES.has(type);
}

/**
 * @param {string | null | undefined} url
 * @returns {string | null}
 */
export function normalizeUrlForDuplicateCheck(url) {
    if (!url || typeof url !== 'string') return null;

    const trimmed = url.trim();
    if (!trimmed) return null;

    try {
        const parsed = new URL(trimmed);
        parsed.protocol = parsed.protocol.toLowerCase();
        parsed.hostname = parsed.hostname.toLowerCase();
        parsed.hash = '';

        if (parsed.pathname.length > 1) {
            parsed.pathname = parsed.pathname.replace(/\/+$/, '');
        } else if (parsed.pathname === '') {
            parsed.pathname = '/';
        }

        const params = new URLSearchParams(parsed.search);
        const kept = [];
        for (const [key, value] of params.entries()) {
            const lowerKey = key.toLowerCase();
            if (!TRACKING_PARAMS.has(lowerKey)) {
                kept.push([lowerKey, value]);
            }
        }
        kept.sort((a, b) => a[0].localeCompare(b[0]) || a[1].localeCompare(b[1]));

        const normalizedParams = new URLSearchParams();
        for (const [key, value] of kept) {
            normalizedParams.append(key, value);
        }
        const search = normalizedParams.toString();
        return `${parsed.origin}${parsed.pathname}${search ? `?${search}` : ''}`;
    } catch {
        return trimmed.toLowerCase().replace(/\/+$/, '');
    }
}

export function duplicateUrlKey(type, normalizedUrl) {
    if (!type || !normalizedUrl) return null;
    return `${type}::${normalizedUrl}`;
}

/**
 * Normalize Telegram channel identity from t.me URL or @username.
 * @param {string | null | undefined} url
 * @returns {string | null}
 */
export function normalizeTelegramChannelIdentity(url) {
    if (!url || typeof url !== 'string') return null;

    const trimmed = url.trim();
    if (!trimmed) return null;

    if (trimmed.startsWith('@')) {
        const handle = trimmed.slice(1).split(/[/?#\s]/)[0];
        return handle ? handle.toLowerCase() : null;
    }

    try {
        const parsed = new URL(trimmed);
        if (parsed.hostname.toLowerCase() !== 't.me') return null;
        const slug = parsed.pathname.replace(/^\/+/, '').split('/')[0];
        if (!slug) return null;
        return slug.replace(/^@+/, '').toLowerCase();
    } catch {
        const match = trimmed.match(/(?:https?:\/\/)?t\.me\/@?([^/?#\s]+)/i);
        return match ? match[1].replace(/^@+/, '').toLowerCase() : null;
    }
}
