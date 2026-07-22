/**
 * Deterministic product-facing blocker reason selection for MEXC capabilities/consumers.
 * Priority (highest first):
 * 1 provider support unknown
 * 2 provider maintenance/unavailable
 * 3 private authentication not verified
 * 4 API-key permission denied/unknown
 * 5 TitanGold user capability missing
 * 6 runtime blocked (Tier-4)
 * 7 risk or confirmation blocked
 * 8 available
 */

export type MexcReasonKind =
  | 'provider_unknown'
  | 'provider_maintenance'
  | 'provider_unavailable'
  | 'auth_pending'
  | 'not_tested'
  | 'key_permission_unverified'
  | 'key_denied'
  | 'key_unknown'
  | 'user_capability'
  | 'runtime_tier4'
  | 'risk_confirmation'
  | 'available'
  | 'account_use_case_unknown'
  | 'wallet_schema_warning'
  | 'wallet_consumer_limited'
  | 'wallet_verification_incomplete'
  | 'wallet_permission_available_incomplete'
  | 'spot_trade_test_authorization'
  | 'futures_order_read_pending'
  | 'futures_read_partial'
  | 'currency_verification_attempt_incomplete'
  | 'generic';

export const MEXC_REASON_I18N: Record<MexcReasonKind, string> = {
  provider_unknown: 'mexc_reason_provider_unknown',
  provider_maintenance: 'mexc_reason_provider_maintenance',
  provider_unavailable: 'mexc_reason_provider_unavailable',
  auth_pending: 'mexc_reason_auth_pending',
  not_tested: 'mexc_reason_not_tested',
  key_permission_unverified: 'mexc_reason_key_permission_unverified',
  key_denied: 'mexc_reason_key_denied',
  key_unknown: 'mexc_reason_key_unknown',
  user_capability: 'mexc_reason_user_capability',
  runtime_tier4: 'mexc_reason_runtime_tier4',
  risk_confirmation: 'mexc_reason_risk_confirmation',
  available: 'mexc_reason_available',
  account_use_case_unknown: 'mexc_reason_account_use_case_unknown',
  wallet_schema_warning: 'mexc_reason_wallet_schema_warning',
  wallet_consumer_limited: 'mexc_reason_wallet_consumer_limited',
  wallet_verification_incomplete: 'mexc_reason_wallet_verification_incomplete',
  wallet_permission_available_incomplete: 'mexc_reason_wallet_permission_available_incomplete',
  spot_trade_test_authorization: 'mexc_reason_spot_trade_test_authorization',
  futures_order_read_pending: 'mexc_reason_futures_order_read_pending',
  futures_read_partial: 'mexc_reason_futures_read_partial',
  currency_verification_attempt_incomplete: 'mexc_currency_verification_attempt_incomplete',
  generic: 'mexc_blocked_generic_reason',
};

export interface CapabilityLike {
  capabilityId?: string;
  providerSupport?: string | null;
  keyGrant?: string | null;
  verificationState?: string | null;
  operationalState?: string | null;
  blockedReason?: string | null;
  sideEffect?: string | null;
  rwClass?: string | null;
  dataContractState?: string | null;
  dataContractWarningCode?: string | null;
  sanitizedDataContractReason?: string | null;
  consumerReadiness?: string | null;
  privateAuthVerified?: boolean | null;
  directEndpointVerified?: boolean | null;
  keyGrantEvidence?: string | null;
}

export interface ConsumerLike {
  consumerId?: string;
  displayName?: string | null;
  eligible?: boolean;
  blockedReason?: string | null;
  sideEffectClass?: string | null;
  requiredCapabilities?: string[];
  registered?: boolean;
  consumerReadiness?: string | null;
  limitedByDataContract?: boolean;
}

const PRIORITY: MexcReasonKind[] = [
  'provider_unknown',
  'provider_maintenance',
  'provider_unavailable',
  'account_use_case_unknown',
  'auth_pending',
  'key_denied',
  'key_permission_unverified',
  'not_tested',
  'futures_order_read_pending',
  'futures_read_partial',
  'spot_trade_test_authorization',
  'key_unknown',
  'wallet_permission_available_incomplete',
  'wallet_verification_incomplete',
  'currency_verification_attempt_incomplete',
  'wallet_schema_warning',
  'wallet_consumer_limited',
  'user_capability',
  'runtime_tier4',
  'risk_confirmation',
  'available',
  'generic',
];

function rank(kind: MexcReasonKind): number {
  const i = PRIORITY.indexOf(kind);
  return i === -1 ? PRIORITY.length : i;
}

export function selectBestReason(kinds: MexcReasonKind[]): MexcReasonKind {
  if (!kinds.length) return 'generic';
  return kinds.slice().sort((a, b) => rank(a) - rank(b))[0];
}

function isVerifiedCap(cap: CapabilityLike | null | undefined): boolean {
  if (!cap) return false;
  return cap.verificationState === 'verified' || cap.operationalState === 'enabled';
}

function resolveCapabilityReasonForId(cap: CapabilityLike): MexcReasonKind {
  const id = String(cap.capabilityId || '');
  if (id === 'SPOT_TRADE_TEST') {
    return 'spot_trade_test_authorization';
  }
  if (id === 'FUTURES_ORDER_READ') {
    const base = classifyCapabilityReason(cap);
    if (base === 'not_tested' || base === 'key_permission_unverified' || base === 'key_unknown' || base === 'auth_pending') {
      return 'futures_order_read_pending';
    }
  }
  return classifyCapabilityReason(cap);
}

export function classifyCapabilityReason(cap: CapabilityLike): MexcReasonKind {
  const provider = String(cap.providerSupport || '').toLowerCase();
  const op = String(cap.operationalState || '').toLowerCase();
  const key = String(cap.keyGrant || '').toLowerCase();
  const reason = String(cap.blockedReason || '');
  const id = String(cap.capabilityId || '');
  const contract = String(cap.dataContractState || '').toLowerCase();
  const verification = String(cap.verificationState || '').toLowerCase();
  const authVerified = cap.privateAuthVerified === true;

  if (id === 'SPOT_TRADE_TEST') {
    return 'spot_trade_test_authorization';
  }

  if (op === 'enabled') {
    if (id === 'WALLET_CURRENCY_READ' && (contract === 'warning' || contract === 'incompatible')) {
      return 'wallet_schema_warning';
    }
    return 'available';
  }

  if (
    id === 'WALLET_CURRENCY_READ'
    && key === 'granted'
    && (verification === 'verification_error' || cap.directEndpointVerified === false)
  ) {
    return 'wallet_permission_available_incomplete';
  }

  if (
    verification === 'verification_error'
    || /verification could not be completed/i.test(reason)
  ) {
    return 'wallet_verification_incomplete';
  }

  if (verification === 'not_tested' || /^Not yet tested$/i.test(reason)) {
    if (id === 'FUTURES_ORDER_READ') return 'futures_order_read_pending';
    if (!authVerified && /Private authentication has not been verified/i.test(reason)) {
      return 'auth_pending';
    }
    if (authVerified || /Required API-key permission has not yet been verified/i.test(reason)) {
      if (key === 'unknown' || /Required API-key permission has not yet been verified/i.test(reason)) {
        return 'key_permission_unverified';
      }
      return 'not_tested';
    }
    if (/Private authentication has not been verified/i.test(reason)) {
      return 'auth_pending';
    }
    return authVerified ? 'not_tested' : 'auth_pending';
  }

  if (provider === 'unknown' || /PROVIDER SUPPORT NOT VERIFIED/i.test(reason)) {
    if (id === 'ACCOUNT_EDIT' || /ACCOUNT_EDIT|no verified official/i.test(reason)) {
      return 'account_use_case_unknown';
    }
    return 'provider_unknown';
  }

  if (provider === 'maintenance' || /maintenance|temporarily unavailable/i.test(reason)) {
    return 'provider_maintenance';
  }

  if (provider === 'unsupported' || /Provider unsupported/i.test(reason)) {
    return 'provider_unavailable';
  }

  if (/Tier-4|runtime|Live side effects|Demo \/ Kill Switch/i.test(reason) || op.includes('runtime')) {
    return 'runtime_tier4';
  }

  if (/risk|confirmation/i.test(reason)) {
    return 'risk_confirmation';
  }

  if (key === 'denied' || /permission denied/i.test(reason)) {
    return 'key_denied';
  }

  if (/Required API-key permission has not yet been verified/i.test(reason)) {
    return 'key_permission_unverified';
  }

  if (/Not yet tested/i.test(reason)) {
    return id === 'FUTURES_ORDER_READ' ? 'futures_order_read_pending' : 'not_tested';
  }

  if (
    /Private authentication has not been verified/i.test(reason)
  ) {
    return 'auth_pending';
  }

  if (
    /Not verified|private capability remains disabled|private authentication|auth/i.test(reason)
    || op === 'disabled'
    || op === 'disabled_pending_explicit_authorization'
  ) {
    if (id === 'SPOT_TRADE_TEST' || op === 'disabled_pending_explicit_authorization') {
      return 'spot_trade_test_authorization';
    }
    if (key === 'unknown' && /permission|keyGrant|API key/i.test(reason)) {
      return 'key_unknown';
    }
    if (authVerified) {
      return key === 'unknown' ? 'key_permission_unverified' : 'not_tested';
    }
    if (provider === 'supported' || !provider) {
      return 'auth_pending';
    }
  }

  if (key === 'unknown') return 'key_unknown';

  if (/Disabled by user|user capability/i.test(reason)) return 'user_capability';

  if (reason) return 'generic';
  return 'generic';
}

export function classifyFromBlockedReasonText(reason: string | null | undefined): MexcReasonKind {
  if (!reason) return 'generic';
  if (reason === 'NOT REGISTERED — NOT ELIGIBLE') return 'generic';

  const segments = reason.split(';').map((s) => s.trim()).filter(Boolean);
  const kinds: MexcReasonKind[] = segments.map((seg) => {
    if (/provider unknown|PROVIDER SUPPORT NOT VERIFIED/i.test(seg)) {
      if (/ACCOUNT_EDIT|no verified official/i.test(seg)) return 'account_use_case_unknown';
      return 'provider_unknown';
    }
    if (/maintenance|temporarily unavailable/i.test(seg)) return 'provider_maintenance';
    if (/Provider unsupported|provider unsupported/i.test(seg)) return 'provider_unavailable';
    if (/Tier-4|runtime gates|Live side effects/i.test(seg)) return 'runtime_tier4';
    if (/permission denied/i.test(seg)) return 'key_denied';
    if (/keyGrant unknown|API key.*unknown/i.test(seg)) return 'key_unknown';
    if (/FUTURES_ORDER_READ|order-read access has not yet been tested/i.test(seg)) {
      return 'futures_order_read_pending';
    }
    if (/Required API permission is available|permission domain is granted|direct currency-configuration/i.test(seg)) {
      return 'wallet_consumer_limited';
    }
    if (/Not verified|private capability|auth/i.test(seg)) return 'auth_pending';
    if (/risk|confirmation/i.test(seg)) return 'risk_confirmation';
    if (/missing from matrix|user/i.test(seg)) return 'user_capability';
    return 'generic';
  });

  return selectBestReason(kinds);
}

export function selectCapabilityProductReason(cap: CapabilityLike): MexcReasonKind {
  return resolveCapabilityReasonForId(cap);
}

/**
 * Group summary reason from the highest-priority unresolved capability in the group.
 * Prefer pending/incomplete capabilities over blocked/unavailable execute gates so
 * group copy reflects the next useful verification gap (e.g. FUTURES_ORDER_READ).
 */
export function selectGroupProductReason(caps: CapabilityLike[]): MexcReasonKind | null {
  const unresolved = (caps || []).filter((cap) => productStatusFromCapability(cap) !== 'available');
  if (!unresolved.length) return null;

  const pending = unresolved.filter((cap) => productStatusFromCapability(cap) === 'pending');
  const pool = pending.length ? pending : unresolved;

  const ranked = pool.slice().sort((a, b) => {
    const ra = rank(selectCapabilityProductReason(a));
    const rb = rank(selectCapabilityProductReason(b));
    if (ra !== rb) return ra - rb;
    return String(a.capabilityId || '').localeCompare(String(b.capabilityId || ''));
  });

  return selectCapabilityProductReason(ranked[0]);
}

function lookupCap(
  capabilityById: Map<string, CapabilityLike> | Record<string, CapabilityLike> | undefined,
  id: string,
): CapabilityLike | undefined {
  if (!capabilityById) return undefined;
  if (capabilityById instanceof Map) return capabilityById.get(id);
  return capabilityById[id];
}

export function selectConsumerProductReason(
  consumer: ConsumerLike,
  capabilityById?: Map<string, CapabilityLike> | Record<string, CapabilityLike>,
): MexcReasonKind {
  if (consumer.registered === false) return 'generic';
  if (consumer.eligible && consumer.consumerReadiness !== 'limited') return 'available';

  if (
    consumer.limitedByDataContract
    || consumer.consumerReadiness === 'limited'
    || /provider records are not yet supported|ساختارهای داده|currency configuration is incomplete|پیکربندی نرمال|Required API permission is available|مجوز موردنیاز API/i.test(String(consumer.blockedReason || ''))
  ) {
    return 'wallet_consumer_limited';
  }

  const consumerId = String(consumer.consumerId || '');
  const isFuturesRead = consumerId === 'futures_trading_read'
    || /Futures Trading \(read\)|Futures Trading — Read/i.test(String(consumer.displayName || ''));

  if (isFuturesRead) {
    const account = lookupCap(capabilityById, 'FUTURES_ACCOUNT_READ');
    const position = lookupCap(capabilityById, 'FUTURES_POSITION_READ');
    const orderRead = lookupCap(capabilityById, 'FUTURES_ORDER_READ');
    const orderPending = !orderRead
      || productStatusFromCapability(orderRead) !== 'available'
      || orderRead.verificationState === 'not_tested';
    if (isVerifiedCap(account) && isVerifiedCap(position) && orderPending) {
      return 'futures_read_partial';
    }
    if (orderPending) return 'futures_order_read_pending';
  }

  // Read-only consumers: never prefer runtime/Live/Kill Switch wording
  const side = String(consumer.sideEffectClass || '');
  if (side === 'read_only' || side === 'none') {
    const required = consumer.requiredCapabilities || [];
    const unresolvedRequired = required
      .map((id) => lookupCap(capabilityById, id))
      .filter((cap): cap is CapabilityLike => Boolean(cap) && productStatusFromCapability(cap) !== 'available');
    if (unresolvedRequired.length) {
      return selectGroupProductReason(unresolvedRequired) || classifyFromBlockedReasonText(consumer.blockedReason);
    }
    const fromText = classifyFromBlockedReasonText(consumer.blockedReason);
    if (fromText === 'runtime_tier4') {
      return 'not_tested';
    }
    return fromText;
  }

  if (side === 'financial_write' || side === 'account_mutation') {
    const fromText = classifyFromBlockedReasonText(consumer.blockedReason);
    if (fromText === 'provider_unknown' || fromText === 'provider_maintenance' || fromText === 'account_use_case_unknown') {
      return fromText;
    }
    return 'runtime_tier4';
  }

  return classifyFromBlockedReasonText(consumer.blockedReason);
}

export function productStatusFromCapability(cap: CapabilityLike): 'available' | 'pending' | 'blocked' | 'unavailable' {
  const kind = classifyCapabilityReason(cap);
  if (kind === 'available' || kind === 'wallet_schema_warning') return 'available';
  if (kind === 'provider_unknown' || kind === 'provider_unavailable' || kind === 'account_use_case_unknown') {
    return 'unavailable';
  }
  if (
    kind === 'auth_pending'
    || kind === 'key_unknown'
    || kind === 'key_permission_unverified'
    || kind === 'not_tested'
    || kind === 'wallet_verification_incomplete'
    || kind === 'wallet_permission_available_incomplete'
    || kind === 'futures_order_read_pending'
    || kind === 'futures_read_partial'
    || kind === 'spot_trade_test_authorization'
    || kind === 'currency_verification_attempt_incomplete'
  ) {
    return 'pending';
  }
  return 'blocked';
}

export function translateReasonKind(kind: MexcReasonKind, t: (k: string) => string): string {
  const key = MEXC_REASON_I18N[kind] || MEXC_REASON_I18N.generic;
  const translated = t(key);
  return translated === key ? t('mexc_blocked_generic_reason') : translated;
}

/** Deterministic Used-by labels from canonical consumer list with optional collapse. */
export function formatUsedBySummary(
  consumers: Array<{ consumerId?: string; displayName?: string | null }>,
  t: (k: string) => string,
  getLabel: (consumerId: string, displayName: string | undefined, t: (k: string) => string) => string,
  maxVisible = 8,
): { labelKey: string; text: string; total: number } {
  const labels = (consumers || []).map((c) => getLabel(String(c.consumerId || ''), c.displayName || undefined, t));
  const unique = labels.filter(Boolean);
  if (unique.length <= maxVisible) {
    return { labelKey: 'mexc_used_by', text: unique.join(' · '), total: unique.length };
  }
  const shown = unique.slice(0, maxVisible);
  const more = unique.length - shown.length;
  const moreLabel = t('mexc_used_by_more');
  const moreText = moreLabel === 'mexc_used_by_more' ? `+${more} more` : `+${more} ${moreLabel}`;
  return {
    labelKey: 'mexc_used_by',
    text: `${shown.join(' · ')} · ${moreText}`,
    total: unique.length,
  };
}
