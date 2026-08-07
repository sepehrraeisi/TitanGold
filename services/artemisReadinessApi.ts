import type { ArtemisReadiness } from '../components/ai/AIManager/artemisProductTypes.ts';

function authHeaders(): HeadersInit {
  const token = localStorage.getItem('titan_token') || sessionStorage.getItem('titan_token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export async function fetchArtemisReadiness(): Promise<ArtemisReadiness> {
  const res = await fetch('/api/v1/artemis/readiness', { headers: authHeaders() });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error || body?.message || `Artemis readiness failed (${res.status})`);
  }
  return res.json();
}

export async function fetchArtemisLegacyDecisionLogs(limit = 20): Promise<any[]> {
  const res = await fetch(`/api/v1/artemis/logs?limit=${encodeURIComponent(String(limit))}`, {
    headers: authHeaders(),
  });
  if (!res.ok) return [];
  const data = await res.json().catch(() => ({}));
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.logs)) return data.logs;
  if (Array.isArray(data?.items)) return data.items;
  return [];
}
