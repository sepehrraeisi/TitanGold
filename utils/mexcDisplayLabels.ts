/**
 * Canonical MEXC frontend localization owner.
 * Machine codes stay exact; product UI always uses these labels.
 */

export type TranslateFn = (key: string) => string;

/** Every canonical MEXC capability — must have EN+FA locale keys mexc_cap_<CODE> */
export const MEXC_CAPABILITY_CODES = [
  'MARKET_DATA_SPOT_PUBLIC',
  'MARKET_DATA_FUTURES_PUBLIC',
  'PRIVATE_AUTH',
  'SPOT_ACCOUNT_READ',
  'SPOT_ORDER_READ',
  'SPOT_TRADE_HISTORY_READ',
  'SPOT_TRADE_TEST',
  'SPOT_TRADE_EXECUTE',
  'SPOT_ORDER_CANCEL',
  'FUTURES_ACCOUNT_READ',
  'FUTURES_POSITION_READ',
  'FUTURES_ORDER_READ',
  'FUTURES_TRADE_EXECUTE',
  'FUTURES_ORDER_CANCEL',
  'FUTURES_POSITION_SETTINGS_WRITE',
  'WALLET_CURRENCY_READ',
  'DEPOSIT_ADDRESS_READ',
  'DEPOSIT_ADDRESS_GENERATE',
  'DEPOSIT_HISTORY_READ',
  'WITHDRAWAL_ADDRESS_READ',
  'WITHDRAWAL_HISTORY_READ',
  'WITHDRAWAL_EXECUTE',
  'WITHDRAWAL_CANCEL',
  'DUST_READ',
  'DUST_EXECUTE',
  'TRANSFER_READ',
  'TRANSFER_EXECUTE',
  'INTERNAL_TRANSFER_READ',
  'INTERNAL_TRANSFER_EXECUTE',
  'P2P_READ',
  'P2P_EXECUTE',
  'SUBACCOUNT_READ',
  'SUBACCOUNT_MANAGE',
  'ACCOUNT_EDIT',
] as const;

export type MexcCapabilityCode = (typeof MEXC_CAPABILITY_CODES)[number];

const GROUP_KEYS: Record<string, string> = {
  'Market Data': 'mexc_group_market_data',
  Spot: 'mexc_group_spot',
  Futures: 'mexc_group_futures',
  Wallet: 'mexc_group_wallet',
  Transfers: 'mexc_group_transfers',
  P2P: 'mexc_group_p2p',
  Account: 'mexc_group_account',
};

const CONSUMER_ID_KEYS: Record<string, string> = {
  portfolio: 'mexc_consumer_portfolio',
  arbitrage: 'mexc_consumer_arbitrage',
  spot_trading_read: 'mexc_consumer_spot_read',
  spot_trading_execute: 'mexc_consumer_spot_execute',
  futures_trading_read: 'mexc_consumer_futures_read',
  futures_trading_execute: 'mexc_consumer_futures_execute',
  wallet: 'mexc_consumer_wallet_read',
  wallet_withdrawal_execute: 'mexc_consumer_wallet_withdrawal',
  wallet_transfer_execute: 'mexc_consumer_wallet_transfer',
  risk_agents: 'mexc_consumer_risk',
  market_data_agents: 'mexc_consumer_market_data',
};

const MODULE_NAME_KEYS: Record<string, string> = {
  Portfolio: 'mexc_consumer_portfolio',
  Arbitrage: 'mexc_consumer_arbitrage',
  'Market Data Agents': 'mexc_consumer_market_data',
  'Spot Trading (read)': 'mexc_consumer_spot_read',
  'Spot Trading (execute)': 'mexc_consumer_spot_execute',
  'Futures Trading (read)': 'mexc_consumer_futures_read',
  'Futures Trading (execute)': 'mexc_consumer_futures_execute',
  Wallet: 'mexc_consumer_wallet_read',
  'Wallet · Deposit address': 'mexc_consumer_wallet_read',
  'Wallet · Deposit history': 'mexc_consumer_wallet_read',
  'Wallet · Withdrawal history': 'mexc_consumer_wallet_withdrawal',
  'Wallet · Withdrawal execute': 'mexc_consumer_wallet_withdrawal',
  'Wallet · Transfer read': 'mexc_consumer_wallet_transfer',
  'Wallet · Transfer execute': 'mexc_consumer_wallet_transfer',
  Risk: 'mexc_consumer_risk',
};

const AUTH_STATE_KEYS: Record<string, string> = {
  not_configured: 'mexc_auth_not_configured',
  configured_unverified: 'mexc_auth_configured_unverified',
  authentication_pending: 'mexc_auth_pending',
  authenticated: 'mexc_auth_authenticated',
  authentication_failed: 'mexc_auth_failed',
  failed: 'mexc_auth_failed',
  revoked: 'mexc_auth_revoked',
  secret_reentry_required: 'mexc_auth_secret_reentry',
};

const PROVIDER_SUPPORT_KEYS: Record<string, string> = {
  supported: 'mexc_provider_supported',
  unsupported: 'mexc_provider_unsupported',
  unknown: 'mexc_provider_unknown',
  degraded: 'mexc_provider_degraded',
  maintenance: 'mexc_provider_maintenance',
  available: 'mexc_available',
  unavailable: 'mexc_unavailable',
};

const KEY_GRANT_KEYS: Record<string, string> = {
  granted: 'mexc_key_granted',
  denied: 'mexc_key_denied',
  unknown: 'mexc_key_unknown',
  not_applicable: 'mexc_key_not_applicable',
};

const VERIFICATION_STATE_KEYS: Record<string, string> = {
  verified: 'mexc_verify_verified',
  unverified: 'mexc_verify_unverified',
  failed: 'mexc_verify_failed',
  pending: 'mexc_verify_pending',
  not_tested: 'mexc_verify_not_tested',
  not_safely_testable: 'mexc_verify_not_safely_testable',
  deferred_private_non_executing_probe: 'mexc_verify_deferred_private',
  available: 'mexc_verify_available',
  not_applicable: 'mexc_verify_na',
};

const OPERATIONAL_STATE_KEYS: Record<string, string> = {
  enabled: 'mexc_op_enabled',
  disabled: 'mexc_op_disabled',
  disabled_pending_explicit_authorization: 'mexc_op_pending_auth',
  blocked: 'mexc_op_blocked',
  blocked_by_runtime: 'mexc_op_blocked_runtime',
  blocked_by_user: 'mexc_op_blocked_user',
  blocked_by_permission: 'mexc_op_blocked_permission',
  blocked_by_provider: 'mexc_op_blocked_provider',
  blocked_by_provider_evidence: 'mexc_op_blocked_provider_evidence',
  blocked_by_risk: 'mexc_op_blocked_risk',
  blocked_tier4: 'mexc_op_blocked_tier4',
  blocked_runtime: 'mexc_op_blocked_runtime',
  blocked_provider: 'mexc_op_blocked_provider',
  blocked_key: 'mexc_op_blocked_key',
  blocked_unverified: 'mexc_op_blocked_unverified',
};

function resolve(t: TranslateFn, key: string): string | null {
  const translated = t(key);
  if (!translated || translated === key) return null;
  return translated;
}

/** Product capability label — never returns raw code in production UI path */
export function getCapabilityLabel(code: string | null | undefined, t: TranslateFn): string {
  if (!code) return t('mexc_unknown');
  const labeled = resolve(t, `mexc_cap_${code}`);
  if (labeled) return labeled;
  // Dev/test: surface missing label visibly so tests fail; never prefer English backend humanLabel
  return t('mexc_cap_missing_label').replace('{code}', code);
}

export function getGroupLabel(group: string | null | undefined, t: TranslateFn): string {
  if (!group) return t('mexc_unknown');
  const key = GROUP_KEYS[group];
  if (key) {
    const labeled = resolve(t, key);
    if (labeled) return labeled;
  }
  return group;
}

export function getProviderSupportLabel(value: string | null | undefined, t: TranslateFn): string {
  if (!value) return t('mexc_unknown');
  return resolve(t, PROVIDER_SUPPORT_KEYS[value]) || t('mexc_unknown');
}

export function getKeyGrantLabel(value: string | null | undefined, t: TranslateFn): string {
  if (!value) return t('mexc_unknown');
  return resolve(t, KEY_GRANT_KEYS[value]) || t('mexc_unknown');
}

export function getVerificationLabel(value: string | null | undefined, t: TranslateFn): string {
  if (!value) return t('mexc_unknown');
  return resolve(t, VERIFICATION_STATE_KEYS[value]) || t('mexc_unknown');
}

export function getOperationalStateLabel(value: string | null | undefined, t: TranslateFn): string {
  if (!value) return t('mexc_unknown');
  if (OPERATIONAL_STATE_KEYS[value]) {
    return resolve(t, OPERATIONAL_STATE_KEYS[value]) || t('mexc_op_blocked');
  }
  if (value.startsWith('blocked_')) return t('mexc_op_blocked');
  return t('mexc_unknown');
}

export function getAuthStateLabel(value: string | null | undefined, t: TranslateFn): string {
  if (!value) return t('connections_not_configured');
  return resolve(t, AUTH_STATE_KEYS[value]) || t('connections_not_configured');
}

export function getConsumerLabel(consumerId: string, displayName: string | undefined, t: TranslateFn): string {
  const key = CONSUMER_ID_KEYS[consumerId];
  if (key) {
    const labeled = resolve(t, key);
    if (labeled) return labeled;
  }
  if (displayName) {
    const modKey = MODULE_NAME_KEYS[displayName];
    if (modKey) {
      const labeled = resolve(t, modKey);
      if (labeled) return labeled;
    }
  }
  return displayName || consumerId;
}

export function getModuleLabel(moduleName: string, t: TranslateFn): string {
  const key = MODULE_NAME_KEYS[moduleName];
  if (key) {
    const labeled = resolve(t, key);
    if (labeled) return labeled;
  }
  return moduleName;
}

export function getReasonLabel(reasonCode: string, t: TranslateFn): string {
  const labeled = resolve(t, reasonCode);
  return labeled || t('mexc_blocked_generic_reason');
}

/**
 * Concise per-capability status for consumer detail rows (product mode).
 * Never returns raw capability codes or backend English prose.
 */
export function getCapabilityConsumerStatusLabel(
  capabilityId: string,
  cap:
    | {
        capabilityId?: string;
        providerSupport?: string | null;
        keyGrant?: string | null;
        verificationState?: string | null;
        operationalState?: string | null;
        blockedReason?: string | null;
      }
    | null
    | undefined,
  t: TranslateFn,
): string {
  if (capabilityId === 'PRIVATE_AUTH') {
    const verified =
      cap?.verificationState === 'verified' ||
      cap?.operationalState === 'enabled' ||
      String(cap?.operationalState || '').includes('authenticated');
    return verified ? t('mexc_cap_status_verified') : t('mexc_cap_status_not_verified');
  }

  if (!cap) return t('mexc_cap_status_awaiting_private');

  const op = String(cap.operationalState || '').toLowerCase();
  const verification = String(cap.verificationState || '').toLowerCase();
  const provider = String(cap.providerSupport || '').toLowerCase();

  if (op === 'enabled' || verification === 'verified' || verification === 'available') {
    return t('mexc_status_available');
  }
  if (provider === 'unknown' || provider === 'unsupported') {
    return t('mexc_cap_status_provider_unverified');
  }
  if (
    op.includes('blocked_by_runtime') ||
    op.includes('blocked_tier4') ||
    verification === 'not_safely_testable'
  ) {
    return t('mexc_cap_status_runtime_blocked');
  }
  if (verification === 'not_tested' || op === 'disabled' || op.includes('pending')) {
    return t('mexc_cap_status_awaiting_private');
  }
  return t('mexc_cap_status_awaiting_private');
}

/** @deprecated Prefer getAuthStateLabel */
export function translateAuthState(value: string | null | undefined, t: TranslateFn): string {
  return getAuthStateLabel(value, t);
}

/** @deprecated Prefer getOperationalStateLabel */
export function translateOperationalState(value: string | null | undefined, t: TranslateFn): string {
  return getOperationalStateLabel(value, t);
}

/** @deprecated Prefer getProviderSupportLabel */
export function translateProviderSupport(value: string | null | undefined, t: TranslateFn): string {
  return getProviderSupportLabel(value, t);
}

/** @deprecated Prefer getVerificationLabel */
export function translateVerificationState(value: string | null | undefined, t: TranslateFn): string {
  return getVerificationLabel(value, t);
}

/** @deprecated Prefer getConsumerLabel */
export function translateConsumerName(consumerId: string, displayName: string, t: TranslateFn): string {
  return getConsumerLabel(consumerId, displayName, t);
}

/** Legacy English blocked-reason text → product copy (prefer reasonKind path) */
export function translateBlockedReason(
  reason: string | null | undefined,
  t: TranslateFn,
  technical = false,
): string {
  if (!reason) return '';
  if (reason === 'NOT REGISTERED — NOT ELIGIBLE') return t('mexc_not_registered');
  if (/Tier-4|runtime gates/i.test(reason)) return t('mexc_reason_runtime_tier4');
  if (/PROVIDER SUPPORT NOT VERIFIED|provider unknown/i.test(reason)) {
    if (/ACCOUNT_EDIT|no verified official/i.test(reason)) return t('mexc_reason_account_use_case_unknown');
    return t('mexc_reason_provider_unknown');
  }
  if (/maintenance|temporarily unavailable/i.test(reason)) return t('mexc_reason_provider_maintenance');
  if (/private.*verif|not verified|unverified/i.test(reason)) return t('mexc_reason_auth_pending');
  if (/Required capabilities not operational/i.test(reason)) return t('mexc_blocked_capabilities_reason');
  if (technical) return reason;
  const segments = reason.split(';').map((s) => s.trim()).filter(Boolean);
  if (segments.length <= 1) {
    if (/missing from matrix/i.test(segments[0] || reason)) return t('mexc_blocked_matrix_reason');
    return t('mexc_blocked_generic_reason');
  }
  return t('mexc_blocked_multiple_reason');
}

/** Known English product sentences that must not appear in Persian DOM */
export const FORBIDDEN_ENGLISH_PRODUCT_PHRASES = [
  'Spot public market data',
  'Futures public market data',
  'Test Connection',
  'MEXC details',
  'Market Data Agents',
  'Account edit',
  'P2P read',
  'P2P execute',
  'Private authentication has not been verified',
  'Official provider API support has not been verified',
  'Financial execution is disabled in the current runtime',
  'Required:',
  'Not verified — private capability',
  'Spot Test New Order',
] as const;

export const CANONICAL_CAPABILITY_CODE_PATTERN =
  /\b(MARKET_DATA_SPOT_PUBLIC|MARKET_DATA_FUTURES_PUBLIC|PRIVATE_AUTH|SPOT_ACCOUNT_READ|SPOT_ORDER_READ|SPOT_TRADE_HISTORY_READ|SPOT_TRADE_TEST|SPOT_TRADE_EXECUTE|SPOT_ORDER_CANCEL|FUTURES_ACCOUNT_READ|FUTURES_POSITION_READ|FUTURES_ORDER_READ|FUTURES_TRADE_EXECUTE|FUTURES_ORDER_CANCEL|FUTURES_POSITION_SETTINGS_WRITE|WALLET_CURRENCY_READ|DEPOSIT_ADDRESS_READ|DEPOSIT_ADDRESS_GENERATE|DEPOSIT_HISTORY_READ|WITHDRAWAL_ADDRESS_READ|WITHDRAWAL_HISTORY_READ|WITHDRAWAL_EXECUTE|WITHDRAWAL_CANCEL|DUST_READ|DUST_EXECUTE|TRANSFER_READ|TRANSFER_EXECUTE|INTERNAL_TRANSFER_READ|INTERNAL_TRANSFER_EXECUTE|P2P_READ|P2P_EXECUTE|SUBACCOUNT_READ|SUBACCOUNT_MANAGE|ACCOUNT_EDIT)\b/;

export const RAW_ENUM_PATTERN =
  /\b(not_applicable|not_tested|deferred_private_non_executing_probe|disabled_pending_explicit_authorization|not_safely_testable|blocked_by_runtime|blocked_by_provider|blocked_by_provider_evidence|blocked_by_permission|blocked_by_risk|blocked_by_user)\b/;
