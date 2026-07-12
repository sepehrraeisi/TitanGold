import { useEffect, useState } from 'react';
import { fetchCapabilities } from '../services/executionRuntimeApi';

export function useCapabilities() {
  const [capabilities, setCapabilities] = useState<string[]>([]);
  const [role, setRole] = useState<string>('user');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCapabilities()
      .then((data) => {
        setCapabilities(data.capabilities || []);
        setRole(data.role || 'user');
      })
      .catch(() => {
        setCapabilities([]);
        setRole('user');
      })
      .finally(() => setLoading(false));
  }, []);

  const has = (cap: string) => capabilities.includes(cap);

  return { capabilities, role, loading, has };
}
