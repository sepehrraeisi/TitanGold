import { useCallback, useEffect, useMemo, useState } from 'react';
import * as api from '../../../services/api.ts';
import { ArtemisState } from '../../../types.ts';
import { mergeWithArtemisDefaults, DEFAULT_ARTEMIS_STATE } from '../defaults.ts';
import { delay } from '../../../utils/dataMerge.ts';

interface UseArtemisStateResult {
    state: ArtemisState | null;
    loading: boolean;
    error: string | null;
    retryCount: number;
    reload: () => Promise<ArtemisState | null>;
    setSafeState: (next: ArtemisState | null) => void;
}

/**
 * Shared hook for loading Artemis state with retry, fallback defaults,
 * and safe merging to avoid undefined field crashes.
 */
export const useArtemisState = (initial?: ArtemisState | null): UseArtemisStateResult => {
    const [state, setState] = useState<ArtemisState | null>(() => initial ? mergeWithArtemisDefaults(initial) : null);
    const [loading, setLoading] = useState<boolean>(!initial);
    const [error, setError] = useState<string | null>(null);
    const [retryCount, setRetryCount] = useState(0);

    const fallbackState = useMemo(() => mergeWithArtemisDefaults(DEFAULT_ARTEMIS_STATE()), []);

    const setSafeState = useCallback((next: ArtemisState | null) => {
        if (next) {
            setState(mergeWithArtemisDefaults(next));
        } else {
            setState(null);
        }
    }, []);

    const loadWithRetry = useCallback(async (retries = 3): Promise<ArtemisState | null> => {
        setLoading(true);
        setError(null);

        for (let attempt = 0; attempt < retries; attempt++) {
            try {
                const raw = await api.fetchArtemisState();
                const safe = mergeWithArtemisDefaults(raw);
                setState(safe);
                setRetryCount(attempt);
                setLoading(false);
                return safe;
            } catch (err) {
                const isLast = attempt === retries - 1;
                const message = err instanceof Error ? err.message : 'Unknown error';
                if (isLast) {
                    setError(message);
                    setState(fallbackState);
                    setLoading(false);
                } else {
                    await delay(2000 * (attempt + 1));
                }
            }
        }

        setLoading(false);
        return state;
    }, [fallbackState]);

    useEffect(() => {
        if (initial) {
            setSafeState(initial);
            setLoading(false);
        } else {
            loadWithRetry();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return {
        state,
        loading,
        error,
        retryCount,
        reload: loadWithRetry,
        setSafeState,
    };
};

