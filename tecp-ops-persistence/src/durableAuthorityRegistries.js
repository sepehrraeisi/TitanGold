/**
 * TECP-OPS-PILOT-001 S2 — durable authority replay/revocation registries.
 *
 * Process-local doubles are explicitly TEST_ONLY and NOT durable operational
 * protection. DB-backed registries remain disabled without authorized DB.
 */

export const DURABLE_REGISTRY_PROOF_CLASS = 'OFFLINE_TEST_ONLY_OR_DB_DISABLED';
export const DURABLE_REGISTRY_MODE = 'S2_GATE_B_NO_DB';

export const DURABLE_REGISTRY_DECISIONS = Object.freeze({
  ALLOW: 'ALLOW',
  DENY_REPLAY: 'DENY_REPLAY',
  DENY_REVOKED: 'DENY_REVOKED',
  DENY_MALFORMED: 'DENY_MALFORMED',
  DENY_DB_NOT_AUTHORIZED: 'DENY_DB_NOT_AUTHORIZED',
  DENY_DB_ERROR: 'DENY_DB_ERROR',
  DENY_UNAVAILABLE: 'DENY_UNAVAILABLE',
  DENY_DEFAULT_FAIL_CLOSED: 'DENY_DEFAULT_FAIL_CLOSED',
});

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.length > 0;
}

function deny(decision, reasons = [], extra = {}) {
  return Object.freeze({
    ok: false,
    allowed: false,
    decision,
    reasons: Object.freeze([...reasons]),
    durable: false,
    classification: DURABLE_REGISTRY_PROOF_CLASS,
    ...extra,
  });
}

function allow(reasons = [], extra = {}) {
  return Object.freeze({
    ok: true,
    allowed: true,
    decision: DURABLE_REGISTRY_DECISIONS.ALLOW,
    reasons: Object.freeze([...reasons]),
    durable: false,
    classification: DURABLE_REGISTRY_PROOF_CLASS,
    ...extra,
  });
}

/**
 * Explicit TEST_ONLY offline doubles. NOT durable operational protection.
 */
export function createOfflineTestOnlyDurableRegistryDoubles() {
  const presented = new Set();
  const revoked = new Set();
  let available = true;

  return Object.freeze({
    kind: 'OFFLINE_TEST_ONLY_DURABLE_REGISTRY_DOUBLES',
    proofClass: DURABLE_REGISTRY_PROOF_CLASS,
    durable: false,
    volatility: 'PROCESS_LOCAL_NOT_DURABLE',
    setAvailable(flag) {
      available = flag === true;
    },
    async isRevoked(jti) {
      if (!available) {
        return deny(DURABLE_REGISTRY_DECISIONS.DENY_UNAVAILABLE, ['REGISTRY_UNAVAILABLE']);
      }
      if (!isNonEmptyString(jti)) {
        return deny(DURABLE_REGISTRY_DECISIONS.DENY_MALFORMED, ['JTI_REQUIRED']);
      }
      if (revoked.has(jti)) {
        return deny(DURABLE_REGISTRY_DECISIONS.DENY_REVOKED, ['JTI_REVOKED']);
      }
      return allow(['NOT_REVOKED'], { revoked: false });
    },
    async revoke(jti, reason = 'TEST_ONLY_REVOKE') {
      if (!available) {
        return deny(DURABLE_REGISTRY_DECISIONS.DENY_UNAVAILABLE, ['REGISTRY_UNAVAILABLE']);
      }
      if (!isNonEmptyString(jti)) {
        return deny(DURABLE_REGISTRY_DECISIONS.DENY_MALFORMED, ['JTI_REQUIRED']);
      }
      revoked.add(jti);
      return allow(['REVOKED_TEST_ONLY'], { reason });
    },
    async hasPresented(jti) {
      if (!available) {
        return deny(DURABLE_REGISTRY_DECISIONS.DENY_UNAVAILABLE, ['REGISTRY_UNAVAILABLE']);
      }
      if (!isNonEmptyString(jti)) {
        return deny(DURABLE_REGISTRY_DECISIONS.DENY_MALFORMED, ['JTI_REQUIRED']);
      }
      if (presented.has(jti)) {
        return deny(DURABLE_REGISTRY_DECISIONS.DENY_REPLAY, ['JTI_ALREADY_PRESENTED']);
      }
      return allow(['NOT_PRESENTED'], { presented: false });
    },
    /**
     * Atomic-style consume for offline doubles: check-then-set in one call.
     * NOT a PostgreSQL UNIQUE proof.
     */
    async consumeJti(jti, binding = {}) {
      if (!available) {
        return deny(DURABLE_REGISTRY_DECISIONS.DENY_UNAVAILABLE, ['REGISTRY_UNAVAILABLE']);
      }
      if (!isNonEmptyString(jti)) {
        return deny(DURABLE_REGISTRY_DECISIONS.DENY_MALFORMED, ['JTI_REQUIRED']);
      }
      if (revoked.has(jti)) {
        return deny(DURABLE_REGISTRY_DECISIONS.DENY_REVOKED, ['JTI_REVOKED']);
      }
      if (presented.has(jti)) {
        return deny(DURABLE_REGISTRY_DECISIONS.DENY_REPLAY, ['JTI_REPLAY']);
      }
      presented.add(jti);
      return allow(['JTI_CONSUMED_TEST_ONLY'], {
        binding: Object.freeze({ ...(isPlainObject(binding) ? binding : {}) }),
        durable: false,
        note: 'NOT_POSTGRES_ATOMICITY_PROOF',
      });
    },
  });
}

/**
 * DB-backed durable registries — disabled without Tier-3/DB authorization.
 */
export function createDurableAuthorityRegistries(dbClient, options = {}) {
  void dbClient;
  void options;
  return Object.freeze({
    kind: 'DURABLE_AUTHORITY_REGISTRIES',
    status: 'DISABLED_WITHOUT_AUTHORIZED_DB',
    proofClass: DURABLE_REGISTRY_PROOF_CLASS,
    durable: false,
    async isRevoked() {
      return deny(DURABLE_REGISTRY_DECISIONS.DENY_DB_NOT_AUTHORIZED, [
        'CP2_DB_AUTHORIZED=NO',
        'GATE_B_FORBIDS_DB_REGISTRY',
      ]);
    },
    async revoke() {
      return deny(DURABLE_REGISTRY_DECISIONS.DENY_DB_NOT_AUTHORIZED, [
        'CP2_DB_AUTHORIZED=NO',
      ]);
    },
    async hasPresented() {
      return deny(DURABLE_REGISTRY_DECISIONS.DENY_DB_NOT_AUTHORIZED, [
        'CP2_DB_AUTHORIZED=NO',
      ]);
    },
    async consumeJti() {
      return deny(DURABLE_REGISTRY_DECISIONS.DENY_DB_NOT_AUTHORIZED, [
        'CP2_DB_AUTHORIZED=NO',
        'NO_ATOMIC_JTI_WITHOUT_DB',
      ]);
    },
  });
}

/**
 * Fail-closed helper when a registry dependency throws / returns soft deny.
 */
export function interpretRegistryResult(result, fallbackDecision = DURABLE_REGISTRY_DECISIONS.DENY_DB_ERROR) {
  if (!isPlainObject(result)) {
    return deny(fallbackDecision, ['REGISTRY_RESULT_MALFORMED']);
  }
  if (result.ok === true) return result;
  return deny(result.decision || fallbackDecision, result.reasons || ['REGISTRY_DENY']);
}
