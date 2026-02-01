/**
 * FRONTEND-010: Request Cancellation Utilities
 * 
 * Provides AbortSignal support for API calls to allow cancellation
 * when users close agent panels or navigate away.
 * 
 * Usage:
 * ```typescript
 * import { withCancellation, isAbortError } from './apiCancellation';
 * 
 * const { signal } = useAbortController();
 * 
 * try {
 *   const data = await fetchData({ signal });
 * } catch (error) {
 *   if (isAbortError(error)) {
 *     // Request was cancelled - this is expected, don't show error
 *     return;
 *   }
 *   // Handle real error
 *   console.error('Error:', error);
 * }
 * ```
 */

/**
 * Options for cancellable API requests
 */
export interface CancellableRequestOptions {
    signal?: AbortSignal;
}

/**
 * Check if an error is an AbortError (request was cancelled)
 * Use this to silently handle cancelled requests without showing errors to users
 * 
 * @param error - The error to check
 * @returns true if the error is from an aborted request
 * 
 * @example
 * try {
 *   await fetchData({ signal });
 * } catch (error) {
 *   if (isAbortError(error)) {
 *     console.log('Request cancelled'); // Don't show to user
 *     return;
 *   }
 *   alert('Error: ' + error.message); // Real error
 * }
 */
export const isAbortError = (error: any): boolean => {
    return (
        error?.name === 'AbortError' ||
        error?.message?.includes('aborted') ||
        error?.message?.includes('abort') ||
        error?.code === 20 // DOMException ABORT_ERR
    );
};

/**
 * Wrapper for fetch that respects AbortSignal
 * Automatically merges the signal into fetch options
 * 
 * @param url - The URL to fetch
 * @param options - Fetch options including optional signal
 * @returns Promise<Response>
 * 
 * @example
 * const { signal } = useAbortController();
 * const response = await cancellableFetch('/api/data', {
 *   method: 'GET',
 *   headers: { 'Authorization': 'Bearer token' },
 *   signal
 * });
 */
export const cancellableFetch = async (
    url: string,
    options: RequestInit & CancellableRequestOptions = {}
): Promise<Response> => {
    const { signal, ...fetchOptions } = options;
    
    // Merge signal into fetch options
    const finalOptions: RequestInit = {
        ...fetchOptions,
        ...(signal && { signal }),
    };
    
    return fetch(url, finalOptions);
};

/**
 * Higher-order function that adds cancellation support to async functions
 * Wraps an async function to accept an optional signal parameter
 * 
 * @param fn - The async function to wrap
 * @returns Wrapped function with signal support
 * 
 * @example
 * const fetchUserData = withCancellation(async (userId: string, options?: CancellableRequestOptions) => {
 *   const response = await cancellableFetch(`/api/users/${userId}`, {
 *     signal: options?.signal
 *   });
 *   return response.json();
 * });
 * 
 * // Usage with cancellation
 * const { signal } = useAbortController();
 * const data = await fetchUserData('123', { signal });
 */
export const withCancellation = <TArgs extends any[], TReturn>(
    fn: (...args: [...TArgs, CancellableRequestOptions?]) => Promise<TReturn>
) => {
    return fn;
};

/**
 * Create a timeout that can be cancelled with an AbortSignal
 * Useful for adding timeouts to requests that respect cancellation
 * 
 * @param signal - AbortSignal to watch for cancellation
 * @param timeoutMs - Timeout in milliseconds
 * @returns Promise that rejects on timeout or when signal is aborted
 * 
 * @example
 * const { signal } = useAbortController();
 * const timeoutPromise = cancellableTimeout(signal, 5000);
 * const dataPromise = fetchData({ signal });
 * 
 * try {
 *   const data = await Promise.race([dataPromise, timeoutPromise]);
 * } catch (error) {
 *   if (isAbortError(error)) {
 *     console.log('Cancelled');
 *   } else {
 *     console.log('Timeout');
 *   }
 * }
 */
export const cancellableTimeout = (
    signal: AbortSignal | undefined,
    timeoutMs: number
): Promise<never> => {
    return new Promise((_, reject) => {
        const timeoutId = setTimeout(() => {
            reject(new Error('Request timeout'));
        }, timeoutMs);

        // Cancel timeout if signal is aborted
        if (signal) {
            signal.addEventListener('abort', () => {
                clearTimeout(timeoutId);
                reject(new DOMException('Request cancelled', 'AbortError'));
            });
        }
    });
};

/**
 * Utility to combine multiple AbortSignals into one
 * Useful when you need to respect both a component's signal and a timeout signal
 * 
 * @param signals - Array of AbortSignals to combine
 * @returns A new AbortController that aborts when any input signal aborts
 * 
 * @example
 * const componentController = new AbortController();
 * const timeoutController = new AbortController();
 * setTimeout(() => timeoutController.abort(), 5000);
 * 
 * const combined = combineSignals([
 *   componentController.signal,
 *   timeoutController.signal
 * ]);
 * 
 * // This will abort if either component unmounts OR timeout hits
 * await fetchData({ signal: combined.signal });
 */
export const combineSignals = (signals: (AbortSignal | undefined)[]): AbortController => {
    const controller = new AbortController();
    
    signals.forEach(signal => {
        if (signal) {
            if (signal.aborted) {
                controller.abort();
            } else {
                signal.addEventListener('abort', () => {
                    controller.abort();
                });
            }
        }
    });
    
    return controller;
};

/**
 * Helper to create a fetch request with both timeout and cancellation support
 * 
 * @param url - URL to fetch
 * @param options - Fetch options with optional signal and timeout
 * @returns Promise<Response>
 * 
 * @example
 * const { signal } = useAbortController();
 * const response = await fetchWithTimeout('/api/data', {
 *   signal,
 *   timeout: 10000,
 *   headers: { 'Authorization': 'Bearer token' }
 * });
 */
export const fetchWithTimeout = async (
    url: string,
    options: RequestInit & CancellableRequestOptions & { timeout?: number } = {}
): Promise<Response> => {
    const { signal, timeout, ...fetchOptions } = options;
    
    if (!timeout) {
        return cancellableFetch(url, { ...fetchOptions, signal });
    }
    
    // Combine user signal with timeout signal
    const timeoutController = new AbortController();
    const timeoutId = setTimeout(() => timeoutController.abort(), timeout);
    
    const combinedController = signal 
        ? combineSignals([signal, timeoutController.signal])
        : timeoutController;
    
    try {
        const response = await fetch(url, {
            ...fetchOptions,
            signal: combinedController.signal,
        });
        clearTimeout(timeoutId);
        return response;
    } catch (error) {
        clearTimeout(timeoutId);
        throw error;
    }
};
