/**
 * Safe MEXC / Connections error and health categories.
 * One failed capability must not mark unrelated capabilities failed.
 */

export const MEXC_HEALTH_CATEGORY = Object.freeze({
  AUTHENTICATION: 'authentication',
  SIGNATURE: 'signature',
  TIMESTAMP: 'timestamp',
  PERMISSION: 'permission',
  IP_RESTRICTION: 'ip_restriction',
  REGION_RESTRICTION: 'region_restriction',
  KYC_REQUIREMENT: 'kyc_requirement',
  ACCOUNT_RESTRICTION: 'account_restriction',
  PROVIDER_MAINTENANCE: 'provider_maintenance',
  RATE_LIMIT: 'rate_limit',
  TIMEOUT: 'timeout',
  NETWORK: 'network',
  INVALID_RESPONSE: 'invalid_response',
  DISABLED_CAPABILITY: 'disabled_capability',
  RUNTIME_BLOCKED: 'runtime_blocked',
  RISK_BLOCKED: 'risk_blocked',
  EMERGENCY_STOP: 'emergency_stop',
  LIVE_UNAVAILABLE: 'live_unavailable',
});

const CATALOG = Object.freeze({
  [MEXC_HEALTH_CATEGORY.AUTHENTICATION]: {
    userMeaning: 'Private authentication failed',
    retryable: false,
    correctiveAction: 'Re-enter API credentials and retry verification after authorization',
    auditCategory: 'auth',
    severity: 'high',
  },
  [MEXC_HEALTH_CATEGORY.SIGNATURE]: {
    userMeaning: 'Request signature was rejected',
    retryable: false,
    correctiveAction: 'Rotate credentials; ensure server clock and signing are correct',
    auditCategory: 'auth',
    severity: 'high',
  },
  [MEXC_HEALTH_CATEGORY.TIMESTAMP]: {
    userMeaning: 'Request timestamp was outside the allowed window',
    retryable: true,
    correctiveAction: 'Synchronize server time and retry',
    auditCategory: 'auth',
    severity: 'medium',
  },
  [MEXC_HEALTH_CATEGORY.PERMISSION]: {
    userMeaning: 'API key lacks the required provider permission',
    retryable: false,
    correctiveAction: 'Enable the required permission on the MEXC API key',
    auditCategory: 'permission',
    severity: 'high',
  },
  [MEXC_HEALTH_CATEGORY.IP_RESTRICTION]: {
    userMeaning: 'Provider rejected the request due to IP restriction',
    retryable: false,
    correctiveAction: 'Allowlist TitanGold egress IPs on the MEXC API key',
    auditCategory: 'permission',
    severity: 'high',
  },
  [MEXC_HEALTH_CATEGORY.REGION_RESTRICTION]: {
    userMeaning: 'Provider restricted access for this region',
    retryable: false,
    correctiveAction: 'Review account region eligibility with MEXC',
    auditCategory: 'provider',
    severity: 'high',
  },
  [MEXC_HEALTH_CATEGORY.KYC_REQUIREMENT]: {
    userMeaning: 'Additional KYC is required for this capability',
    retryable: false,
    correctiveAction: 'Complete KYC on the MEXC account',
    auditCategory: 'account',
    severity: 'medium',
  },
  [MEXC_HEALTH_CATEGORY.ACCOUNT_RESTRICTION]: {
    userMeaning: 'The exchange account is restricted',
    retryable: false,
    correctiveAction: 'Resolve account restriction with MEXC support',
    auditCategory: 'account',
    severity: 'high',
  },
  [MEXC_HEALTH_CATEGORY.PROVIDER_MAINTENANCE]: {
    userMeaning: 'Provider reports this capability as under maintenance',
    retryable: true,
    correctiveAction: 'Wait for provider maintenance to end; do not claim operational availability',
    auditCategory: 'provider',
    severity: 'medium',
  },
  [MEXC_HEALTH_CATEGORY.RATE_LIMIT]: {
    userMeaning: 'Provider rate limit reached',
    retryable: true,
    correctiveAction: 'Reduce request rate and retry later',
    auditCategory: 'provider',
    severity: 'medium',
  },
  [MEXC_HEALTH_CATEGORY.TIMEOUT]: {
    userMeaning: 'Provider request timed out',
    retryable: true,
    correctiveAction: 'Retry later; check network path to MEXC',
    auditCategory: 'network',
    severity: 'medium',
  },
  [MEXC_HEALTH_CATEGORY.NETWORK]: {
    userMeaning: 'Network error talking to the provider',
    retryable: true,
    correctiveAction: 'Retry later',
    auditCategory: 'network',
    severity: 'medium',
  },
  [MEXC_HEALTH_CATEGORY.INVALID_RESPONSE]: {
    userMeaning: 'Provider returned an unexpected response',
    retryable: true,
    correctiveAction: 'Retry later; contact support if persistent',
    auditCategory: 'provider',
    severity: 'medium',
  },
  [MEXC_HEALTH_CATEGORY.DISABLED_CAPABILITY]: {
    userMeaning: 'This capability is disabled in TitanGold',
    retryable: false,
    correctiveAction: 'No action — capability remains disabled until authorized',
    auditCategory: 'policy',
    severity: 'low',
  },
  [MEXC_HEALTH_CATEGORY.RUNTIME_BLOCKED]: {
    userMeaning: 'Runtime policy blocked this operation',
    retryable: false,
    correctiveAction: 'Operation remains blocked while Demo mode or policy gates apply',
    auditCategory: 'runtime',
    severity: 'high',
  },
  [MEXC_HEALTH_CATEGORY.RISK_BLOCKED]: {
    userMeaning: 'Risk rules blocked this operation',
    retryable: false,
    correctiveAction: 'Review risk settings with an authorized operator',
    auditCategory: 'risk',
    severity: 'high',
  },
  [MEXC_HEALTH_CATEGORY.EMERGENCY_STOP]: {
    userMeaning: 'Emergency Stop is active',
    retryable: false,
    correctiveAction: 'Clear Emergency Stop only through the authorized runtime control path',
    auditCategory: 'runtime',
    severity: 'critical',
  },
  [MEXC_HEALTH_CATEGORY.LIVE_UNAVAILABLE]: {
    userMeaning: 'Live side effects are unavailable',
    retryable: false,
    correctiveAction: 'Live execution is not enabled for this environment',
    auditCategory: 'runtime',
    severity: 'high',
  },
});

export function describeHealthCategory(category, { affectedCapability = null } = {}) {
  const base = CATALOG[category] || {
    userMeaning: 'An unexpected connection error occurred',
    retryable: false,
    correctiveAction: 'Retry later or contact support',
    auditCategory: 'unknown',
    severity: 'medium',
  };
  return {
    category,
    ...base,
    affectedCapability,
  };
}

export function mapProviderCodeToHealthCategory(normalizedCode) {
  const code = String(normalizedCode || '');
  if (code.includes('PERMISSION') || code.includes('700007')) return MEXC_HEALTH_CATEGORY.PERMISSION;
  if (code.includes('IP') || code.includes('700006')) return MEXC_HEALTH_CATEGORY.IP_RESTRICTION;
  if (code.includes('SIGNATURE') || code.includes('700005')) return MEXC_HEALTH_CATEGORY.SIGNATURE;
  if (code.includes('TIMESTAMP') || code.includes('700003') || code.includes('700002')) return MEXC_HEALTH_CATEGORY.TIMESTAMP;
  if (code.includes('RATE') || code.includes('429')) return MEXC_HEALTH_CATEGORY.RATE_LIMIT;
  if (code.includes('TIMEOUT')) return MEXC_HEALTH_CATEGORY.TIMEOUT;
  if (code.includes('NETWORK')) return MEXC_HEALTH_CATEGORY.NETWORK;
  if (code.includes('MAINTENANCE') || code.includes('503')) return MEXC_HEALTH_CATEGORY.PROVIDER_MAINTENANCE;
  if (code.includes('AUTH') || code.includes('700001')) return MEXC_HEALTH_CATEGORY.AUTHENTICATION;
  return MEXC_HEALTH_CATEGORY.INVALID_RESPONSE;
}
