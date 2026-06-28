/** Bearer token headers for Telegram Collector write endpoints. */

export function getCollectorAuthHeaders(extra?: HeadersInit): HeadersInit {
    const token =
        typeof localStorage !== 'undefined'
            ? localStorage.getItem('titan_token') || sessionStorage.getItem('titan_token')
            : null;

    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...(extra as Record<string, string> | undefined),
    };

    if (token) {
        headers.Authorization = `Bearer ${token}`;
    }

    return headers;
}

export function mergeCollectorAuthInit(init?: RequestInit): RequestInit {
    const authHeaders = getCollectorAuthHeaders();
    const initHeaders = (init?.headers as Record<string, string> | undefined) || {};

    return {
        ...init,
        credentials: init?.credentials ?? 'include',
        headers: {
            ...authHeaders,
            ...initHeaders,
        },
    };
}
