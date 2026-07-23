import { query } from '../../../database/db.js';
import { KEY_GRANT, VERIFICATION_STATE, OPERATIONAL_STATE } from './capabilityIds.js';
import {
  ACCESS_SCHEMA_SEPARATION_CORRECTION,
  RUN_60513_PROBE4_SANITIZED_EVIDENCE,
  WALLET_ACCESS_EVIDENCE_REASON,
  WALLET_DATA_CONTRACT_STATE,
  WALLET_PROVIDER_SCHEMA_DRIFT,
  buildWalletDataContractProjection,
  classifyWalletAccessEvidence,
} from './walletAccessEvidence.js';
import {
  SHARED_PERMISSION_PROJECTION_CORRECTION,
  WALLET_PERMISSION_VOLUME_REASON,
  WALLET_PERMISSION_VOLUME_WARNING,
  buildProviderPermissionEvidenceFromVerifiedRows,
  MEXC_PROVIDER_PERMISSION,
} from './providerPermissionEvidence.js';

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

/**
 * Append-only correction that separates endpoint access from data-contract readiness.
 * Gated on classifyWalletAccessEvidence — insufficient evidence performs no DB writes.
 * Does not decrypt credentials, sign, or call providers.
 */
export async function applyWalletAccessSchemaSeparationCorrection({
  connectionId,
  ownerId,
  correctionCorrelationId,
  evidence = RUN_60513_PROBE4_SANITIZED_EVIDENCE,
  originalCorrelationId = ACCESS_SCHEMA_SEPARATION_CORRECTION.runId,
  originalFailureCode = ACCESS_SCHEMA_SEPARATION_CORRECTION.originalFailureCode,
  testedAt = evidence?.testedAt || RUN_60513_PROBE4_SANITIZED_EVIDENCE.testedAt,
  queryFn = query,
} = {}) {
  if (!connectionId || !ownerId || !correctionCorrelationId) {
    throw new Error('connectionId, ownerId and correctionCorrelationId are required');
  }

  const classification = classifyWalletAccessEvidence(evidence);
  if (!classification.sufficient) {
    return {
      success: false,
      applied: false,
      appended: false,
      idempotent: false,
      reason: 'EVIDENCE_INSUFFICIENT',
      decision: classification.decision,
      missingForSufficiency: classification.missingForSufficiency,
      recommendedVerdict: classification.recommendedVerdict,
      table: classification.table,
      providerTransport: 0,
      credentialDecryption: 0,
      signatureGeneration: 0,
    };
  }

  const sourceOfEvidence = `access_schema_separation:${originalCorrelationId}`;
  const dataContract = buildWalletDataContractProjection({
    dataContractState: WALLET_DATA_CONTRACT_STATE.WARNING,
    dataContractWarningCode: WALLET_PROVIDER_SCHEMA_DRIFT,
    sanitizedDataContractReason: WALLET_ACCESS_EVIDENCE_REASON.SCHEMA_WARNING,
    lastDataContractCheckedAt: testedAt,
    consumerReadiness: 'limited',
  });

  const existing = await queryFn(
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
      ACCESS_SCHEMA_SEPARATION_CORRECTION.probeId,
      sourceOfEvidence,
    ],
  );

  const applyProjection = async () => {
    await queryFn(
      `INSERT INTO mexc_connection_capability_state (
         connection_id, owner_id, capability_id, key_grant, verification_state, operational_state,
         last_verified_at, last_failure_code, sanitized_reason, source_of_evidence, updated_at
       ) VALUES ($1,$2,$3,$4,$5,$6,$7::timestamptz,NULL,$8,$9,NOW())
       ON CONFLICT (connection_id, capability_id) DO UPDATE SET
         key_grant = EXCLUDED.key_grant,
         verification_state = EXCLUDED.verification_state,
         operational_state = EXCLUDED.operational_state,
         last_verified_at = EXCLUDED.last_verified_at,
         last_failure_code = NULL,
         sanitized_reason = EXCLUDED.sanitized_reason,
         source_of_evidence = EXCLUDED.source_of_evidence,
         updated_at = NOW()`,
      [
        connectionId,
        ownerId,
        'WALLET_CURRENCY_READ',
        KEY_GRANT.GRANTED,
        VERIFICATION_STATE.VERIFIED,
        OPERATIONAL_STATE.ENABLED,
        testedAt,
        WALLET_ACCESS_EVIDENCE_REASON.ENDPOINT_ACCESS_VERIFIED,
        sourceOfEvidence,
      ],
    );

    await queryFn(
      `UPDATE exchange_connections
       SET metadata = COALESCE(metadata, '{}'::jsonb) || $2::jsonb,
           updated_at = NOW()
       WHERE id = $1`,
      [
        connectionId,
        JSON.stringify({
          mexcWalletDataContract: dataContract,
          mexcWalletAccessVerifiedAt: testedAt,
        }),
      ],
    );
  };

  if (existing.rows.length) {
    await applyProjection();
    return {
      success: true,
      applied: true,
      appended: false,
      idempotent: true,
      capabilityId: 'WALLET_CURRENCY_READ',
      verificationState: VERIFICATION_STATE.VERIFIED,
      keyGrant: KEY_GRANT.GRANTED,
      operationalState: OPERATIONAL_STATE.ENABLED,
      lastFailureCode: null,
      sanitizedReason: WALLET_ACCESS_EVIDENCE_REASON.ENDPOINT_ACCESS_VERIFIED,
      dataContract,
      originalCorrelationId,
      originalFailureCode,
      correctionCorrelationId: existing.rows[0].correlation_id,
      correctionEventId: existing.rows[0].id,
      supersessionType: ACCESS_SCHEMA_SEPARATION_CORRECTION.supersessionType,
      providerTransport: 0,
      credentialDecryption: 0,
      signatureGeneration: 0,
    };
  }

  const inserted = await queryFn(
    `INSERT INTO mexc_capability_verifications (
       connection_id, owner_id, capability_id, probe_id, correlation_id,
       key_grant, verification_state, operational_state,
       last_failure_code, sanitized_reason, source_of_evidence, tested_at, run_status
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NULL,$9,$10,$11::timestamptz,$12)
     RETURNING id, correlation_id, tested_at`,
    [
      connectionId,
      ownerId,
      'WALLET_CURRENCY_READ',
      ACCESS_SCHEMA_SEPARATION_CORRECTION.probeId,
      correctionCorrelationId,
      KEY_GRANT.GRANTED,
      VERIFICATION_STATE.VERIFIED,
      OPERATIONAL_STATE.ENABLED,
      WALLET_ACCESS_EVIDENCE_REASON.ENDPOINT_ACCESS_VERIFIED,
      sourceOfEvidence,
      testedAt,
      'superseded',
    ],
  );

  await applyProjection();

  return {
    success: true,
    applied: true,
    appended: true,
    idempotent: false,
    capabilityId: 'WALLET_CURRENCY_READ',
    verificationState: VERIFICATION_STATE.VERIFIED,
    keyGrant: KEY_GRANT.GRANTED,
    operationalState: OPERATIONAL_STATE.ENABLED,
    lastFailureCode: null,
    sanitizedReason: WALLET_ACCESS_EVIDENCE_REASON.ENDPOINT_ACCESS_VERIFIED,
    dataContract,
    originalCorrelationId,
    originalFailureCode,
    correctionCorrelationId,
    correctionEventId: inserted.rows[0]?.id || null,
    supersessionType: ACCESS_SCHEMA_SEPARATION_CORRECTION.supersessionType,
    providerTransport: 0,
    credentialDecryption: 0,
    signatureGeneration: 0,
  };
}

/**
 * Append-only projection correction:
 * SPOT_WITHDRAW_READ granted via shared deposit/withdrawal history success;
 * Wallet currency-config direct endpoint remains verification_error;
 * data-contract readiness remains limited/warning.
 *
 * Zero provider transport, zero credential decrypt, zero signing.
 * Idempotent on (connection, probe_id, source_of_evidence).
 */
export async function applySharedPermissionEvidenceProjection({
  connectionId,
  ownerId,
  correctionCorrelationId,
  testedAt = new Date().toISOString(),
  queryFn = query,
} = {}) {
  if (!connectionId || !ownerId || !correctionCorrelationId) {
    throw new Error('connectionId, ownerId and correctionCorrelationId are required');
  }

  const sourceOfEvidence = `${SHARED_PERMISSION_PROJECTION_CORRECTION.sourcePrefix}:${correctionCorrelationId}`;

  const existing = await queryFn(
    `SELECT id, correlation_id, tested_at
     FROM mexc_capability_verifications
     WHERE connection_id = $1
       AND owner_id = $2
       AND capability_id = $3
       AND probe_id = $4
       AND source_of_evidence LIKE $5
     ORDER BY tested_at DESC
     LIMIT 1`,
    [
      connectionId,
      ownerId,
      'WALLET_CURRENCY_READ',
      SHARED_PERMISSION_PROJECTION_CORRECTION.probeId,
      `${SHARED_PERMISSION_PROJECTION_CORRECTION.sourcePrefix}:%`,
    ],
  );

  const verifiedRowsResult = await queryFn(
    `SELECT id, capability_id, key_grant, verification_state, correlation_id,
            tested_at::text AS tested_at, last_failure_code
     FROM mexc_capability_verifications
     WHERE connection_id = $1
       AND owner_id = $2
       AND capability_id = ANY($3::text[])
       AND verification_state = 'verified'
       AND key_grant = 'granted'
     ORDER BY tested_at DESC`,
    [
      connectionId,
      ownerId,
      ['DEPOSIT_HISTORY_READ', 'WITHDRAWAL_HISTORY_READ', 'TRANSFER_READ'],
    ],
  );

  // Prefer one row per capability (latest verified).
  const latestByCap = new Map();
  for (const row of verifiedRowsResult.rows) {
    if (!latestByCap.has(row.capability_id)) {
      latestByCap.set(row.capability_id, {
        id: row.id,
        capabilityId: row.capability_id,
        keyGrant: row.key_grant,
        verificationState: row.verification_state,
        correlationId: row.correlation_id,
        testedAt: row.tested_at,
      });
    }
  }

  const walletAttemptResult = await queryFn(
    `SELECT id, capability_id, key_grant, verification_state, correlation_id,
            tested_at::text AS tested_at, last_failure_code
     FROM mexc_capability_verifications
     WHERE connection_id = $1
       AND owner_id = $2
       AND capability_id = 'WALLET_CURRENCY_READ'
       AND probe_id = 'wallet_currency_config'
     ORDER BY tested_at DESC
     LIMIT 1`,
    [connectionId, ownerId],
  );
  const latestWalletAttemptRow = walletAttemptResult.rows[0] || null;
  const latestWalletAttempt = latestWalletAttemptRow
    ? {
      id: latestWalletAttemptRow.id,
      testedAt: latestWalletAttemptRow.tested_at,
      lastFailureCode: latestWalletAttemptRow.last_failure_code,
      failureCode: latestWalletAttemptRow.last_failure_code,
      lastAttemptAt: latestWalletAttemptRow.tested_at,
    }
    : null;

  const { providerPermissionEvidence, walletCurrencyProjection } =
    buildProviderPermissionEvidenceFromVerifiedRows({
      verifiedRows: [...latestByCap.values()],
      latestWalletAttempt,
    });

  if (walletCurrencyProjection.keyGrant !== KEY_GRANT.GRANTED) {
    return {
      success: false,
      applied: false,
      appended: false,
      idempotent: false,
      reason: 'SHARED_PERMISSION_EVIDENCE_MISSING',
      providerPermissionEvidence,
      providerTransport: 0,
      credentialDecryption: 0,
      signatureGeneration: 0,
    };
  }

  const dataContract = buildWalletDataContractProjection({
    dataContractState: WALLET_DATA_CONTRACT_STATE.WARNING,
    dataContractWarningCode: WALLET_PERMISSION_VOLUME_WARNING,
    sanitizedDataContractReason: WALLET_PERMISSION_VOLUME_REASON.EN,
    lastDataContractCheckedAt: testedAt,
    consumerReadiness: 'limited',
  });

  const failureCode = walletCurrencyProjection.lastFailureCode
    || latestWalletAttempt?.lastFailureCode
    || 'MEXC_RESPONSE_COMPRESSED_TOO_LARGE';

  const applyProjection = async () => {
    await queryFn(
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
        KEY_GRANT.GRANTED,
        VERIFICATION_STATE.VERIFICATION_ERROR,
        OPERATIONAL_STATE.DISABLED,
        failureCode,
        WALLET_PERMISSION_VOLUME_REASON.EN,
        sourceOfEvidence,
      ],
    );

    await queryFn(
      `UPDATE exchange_connections
       SET metadata = COALESCE(metadata, '{}'::jsonb) || $2::jsonb,
           updated_at = NOW()
       WHERE id = $1`,
      [
        connectionId,
        JSON.stringify({
          mexcProviderPermissionEvidence: providerPermissionEvidence,
          mexcWalletDataContract: dataContract,
          mexcWalletAccessVerifiedAt: null,
          mexcWalletCurrencyProjection: {
            keyGrantEvidence: walletCurrencyProjection.keyGrantEvidence,
            keyGrantEvidenceType: walletCurrencyProjection.keyGrantEvidenceType,
            directEndpointVerified: false,
            lastAttemptAt: walletCurrencyProjection.lastAttemptAt,
            lastAttemptResult: walletCurrencyProjection.lastAttemptResult,
            lastAttemptFailureCode: walletCurrencyProjection.lastAttemptFailureCode,
            lastVerifiedAt: null,
          },
          mexcWalletLastProbeEvidence: {
            ...(latestWalletAttempt
              ? {
                historyRowId: latestWalletAttempt.id,
                testedAt: latestWalletAttempt.testedAt,
                errorCode: failureCode,
                lastAttemptAt: latestWalletAttempt.testedAt,
              }
              : {}),
            keyGrant: KEY_GRANT.GRANTED,
            keyGrantEvidence: MEXC_PROVIDER_PERMISSION.SPOT_WITHDRAW_READ,
            directEndpointVerified: false,
            dataContractState: 'warning',
            dataContractWarningCode: WALLET_PERMISSION_VOLUME_WARNING,
          },
        }),
      ],
    );
  };

  if (existing.rows.length) {
    await applyProjection();
    return {
      success: true,
      applied: true,
      appended: false,
      idempotent: true,
      capabilityId: 'WALLET_CURRENCY_READ',
      verificationState: VERIFICATION_STATE.VERIFICATION_ERROR,
      keyGrant: KEY_GRANT.GRANTED,
      operationalState: OPERATIONAL_STATE.DISABLED,
      directEndpointVerified: false,
      dataContract,
      providerPermissionEvidence,
      lastAttemptAt: walletCurrencyProjection.lastAttemptAt,
      lastVerifiedAt: null,
      correctionCorrelationId: existing.rows[0].correlation_id,
      correctionEventId: existing.rows[0].id,
      supersessionType: SHARED_PERMISSION_PROJECTION_CORRECTION.supersessionType,
      linkedEvidenceRowIds: {
        deposit: latestByCap.get('DEPOSIT_HISTORY_READ')?.id || null,
        withdrawal: latestByCap.get('WITHDRAWAL_HISTORY_READ')?.id || null,
        walletAttempt: latestWalletAttempt?.id || null,
      },
      providerTransport: 0,
      credentialDecryption: 0,
      signatureGeneration: 0,
    };
  }

  const inserted = await queryFn(
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
      SHARED_PERMISSION_PROJECTION_CORRECTION.probeId,
      correctionCorrelationId,
      KEY_GRANT.GRANTED,
      VERIFICATION_STATE.VERIFICATION_ERROR,
      OPERATIONAL_STATE.DISABLED,
      failureCode,
      [
        'Permission evidence granted via shared SPOT_WITHDRAW_READ',
        'Direct currency-config endpoint verification remains incomplete',
        'Data-contract readiness remains limited',
      ].join('; '),
      sourceOfEvidence,
      testedAt,
      'superseded',
    ],
  );

  await applyProjection();

  return {
    success: true,
    applied: true,
    appended: true,
    idempotent: false,
    capabilityId: 'WALLET_CURRENCY_READ',
    verificationState: VERIFICATION_STATE.VERIFICATION_ERROR,
    keyGrant: KEY_GRANT.GRANTED,
    operationalState: OPERATIONAL_STATE.DISABLED,
    directEndpointVerified: false,
    dataContract,
    providerPermissionEvidence,
    lastAttemptAt: walletCurrencyProjection.lastAttemptAt,
    lastVerifiedAt: null,
    correctionCorrelationId,
    correctionEventId: inserted.rows[0]?.id || null,
    supersessionType: SHARED_PERMISSION_PROJECTION_CORRECTION.supersessionType,
    linkedEvidenceRowIds: {
      deposit: latestByCap.get('DEPOSIT_HISTORY_READ')?.id || null,
      withdrawal: latestByCap.get('WITHDRAWAL_HISTORY_READ')?.id || null,
      walletAttempt: latestWalletAttempt?.id || null,
    },
    providerTransport: 0,
    credentialDecryption: 0,
    signatureGeneration: 0,
  };
}
