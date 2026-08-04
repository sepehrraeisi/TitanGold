/**
 * TREND-CORE — Frontend API client and contract parsers.
 */

import { buildTrendCoreApiPath } from './trendCorePaths.ts';

export type TrendDirection = 'bullish' | 'bearish' | 'sideways' | 'mixed' | 'unavailable';
export type TrendRegime = 'trending' | 'ranging' | 'transition' | 'unavailable';

export type TrendSnapshot = {
  symbol: string | null;
  timeframe: string | null;
  direction: TrendDirection;
  regime: TrendRegime;
  strength: number | null;
  strengthClassification: string | null;
  adx: {
    value: number;
    diPlus: number;
    diMinus: number;
    strength: string;
    interpretation?: string;
    interpretationKey?: string;
  } | null;
  currentPrice: number | null;
  summary: string | null;
  supportingEvidence: Array<Record<string, unknown>>;
  conflictingEvidence: Array<Record<string, unknown>>;
  weakeningEvidence: Array<Record<string, unknown>>;
  reversalEvidence: Array<Record<string, unknown>>;
  freshness: string;
  freshnessMs: number | null;
  freshnessReasonKey?: string;
  provenance: Record<string, unknown>;
  unavailableReasons: string[];
  analyticalSignal: string | null;
};

export type TrendRunSummary = {
  runId: string;
  agentId: string;
  status: string;
  trigger: string;
  symbol: string | null;
  timeframe: string | null;
  startedAt: string;
  completedAt: string;
  durationMs: number | null;
  snapshotSummary: Record<string, unknown>;
  errorMessage: string | null;
};

export type TrendOverview = {
  productIdentity: Record<string, unknown>;
  settings: TrendSettings;
  latestSnapshot: TrendSnapshot | null;
  latestRun: TrendRunSummary | null;
  comparison: Record<string, unknown>;
  metrics: { totalRuns: number; lastRunAt: string | null; lastRunId: string | null };
  runtime: Record<string, unknown>;
  scheduler: Record<string, unknown>;
};

export type TrendSettings = {
  symbol: string;
  timeframe: string;
  compareTimeframes: string[];
  adxPeriod: number;
  smaPeriod: number;
  emaPeriod: number;
  trendLineLookback: number;
  candleCount: number;
  autoExecute: { supported: false; effective: false; reason: string };
  version: number;
};

export type TrendIntegrations = Record<string, { status: string; owner?: string; note?: string }>;

async function trendCoreRequest<T>(agentId: string, path: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem('titan_token') || sessionStorage.getItem('titan_token');
  if (!token) {
    const err = new Error('Authentication required') as Error & { status?: number };
    err.status = 401;
    throw err;
  }
  const response = await fetch(buildTrendCoreApiPath(agentId, path), {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    const err = new Error(body?.error?.message || `Trend request failed: ${response.status}`) as Error & {
      status?: number;
      code?: string;
    };
    err.status = response.status;
    err.code = body?.error?.code;
    throw err;
  }
  return response.json() as Promise<T>;
}

function asSnapshot(raw: unknown): TrendSnapshot | null {
  if (!raw || typeof raw !== 'object') return null;
  return raw as TrendSnapshot;
}

export async function fetchTrendOverview(agentId: string): Promise<TrendOverview> {
  const raw = await trendCoreRequest<{ overview: TrendOverview }>(agentId, 'overview');
  const o = raw.overview;
  return {
    ...o,
    latestSnapshot: asSnapshot(o.latestSnapshot),
  };
}

export async function runTrendAnalysis(
  agentId: string,
  payload: { symbol: string; timeframe: string; idempotencyKey?: string; compareTimeframes?: string[] },
): Promise<{ run: TrendRunSummary; snapshot: TrendSnapshot; multiTimeframe: unknown[]; idempotent: boolean }> {
  const raw = await trendCoreRequest<{
    run: TrendRunSummary;
    snapshot: TrendSnapshot;
    multiTimeframe: unknown[];
    idempotent: boolean;
  }>(agentId, 'analyze', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return { ...raw, snapshot: asSnapshot(raw.snapshot)! };
}

export async function fetchTrendRuns(
  agentId: string,
  page = 1,
  pageSize = 20,
): Promise<{ runs: TrendRunSummary[]; pagination: Record<string, number> }> {
  return trendCoreRequest(agentId, `runs?page=${page}&pageSize=${pageSize}`);
}

export async function fetchTrendRunDetail(
  agentId: string,
  runId: string,
): Promise<{ run: TrendRunSummary; snapshot: TrendSnapshot; multiTimeframe: unknown[] }> {
  const raw = await trendCoreRequest<{
    run: TrendRunSummary;
    snapshot: TrendSnapshot;
    multiTimeframe: unknown[];
  }>(agentId, `runs/${runId}`);
  return { ...raw, snapshot: asSnapshot(raw.snapshot)! };
}

export async function fetchTrendSettings(agentId: string): Promise<TrendSettings> {
  const raw = await trendCoreRequest<{ settings: TrendSettings }>(agentId, 'settings');
  return raw.settings;
}

export async function updateTrendSettings(
  agentId: string,
  patch: Partial<TrendSettings> & { version?: number },
): Promise<TrendSettings> {
  const raw = await trendCoreRequest<{ settings: TrendSettings }>(agentId, 'settings', {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });
  return raw.settings;
}

export async function fetchTrendIntegrations(agentId: string): Promise<TrendIntegrations> {
  const raw = await trendCoreRequest<{ integrations: TrendIntegrations }>(agentId, 'integrations');
  return raw.integrations;
}

export function createTrendIdempotencyKey(): string {
  return `trend-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}
