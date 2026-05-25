/**
 * SSRF / unsafe URL guard for discovery (explicit, not implicit).
 */

const BLOCKED_SCHEMES = new Set(['file', 'ftp', 'gopher', 'data', 'javascript', 'mailto']);

const PRIVATE_IPV4_RANGES = [
    /^127\./,
    /^10\./,
    /^192\.168\./,
    /^169\.254\./,
    /^0\./,
    /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./,
    /^172\.(1[6-9]|2\d|3[01])\./,
];

const METADATA_HOST_PATTERNS = [
    /^metadata\./i,
    /\.internal$/i,
    /\.local$/i,
    /^localhost$/i,
];

export function assertSafeDiscoveryUrl(rawUrl) {
    let parsed;
    try {
        parsed = new URL(String(rawUrl).trim());
    } catch {
        const err = new Error('Invalid URL');
        err.status = 400;
        err.code = 'INVALID_URL';
        throw err;
    }

    const scheme = parsed.protocol.replace(':', '').toLowerCase();
    if (scheme !== 'http' && scheme !== 'https') {
        const err = new Error(`Blocked URL scheme: ${scheme}`);
        err.status = 400;
        err.code = 'SSRF_BLOCKED';
        throw err;
    }

    if (BLOCKED_SCHEMES.has(scheme)) {
        const err = new Error(`Blocked URL scheme: ${scheme}`);
        err.status = 400;
        err.code = 'SSRF_BLOCKED';
        throw err;
    }

    const host = parsed.hostname.toLowerCase();

    if (host === 'localhost' || host.endsWith('.localhost')) {
        const err = new Error('localhost URLs are not allowed for discovery');
        err.status = 400;
        err.code = 'SSRF_BLOCKED';
        throw err;
    }

    for (const re of METADATA_HOST_PATTERNS) {
        if (re.test(host)) {
            const err = new Error('Internal or metadata host blocked');
            err.status = 400;
            err.code = 'SSRF_BLOCKED';
            throw err;
        }
    }

    const ipv4 = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
    if (ipv4) {
        const ip = host;
        for (const re of PRIVATE_IPV4_RANGES) {
            if (re.test(ip)) {
                const err = new Error('Private IP ranges are not allowed');
                err.status = 400;
                err.code = 'SSRF_BLOCKED';
                throw err;
            }
        }
    }

    if (host.includes(':') && (host.startsWith('fc') || host.startsWith('fd') || host === '::1')) {
        const err = new Error('Private IPv6 addresses are not allowed');
        err.status = 400;
        err.code = 'SSRF_BLOCKED';
        throw err;
    }

    return parsed;
}

export function normalizeDiscoveryUrl(rawUrl) {
    const parsed = assertSafeDiscoveryUrl(rawUrl);
    const hostKey = parsed.hostname.toLowerCase().replace(/^www\./, '');
    let pathKey = parsed.pathname || '/';
    if (pathKey.length > 1 && pathKey.endsWith('/')) {
        pathKey = pathKey.slice(0, -1);
    }
    pathKey = pathKey.toLowerCase() || '/';
    const canonical = `${parsed.protocol}//${parsed.host}${pathKey}${parsed.search || ''}`;
    return { hostKey, pathKey, canonical, parsed };
}

export function normalizeTitleKey(title) {
    if (!title) return null;
    return String(title)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, ' ')
        .trim()
        .slice(0, 200) || null;
}
