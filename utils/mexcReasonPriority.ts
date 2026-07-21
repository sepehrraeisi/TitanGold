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
  | 'generic';

export const MEXC_REASON_I18N: Record<MexcReasonKind, string> = {
  provider_unknown: 'mexc_reason_provider_unknown',
  provider_maintenance: 'mexc_reason_provider_maintenance',
  provider_unavailable: 'mexc_reason_provider_unavailable',
  auth_pending: 'mexc_reason_auth_pending',
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
}

export interface ConsumerLike {
  consumerId?: string;
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
  'key_unknown',
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

export function classifyCapabilityReason(cap: CapabilityLike): MexcReasonKind {
  const provider = String(cap.providerSupport || '').toLowerCase();
  const op = String(cap.operationalState || '').toLowerCase();
  const key = String(cap.keyGrant || '').toLowerCase();
  const reason = String(cap.blockedReason || '');
  const id = String(cap.capabilityId || '');
  const contract = String(cap.dataContractState || '').toLowerCase();
  const verification = String(cap.verificationState || '').toLowerCase();

  if (op === 'enabled') {
    if (id === 'WALLET_CURRENCY_READ' && (contract === 'warning' || contract === 'incompatible')) {
      return 'wallet_schema_warning';
    }
    return 'available';
  }

  if (
    verification === 'verification_error'
    || /verification could not be completed/i.test(reason)
  ) {
    return 'wallet_verification_incomplete';
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

  if (
    /Not verified|private capability remains disabled|private authentication|auth/i.test(reason)
    || op === 'disabled'
    || op === 'disabled_pending_explicit_authorization'
  ) {
    // Prefer key_unknown when grant is unknown and private
    if (key === 'unknown' && /permission|keyGrant|API key/i.test(reason)) {
      return 'key_unknown';
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
    if (/Not verified|private capability|auth/i.test(seg)) return 'auth_pending';
    if (/risk|confirmation/i.test(seg)) return 'risk_confirmation';
    if (/missing from matrix|user/i.test(seg)) return 'user_capability';
    return 'generic';
  });

  return selectBestReason(kinds);
}

export function selectCapabilityProductReason(cap: CapabilityLike): MexcReasonKind {
  return classifyCapabilityReason(cap);
}

export function selectConsumerProductReason(consumer: ConsumerLike): MexcReasonKind {
  if (consumer.registered === false) return 'generic';
  if (consumer.eligible) return 'available';

  if (
    consumer.limitedByDataContract
    || consumer.consumerReadiness === 'limited'
    || /provider records are not yet supported|ساختارهای داده/i.test(String(consumer.blockedReason || ''))
  ) {
    return 'wallet_consumer_limited';
  }

  const side = String(consumer.sideEffectClass || '');
  if (side === 'financial_write' || side === 'account_mutation') {
    // Execution consumers: prefer Tier-4 unless provider unknown dominates the text
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
  if (kind === 'auth_pending' || kind === 'key_unknown' || kind === 'wallet_verification_incomplete') return 'pending';
  return 'blocked';
}

export function translateReasonKind(kind: MexcReasonKind, t: (k: string) => string): string {
  const key = MEXC_REASON_I18N[kind] || MEXC_REASON_I18N.generic;
  const translated = t(key);
  return translated === key ? t('mexc_blocked_generic_reason') : translated;
}
