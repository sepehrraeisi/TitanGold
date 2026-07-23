/**
 * Sanitized MEXC verification history — safe fields only.
 * Never returns balances, orders, addresses, signatures, or raw provider bodies.
 */

import { query } from '../../../database/db.js';

const SAFE_FILTERS = new Set(['all', 'verified', 'warning', 'failed', 'corrected', 'incomplete']);

const UNSAFE_REASON_PATTERNS = [
  /balance/i,
  /order\b/i,
  /address/i,
  /signature/i,
  /api[_-]?secret/i,
  /api[_-]?key/i,
  /raw[_-]?body/i,
  /ciphertext/i,
  /withdraw/i,
];

function normalizeFilter(filter) {
  const value = String(filter || 'all').toLowerCase().trim();
  return SAFE_FILTERS.has(value) ? value : 'all';
}

function isCorrectionEvidence(sourceOfEvidence) {
  const src = String(sourceOfEvidence || '').toLowerCase();
  return (
    src.includes('correction')
    || src.includes('supersession')
    || src.includes('remediation')
    || src.includes('rollback')
  );
}

function classifyHistoryOutcome(row) {
  if (isCorrectionEvidence(row.source_of_evidence)) {
    return 'corrected';
  }
  const state = String(row.verification_state || '').toLowerCase();
  const runStatus = String(row.run_status || '').toLowerCase();
  const failureCode = String(row.last_failure_code || '').toLowerCase();

  if (state === 'verified' || state === 'enabled' || runStatus === 'verified') {
    return 'verified';
  }
  if (
    state.includes('warn')
    || failureCode.includes('warn')
    || runStatus.includes('warn')
    || String(row.data_contract_state || '').toLowerCase() === 'warning'
  ) {
    return 'warning';
  }
  if (
    state.includes('incomplete')
    || state.includes('pending')
    || state.includes('untested')
    || runStatus.includes('incomplete')
  ) {
    return 'incomplete';
  }
  if (
    state.includes('fail')
    || state.includes('error')
    || state.includes('denied')
    || Boolean(row.last_failure_code)
    || runStatus.includes('fail')
  ) {
    return 'failed';
  }
  if (!state) {
    return row.last_failure_code ? 'failed' : 'incomplete';
  }
  return 'incomplete';
}

function sanitizeReason(reason) {
  if (reason == null) return null;
  const text = String(reason).slice(0, 500);
  if (UNSAFE_REASON_PATTERNS.some((re) => re.test(text))) {
    return null;
  }
  return text;
}

function toSafeHistoryItem(row) {
  const outcome = classifyHistoryOutcome(row);
  return {
    id: row.id,
    capabilityId: row.capability_id || null,
    probeId: row.probe_id || null,
    correlationId: row.correlation_id || null,
    verificationState: row.verification_state || null,
    operationalState: row.operational_state || null,
    keyGrant: row.key_grant || null,
    providerSupport: row.provider_support || null,
    lastFailureCode: row.last_failure_code || null,
    sanitizedReason: sanitizeReason(row.sanitized_reason),
    sourceOfEvidence: row.source_of_evidence || null,
    latencyMs: Number.isFinite(row.latency_ms) ? row.latency_ms : null,
    testedAt: row.tested_at || null,
    createdAt: row.created_at || null,
    runStatus: row.run_status || null,
    outcome,
    isCorrection: outcome === 'corrected',
  };
}

/**
 * List sanitized verification history for a MEXC connection.
 * @param {string} connectionId
 * @param {string} ownerId
 * @param {{ filter?: string, limit?: number, offset?: number }} [opts]
 */
export async function listSanitizedVerificationHistory(connectionId, ownerId, opts = {}) {
  if (!connectionId || !ownerId) {
    return { items: [], total: 0, filter: normalizeFilter(opts.filter) };
  }

  const filter = normalizeFilter(opts.filter);
  const limit = Math.min(Math.max(Number(opts.limit) || 100, 1), 500);
  const offset = Math.max(Number(opts.offset) || 0, 0);

  const result = await query(
    `SELECT
       id,
       capability_id,
       probe_id,
       correlation_id,
       provider_support,
       key_grant,
       verification_state,
       operational_state,
       last_failure_code,
       sanitized_reason,
       source_of_evidence,
       latency_ms,
       tested_at,
       created_at,
       run_status
     FROM mexc_capability_verifications
     WHERE connection_id = $1
       AND owner_id = $2
     ORDER BY tested_at DESC, created_at DESC
     LIMIT $3 OFFSET $4`,
    [connectionId, ownerId, limit, offset],
  );

  const rows = result.rows || [];
  const mapped = rows.map(toSafeHistoryItem);
  const items = filter === 'all'
    ? mapped
    : mapped.filter((item) => item.outcome === filter);

  return {
    items,
    total: items.length,
    filter,
  };
}

export { normalizeFilter, classifyHistoryOutcome, isCorrectionEvidence };
