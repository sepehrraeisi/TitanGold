/**
 * WP-B.1 product-safe evidence projection.
 * Full envelope is INTERNAL/DIAGNOSTIC. Ordinary routes never receive raw payloads.
 */

export const EVIDENCE_PRODUCT_FORBIDDEN_KEYS = Object.freeze([
  'metadata',
  'input',
  'output',
  'input_data',
  'output_data',
  'context',
  'apiKey',
  'api_key',
  'apiSecret',
  'secret',
  'password',
  'token',
  'jwt',
  'authorization',
  'chatId',
  'chat_id',
  'signedUrl',
  'private_key',
]);

export function projectEvidenceForProduct(envelope) {
  if (!envelope || typeof envelope !== 'object') return null;
  return {
    schemaVersion: envelope.schemaVersion,
    contractVersion: envelope.contractVersion,
    adapterVersion: envelope.adapterVersion || null,
    agentId: envelope.agentId,
    agentRole: envelope.agentRole,
    authorityClass: envelope.authorityClass,
    symbol: envelope.symbol || null,
    timeframe: envelope.timeframe || null,
    availability: envelope.availability,
    unavailableReason: envelope.unavailableReason || null,
    lifecycleStatus: envelope.lifecycleStatus,
    executionClass: envelope.executionClass,
    limitations: Array.isArray(envelope.limitations) ? envelope.limitations : [],
    freshness: envelope.freshness
      ? {
          status: envelope.freshness.status,
          reasonKey: envelope.freshness.reasonKey || null,
        }
      : null,
    dataQuality: envelope.dataQuality
      ? { status: envelope.dataQuality.status }
      : null,
    confidence: envelope.confidence
      ? {
          availability: envelope.confidence.availability,
          kind: envelope.confidence.kind || null,
          scale: envelope.confidence.scale || null,
        }
      : null,
    conclusion: envelope.conclusion
      ? {
          direction: envelope.conclusion.direction || null,
          regime: envelope.conclusion.regime || null,
          signal: envelope.conclusion.signal || null,
          strength: envelope.conclusion.strength
            ? envelope.conclusion.strength.availability === 'unavailable'
              ? { availability: 'unavailable' }
              : {
                  value: envelope.conclusion.strength.value ?? null,
                  scale: envelope.conclusion.strength.scale || null,
                }
            : null,
        }
      : null,
    evidenceItemCount: Array.isArray(envelope.evidence?.items) ? envelope.evidence.items.length : 0,
    advisoryOnly: envelope.executionClass === 'advisory_only',
    executionEligible: false,
  };
}

export function productEvidenceContainsForbiddenField(payload) {
  if (!payload || typeof payload !== 'object') return false;
  const json = JSON.stringify(payload);
  return EVIDENCE_PRODUCT_FORBIDDEN_KEYS.some((key) => new RegExp(`"${key}"\\s*:`).test(json));
}

export default {
  projectEvidenceForProduct,
  productEvidenceContainsForbiddenField,
  EVIDENCE_PRODUCT_FORBIDDEN_KEYS,
};
