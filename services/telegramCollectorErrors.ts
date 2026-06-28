/** Safe error parsing for Telegram Collector HTTP responses — never surface raw HTML. */

export type CollectorFetchErrorKind =
    | 'html_response'
    | 'route_unavailable'
    | 'network'
    | 'unknown';

export type CollectorSafeError = {
    kind: CollectorFetchErrorKind;
    status?: number;
    contentType?: string | null;
    messageKey: string;
    safeDetail?: string;
};

const HTML_MARKERS = ['<html', '<!DOCTYPE', '404 Not Found', '<center>'];

export function isHtmlLikeResponse(contentType: string | null | undefined, bodySnippet: string): boolean {
    const ct = String(contentType || '').toLowerCase();
    if (ct.includes('text/html')) return true;
    const lower = bodySnippet.trim().toLowerCase();
    return HTML_MARKERS.some(m => lower.includes(m.toLowerCase()));
}

export function buildCollectorSafeError(args: {
    status?: number;
    contentType?: string | null;
    bodySnippet?: string;
    networkMessage?: string;
}): CollectorSafeError {
    const { status, contentType, bodySnippet = '', networkMessage } = args;

    if (networkMessage) {
        return {
            kind: 'network',
            status,
            contentType,
            messageKey: 'collector_proxy_unreachable',
            safeDetail: networkMessage.slice(0, 120),
        };
    }

    if (isHtmlLikeResponse(contentType, bodySnippet)) {
        return {
            kind: 'html_response',
            status,
            contentType,
            messageKey: 'collector_proxy_unreachable',
        };
    }

    if (status === 404 || status === 502 || status === 503) {
        return {
            kind: 'route_unavailable',
            status,
            contentType,
            messageKey: 'collector_route_unavailable',
        };
    }

    return {
        kind: 'unknown',
        status,
        contentType,
        messageKey: 'collector_connect_failed',
        safeDetail: bodySnippet.slice(0, 80).replace(/<[^>]+>/g, '').trim() || undefined,
    };
}

export function formatCollectorSafeError(
    err: CollectorSafeError,
    t: (key: string) => string,
): string {
    const key = err.messageKey;
    const base = t(key) || key;
    if (err.status != null) {
        return `${base} (HTTP ${err.status})`;
    }
    return base;
}

export function containsRawHtmlError(text: string): boolean {
    const lower = text.toLowerCase();
    return lower.includes('<html') || lower.includes('404 not found') || lower.includes('<center>');
}

export function maskPhoneForDisplay(phone?: string | null): string {
    const raw = String(phone || '').trim();
    if (!raw) return '—';
    if (raw.length <= 4) return '****';
    return `${raw.slice(0, 3)}***${raw.slice(-2)}`;
}

export type DiagnoseCollectorCheck = {
    key: string;
    ok: boolean;
    status?: number;
    latencyMs?: number;
    contentType?: string | null;
    responseKind?: 'json' | 'html' | 'text' | 'empty';
    errorKey?: string;
    safeError?: string;
};

export async function diagnoseCollectorEndpoint(
    key: string,
    url: string,
    method = 'GET',
): Promise<DiagnoseCollectorCheck> {
    const started = Date.now();
    try {
        const res = await fetch(url, { method, credentials: 'include' });
        const latencyMs = Date.now() - started;
        const contentType = res.headers.get('content-type');
        const text = await res.text();
        const responseKind = contentType?.includes('json')
            ? 'json'
            : isHtmlLikeResponse(contentType, text)
              ? 'html'
              : text
                ? 'text'
                : 'empty';

        if (res.ok) {
            return { key, ok: true, status: res.status, latencyMs, contentType, responseKind };
        }

        const safe = buildCollectorSafeError({ status: res.status, contentType, bodySnippet: text });
        return {
            key,
            ok: false,
            status: res.status,
            latencyMs,
            contentType,
            responseKind,
            errorKey: safe.messageKey,
            safeError: formatCollectorSafeError(safe, k => k),
        };
    } catch (err: unknown) {
        const safe = buildCollectorSafeError({
            networkMessage: err instanceof Error ? err.message : 'Network error',
        });
        return {
            key,
            ok: false,
            latencyMs: Date.now() - started,
            errorKey: safe.messageKey,
            safeError: formatCollectorSafeError(safe, k => k),
        };
    }
}

import { mergeCollectorAuthInit } from './collectorAuth.ts';

export async function fetchCollectorJson<T>(url: string, init?: RequestInit): Promise<T> {
    const method = (init?.method || 'GET').toUpperCase();
    const merged =
        method === 'GET' || method === 'HEAD'
            ? { ...init, credentials: init?.credentials ?? 'include' }
            : mergeCollectorAuthInit(init);
    const res = await fetch(url, merged);
    const contentType = res.headers.get('content-type');
    const text = await res.text();

    if (!res.ok) {
        const safe = buildCollectorSafeError({ status: res.status, contentType, bodySnippet: text });
        const err = new Error(safe.messageKey);
        (err as Error & { collectorError: CollectorSafeError }).collectorError = safe;
        throw err;
    }

    if (isHtmlLikeResponse(contentType, text)) {
        const safe = buildCollectorSafeError({ status: res.status, contentType, bodySnippet: text });
        const err = new Error(safe.messageKey);
        (err as Error & { collectorError: CollectorSafeError }).collectorError = safe;
        throw err;
    }

    try {
        return JSON.parse(text) as T;
    } catch {
        const safe = buildCollectorSafeError({ status: res.status, contentType, bodySnippet: text });
        const err = new Error(safe.messageKey);
        (err as Error & { collectorError: CollectorSafeError }).collectorError = safe;
        throw err;
    }
}
