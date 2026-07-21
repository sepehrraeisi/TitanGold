import { query } from '../../../database/db.js';
import { KEY_GRANT, VERIFICATION_STATE, OPERATIONAL_STATE } from './capabilityIds.js';

export const WALLET_CONTRACT_REMEDIATION_CODE = 'MEXC_VERIFICATION_CONTRACT_ERROR';
export const WALLET_CONTRACT_REMEDIATION_REASON = 'Wallet capability verification could not be completed';
export const WALLET_CONTRACT_CORRECTION_PROBE_ID = 'wallet_currency_config_correction';
export const WALLET_CONTRACT_SUPERSESSION_TYPE = 'current_projection_correction';

/**
 * Append-only correction for the known Probe-4 parser/contract defect.
 * Preserves the original verification row and updates only the current-state projection.
 * Idempotent for a given originalCorrelationId.
 */
export async function applyWalletCurrencyVerificationCorrection({
  connectionId,
  ownerId,
  correctionCorrelationId,
  originalCorrelationId = null,
  originalFailureCode = 'MEXC_RESPONSE_INVALID',
  testedAt = new Date().toISOString(),
} = {}) {
  if (!connectionId || !ownerId || !correctionCorrelationId) {
    throw new Error('connectionId, ownerId and correctionCorrelationId are required');
  }

  const sourceOfEvidence = originalCorrelationId
    ? `engineering_correction:${originalCorrelationId}`
    : 'engineering_correction';

  if (originalCorrelationId) {
    const existing = await query(
      `SELECT id, correlation_id, tested_at
       FROM mexc_capability_verifications
       WHERE connection_id = $1
         AND owner_id = $2
         AND capability_id = $3
         AND probe_id = $4
         AND source_of_evidence = $5
       ORDER BY tested_at DESC
       LIMIT 1`,
      [
        connectionId,
        ownerId,
        'WALLET_CURRENCY_READ',
        WALLET_CONTRACT_CORRECTION_PROBE_ID,
        sourceOfEvidence,
      ],
    );
    if (existing.rows.length) {
      await query(
        `INSERT INTO mexc_connection_capability_state (
           connection_id, owner_id, capability_id, key_grant, verification_state, operational_state,
           last_verified_at, last_failure_code, sanitized_reason, source_of_evidence, updated_at
         ) VALUES ($1,$2,$3,$4,$5,$6,NULL,$7,$8,$9,NOW())
         ON CONFLICT (connection_id, capability_id) DO UPDATE SET
           key_grant = EXCLUDED.key_grant,
           verification_state = EXCLUDED.verification_state,
           operational_state = EXCLUDED.operational_state,
           last_verified_at = NULL,
           last_failure_code = EXCLUDED.last_failure_code,
           sanitized_reason = EXCLUDED.sanitized_reason,
           source_of_evidence = EXCLUDED.source_of_evidence,
           updated_at = NOW()`,
        [
          connectionId,
          ownerId,
          'WALLET_CURRENCY_READ',
          KEY_GRANT.UNKNOWN,
          VERIFICATION_STATE.VERIFICATION_ERROR,
          OPERATIONAL_STATE.DISABLED,
          WALLET_CONTRACT_REMEDIATION_CODE,
          WALLET_CONTRACT_REMEDIATION_REASON,
          sourceOfEvidence,
        ],
      );

      return {
        success: true,
        idempotent: true,
        appended: false,
        capabilityId: 'WALLET_CURRENCY_READ',
        verificationState: VERIFICATION_STATE.VERIFICATION_ERROR,
        keyGrant: KEY_GRANT.UNKNOWN,
        operationalState: OPERATIONAL_STATE.DISABLED,
        lastFailureCode: WALLET_CONTRACT_REMEDIATION_CODE,
        sanitizedReason: WALLET_CONTRACT_REMEDIATION_REASON,
        originalCorrelationId,
        originalFailureCode,
        correctionCorrelationId: existing.rows[0].correlation_id,
        correctionEventId: existing.rows[0].id,
        supersessionType: WALLET_CONTRACT_SUPERSESSION_TYPE,
      };
    }
  }

  const inserted = await query(
    `INSERT INTO mexc_capability_verifications (
       connection_id, owner_id, capability_id, probe_id, correlation_id,
       key_grant, verification_state, operational_state,
       last_failure_code, sanitized_reason, source_of_evidence, tested_at, run_status
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::timestamptz,$13)
     RETURNING id, correlation_id, tested_at`,
    [
      connectionId,
      ownerId,
      'WALLET_CURRENCY_READ',
      WALLET_CONTRACT_CORRECTION_PROBE_ID,
      correctionCorrelationId,
      KEY_GRANT.UNKNOWN,
      VERIFICATION_STATE.VERIFICATION_ERROR,
      OPERATIONAL_STATE.DISABLED,
      WALLET_CONTRACT_REMEDIATION_CODE,
      WALLET_CONTRACT_REMEDIATION_REASON,
      sourceOfEvidence,
      testedAt,
      'superseded',
    ],
  );

  await query(
    `INSERT INTO mexc_connection_capability_state (
       connection_id, owner_id, capability_id, key_grant, verification_state, operational_state,
       last_verified_at, last_failure_code, sanitized_reason, source_of_evidence, updated_at
     ) VALUES ($1,$2,$3,$4,$5,$6,NULL,$7,$8,$9,NOW())
     ON CONFLICT (connection_id, capability_id) DO UPDATE SET
       key_grant = EXCLUDED.key_grant,
       verification_state = EXCLUDED.verification_state,
       operational_state = EXCLUDED.operational_state,
       last_verified_at = NULL,
       last_failure_code = EXCLUDED.last_failure_code,
       sanitized_reason = EXCLUDED.sanitized_reason,
       source_of_evidence = EXCLUDED.source_of_evidence,
       updated_at = NOW()`,
    [
      connectionId,
      ownerId,
      'WALLET_CURRENCY_READ',
      KEY_GRANT.UNKNOWN,
      VERIFICATION_STATE.VERIFICATION_ERROR,
      OPERATIONAL_STATE.DISABLED,
      WALLET_CONTRACT_REMEDIATION_CODE,
      WALLET_CONTRACT_REMEDIATION_REASON,
      sourceOfEvidence,
    ],
  );

  return {
    success: true,
    idempotent: false,
    appended: true,
    capabilityId: 'WALLET_CURRENCY_READ',
    verificationState: VERIFICATION_STATE.VERIFICATION_ERROR,
    keyGrant: KEY_GRANT.UNKNOWN,
    operationalState: OPERATIONAL_STATE.DISABLED,
    lastFailureCode: WALLET_CONTRACT_REMEDIATION_CODE,
    sanitizedReason: WALLET_CONTRACT_REMEDIATION_REASON,
    originalCorrelationId,
    originalFailureCode,
    correctionCorrelationId,
    correctionEventId: inserted.rows[0]?.id || null,
    supersessionType: WALLET_CONTRACT_SUPERSESSION_TYPE,
  };
}
