/**
 * Canonical MEXC provider-permission-domain evidence.
 *
 * Separates API-key permission domains from per-endpoint verification and
 * data-contract readiness. Read success on a shared-permission endpoint may
 * grant the permission domain; it never grants write/execute capabilities.
 */

export const PROVIDER_PERMISSION_STATE = Object.freeze({
  GRANTED: 'granted',
  DENIED: 'denied',
  UNKNOWN: 'unknown',
});

export const PROVIDER_PERMISSION_EVIDENCE_TYPE = Object.freeze({
  DIRECT_ENDPOINT_SUCCESS: 'direct_endpoint_success',
  SHARED_PERMISSION_SUCCESS: 'shared_permission_success',
  EXPLICIT_PROVIDER_DENIAL: 'explicit_provider_denial',
  UNKNOWN: 'unknown',
});

/** Official MEXC permission codes used by TitanGold (read domains only here). */
export const MEXC_PROVIDER_PERMISSION = Object.freeze({
  SPOT_WITHDRAW_READ: 'SPOT_WITHDRAW_READ',
  SPOT_TRANSFER_READ: 'SPOT_TRANSFER_READ',
});

/**
 * Capability → official permission domain (read).
 * Write/execute capabilities are intentionally absent.
 */
export const CAPABILITY_PROVIDER_PERMISSION = Object.freeze({
  WALLET_CURRENCY_READ: MEXC_PROVIDER_PERMISSION.SPOT_WITHDRAW_READ,
  DEPOSIT_HISTORY_READ: MEXC_PROVIDER_PERMISSION.SPOT_WITHDRAW_READ,
  WITHDRAWAL_HISTORY_READ: MEXC_PROVIDER_PERMISSION.SPOT_WITHDRAW_READ,
  DEPOSIT_ADDRESS_READ: MEXC_PROVIDER_PERMISSION.SPOT_WITHDRAW_READ,
  TRANSFER_READ: MEXC_PROVIDER_PERMISSION.SPOT_TRANSFER_READ,
});

export const SHARED_PERMISSION_EVIDENCE_CAPABILITIES = Object.freeze({
  [MEXC_PROVIDER_PERMISSION.SPOT_WITHDRAW_READ]: Object.freeze([
    'DEPOSIT_HISTORY_READ',
    'WITHDRAWAL_HISTORY_READ',
  ]),
  [MEXC_PROVIDER_PERMISSION.SPOT_TRANSFER_READ]: Object.freeze([
    'TRANSFER_READ',
  ]),
});

export const WALLET_PERMISSION_VOLUME_WARNING = 'MEXC_WALLET_PROVIDER_SCHEMA_OR_VOLUME_LIMIT';

export const WALLET_PERMISSION_VOLUME_REASON = Object.freeze({
  EN: 'Endpoint permission is available, but the full provider currency configuration is not yet supported safely',
  FA: 'مجوز خواندن در دسترس است، اما پیکربندی کامل ارزهای ارائه‌دهنده هنوز به‌صورت ایمن پشتیبانی نمی‌شود',
  PERMISSION_AVAILABLE_EN: 'Permission available',
  PERMISSION_AVAILABLE_FA: 'مجوز موردنیاز در دسترس است',
  ENDPOINT_INCOMPLETE_EN: 'Currency configuration verification is incomplete',
  ENDPOINT_INCOMPLETE_FA: 'تأیید پیکربندی ارزها کامل نشده است',
  STRUCTURES_EN: 'Some provider currency records are not yet supported',
  STRUCTURES_FA: 'برخی ساختارهای اطلاعات ارز ارائه‌دهنده هنوز پشتیبانی نمی‌شوند',
  CONSUMER_LIMITED_EN: 'Wallet read permission is available, but normalized currency configuration is incomplete',
  CONSUMER_LIMITED_FA: 'مجوز خواندن کیف پول در دسترس است، اما پیکربندی نرمال‌شده ارزها کامل نیست',
});

export const SHARED_PERMISSION_PROJECTION_CORRECTION = Object.freeze({
  probeId: 'shared_permission_evidence_projection',
  supersessionType: 'shared_permission_evidence_projection',
  sourcePrefix: 'shared_permission_evidence_projection',
});

/**
 * @param {object} partial
 * @returns {object} normalized providerPermissionEvidence entry
 */
export function buildProviderPermissionEvidenceEntry({
  permissionCode,
  state = PROVIDER_PERMISSION_STATE.UNKNOWN,
  evidenceCapabilityIds = [],
  evidenceVerificationRowIds = [],
  evidenceRunIds = [],
  lastEvidenceAt = null,
  evidenceType = PROVIDER_PERMISSION_EVIDENCE_TYPE.UNKNOWN,
} = {}) {
  return {
    permissionCode: permissionCode || null,
    state,
    evidenceCapabilityIds: [...new Set((evidenceCapabilityIds || []).filter(Boolean))],
    evidenceVerificationRowIds: [...new Set((evidenceVerificationRowIds || []).filter(Boolean))],
    evidenceRunIds: [...new Set((evidenceRunIds || []).filter(Boolean))],
    lastEvidenceAt: lastEvidenceAt || null,
    evidenceType,
  };
}

/**
 * Build SPOT_WITHDRAW_READ / SPOT_TRANSFER_READ projections from verified capability rows.
 * Does not infer write permissions. Does not mark Wallet endpoint verified.
 *
 * @param {object} opts
 * @param {Array<{capabilityId:string,id?:string,verificationState?:string,keyGrant?:string,testedAt?:string,correlationId?:string}>} opts.verifiedRows
 * @param {object|null} [opts.latestWalletAttempt]
 */
export function buildProviderPermissionEvidenceFromVerifiedRows({
  verifiedRows = [],
  latestWalletAttempt = null,
} = {}) {
  const byCap = new Map();
  for (const row of verifiedRows) {
    if (!row?.capabilityId) continue;
    if (row.verificationState && row.verificationState !== 'verified') continue;
    if (row.keyGrant && row.keyGrant !== 'granted') continue;
    byCap.set(row.capabilityId, row);
  }

  const deposit = byCap.get('DEPOSIT_HISTORY_READ');
  const withdrawal = byCap.get('WITHDRAWAL_HISTORY_READ');
  const transfer = byCap.get('TRANSFER_READ');

  const withdrawEvidenceCaps = [];
  const withdrawRowIds = [];
  const withdrawRunIds = [];
  let withdrawAt = null;

  if (deposit) {
    withdrawEvidenceCaps.push('DEPOSIT_HISTORY_READ');
    if (deposit.id) withdrawRowIds.push(deposit.id);
    if (deposit.correlationId) withdrawRunIds.push(deposit.correlationId);
    withdrawAt = deposit.testedAt || withdrawAt;
  }
  if (withdrawal) {
    withdrawEvidenceCaps.push('WITHDRAWAL_HISTORY_READ');
    if (withdrawal.id) withdrawRowIds.push(withdrawal.id);
    if (withdrawal.correlationId) withdrawRunIds.push(withdrawal.correlationId);
    if (!withdrawAt || (withdrawal.testedAt && withdrawal.testedAt > withdrawAt)) {
      withdrawAt = withdrawal.testedAt;
    }
  }

  const spotWithdrawRead = withdrawEvidenceCaps.length
    ? buildProviderPermissionEvidenceEntry({
      permissionCode: MEXC_PROVIDER_PERMISSION.SPOT_WITHDRAW_READ,
      state: PROVIDER_PERMISSION_STATE.GRANTED,
      evidenceCapabilityIds: withdrawEvidenceCaps,
      evidenceVerificationRowIds: withdrawRowIds,
      evidenceRunIds: withdrawRunIds,
      lastEvidenceAt: withdrawAt,
      evidenceType: PROVIDER_PERMISSION_EVIDENCE_TYPE.SHARED_PERMISSION_SUCCESS,
    })
    : buildProviderPermissionEvidenceEntry({
      permissionCode: MEXC_PROVIDER_PERMISSION.SPOT_WITHDRAW_READ,
      state: PROVIDER_PERMISSION_STATE.UNKNOWN,
      evidenceType: PROVIDER_PERMISSION_EVIDENCE_TYPE.UNKNOWN,
    });

  const spotTransferRead = transfer
    ? buildProviderPermissionEvidenceEntry({
      permissionCode: MEXC_PROVIDER_PERMISSION.SPOT_TRANSFER_READ,
      state: PROVIDER_PERMISSION_STATE.GRANTED,
      evidenceCapabilityIds: ['TRANSFER_READ'],
      evidenceVerificationRowIds: transfer.id ? [transfer.id] : [],
      evidenceRunIds: transfer.correlationId ? [transfer.correlationId] : [],
      lastEvidenceAt: transfer.testedAt || null,
      evidenceType: PROVIDER_PERMISSION_EVIDENCE_TYPE.SHARED_PERMISSION_SUCCESS,
    })
    : buildProviderPermissionEvidenceEntry({
      permissionCode: MEXC_PROVIDER_PERMISSION.SPOT_TRANSFER_READ,
      state: PROVIDER_PERMISSION_STATE.UNKNOWN,
      evidenceType: PROVIDER_PERMISSION_EVIDENCE_TYPE.UNKNOWN,
    });

  return {
    providerPermissionEvidence: {
      [MEXC_PROVIDER_PERMISSION.SPOT_WITHDRAW_READ]: spotWithdrawRead,
      [MEXC_PROVIDER_PERMISSION.SPOT_TRANSFER_READ]: spotTransferRead,
    },
    walletCurrencyProjection: buildWalletCurrencyPermissionProjection({
      spotWithdrawRead,
      latestWalletAttempt,
    }),
  };
}

/**
 * Split WALLET_CURRENCY_READ into key permission vs direct endpoint vs data readiness.
 */
export function buildWalletCurrencyPermissionProjection({
  spotWithdrawRead,
  latestWalletAttempt = null,
} = {}) {
  const permissionGranted = spotWithdrawRead?.state === PROVIDER_PERMISSION_STATE.GRANTED;
  const attemptAt = latestWalletAttempt?.testedAt
    || latestWalletAttempt?.lastAttemptAt
    || null;
  const failureCode = latestWalletAttempt?.lastFailureCode
    || latestWalletAttempt?.failureCode
    || null;

  return {
    keyGrant: permissionGranted ? 'granted' : 'unknown',
    keyGrantEvidence: permissionGranted
      ? MEXC_PROVIDER_PERMISSION.SPOT_WITHDRAW_READ
      : null,
    keyGrantEvidenceType: permissionGranted
      ? PROVIDER_PERMISSION_EVIDENCE_TYPE.SHARED_PERMISSION_SUCCESS
      : null,
    verificationState: 'verification_error',
    directEndpointVerified: false,
    lastVerifiedAt: null,
    lastAttemptAt: attemptAt,
    lastAttemptResult: latestWalletAttempt ? 'verification_error' : null,
    lastAttemptFailureCode: failureCode,
    lastFailureCode: failureCode,
    operationalState: 'disabled',
    dataContractState: permissionGranted ? 'warning' : 'unknown',
    dataContractWarningCode: permissionGranted ? WALLET_PERMISSION_VOLUME_WARNING : null,
    sanitizedDataContractReason: permissionGranted
      ? WALLET_PERMISSION_VOLUME_REASON.EN
      : null,
    consumerReadiness: permissionGranted ? 'limited' : 'unknown',
    sanitizedReason: permissionGranted
      ? WALLET_PERMISSION_VOLUME_REASON.EN
      : 'Wallet capability verification could not be completed',
  };
}

/**
 * Pure helper: does shared-permission evidence support granting keyGrant for wallet?
 */
export function canGrantWalletKeyFromSharedPermission(evidenceMap = {}) {
  const withdraw = evidenceMap?.[MEXC_PROVIDER_PERMISSION.SPOT_WITHDRAW_READ];
  return withdraw?.state === PROVIDER_PERMISSION_STATE.GRANTED
    && withdraw?.evidenceType === PROVIDER_PERMISSION_EVIDENCE_TYPE.SHARED_PERMISSION_SUCCESS;
}
