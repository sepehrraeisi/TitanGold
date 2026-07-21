/**
 * Canonical MEXC Capability Matrix — derives multi-dimensional state per capability.
 * Does not infer trading/withdrawal from authentication success alone.
 */

import {
  MEXC_CAPABILITY,
  MEXC_CAPABILITY_IDS,
  CAPABILITY_GROUP,
  PROVIDER_SUPPORT,
  KEY_GRANT,
  VERIFICATION_STATE,
  OPERATIONAL_STATE,
  SIDE_EFFECT,
  RW_CLASS,
} from './capabilityIds.js';
import { listInventoryByCapability } from './capabilityInventory.js';

const CAPABILITY_META = Object.freeze({
  [MEXC_CAPABILITY.MARKET_DATA_SPOT_PUBLIC]: {
    group: CAPABILITY_GROUP.MARKET_DATA,
    rwClass: RW_CLASS.PUBLIC,
    sideEffect: SIDE_EFFECT.NONE,
    defaultProviderSupport: PROVIDER_SUPPORT.SUPPORTED,
    safeVerification: 'public_probe',
    credentialRequired: false,
    humanLabel: 'Spot public market data',
  },
  [MEXC_CAPABILITY.MARKET_DATA_FUTURES_PUBLIC]: {
    group: CAPABILITY_GROUP.MARKET_DATA,
    rwClass: RW_CLASS.PUBLIC,
    sideEffect: SIDE_EFFECT.NONE,
    defaultProviderSupport: PROVIDER_SUPPORT.SUPPORTED,
    safeVerification: 'public_probe',
    credentialRequired: false,
    humanLabel: 'Futures public market data',
  },
  [MEXC_CAPABILITY.PRIVATE_AUTH]: {
    group: CAPABILITY_GROUP.ACCOUNT,
    rwClass: RW_CLASS.PRIVATE_READ,
    sideEffect: SIDE_EFFECT.READ_ONLY,
    defaultProviderSupport: PROVIDER_SUPPORT.SUPPORTED,
    safeVerification: 'private_auth_probe',
  },
  [MEXC_CAPABILITY.SPOT_ACCOUNT_READ]: {
    group: CAPABILITY_GROUP.SPOT,
    rwClass: RW_CLASS.PRIVATE_READ,
    sideEffect: SIDE_EFFECT.READ_ONLY,
    defaultProviderSupport: PROVIDER_SUPPORT.SUPPORTED,
    safeVerification: 'private_read_probe',
  },
  [MEXC_CAPABILITY.SPOT_ORDER_READ]: {
    group: CAPABILITY_GROUP.SPOT,
    rwClass: RW_CLASS.PRIVATE_READ,
    sideEffect: SIDE_EFFECT.READ_ONLY,
    defaultProviderSupport: PROVIDER_SUPPORT.SUPPORTED,
    safeVerification: 'private_read_probe',
  },
  [MEXC_CAPABILITY.SPOT_TRADE_HISTORY_READ]: {
    group: CAPABILITY_GROUP.SPOT,
    rwClass: RW_CLASS.PRIVATE_READ,
    sideEffect: SIDE_EFFECT.READ_ONLY,
    defaultProviderSupport: PROVIDER_SUPPORT.SUPPORTED,
    safeVerification: 'private_read_probe',
  },
  [MEXC_CAPABILITY.SPOT_TRADE_TEST]: {
    group: CAPABILITY_GROUP.SPOT,
    rwClass: RW_CLASS.PRIVATE_WRITE,
    sideEffect: SIDE_EFFECT.NON_EXECUTING_PRIVATE_VALIDATION,
    defaultProviderSupport: PROVIDER_SUPPORT.SUPPORTED,
    safeVerification: 'deferred_private_non_executing_probe',
    credentialRequired: true,
    humanLabel: 'Spot Test New Order (non-executing)',
  },
  [MEXC_CAPABILITY.SPOT_TRADE_EXECUTE]: {
    group: CAPABILITY_GROUP.SPOT,
    rwClass: RW_CLASS.PRIVATE_WRITE,
    sideEffect: SIDE_EFFECT.FINANCIAL_WRITE,
    defaultProviderSupport: PROVIDER_SUPPORT.SUPPORTED,
    safeVerification: 'not_safely_testable',
  },
  [MEXC_CAPABILITY.SPOT_ORDER_CANCEL]: {
    group: CAPABILITY_GROUP.SPOT,
    rwClass: RW_CLASS.PRIVATE_WRITE,
    sideEffect: SIDE_EFFECT.FINANCIAL_WRITE,
    defaultProviderSupport: PROVIDER_SUPPORT.SUPPORTED,
    safeVerification: 'not_safely_testable',
  },
  [MEXC_CAPABILITY.FUTURES_ACCOUNT_READ]: {
    group: CAPABILITY_GROUP.FUTURES,
    rwClass: RW_CLASS.PRIVATE_READ,
    sideEffect: SIDE_EFFECT.READ_ONLY,
    defaultProviderSupport: PROVIDER_SUPPORT.SUPPORTED,
    safeVerification: 'private_read_probe',
  },
  [MEXC_CAPABILITY.FUTURES_POSITION_READ]: {
    group: CAPABILITY_GROUP.FUTURES,
    rwClass: RW_CLASS.PRIVATE_READ,
    sideEffect: SIDE_EFFECT.READ_ONLY,
    defaultProviderSupport: PROVIDER_SUPPORT.SUPPORTED,
    safeVerification: 'private_read_probe',
  },
  [MEXC_CAPABILITY.FUTURES_ORDER_READ]: {
    group: CAPABILITY_GROUP.FUTURES,
    rwClass: RW_CLASS.PRIVATE_READ,
    sideEffect: SIDE_EFFECT.READ_ONLY,
    defaultProviderSupport: PROVIDER_SUPPORT.SUPPORTED,
    safeVerification: 'private_read_probe',
  },
  [MEXC_CAPABILITY.FUTURES_TRADE_EXECUTE]: {
    group: CAPABILITY_GROUP.FUTURES,
    rwClass: RW_CLASS.PRIVATE_WRITE,
    sideEffect: SIDE_EFFECT.FINANCIAL_WRITE,
    defaultProviderSupport: PROVIDER_SUPPORT.MAINTENANCE,
    safeVerification: 'not_safely_testable',
  },
  [MEXC_CAPABILITY.FUTURES_ORDER_CANCEL]: {
    group: CAPABILITY_GROUP.FUTURES,
    rwClass: RW_CLASS.PRIVATE_WRITE,
    sideEffect: SIDE_EFFECT.FINANCIAL_WRITE,
    defaultProviderSupport: PROVIDER_SUPPORT.MAINTENANCE,
    safeVerification: 'not_safely_testable',
  },
  [MEXC_CAPABILITY.FUTURES_POSITION_SETTINGS_WRITE]: {
    group: CAPABILITY_GROUP.FUTURES,
    rwClass: RW_CLASS.PRIVATE_WRITE,
    sideEffect: SIDE_EFFECT.FINANCIAL_WRITE,
    defaultProviderSupport: PROVIDER_SUPPORT.SUPPORTED,
    safeVerification: 'not_safely_testable',
  },
  [MEXC_CAPABILITY.WALLET_CURRENCY_READ]: {
    group: CAPABILITY_GROUP.WALLET,
    rwClass: RW_CLASS.PRIVATE_READ,
    sideEffect: SIDE_EFFECT.READ_ONLY,
    defaultProviderSupport: PROVIDER_SUPPORT.SUPPORTED,
    safeVerification: 'private_read_probe',
  },
  [MEXC_CAPABILITY.DEPOSIT_ADDRESS_READ]: {
    group: CAPABILITY_GROUP.WALLET,
    rwClass: RW_CLASS.PRIVATE_READ,
    sideEffect: SIDE_EFFECT.READ_ONLY,
    defaultProviderSupport: PROVIDER_SUPPORT.SUPPORTED,
    safeVerification: 'private_read_probe',
  },
  [MEXC_CAPABILITY.DEPOSIT_ADDRESS_GENERATE]: {
    group: CAPABILITY_GROUP.WALLET,
    rwClass: RW_CLASS.PRIVATE_WRITE,
    sideEffect: SIDE_EFFECT.ACCOUNT_MUTATION,
    defaultProviderSupport: PROVIDER_SUPPORT.SUPPORTED,
    safeVerification: 'not_safely_testable',
  },
  [MEXC_CAPABILITY.DEPOSIT_HISTORY_READ]: {
    group: CAPABILITY_GROUP.WALLET,
    rwClass: RW_CLASS.PRIVATE_READ,
    sideEffect: SIDE_EFFECT.READ_ONLY,
    defaultProviderSupport: PROVIDER_SUPPORT.SUPPORTED,
    safeVerification: 'private_read_probe',
  },
  [MEXC_CAPABILITY.WITHDRAWAL_ADDRESS_READ]: {
    group: CAPABILITY_GROUP.WALLET,
    rwClass: RW_CLASS.PRIVATE_READ,
    sideEffect: SIDE_EFFECT.READ_ONLY,
    defaultProviderSupport: PROVIDER_SUPPORT.SUPPORTED,
    safeVerification: 'private_read_probe',
  },
  [MEXC_CAPABILITY.WITHDRAWAL_HISTORY_READ]: {
    group: CAPABILITY_GROUP.WALLET,
    rwClass: RW_CLASS.PRIVATE_READ,
    sideEffect: SIDE_EFFECT.READ_ONLY,
    defaultProviderSupport: PROVIDER_SUPPORT.SUPPORTED,
    safeVerification: 'private_read_probe',
  },
  [MEXC_CAPABILITY.WITHDRAWAL_EXECUTE]: {
    group: CAPABILITY_GROUP.WALLET,
    rwClass: RW_CLASS.PRIVATE_WRITE,
    sideEffect: SIDE_EFFECT.FINANCIAL_WRITE,
    defaultProviderSupport: PROVIDER_SUPPORT.SUPPORTED,
    safeVerification: 'not_safely_testable',
  },
  [MEXC_CAPABILITY.WITHDRAWAL_CANCEL]: {
    group: CAPABILITY_GROUP.WALLET,
    rwClass: RW_CLASS.PRIVATE_WRITE,
    sideEffect: SIDE_EFFECT.FINANCIAL_WRITE,
    defaultProviderSupport: PROVIDER_SUPPORT.SUPPORTED,
    safeVerification: 'not_safely_testable',
  },
  [MEXC_CAPABILITY.TRANSFER_READ]: {
    group: CAPABILITY_GROUP.TRANSFERS,
    rwClass: RW_CLASS.PRIVATE_READ,
    sideEffect: SIDE_EFFECT.READ_ONLY,
    defaultProviderSupport: PROVIDER_SUPPORT.SUPPORTED,
    safeVerification: 'private_read_probe',
  },
  [MEXC_CAPABILITY.TRANSFER_EXECUTE]: {
    group: CAPABILITY_GROUP.TRANSFERS,
    rwClass: RW_CLASS.PRIVATE_WRITE,
    sideEffect: SIDE_EFFECT.FINANCIAL_WRITE,
    defaultProviderSupport: PROVIDER_SUPPORT.SUPPORTED,
    safeVerification: 'not_safely_testable',
  },
  [MEXC_CAPABILITY.INTERNAL_TRANSFER_READ]: {
    group: CAPABILITY_GROUP.TRANSFERS,
    rwClass: RW_CLASS.PRIVATE_READ,
    sideEffect: SIDE_EFFECT.READ_ONLY,
    defaultProviderSupport: PROVIDER_SUPPORT.SUPPORTED,
    safeVerification: 'private_read_probe',
  },
  [MEXC_CAPABILITY.INTERNAL_TRANSFER_EXECUTE]: {
    group: CAPABILITY_GROUP.TRANSFERS,
    rwClass: RW_CLASS.PRIVATE_WRITE,
    sideEffect: SIDE_EFFECT.FINANCIAL_WRITE,
    defaultProviderSupport: PROVIDER_SUPPORT.SUPPORTED,
    safeVerification: 'not_safely_testable',
  },
  [MEXC_CAPABILITY.DUST_READ]: {
    group: CAPABILITY_GROUP.WALLET,
    rwClass: RW_CLASS.PRIVATE_READ,
    sideEffect: SIDE_EFFECT.READ_ONLY,
    defaultProviderSupport: PROVIDER_SUPPORT.SUPPORTED,
    safeVerification: 'private_read_probe',
  },
  [MEXC_CAPABILITY.DUST_EXECUTE]: {
    group: CAPABILITY_GROUP.WALLET,
    rwClass: RW_CLASS.PRIVATE_WRITE,
    sideEffect: SIDE_EFFECT.FINANCIAL_WRITE,
    defaultProviderSupport: PROVIDER_SUPPORT.SUPPORTED,
    safeVerification: 'not_safely_testable',
  },
  [MEXC_CAPABILITY.SUBACCOUNT_READ]: {
    group: CAPABILITY_GROUP.ACCOUNT,
    rwClass: RW_CLASS.PRIVATE_READ,
    sideEffect: SIDE_EFFECT.READ_ONLY,
    defaultProviderSupport: PROVIDER_SUPPORT.SUPPORTED,
    safeVerification: 'private_read_probe',
  },
  [MEXC_CAPABILITY.SUBACCOUNT_MANAGE]: {
    group: CAPABILITY_GROUP.ACCOUNT,
    rwClass: RW_CLASS.PRIVATE_WRITE,
    sideEffect: SIDE_EFFECT.ACCOUNT_MUTATION,
    defaultProviderSupport: PROVIDER_SUPPORT.SUPPORTED,
    safeVerification: 'not_safely_testable',
  },
  [MEXC_CAPABILITY.P2P_READ]: {
    group: CAPABILITY_GROUP.P2P,
    rwClass: RW_CLASS.PRIVATE_READ,
    sideEffect: SIDE_EFFECT.READ_ONLY,
    defaultProviderSupport: PROVIDER_SUPPORT.UNKNOWN,
    safeVerification: 'not_safely_testable',
    credentialRequired: true,
    humanLabel: 'P2P read',
  },
  [MEXC_CAPABILITY.P2P_EXECUTE]: {
    group: CAPABILITY_GROUP.P2P,
    rwClass: RW_CLASS.PRIVATE_WRITE,
    sideEffect: SIDE_EFFECT.FINANCIAL_WRITE,
    defaultProviderSupport: PROVIDER_SUPPORT.UNKNOWN,
    safeVerification: 'not_safely_testable',
    credentialRequired: true,
    humanLabel: 'P2P execute',
  },
  [MEXC_CAPABILITY.ACCOUNT_EDIT]: {
    group: CAPABILITY_GROUP.ACCOUNT,
    rwClass: RW_CLASS.PRIVATE_WRITE,
    sideEffect: SIDE_EFFECT.ACCOUNT_MUTATION,
    defaultProviderSupport: PROVIDER_SUPPORT.UNKNOWN,
    safeVerification: 'not_safely_testable',
    credentialRequired: true,
    humanLabel: 'Account edit',
    blockedReasonDefault: 'PROVIDER SUPPORT NOT VERIFIED — no verified official TitanGold endpoint/use case',
  },
});

function deriveProviderSupport(capabilityId, meta) {
  const rows = listInventoryByCapability(capabilityId);
  if (!rows.length) return PROVIDER_SUPPORT.UNKNOWN;
  if (rows.every((r) => r.implementationState === 'PROVIDER_SUPPORT_NOT_VERIFIED')) {
    return PROVIDER_SUPPORT.UNKNOWN;
  }
  if (rows.some((r) => r.maintenanceStatus === 'maintenance')) {
    // If all write rows are maintenance and capability is write-oriented
    if (meta.sideEffect === SIDE_EFFECT.FINANCIAL_WRITE && rows.every((r) => r.rwClass !== 'private_read' || r.maintenanceStatus === 'maintenance')) {
      const writeRows = rows.filter((r) => r.rwClass === 'private_write');
      if (writeRows.length && writeRows.every((r) => r.maintenanceStatus === 'maintenance')) {
        return PROVIDER_SUPPORT.MAINTENANCE;
      }
    }
  }
  if (meta.defaultProviderSupport === PROVIDER_SUPPORT.MAINTENANCE) {
    return PROVIDER_SUPPORT.MAINTENANCE;
  }
  if (meta.defaultProviderSupport === PROVIDER_SUPPORT.UNKNOWN) {
    return PROVIDER_SUPPORT.UNKNOWN;
  }
  return PROVIDER_SUPPORT.SUPPORTED;
}

function deriveOperationalState({
  providerSupport,
  keyGrant,
  verificationState,
  meta,
  runtimeAllowsSideEffects = false,
  userDisabled = false,
}) {
  if (userDisabled) return { state: OPERATIONAL_STATE.BLOCKED_BY_USER, reason: 'Disabled by user' };

  if (providerSupport === PROVIDER_SUPPORT.UNKNOWN) {
    return {
      state: OPERATIONAL_STATE.BLOCKED_BY_PROVIDER_EVIDENCE,
      reason: meta.blockedReasonDefault || 'PROVIDER SUPPORT NOT VERIFIED',
    };
  }
  if (providerSupport === PROVIDER_SUPPORT.MAINTENANCE) {
    return { state: OPERATIONAL_STATE.BLOCKED_BY_PROVIDER, reason: 'Provider temporarily unavailable (maintenance)' };
  }
  if (providerSupport === PROVIDER_SUPPORT.UNSUPPORTED) {
    return { state: OPERATIONAL_STATE.BLOCKED_BY_PROVIDER, reason: 'Provider unsupported' };
  }

  if (meta.rwClass === RW_CLASS.PUBLIC) {
    return { state: OPERATIONAL_STATE.ENABLED, reason: null };
  }

  if (meta.safeVerification === 'deferred_private_non_executing_probe') {
    return {
      state: OPERATIONAL_STATE.DISABLED_PENDING_EXPLICIT_AUTHORIZATION,
      reason: 'Deferred private non-executing probe — excluded from current read-only checkpoint',
    };
  }

  if (meta.sideEffect === SIDE_EFFECT.FINANCIAL_WRITE || meta.sideEffect === SIDE_EFFECT.ACCOUNT_MUTATION) {
    if (!runtimeAllowsSideEffects) {
      return {
        state: OPERATIONAL_STATE.BLOCKED_BY_RUNTIME,
        reason: 'Tier-4 financial/account mutation blocked by runtime (Demo / Kill Switch / Live unavailable)',
      };
    }
  }

  if (meta.safeVerification === 'not_safely_testable' || meta.safeVerification === 'not_safely_testable_until_approved') {
    return {
      state: OPERATIONAL_STATE.DISABLED,
      reason: 'No safe non-mutating verification; operational enablement requires separate authorization',
    };
  }

  if (keyGrant === KEY_GRANT.DENIED) {
    return { state: OPERATIONAL_STATE.BLOCKED_BY_PERMISSION, reason: 'API key permission denied' };
  }

  if (verificationState === VERIFICATION_STATE.VERIFIED && (keyGrant === KEY_GRANT.GRANTED || keyGrant === KEY_GRANT.NOT_APPLICABLE)) {
    return { state: OPERATIONAL_STATE.ENABLED, reason: null };
  }

  if (verificationState === VERIFICATION_STATE.FAILED) {
    return { state: OPERATIONAL_STATE.DISABLED, reason: 'Last verification failed' };
  }

  if (verificationState === VERIFICATION_STATE.VERIFICATION_ERROR) {
    return { state: OPERATIONAL_STATE.DISABLED, reason: 'Verification could not be completed safely' };
  }

  return {
    state: OPERATIONAL_STATE.DISABLED,
    reason: 'Not verified — private capability remains disabled until safe verification succeeds',
  };
}

/**
 * @param {object} opts
 * @param {Record<string, object>} [opts.storedStates] - capabilityId -> persisted state
 * @param {boolean} [opts.credentialsConfigured]
 * @param {boolean} [opts.privateAuthVerified]
 * @param {boolean} [opts.runtimeAllowsSideEffects]
 * @param {boolean} [opts.userDisabled]
 */
export function buildCapabilityMatrix(opts = {}) {
  const {
    storedStates = {},
    credentialsConfigured = false,
    privateAuthVerified = false,
    runtimeAllowsSideEffects = false,
    userDisabled = false,
  } = opts;

  const capabilities = MEXC_CAPABILITY_IDS.map((capabilityId) => {
    const meta = CAPABILITY_META[capabilityId];
    const stored = storedStates[capabilityId] || {};
    const providerSupport = stored.providerSupport || deriveProviderSupport(capabilityId, meta);

    let keyGrant = stored.keyGrant || KEY_GRANT.UNKNOWN;
    let verificationState = stored.verificationState || VERIFICATION_STATE.NOT_TESTED;

    if (meta.safeVerification === 'not_safely_testable' || meta.safeVerification === 'not_safely_testable_until_approved') {
      verificationState = stored.verificationState || VERIFICATION_STATE.NOT_SAFELY_TESTABLE;
      if (!stored.keyGrant) keyGrant = KEY_GRANT.UNKNOWN;
    }

    if (meta.safeVerification === 'deferred_private_non_executing_probe') {
      verificationState = stored.verificationState || VERIFICATION_STATE.DEFERRED_PRIVATE_NON_EXECUTING_PROBE;
      if (!stored.keyGrant) keyGrant = KEY_GRANT.UNKNOWN;
    }

    if (meta.rwClass === RW_CLASS.PUBLIC || meta.credentialRequired === false) {
      keyGrant = KEY_GRANT.NOT_APPLICABLE;
      verificationState = stored.verificationState || VERIFICATION_STATE.AVAILABLE;
    }

    if (capabilityId === MEXC_CAPABILITY.PRIVATE_AUTH || capabilityId === MEXC_CAPABILITY.SPOT_ACCOUNT_READ) {
      if (privateAuthVerified) {
        keyGrant = KEY_GRANT.GRANTED;
        verificationState = VERIFICATION_STATE.VERIFIED;
      } else if (credentialsConfigured && !stored.verificationState) {
        verificationState = VERIFICATION_STATE.NOT_TESTED;
        keyGrant = KEY_GRANT.UNKNOWN;
      }
    } else if (
      meta.rwClass === RW_CLASS.PRIVATE_READ
      && privateAuthVerified
      && !stored.keyGrant
      && meta.safeVerification === 'private_read_probe'
    ) {
      // Auth success does NOT grant other private capabilities
      keyGrant = KEY_GRANT.UNKNOWN;
    }

    if (!credentialsConfigured && meta.rwClass !== RW_CLASS.PUBLIC) {
      keyGrant = KEY_GRANT.UNKNOWN;
      if (
        verificationState !== VERIFICATION_STATE.NOT_SAFELY_TESTABLE
        && verificationState !== VERIFICATION_STATE.DEFERRED_PRIVATE_NON_EXECUTING_PROBE
      ) {
        verificationState = VERIFICATION_STATE.NOT_TESTED;
      }
    }

    const { state: operationalState, reason: blockedReason } = deriveOperationalState({
      providerSupport,
      keyGrant,
      verificationState,
      meta,
      runtimeAllowsSideEffects,
      userDisabled,
    });

    const inventory = listInventoryByCapability(capabilityId);

    return {
      capabilityId,
      humanLabel: meta.humanLabel || capabilityId.replace(/_/g, ' '),
      credentialRequired: meta.credentialRequired !== false && meta.rwClass !== RW_CLASS.PUBLIC,
      group: meta.group,
      rwClass: meta.rwClass,
      sideEffect: meta.sideEffect,
      providerSupport,
      keyGrant,
      verificationState,
      operationalState,
      blockedReason,
      lastVerifiedAt: stored.lastVerifiedAt || null,
      lastFailureCode: stored.lastFailureCode || null,
      sanitizedReason: stored.sanitizedReason || null,
      sourceOfEvidence: stored.sourceOfEvidence || null,
      inventoryEndpoints: inventory.map((r) => ({
        name: r.name,
        method: r.method,
        endpoint: r.officialEndpoint,
        host: r.host,
        permission: r.officialPermission,
        maintenanceStatus: r.maintenanceStatus,
      })),
    };
  });

  return {
    generatedAt: new Date().toISOString(),
    credentialsConfigured,
    privateAuthVerified,
    runtimeAllowsSideEffects: Boolean(runtimeAllowsSideEffects),
    realSideEffectsAllowed: false, // program rule: never claim live side effects in this slice
    capabilities,
    byGroup: groupCapabilities(capabilities),
  };
}

function groupCapabilities(capabilities) {
  const groups = {};
  for (const cap of capabilities) {
    if (!groups[cap.group]) groups[cap.group] = [];
    groups[cap.group].push(cap);
  }
  return groups;
}

export function getCapabilityMeta(capabilityId) {
  return CAPABILITY_META[capabilityId] || null;
}

export { CAPABILITY_META };
