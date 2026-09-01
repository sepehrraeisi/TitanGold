/**
 * Artemis Core Stage 2 public owner surface.
 * Re-exports the WP-B.1 evidence contract. Do not invent a second schema.
 */

export * from './artemisEvidenceContract.js';
export { applyCanonicalAgentId } from '../services/artemisAgentIdentity.js';

import { validateEvidenceEnvelope } from './artemisEvidenceContract.js';
import { applyCanonicalAgentId } from '../services/artemisAgentIdentity.js';

export function normalizeAndValidateEvidenceEnvelope(envelope, options = {}) {
  return validateEvidenceEnvelope(applyCanonicalAgentId(envelope), options);
}
