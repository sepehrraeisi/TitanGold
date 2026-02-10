import { useState, useCallback } from 'react';

interface AsyncState<T> {
    data: T | null;
    isLoading: boolean;
    error: string | null;
}

export const useAsync = <T, Args extends any[]>(
    asyncFunction: (...args: Args) => Promise<T>,
    immediate = false
) => {
    const [state, setState] = useState<AsyncState<T>>({
        data: null,
        isLoading: false,
        error: null,
    });

    const execute = useCallback(
        async (...args: Args) => {
            setState({ data: null, isLoading: true, error: null });
            try {
                const response = await asyncFunction(...args);
                setState({ data: response, isLoading: false, error: null });
                return response;
            } catch (error: any) {
                const errorMessage = error.message || 'An unexpected error occurred';
                setState({ data: null, isLoading: false, error: errorMessage });
                throw error;
            }
        },
        [asyncFunction]
    );

    const reset = useCallback(() => {
        setState({ data: null, isLoading: false, error: null });
    }, []);

    const setData = useCallback((data: T | null) => {
        setState(prev => ({ ...prev, data }));
    }, []);

    const setError = useCallback((error: string | null) => {
        setState(prev => ({ ...prev, error }));
    }, []);

    return {
        ...state,
        execute,
        reset,
        setData,
        setError,
    };
};
