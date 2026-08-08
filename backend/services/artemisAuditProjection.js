/**
 * Consumer-safe Artemis audit projection.
 * Ordinary product responses must never include raw metadata/input/output/context.
 */

import { LEGACY_ADVISORY_CLASSIFICATION } from './artemisDecisionContainment.js';

export const ARTEMIS_PRODUCT_AUDIT_FORBIDDEN_KEYS = Object.freeze([
  'metadata',
  'input',
  'output',
  'context',
  'opportunity',
  'signals',
  'providers',
  'portfolioValue',
  'dailyLoss',
  'dailyProfit',
  'activeTrades',
  'maxTrades',
]);

function asObject(value) {
  if (!value) return {};
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
    } catch {
      return {};
    }
  }
  if (typeof value === 'object' && !Array.isArray(value)) return value;
  return {};
}

function pickString(...candidates) {
  for (const candidate of candidates) {
    if (candidate == null) continue;
    const text = String(candidate).trim();
    if (text) return text;
  }
  return null;
}

function isoTimestamp(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export function projectAdvisoryRecord(row = {}) {
  const meta = asObject(row.metadata);
  const decision = asObject(meta.decision);
  const opportunity = asObject(meta.opportunity);
  const action = (pickString(decision.action, meta.action, row.action) || 'HOLD').toUpperCase();
  const symbol = pickString(opportunity.symbol, meta.symbol, row.symbol);
  const message = pickString(row.message, decision.reason, meta.reason);
  const createdAt = isoTimestamp(row.created_at || row.createdAt || row.timestamp);
  return {
    id: row.id ?? null,
    level: row.level || null,
    classification: pickString(decision.classification, meta.classification) || LEGACY_ADVISORY_CLASSIFICATION,
    created_at: createdAt,
    timestamp: createdAt,
    action,
    symbol,
    message,
    reason: pickString(decision.reason, meta.reason, row.reason) || message,
    executionEligible: false,
    advisoryOnly: true,
  };
}

export function projectAgentRunRecord(row = {}) {
  const input = asObject(row.input);
  const output = asObject(row.output);
  const scoreRaw = row.recordedScore ?? row.confidence;
  const recordedScore = typeof scoreRaw === 'number' && Number.isFinite(scoreRaw) ? scoreRaw : null;
  return {
    id: row.id ?? null,
    agentId: row.agentId || row.agent_id || null,
    agentKey: row.agentKey || row.agent_key || null,
    agentName: row.agentName || row.agent_name || null,
    createdAt: isoTimestamp(row.created_at || row.createdAt),
    successful: row.successful === true || row.was_successful === true,
    recordedScore,
    symbol: pickString(row.symbol, input.symbol, input.pair, output.symbol),
    action: pickString(row.action, output.action, output.decision),
  };
}

export function collectObjectKeys(value, acc = new Set()) {
  if (!value || typeof value !== 'object') return acc;
  if (Array.isArray(value)) {
    value.forEach((item) => collectObjectKeys(item, acc));
    return acc;
  }
  for (const [key, nested] of Object.entries(value)) {
    acc.add(key);
    collectObjectKeys(nested, acc);
  }
  return acc;
}

export function productAuditContainsForbiddenField(payload) {
  const keys = collectObjectKeys(payload);
  return ARTEMIS_PRODUCT_AUDIT_FORBIDDEN_KEYS.some((key) => keys.has(key));
}
