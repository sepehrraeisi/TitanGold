import type { ArtemisAuditBundle, ArtemisReadiness } from '../components/ai/AIManager/artemisProductTypes.ts';

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

export async function fetchArtemisAuditBundle(limit = 50): Promise<ArtemisAuditBundle> {
  try {
    const res = await fetch(`/api/v1/artemis/logs?limit=${encodeURIComponent(String(limit))}`, {
      headers: authHeaders(),
    });
    if (!res.ok) {
      return {
        systemLogs: [],
        decisions: [],
        loadFailed: true,
        limit,
        advisoryTotal: null,
        agentRunTotal: null,
      };
    }
    const data = await res.json().catch(() => ({}));
    const systemLogs = Array.isArray(data?.systemLogs)
      ? data.systemLogs
      : Array.isArray(data?.logs)
        ? data.logs
        : Array.isArray(data)
          ? data
          : [];
    const decisions = Array.isArray(data?.decisions)
      ? data.decisions.map((row: Record<string, unknown>) => ({
          id: row.id,
          agentId: row.agent_id || row.agentId,
          agentKey: row.agent_key || row.agentKey || null,
          agentName: row.agent_name || row.agentName || null,
          successful: row.was_successful === true || row.successful === true,
          recordedScore: typeof row.confidence === 'number' ? row.confidence : null,
          createdAt: row.created_at || row.createdAt || null,
          symbol: (row.input as { symbol?: string } | undefined)?.symbol || null,
          action: (row.output as { action?: string } | undefined)?.action || null,
        }))
      : [];
    return {
      systemLogs,
      decisions,
      loadFailed: false,
      limit: typeof data?.limit === 'number' ? data.limit : limit,
      advisoryTotal: typeof data?.advisoryTotal === 'number' ? data.advisoryTotal : typeof data?.total === 'number' ? data.total : null,
      agentRunTotal: typeof data?.agentRunTotal === 'number' ? data.agentRunTotal : null,
    };
  } catch {
    return {
      systemLogs: [],
      decisions: [],
      loadFailed: true,
      limit,
      advisoryTotal: null,
      agentRunTotal: null,
    };
  }
}

/** @deprecated use fetchArtemisAuditBundle */
export async function fetchArtemisLegacyDecisionLogs(limit = 20) {
  const bundle = await fetchArtemisAuditBundle(limit);
  return bundle.systemLogs;
}
