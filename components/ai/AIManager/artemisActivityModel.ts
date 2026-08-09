import type { ArtemisAgentRun, ArtemisAuditBundle, ArtemisAuditLog, ArtemisReadiness } from './artemisProductTypes.ts';

export type RecordWindowKind = 'loaded' | 'true_empty' | 'details_unavailable' | 'filtered_empty';

export type RecordWindow<T> = {
  count: number | null;
  latestAt: string | null;
  records: T[];
  loadedCount: number;
  limit: number;
  detailsAvailable: boolean;
  showingPartialWindow: boolean;
  kind: RecordWindowKind;
  auditLoadFailed: boolean;
};

function asArray<T>(value: T[] | null | undefined): T[] {
  return Array.isArray(value) ? value : [];
}

export function resolveRecordWindow<T>(opts: {
  persistedCount?: number | null;
  latestAt?: string | null;
  primaryRecords?: T[] | null;
  fallbackRecords?: T[] | null;
  filteredRecords?: T[] | null;
  limit?: number;
  auditLoadFailed?: boolean;
}): RecordWindow<T> {
  const primary = asArray(opts.primaryRecords);
  const fallback = asArray(opts.fallbackRecords);
  const records = primary.length > 0 ? primary : fallback;
  const loadedCount = records.length;
  const count = typeof opts.persistedCount === 'number' ? opts.persistedCount : loadedCount || null;
  const detailsAvailable = loadedCount > 0;
  const showingPartialWindow = typeof count === 'number' && count > loadedCount && loadedCount > 0;
  let kind: RecordWindowKind = 'loaded';
  if (opts.filteredRecords && loadedCount > 0 && opts.filteredRecords.length === 0) {
    kind = 'filtered_empty';
  } else if (!detailsAvailable) {
    kind = (count || 0) > 0 ? 'details_unavailable' : 'true_empty';
  }
  return {
    count,
    latestAt: opts.latestAt || null,
    records,
    loadedCount,
    limit: opts.limit ?? Math.max(loadedCount, 50),
    detailsAvailable,
    showingPartialWindow,
    kind,
    auditLoadFailed: opts.auditLoadFailed === true,
  };
}

export function resolveAdvisoryWindow(
  readiness: ArtemisReadiness | null | undefined,
  audit?: ArtemisAuditBundle | null,
): RecordWindow<ArtemisAuditLog> {
  return resolveRecordWindow<ArtemisAuditLog>({
    persistedCount: readiness?.advisory?.count ?? null,
    latestAt: readiness?.advisory?.latestAt || null,
    primaryRecords: audit?.systemLogs,
    fallbackRecords: readiness?.advisory?.recent,
    limit: readiness?.advisory?.limit || audit?.limit || 50,
    auditLoadFailed: audit?.loadFailed === true,
  });
}

export function resolveAgentRunWindow(
  readiness: ArtemisReadiness | null | undefined,
  audit?: ArtemisAuditBundle | null,
): RecordWindow<ArtemisAgentRun> {
  return resolveRecordWindow<ArtemisAgentRun>({
    persistedCount: readiness?.agentRuns?.count ?? null,
    latestAt: readiness?.agentRuns?.latestAt || null,
    primaryRecords: audit?.decisions,
    fallbackRecords: readiness?.agentRuns?.recent,
    limit: readiness?.agentRuns?.limit || audit?.limit || 50,
    auditLoadFailed: audit?.loadFailed === true,
  });
}

export function formatCount(value: number | null | undefined): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '—';
  return new Intl.NumberFormat().format(value);
}
