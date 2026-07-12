export type ExecutionRuntimeView = {
  requestedMode: 'demo' | 'live';
  effectiveMode: 'demo' | 'live' | 'dry_run';
  globalRuntimeMode: 'demo' | 'live';
  killSwitchActive: boolean;
  killSwitchReason?: string | null;
  deploymentEngineEnabled: boolean;
  providerConnected: boolean;
  workerAcknowledged: boolean;
  workerAckAt?: string | null;
  workerAckRevision?: number | null;
  stateVersion?: number;
  updatedAt?: string | null;
};

function authHeaders(): HeadersInit {
  const token = localStorage.getItem('titan_token') || sessionStorage.getItem('titan_token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export async function fetchExecutionRuntime(): Promise<ExecutionRuntimeView> {
  const response = await fetch('/api/v1/settings/execution-runtime', { headers: authHeaders() });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || `HTTP ${response.status}`);
  }
  return response.json();
}

export async function fetchCapabilities(): Promise<{ role: string; capabilities: string[] }> {
  const response = await fetch('/api/v1/auth/capabilities', { headers: authHeaders() });
  if (!response.ok) throw new Error('Failed to fetch capabilities');
  return response.json();
}
