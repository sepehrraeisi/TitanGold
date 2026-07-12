import { useCallback, useEffect, useState } from 'react';
import { fetchExecutionRuntime, type ExecutionRuntimeView } from '../services/executionRuntimeApi';

export function useExecutionRuntime(pollMs = 30000) {
  const [runtime, setRuntime] = useState<ExecutionRuntimeView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setError(null);
      const data = await fetchExecutionRuntime();
      setRuntime(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load runtime state');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, pollMs);
    return () => clearInterval(id);
  }, [refresh, pollMs]);

  return { runtime, loading, error, refresh };
}
