/**
 * TECP-OPS-PILOT-001 S2 — operational emergency-stop control.
 *
 * Process-local sticky stop. NON_OPERATIONAL for Gate B.
 * No Worker or MCP side effects. Untrusted reset is denied.
 */

export const EMERGENCY_STOP_PROOF_CLASS = 'PROCESS_LOCAL_EMERGENCY_STOP_NON_OPERATIONAL';
export const EMERGENCY_STOP_DEFAULT_TTL_MS = 24 * 60 * 60 * 1000;

export const EMERGENCY_STOP_DECISIONS = Object.freeze({
  ALLOW: 'ALLOW',
  DENY_ACTIVE: 'DENY_ACTIVE',
  DENY_UNTRUSTED_RESET: 'DENY_UNTRUSTED_RESET',
  DENY_MALFORMED: 'DENY_MALFORMED',
  DENY_MISSING_CLOCK: 'DENY_MISSING_CLOCK',
  DENY_DEFAULT_FAIL_CLOSED: 'DENY_DEFAULT_FAIL_CLOSED',
});

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isSafeInteger(value) {
  return typeof value === 'number' && Number.isSafeInteger(value);
}

function deny(decision, reasons = [], extra = {}) {
  return Object.freeze({
    ok: false,
    allowed: false,
    decision,
    reasons: Object.freeze([...reasons]),
    classification: EMERGENCY_STOP_PROOF_CLASS,
    ...extra,
  });
}

function allow(reasons = [], extra = {}) {
  return Object.freeze({
    ok: true,
    allowed: true,
    decision: EMERGENCY_STOP_DECISIONS.ALLOW,
    reasons: Object.freeze([...reasons]),
    classification: EMERGENCY_STOP_PROOF_CLASS,
    ...extra,
  });
}

/**
 * Create a process-local emergency stop controller.
 * Default posture is fail-closed only after explicit activation OR when
 * constructed with defaultDeny=true.
 */
export function createOperationalEmergencyStop(options = {}) {
  if (!isPlainObject(options)) throw new TypeError('OPTIONS_OBJECT_REQUIRED');

  let active = options.defaultDeny === true;
  let activatedAt = null;
  let expiresAt = null;
  let reason = null;
  const ttlMs = isSafeInteger(options.ttlMs) && options.ttlMs > 0
    ? options.ttlMs
    : EMERGENCY_STOP_DEFAULT_TTL_MS;
  const clock = options.clock && typeof options.clock.nowMs === 'function'
    ? options.clock
    : Object.freeze({ nowMs: () => Date.now() });

  function refreshExpired() {
    if (!active || expiresAt == null) return;
    let now;
    try {
      now = clock.nowMs();
    } catch {
      // fail closed: treat as still active if clock fails while armed
      return;
    }
    if (isSafeInteger(now) && now >= expiresAt) {
      active = false;
      activatedAt = null;
      expiresAt = null;
      reason = null;
    }
  }

  return Object.freeze({
    kind: 'OPERATIONAL_EMERGENCY_STOP',
    proofClass: EMERGENCY_STOP_PROOF_CLASS,
    processLocal: true,
    workerSideEffects: false,
    mcpSideEffects: false,

    activate(input = {}) {
      if (!isPlainObject(input)) {
        return deny(EMERGENCY_STOP_DECISIONS.DENY_MALFORMED, ['ACTIVATE_OBJECT_REQUIRED']);
      }
      let now;
      try {
        now = clock.nowMs();
      } catch {
        return deny(EMERGENCY_STOP_DECISIONS.DENY_MISSING_CLOCK, ['CLOCK_UNAVAILABLE']);
      }
      if (!isSafeInteger(now) || now < 0) {
        return deny(EMERGENCY_STOP_DECISIONS.DENY_MISSING_CLOCK, ['CLOCK_INVALID']);
      }
      const lifetime = isSafeInteger(input.ttlMs) && input.ttlMs > 0 ? input.ttlMs : ttlMs;
      active = true;
      activatedAt = now;
      expiresAt = now + lifetime;
      reason = typeof input.reason === 'string' ? input.reason : 'EMERGENCY_STOP_ACTIVATED';
      return allow(['EMERGENCY_STOP_ACTIVATED_STICKY'], {
        activatedAt,
        expiresAt,
        reason,
        sticky: true,
      });
    },

    isStopped() {
      refreshExpired();
      if (active) {
        return deny(EMERGENCY_STOP_DECISIONS.DENY_ACTIVE, ['EMERGENCY_STOP_ACTIVE'], {
          activatedAt,
          expiresAt,
          reason,
          sticky: true,
        });
      }
      return allow(['EMERGENCY_STOP_INACTIVE'], {
        activatedAt: null,
        expiresAt: null,
        sticky: false,
      });
    },

    assertNotStopped() {
      const state = this.isStopped();
      if (!state.ok) return state;
      return allow(['EMERGENCY_STOP_CLEAR']);
    },

    /**
     * Untrusted reset attempts are always denied. There is no Gate B path that
     * grants Worker/MCP/caller reset authority.
     */
    attemptReset(request = {}) {
      if (!isPlainObject(request)) {
        return deny(EMERGENCY_STOP_DECISIONS.DENY_MALFORMED, ['RESET_OBJECT_REQUIRED']);
      }
      return deny(EMERGENCY_STOP_DECISIONS.DENY_UNTRUSTED_RESET, [
        'UNTRUSTED_RESET_FORBIDDEN',
        'NO_WORKER_OR_MCP_RESET_AUTHORITY',
      ], {
        stillActive: active === true,
      });
    },

    snapshot() {
      refreshExpired();
      return Object.freeze({
        active,
        activatedAt,
        expiresAt,
        reason,
        processLocal: true,
        proofClass: EMERGENCY_STOP_PROOF_CLASS,
      });
    },
  });
}
