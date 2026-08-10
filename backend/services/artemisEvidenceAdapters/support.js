import {
  ADAPTER_VERSIONS,
  AGENT_CONTRACT_ROLE,
  AVAILABILITY,
  CONTRACT_VERSION,
  EXECUTION_CLASS,
  LIFECYCLE_STATUS,
  SCHEMA_VERSION,
} from '../../contracts/artemisEvidenceContract.js';
import { asIsoOrNull } from '../artemisEvidenceTruth.js';

export function parseJsonObject(value) {
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

export function scalarEvidenceValue(value) {
  if (value == null) return null;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  const text = String(value).trim();
  if (!text) return null;
  return text.length > 256 ? text.slice(0, 256) : text;
}

export function buildBaseEnvelope({
  agentId,
  adapterVersion,
  runId = null,
  agentRecordId = null,
  analysisTimestamp,
  createdAt = null,
  symbol = null,
  timeframe = null,
  provider = null,
  venue = null,
  correlationFamily = null,
  availability = AVAILABILITY.AVAILABLE,
  unavailableReason = null,
  lifecycleStatus = LIFECYCLE_STATUS.COMPLETED,
  limitations = [],
  executionClass = EXECUTION_CLASS.ADVISORY_ONLY,
  freshness,
  dataQuality,
  confidence,
  conclusion = undefined,
  evidence = undefined,
  provenance,
}) {
  const role = AGENT_CONTRACT_ROLE[agentId];
  const envelope = {
    schemaVersion: SCHEMA_VERSION,
    contractVersion: CONTRACT_VERSION,
    adapterVersion: adapterVersion || ADAPTER_VERSIONS[agentId],
    agentId,
    agentRole: role.agentRole,
    authorityClass: role.authorityClass,
    runId: runId || null,
    agentRecordId: agentRecordId || null,
    analysisTimestamp: asIsoOrNull(analysisTimestamp),
    createdAt: asIsoOrNull(createdAt),
    symbol: symbol || null,
    timeframe: timeframe || null,
    provider: provider || null,
    venue: venue || null,
    correlationFamily: correlationFamily || null,
    availability,
    unavailableReason,
    lifecycleStatus,
    limitations: Array.isArray(limitations) ? limitations : [],
    executionClass,
    freshness,
    dataQuality,
    confidence,
    provenance,
  };
  if (conclusion) envelope.conclusion = conclusion;
  if (evidence) envelope.evidence = evidence;
  return envelope;
}
