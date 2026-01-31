import { useEffect, useRef, useCallback, DependencyList } from 'react';

/**
 * Memory Leak Prevention Hooks (FRONTEND-009)
 * 
 * These hooks provide automatic cleanup for common memory leak patterns:
 * - AbortController for fetch requests
 * - Mounted state tracking to prevent setState on unmounted components
 * - Interval/timeout cleanup
 * - Event listener cleanup
 */

/**
 * Hook to track if component is mounted
 * Prevents "Can't perform a React state update on an unmounted component" warnings
 * 
 * @returns {React.MutableRefObject<boolean>} isMountedRef - ref that's true when mounted
 */
export const useIsMounted = () => {
    const isMountedRef = useRef<boolean>(false);

    useEffect(() => {
        isMountedRef.current = true;
        return () => {
            isMountedRef.current = false;
        };
    }, []);

    return isMountedRef;
};

/**
 * Hook to create an AbortController that auto-cancels on unmount
 * Use for fetch requests to prevent memory leaks
 * 
 * @returns {{ signal: AbortSignal, abort: () => void }} - AbortController interface
 * 
 * @example
 * const { signal } = useAbortController();
 * const data = await fetch('/api/data', { signal });
 */
export const useAbortController = () => {
    const abortControllerRef = useRef<AbortController | null>(null);

    useEffect(() => {
        abortControllerRef.current = new AbortController();
        
        return () => {
            if (abortControllerRef.current) {
                abortControllerRef.current.abort();
            }
        };
    }, []);

    return {
        signal: abortControllerRef.current?.signal as AbortSignal,
        abort: () => abortControllerRef.current?.abort(),
    };
};

/**
 * Hook to safely execute async functions with automatic cleanup
 * Combines mounted check + AbortController
 * 
 * @param asyncFn - Async function to execute
 * @param deps - Dependency array (like useEffect)
 * 
 * @example
 * useAsyncEffect(async (signal) => {
 *   const data = await fetch('/api/data', { signal });
 *   setData(data);
 * }, [someDepency]);
 */
export const useAsyncEffect = (
    asyncFn: (signal: AbortSignal) => Promise<void>,
    deps: DependencyList
) => {
    const isMountedRef = useIsMounted();

    useEffect(() => {
        const abortController = new AbortController();

        const execute = async () => {
            try {
                await asyncFn(abortController.signal);
            } catch (error: any) {
                // Ignore AbortErrors - they're expected on unmount
                if (error?.name !== 'AbortError' && isMountedRef.current) {
                    console.error('useAsyncEffect error:', error);
                }
            }
        };

        execute();

        return () => {
            abortController.abort();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, deps);
};

/**
 * Hook to safely manage intervals with automatic cleanup
 * 
 * @param callback - Function to execute at interval
 * @param delay - Interval delay in ms (null to pause)
 * 
 * @example
 * useInterval(() => {
 *   console.log('Tick');
 * }, 1000);
 */
export const useInterval = (callback: () => void, delay: number | null) => {
    const savedCallback = useRef<() => void>();

    // Remember the latest callback
    useEffect(() => {
        savedCallback.current = callback;
    }, [callback]);

    // Set up the interval
    useEffect(() => {
        if (delay === null) {
            return;
        }

        const tick = () => {
            savedCallback.current?.();
        };

        const id = setInterval(tick, delay);
        return () => clearInterval(id);
    }, [delay]);
};

/**
 * Hook to safely manage timeouts with automatic cleanup
 * 
 * @param callback - Function to execute after delay
 * @param delay - Timeout delay in ms (null to cancel)
 * 
 * @example
 * useTimeout(() => {
 *   console.log('Delayed action');
 * }, 5000);
 */
export const useTimeout = (callback: () => void, delay: number | null) => {
    const savedCallback = useRef<() => void>();

    // Remember the latest callback
    useEffect(() => {
        savedCallback.current = callback;
    }, [callback]);

    // Set up the timeout
    useEffect(() => {
        if (delay === null) {
            return;
        }

        const id = setTimeout(() => {
            savedCallback.current?.();
        }, delay);

        return () => clearTimeout(id);
    }, [delay]);
};

/**
 * Hook to manage event listeners with automatic cleanup
 * 
 * @param eventName - Event name (e.g., 'resize', 'scroll')
 * @param handler - Event handler function
 * @param element - Element to attach listener to (default: window)
 * 
 * @example
 * useEventListener('resize', handleResize);
 * useEventListener('click', handleClick, buttonRef.current);
 */
export const useEventListener = <K extends keyof WindowEventMap>(
    eventName: K,
    handler: (event: WindowEventMap[K]) => void,
    element: HTMLElement | Window = window
) => {
    const savedHandler = useRef<(event: WindowEventMap[K]) => void>();

    // Update ref.current value if handler changes
    useEffect(() => {
        savedHandler.current = handler;
    }, [handler]);

    useEffect(() => {
        // Make sure element supports addEventListener
        const isSupported = element && element.addEventListener;
        if (!isSupported) return;

        // Create event listener that calls handler function stored in ref
        const eventListener = (event: Event) => {
            savedHandler.current?.(event as WindowEventMap[K]);
        };

        element.addEventListener(eventName, eventListener);

        // Remove event listener on cleanup
        return () => {
            element.removeEventListener(eventName, eventListener);
        };
    }, [eventName, element]);
};

/**
 * Wrapper for useEffect that provides automatic cleanup for common patterns
 * Returns cleanup utilities for manual cleanup if needed
 * 
 * @param effect - Effect function that receives cleanup utilities
 * @param deps - Dependency array
 * 
 * @example
 * useMemorySafeEffect(({ isMounted, signal, addCleanup }) => {
 *   const fetchData = async () => {
 *     const data = await fetch('/api', { signal });
 *     if (isMounted()) setData(data);
 *   };
 *   fetchData();
 *   
 *   const interval = setInterval(() => {...}, 1000);
 *   addCleanup(() => clearInterval(interval));
 * }, []);
 */
export const useMemorySafeEffect = (
    effect: (utils: {
        isMounted: () => boolean;
        signal: AbortSignal;
        addCleanup: (cleanup: () => void) => void;
    }) => void | (() => void),
    deps: DependencyList
) => {
    const isMountedRef = useIsMounted();
    const cleanupFnsRef = useRef<Array<() => void>>([]);

    useEffect(() => {
        const abortController = new AbortController();
        cleanupFnsRef.current = [];

        const isMounted = () => isMountedRef.current;
        const addCleanup = (cleanup: () => void) => {
            cleanupFnsRef.current.push(cleanup);
        };

        // Execute the effect
        const cleanup = effect({
            isMounted,
            signal: abortController.signal,
            addCleanup,
        });

        // Return cleanup function
        return () => {
            abortController.abort();
            // Run manual cleanups
            cleanupFnsRef.current.forEach(fn => fn());
            // Run effect's own cleanup if provided
            if (cleanup) cleanup();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, deps);
};
