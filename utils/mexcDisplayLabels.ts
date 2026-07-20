type TranslateFn = (key: string) => string;

const AUTH_STATE_KEYS: Record<string, string> = {
  not_configured: 'mexc_auth_not_configured',
  configured_unverified: 'mexc_auth_configured_unverified',
  authenticated: 'mexc_auth_authenticated',
  authentication_failed: 'mexc_auth_failed',
};

const OPERATIONAL_STATE_KEYS: Record<string, string> = {
  enabled: 'mexc_op_enabled',
  disabled: 'mexc_op_disabled',
  disabled_pending_explicit_authorization: 'mexc_op_pending_auth',
  blocked: 'mexc_op_blocked',
  blocked_tier4: 'mexc_op_blocked_tier4',
  blocked_runtime: 'mexc_op_blocked_runtime',
  blocked_provider: 'mexc_op_blocked_provider',
  blocked_key: 'mexc_op_blocked_key',
  blocked_unverified: 'mexc_op_blocked_unverified',
};

const PROVIDER_SUPPORT_KEYS: Record<string, string> = {
  supported: 'mexc_provider_supported',
  unsupported: 'mexc_provider_unsupported',
  unknown: 'mexc_provider_unknown',
  degraded: 'mexc_provider_degraded',
};

const VERIFICATION_STATE_KEYS: Record<string, string> = {
  verified: 'mexc_verify_verified',
  unverified: 'mexc_verify_unverified',
  failed: 'mexc_verify_failed',
  pending: 'mexc_verify_pending',
  not_applicable: 'mexc_verify_na',
};

const CONSUMER_ID_KEYS: Record<string, string> = {
  portfolio: 'mexc_consumer_portfolio',
  arbitrage: 'mexc_consumer_arbitrage',
  spot_trading_read: 'mexc_consumer_spot_read',
  spot_trading_execute: 'mexc_consumer_spot_execute',
  futures_trading_read: 'mexc_consumer_futures_read',
  futures_trading_execute: 'mexc_consumer_futures_execute',
  wallet: 'mexc_consumer_wallet',
  risk_agents: 'mexc_consumer_risk',
  market_data_agents: 'mexc_consumer_market_data',
};

function translateMapped(
  value: string | null | undefined,
  map: Record<string, string>,
  t: TranslateFn,
): string {
  if (!value) return '';
  const key = map[value];
  if (key) {
    const translated = t(key);
    if (translated !== key) return translated;
  }
  return value.replace(/_/g, ' ');
}

export function translateAuthState(value: string | null | undefined, t: TranslateFn): string {
  return translateMapped(value, AUTH_STATE_KEYS, t) || t('connections_not_configured');
}

export function translateOperationalState(value: string | null | undefined, t: TranslateFn): string {
  if (!value) return t('mexc_unknown');
  if (value.startsWith('blocked_')) {
    const mapped = OPERATIONAL_STATE_KEYS[value];
    if (mapped) {
      const translated = t(mapped);
      if (translated !== mapped) return translated;
    }
    return t('mexc_op_blocked');
  }
  return translateMapped(value, OPERATIONAL_STATE_KEYS, t);
}

export function translateProviderSupport(value: string | null | undefined, t: TranslateFn): string {
  return translateMapped(value, PROVIDER_SUPPORT_KEYS, t) || t('mexc_unknown');
}

export function translateVerificationState(value: string | null | undefined, t: TranslateFn): string {
  return translateMapped(value, VERIFICATION_STATE_KEYS, t) || t('mexc_unknown');
}

export function translateConsumerName(consumerId: string, displayName: string, t: TranslateFn): string {
  const key = CONSUMER_ID_KEYS[consumerId];
  if (key) {
    const translated = t(key);
    if (translated !== key) return translated;
  }
  return displayName;
}

export function translateBlockedReason(
  reason: string | null | undefined,
  t: TranslateFn,
  technical = false,
): string {
  if (!reason) return '';
  if (reason === 'NOT REGISTERED — NOT ELIGIBLE') return t('mexc_not_registered');
  if (/Tier-4|runtime gates/i.test(reason)) return t('mexc_blocked_tier4_reason');
  if (/private.*verif|not verified|unverified/i.test(reason)) return t('mexc_blocked_unverified_reason');
  if (/Required capabilities not operational/i.test(reason)) return t('mexc_blocked_capabilities_reason');

  if (technical) return reason;

  const segments = reason.split(';').map((s) => s.trim()).filter(Boolean);
  if (segments.length <= 1) {
    const segment = segments[0] || reason;
    if (/missing from matrix/i.test(segment)) return t('mexc_blocked_matrix_reason');
    return t('mexc_blocked_generic_reason');
  }
  return t('mexc_blocked_multiple_reason');
}
