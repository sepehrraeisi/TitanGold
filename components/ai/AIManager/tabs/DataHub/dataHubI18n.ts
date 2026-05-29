/** Safe i18n helpers for dynamic keys — never show raw HTTP text like "Not Found" in titles. */

import { DataHubApiError } from '../../../../../services/dataSourcesApi';

export type DataHubQueryErrorDisplay = {
    message: string;
    variant: 'error' | 'warning';
    retryable: boolean;
    status?: number;
};

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
    /^resource not found$/i,
    /^404$/,
    /^internal server error$/i,
    /^unauthorized$/i,
    /^forbidden$/i,
];

function isNetworkLike(error: Error): boolean {
    const msg = (error.message || '').toLowerCase();
    return (
        msg.includes('network') ||
        msg.includes('fetch') ||
        msg.includes('failed to fetch') ||
        msg.includes('econnrefused') ||
        msg.includes('networkerror')
    );
}

function resolveHttpStatus(error: DataHubApiError | Error): number | undefined {
    if (error instanceof DataHubApiError) return error.status;
    const e = error as Error & { status?: number; response?: { status?: number } };
    if (typeof e.status === 'number') return e.status;
    if (typeof e.response?.status === 'number') return e.response.status;
    return undefined;
}

function isRawHttpMessage(message: string): boolean {
    const raw = String(message).trim();
    return RAW_HTTP_PATTERNS.some(p => p.test(raw));
}

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

export function formatDataHubQueryError(
    t: (key: string) => string,
    error: DataHubApiError | Error | null | undefined,
): DataHubQueryErrorDisplay | null {
    if (!error) return null;

    const status = resolveHttpStatus(error);
    const rawMessage = error.message || '';

    if (isNetworkLike(error) && (status === undefined || status === 0)) {
        return { message: safeT(t, 'datahub_error_generic'), variant: 'error', retryable: true };
    }

    if (status === 401 || (/unauthorized/i.test(rawMessage) && isRawHttpMessage(rawMessage))) {
        return {
            message: safeT(t, 'datahub_error_unauthorized'),
            variant: 'warning',
            retryable: false,
            status: status ?? 401,
        };
    }

    if (status === 403 || (/forbidden/i.test(rawMessage) && isRawHttpMessage(rawMessage))) {
        return {
            message: safeT(t, 'datahub_error_forbidden'),
            variant: 'warning',
            retryable: false,
            status: status ?? 403,
        };
    }

    if (
        status === 404 ||
        (/not found/i.test(rawMessage) && isRawHttpMessage(rawMessage))
    ) {
        return {
            message: safeT(t, 'datahub_error_not_found'),
            variant: 'warning',
            retryable: false,
            status: status ?? 404,
        };
    }

    if (status !== undefined && status >= 500) {
        return {
            message: safeT(t, 'datahub_error_generic'),
            variant: 'error',
            retryable: true,
            status,
        };
    }

    if (status === 400 || status === 409 || status === 422) {
        return {
            message: formatApiErrorForUi(t, rawMessage),
            variant: 'warning',
            retryable: false,
            status,
        };
    }

    const message = isRawHttpMessage(rawMessage)
        ? safeT(t, 'datahub_error_generic')
        : formatApiErrorForUi(t, rawMessage);

    return {
        message,
        variant: 'error',
        retryable: true,
        status,
    };
}
