/**
 * TECP-DLP-008 D1 — sealed authenticated write gateway (TEST_ONLY / NON_OPERATIONAL).
 *
 * Architecture Option D / D1 Dual-Session:
 * - RESTRICTED_CALLER_ROLE: no protected DML (proven via disposable SQL + tests).
 * - TRUSTED_WRITER_ROLE: separate PostgreSQL session held privately by this gateway.
 *
 * Reuses frozen DLP-007 createAuthenticatedTaskClaimLeaseAuditAdapter by import only.
 * Does not duplicate lease/capability/authz/transaction business rules.
 *
 * LOCAL_SOCKET_TRUST_ROLE_IMPERSONATION remains NOT_SEALED / TEST_ONLY_RESIDUAL.
 * Privileged factory construction is a TEST_ONLY trust root (R5 class).
 * Public DLP-001..004 JS exports remain exported; restricted-role DML is denied
 * by PostgreSQL privileges, not by deleting those exports.
 */

import {
  createAuthenticatedTaskClaimLeaseAuditAdapter,
  FORBIDDEN_REQUEST_FIELDS as DLP007_FORBIDDEN_REQUEST_FIELDS,
  APPROVED_GOVERNANCE_REVISION as DLP007_GOVERNANCE_REVISION,
} from './authenticatedTaskClaimLeaseAuditAdapter.js';

export const APPROVED_GOVERNANCE_REVISION = 'DLP008_AUTHORIZATION_20261102';

export const SEALED_GATEWAY_KIND = 'TEST_ONLY_SEALED_AUTHENTICATED_WRITE_GATEWAY';

export const SEALED_GATEWAY_DECISIONS = Object.freeze({
  ALLOW: 'ALLOW',
  DENY_INVALID_INPUT: 'DENY_INVALID_INPUT',
  DENY_UNTRUSTED_REQUEST_FIELD: 'DENY_UNTRUSTED_REQUEST_FIELD',
  DENY_WRITER_DEPENDENCY_INJECTION: 'DENY_WRITER_DEPENDENCY_INJECTION',
  DENY_PRIVILEGED_DEPS: 'DENY_PRIVILEGED_DEPS',
  DENY_SESSION_ATTESTATION: 'DENY_SESSION_ATTESTATION',
  /** Unexpected throw from inner adapter/execution — never rethrow raw Error to callers. */
  DENY_UNEXPECTED_EXECUTION: 'DENY_UNEXPECTED_EXECUTION',
});

/** Additional fields forbidden on untrusted sealed-gateway requests. */
export const FORBIDDEN_REQUEST_FIELDS = Object.freeze([
  ...DLP007_FORBIDDEN_REQUEST_FIELDS,
  'writerClient',
  'writer',
  'restrictedClient',
  'connectionConfig',
  'connectionString',
  'password',
  'sql',
  'rawSql',
  'query',
  'transaction',
  'txn',
  'withTransaction',
  'executeSql',
  'adapter',
  'innerAdapter',
  'gateway',
  'sessionAttestation',
]);

const ALLOWED_REQUEST_FIELDS = Object.freeze([
  'capabilityToken',
  'operationKey',
  'idempotency',
]);

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.length > 0;
}

function isPositiveSafeInt(value) {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
}

function requireClient(client) {
  if (!client || typeof client.query !== 'function') {
    throw new TypeError('PostgreSQL client with query() required');
  }
}

/**
 * Attest that a captured writer session remains the intended independent session.
 * Does not authenticate OS principals; TEST_ONLY residual for dual-session proof.
 */
export async function attestWriterSession(client, expected) {
  requireClient(client);
  if (!isPlainObject(expected)
    || !isNonEmptyString(expected.sessionUser)
    || !isNonEmptyString(expected.currentUser)
    || !isPositiveSafeInt(expected.backendPid)) {
    throw new TypeError('writer session attestation expectation invalid');
  }
  const r = await client.query(
    `SELECT
        session_user::text AS session_user,
        current_user::text AS current_user,
        pg_backend_pid()::int AS backend_pid`,
  );
  const row = r.rows[0];
  if (!row
    || row.session_user !== expected.sessionUser
    || row.current_user !== expected.currentUser
    || Number(row.backend_pid) !== expected.backendPid) {
    const err = new Error('WRITER_SESSION_ATTESTATION_FAILED');
    err.code = 'SEALED_GATEWAY_SESSION_MISMATCH';
    throw err;
  }
  return Object.freeze({
    sessionUser: row.session_user,
    currentUser: row.current_user,
    backendPid: Number(row.backend_pid),
  });
}

function gatewayResult(decision, extra = {}) {
  return Object.freeze({
    ok: false,
    decision,
    sealed: true,
    kind: SEALED_GATEWAY_KIND,
    governanceRevision: APPROVED_GOVERNANCE_REVISION,
    architecture: 'OPTION_D / D1_DUAL_SESSION',
    operational: false,
    realWorkerAuthenticated: false,
    productionSealed: false,
    localSocketTrustSealed: false,
    ...extra,
  });
}

function rejectUntrustedRequest(untrustedRequest) {
  if (!isPlainObject(untrustedRequest)) {
    return gatewayResult(SEALED_GATEWAY_DECISIONS.DENY_INVALID_INPUT, {
      reasons: Object.freeze([SEALED_GATEWAY_DECISIONS.DENY_INVALID_INPUT, 'REQUEST_NOT_OBJECT']),
    });
  }
  for (const key of Object.keys(untrustedRequest)) {
    if (FORBIDDEN_REQUEST_FIELDS.includes(key)) {
      return gatewayResult(SEALED_GATEWAY_DECISIONS.DENY_UNTRUSTED_REQUEST_FIELD, {
        reasons: Object.freeze([
          SEALED_GATEWAY_DECISIONS.DENY_UNTRUSTED_REQUEST_FIELD,
          `FORBIDDEN_FIELD:${key}`,
        ]),
      });
    }
    if (!ALLOWED_REQUEST_FIELDS.includes(key)) {
      return gatewayResult(SEALED_GATEWAY_DECISIONS.DENY_UNTRUSTED_REQUEST_FIELD, {
        reasons: Object.freeze([
          SEALED_GATEWAY_DECISIONS.DENY_UNTRUSTED_REQUEST_FIELD,
          `UNKNOWN_FIELD:${key}`,
        ]),
      });
    }
  }
  return null;
}

const SENSITIVE_KEY_RE = /client|writer|password|connection|socket|query|sql|adapter|registry|provider|reader|deps|principal|pem|private|secret|tokenRaw/i;

/**
 * Strip privileged references from nested results before returning to callers.
 * Fail closed: if a sensitive key appears, replace the subtree with a marker.
 */
function sanitizePublicResult(value, depth = 0) {
  if (depth > 12) return '[TRUNCATED]';
  if (value == null) return value;
  if (typeof value !== 'object') return value;
  if (typeof value.query === 'function' || typeof value.connect === 'function') {
    return '[REDACTED_CLIENT]';
  }
  if (Array.isArray(value)) {
    return Object.freeze(value.map((entry) => sanitizePublicResult(entry, depth + 1)));
  }
  const out = {};
  for (const [key, child] of Object.entries(value)) {
    if (SENSITIVE_KEY_RE.test(key)) {
      out[key] = '[REDACTED]';
      continue;
    }
    out[key] = sanitizePublicResult(child, depth + 1);
  }
  return Object.freeze(out);
}

function wrapInnerResult(inner) {
  if (!isPlainObject(inner)) {
    return gatewayResult(SEALED_GATEWAY_DECISIONS.DENY_INVALID_INPUT, {
      reasons: Object.freeze([SEALED_GATEWAY_DECISIONS.DENY_INVALID_INPUT, 'INNER_RESULT_INVALID']),
      rollbackConfirmed: false,
      rollbackStatus: 'UNKNOWN',
    });
  }
  const sanitized = sanitizePublicResult(inner);
  // Preserve inner ok only from the original trusted boolean; never invent success.
  const ok = inner.ok === true;
  const out = {
    ...sanitized,
    ok,
    sealed: true,
    kind: SEALED_GATEWAY_KIND,
    governanceRevision: APPROVED_GOVERNANCE_REVISION,
    architecture: 'OPTION_D / D1_DUAL_SESSION',
    operational: false,
    productionSealed: false,
    localSocketTrustSealed: false,
    dlp007GovernanceRevision: DLP007_GOVERNANCE_REVISION,
  };
  // Never upgrade unknown/failed rollback into confirmed.
  if (out.rollbackConfirmed !== true) {
    out.rollbackConfirmed = false;
  }
  if (typeof out.rollbackStatus !== 'string') {
    out.rollbackStatus = ok ? (out.rollbackStatus || undefined) : (out.rollbackStatus || 'UNKNOWN');
  }
  if (out.rollbackStatus === undefined) delete out.rollbackStatus;
  return Object.freeze(out);
}

/**
 * Stable fail-closed DENY for unexpected throws. Never includes message/stack/cause/SQL/client.
 */
function unexpectedExecutionDeny() {
  return gatewayResult(SEALED_GATEWAY_DECISIONS.DENY_UNEXPECTED_EXECUTION, {
    reasons: Object.freeze([SEALED_GATEWAY_DECISIONS.DENY_UNEXPECTED_EXECUTION]),
    rollbackConfirmed: false,
    rollbackStatus: 'UNKNOWN',
  });
}

function validatePrivilegedDeps(deps) {
  if (!isPlainObject(deps)) return 'DEPS_NOT_OBJECT';
  if (!deps.writerClient) return 'MISSING_WRITER_CLIENT';
  if (deps.client) return 'LEGACY_CLIENT_KEY_FORBIDDEN_USE_WRITER_CLIENT';
  if (!deps.writerSessionAttestation) return 'MISSING_WRITER_SESSION_ATTESTATION';
  if (typeof deps.getVerifiedPrincipal !== 'function') return 'MISSING_GET_VERIFIED_PRINCIPAL';
  if (!deps.policyProvider) return 'MISSING_POLICY_PROVIDER';
  if (!deps.capabilityDeps) return 'MISSING_CAPABILITY_DEPS';
  if (!isPlainObject(deps.operationContracts)) return 'MISSING_OPERATION_CONTRACTS';
  return null;
}

/**
 * Privileged TEST_ONLY factory. Not an isolation boundary against arbitrary
 * in-process privileged code. Untrusted execute* requests cannot rebind deps.
 *
 * @param {object} privilegedDeps
 * @param {object} privilegedDeps.writerClient independent TRUSTED_WRITER_ROLE session
 * @param {{sessionUser:string,currentUser:string,backendPid:number}} privilegedDeps.writerSessionAttestation
 * @param {function(): object} privilegedDeps.getVerifiedPrincipal
 * @param {object} privilegedDeps.policyProvider
 * @param {object} privilegedDeps.capabilityDeps
 * @param {object} privilegedDeps.operationContracts
 */
export function createSealedAuthenticatedWriteGateway(privilegedDeps) {
  const depError = validatePrivilegedDeps(privilegedDeps);
  if (depError) {
    throw new TypeError(`privileged deps invalid: ${depError}`);
  }

  const writerClient = privilegedDeps.writerClient;
  const writerSessionAttestation = Object.freeze({
    sessionUser: privilegedDeps.writerSessionAttestation.sessionUser,
    currentUser: privilegedDeps.writerSessionAttestation.currentUser,
    backendPid: privilegedDeps.writerSessionAttestation.backendPid,
  });
  requireClient(writerClient);

  // Capture DLP-007 adapter privately with the trusted writer session only.
  const innerAdapter = createAuthenticatedTaskClaimLeaseAuditAdapter({
    client: writerClient,
    getVerifiedPrincipal: privilegedDeps.getVerifiedPrincipal,
    policyProvider: privilegedDeps.policyProvider,
    capabilityDeps: privilegedDeps.capabilityDeps,
    operationContracts: Object.freeze({ ...privilegedDeps.operationContracts }),
  });

  async function executeSealedBind(untrustedRequest) {
    const rejected = rejectUntrustedRequest(untrustedRequest);
    if (rejected) return rejected;
    try {
      await attestWriterSession(writerClient, writerSessionAttestation);
    } catch {
      return gatewayResult(SEALED_GATEWAY_DECISIONS.DENY_SESSION_ATTESTATION, {
        reasons: Object.freeze([SEALED_GATEWAY_DECISIONS.DENY_SESSION_ATTESTATION]),
        rollbackConfirmed: false,
        rollbackStatus: 'UNKNOWN',
      });
    }
    try {
      const inner = await innerAdapter.executeAuthenticatedBind(untrustedRequest);
      return wrapInnerResult(inner);
    } catch {
      return unexpectedExecutionDeny();
    }
  }

  async function executeSealedRelease(untrustedRequest) {
    const rejected = rejectUntrustedRequest(untrustedRequest);
    if (rejected) return rejected;
    try {
      await attestWriterSession(writerClient, writerSessionAttestation);
    } catch {
      return gatewayResult(SEALED_GATEWAY_DECISIONS.DENY_SESSION_ATTESTATION, {
        reasons: Object.freeze([SEALED_GATEWAY_DECISIONS.DENY_SESSION_ATTESTATION]),
        rollbackConfirmed: false,
        rollbackStatus: 'UNKNOWN',
      });
    }
    try {
      const inner = await innerAdapter.executeAuthenticatedRelease(untrustedRequest);
      return wrapInnerResult(inner);
    } catch {
      return unexpectedExecutionDeny();
    }
  }

  return Object.freeze({
    kind: SEALED_GATEWAY_KIND,
    governanceRevision: APPROVED_GOVERNANCE_REVISION,
    architecture: 'OPTION_D / D1_DUAL_SESSION',
    operational: false,
    realWorkerAuthenticated: false,
    productionSealed: false,
    localSocketTrustSealed: false,
    executeSealedBind,
    executeSealedRelease,
    // Explicit non-exports: no writerClient, no innerAdapter, no SQL executor.
  });
}

export const SEALED_GATEWAY_PUBLIC_API = Object.freeze([
  'APPROVED_GOVERNANCE_REVISION',
  'SEALED_GATEWAY_KIND',
  'SEALED_GATEWAY_DECISIONS',
  'FORBIDDEN_REQUEST_FIELDS',
  'SEALED_GATEWAY_PUBLIC_API',
  'attestWriterSession',
  'createSealedAuthenticatedWriteGateway',
]);
