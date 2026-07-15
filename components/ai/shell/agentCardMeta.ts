/**
 * Shared metadata helpers for Agents shell cards / control panel chrome.
 * Side-effect classification comes from the same registry vocabulary as backend.
 */

export type AgentExecutionKind = 'analytical' | 'provider' | 'simulation' | 'live_capable';

export type AgentOperationalState = 'ready' | 'running' | 'paused' | 'error' | 'unavailable';

const LIVE_CAPABLE_KEYS = new Set(['order', 'portfolio', 'artemis_decision']);
const PROVIDER_KEYS = new Set(['arbitrage', 'liquidity', 'market_intelligence']);
const SIMULATION_KEYS = new Set(['order']);

export function getAgentExecutionKind(agentKey?: string | null): AgentExecutionKind {
  const key = String(agentKey || '').toLowerCase();
  if (LIVE_CAPABLE_KEYS.has(key) || SIMULATION_KEYS.has(key)) return 'live_capable';
  if (PROVIDER_KEYS.has(key)) return 'provider';
  return 'analytical';
}

export function mapAgentOperationalState(status?: string | null): AgentOperationalState {
  const s = String(status || '').toLowerCase();
  if (s === 'active') return 'ready';
  if (s === 'training' || s === 'running') return 'running';
  if (s === 'inactive' || s === 'paused' || s === 'idle') return 'paused';
  if (s === 'error' || s === 'failed') return 'error';
  return 'unavailable';
}

export function formatLastRun(iso?: string | null, neverLabel = 'Never'): string {
  if (!iso) return neverLabel;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return neverLabel;
  // Heuristic: very old / epoch placeholders treat as never
  if (d.getFullYear() < 2000) return neverLabel;
  return d.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatAccuracy(accuracy: number | null | undefined, naLabel = 'N/A'): string {
  if (accuracy == null || Number(accuracy) <= 0) return naLabel;
  return `${Number(accuracy).toFixed(1)}%`;
}
