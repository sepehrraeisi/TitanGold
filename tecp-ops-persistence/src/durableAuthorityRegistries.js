/**
 * TECP-OPS-PILOT-001 S2 Gate C+D — durable authority replay/revocation registries.
 *
 * TEST_ONLY process-local doubles remain non-durable.
 * DB-backed registries use fixed parameterized SQL templates only.
 * Caller-supplied SQL / callbacks / client factories are refused.
 * Durable atomicity is NOT proven until Tier-3 disposable PostgreSQL runs.
 */

export const DURABLE_REGISTRY_PROOF_CLASS = 'SQL_BACKED_OR_TEST_ONLY_NOT_OPERATIONAL';
export const DURABLE_REGISTRY_MODE = 'S2_GATE_CD_SQL_IMPLEMENTED_DEFAULT_DENY_WITHOUT_OWNED_TXN';

export const DURABLE_REGISTRY_DECISIONS = Object.freeze({
  ALLOW: 'ALLOW',
  DENY_REPLAY: 'DENY_REPLAY',
  DENY_REVOKED: 'DENY_REVOKED',
  DENY_MALFORMED: 'DENY_MALFORMED',
  DENY_DB_NOT_AUTHORIZED: 'DENY_DB_NOT_AUTHORIZED',
  DENY_DB_ERROR: 'DENY_DB_ERROR',
  DENY_UNAVAILABLE: 'DENY_UNAVAILABLE',
  DENY_NO_TRANSACTION: 'DENY_NO_TRANSACTION',
  DENY_CALLER_SQL: 'DENY_CALLER_SQL',
  DENY_SCOPE_MISMATCH: 'DENY_SCOPE_MISMATCH',
  DENY_DEFAULT_FAIL_CLOSED: 'DENY_DEFAULT_FAIL_CLOSED',
});

/** Fixed internal SQL templates — never accept caller SQL. */
export const DURABLE_JTI_SQL = Object.freeze({
  SELECT_REVOKED: `
    SELECT jti, reason, issuer_id, audience
      FROM tecp_ops_authority_revocation
     WHERE jti = $1
     FOR SHARE`,
  INSERT_REVOCATION: `
    INSERT INTO tecp_ops_authority_revocation
      (jti, reason, governance_revision, issuer_id, audience)
    VALUES ($1, $2, $3, $4, $5)
    ON CONFLICT (jti) DO NOTHING
    RETURNING jti`,
  SELECT_PRESENTED: `
    SELECT jti, principal_id, task_id, action, resource_type, resource_key,
           issuer_id, audience, governance_revision
      FROM tecp_ops_authority_jti_presentation
     WHERE jti = $1
     FOR SHARE`,
  INSERT_PRESENTATION: `
    INSERT INTO tecp_ops_authority_jti_presentation
      (jti, principal_id, task_id, action, resource_type, resource_key,
       governance_revision, issuer_id, audience)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
    RETURNING jti`,
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
    durable: Boolean(extra.durable),
    classification: DURABLE_REGISTRY_PROOF_CLASS,
    ...extra,
  });
}

function rejectCallerSqlSurface(bag) {
  if (!isPlainObject(bag)) return null;
  for (const key of ['sql', 'queryText', 'statement', 'rawSql', 'clientFactory']) {
    if (Object.prototype.hasOwnProperty.call(bag, key) && bag[key] != null) {
      return key;
    }
  }
  if (typeof bag.callback === 'function' || typeof bag.execute === 'function') {
    return 'callback';
  }
  return null;
}

/**
 * Explicit TEST_ONLY offline doubles. NOT durable operational protection.
 */
export function createOfflineTestOnlyDurableRegistryDoubles() {
  const presented = new Set();
  const revoked = new Map();
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
      return allow(['NOT_REVOKED'], { revoked: false, durable: false });
    },
    async revoke(jti, reason = 'TEST_ONLY_REVOKE', scope = {}) {
      if (!available) {
        return deny(DURABLE_REGISTRY_DECISIONS.DENY_UNAVAILABLE, ['REGISTRY_UNAVAILABLE']);
      }
      if (!isNonEmptyString(jti)) {
        return deny(DURABLE_REGISTRY_DECISIONS.DENY_MALFORMED, ['JTI_REQUIRED']);
      }
      revoked.set(jti, { reason, ...scope });
      return allow(['REVOKED_TEST_ONLY'], { reason, durable: false });
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
      return allow(['NOT_PRESENTED'], { presented: false, durable: false });
    },
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

async function assertOwnedTransactionOpen(client) {
  if (!client || typeof client.query !== 'function') {
    return deny(DURABLE_REGISTRY_DECISIONS.DENY_MALFORMED, ['DB_CLIENT_REQUIRED']);
  }
  try {
    const res = await client.query(
      `SELECT
         current_setting('transaction_read_only', true) AS txn_ro,
         pg_current_xact_id_if_assigned() IS NOT NULL AS in_txn`,
    );
    // Prefer explicit ownership marker when present (DLP write-lease owned txn).
    try {
      const marker = await client.query(
        `SELECT current_setting('tecp.dlp_write_lease_txn_owner', true) AS owned`,
      );
      if (
        marker.rows[0]?.owned === 'TECP_DLP_WRITE_LEASE_TXN_OWNER_V1'
        || marker.rows[0]?.owned === '1'
        || marker.rows[0]?.owned === 'true'
      ) {
        return allow(['OWNED_TXN_MARKER_PRESENT'], { durable: true });
      }
    } catch {
      // fall through to generic in-txn check
    }
    if (res.rows[0]?.in_txn === true) {
      return allow(['OPEN_TXN_DETECTED'], { durable: true });
    }
    return deny(DURABLE_REGISTRY_DECISIONS.DENY_NO_TRANSACTION, [
      'OWNED_OPEN_TRANSACTION_REQUIRED',
    ]);
  } catch (error) {
    return deny(DURABLE_REGISTRY_DECISIONS.DENY_DB_ERROR, [
      error.code || error.message || 'TXN_PROBE_FAILED',
    ]);
  }
}

function requireBinding(binding) {
  if (!isPlainObject(binding)) {
    return deny(DURABLE_REGISTRY_DECISIONS.DENY_MALFORMED, ['BINDING_OBJECT_REQUIRED']);
  }
  for (const key of [
    'principalId', 'taskId', 'action', 'resourceType', 'resourceKey',
    'governanceRevision', 'issuerId', 'audience',
  ]) {
    if (!isNonEmptyString(binding[key])) {
      return deny(DURABLE_REGISTRY_DECISIONS.DENY_MALFORMED, [`MISSING_BINDING:${key}`]);
    }
  }
  return null;
}

/**
 * SQL-backed durable registries for future disposable PostgreSQL.
 * Requires an owned open transaction on the injected client.
 * Does not BEGIN/COMMIT/ROLLBACK — caller owns the transaction.
 */
export function createDurableAuthorityRegistries(dbClient, options = {}) {
  if (!isPlainObject(options)) {
    return Object.freeze({
      kind: 'DURABLE_AUTHORITY_REGISTRIES',
      status: 'DISABLED_MALFORMED_OPTIONS',
      proofClass: DURABLE_REGISTRY_PROOF_CLASS,
      durable: false,
      async isRevoked() {
        return deny(DURABLE_REGISTRY_DECISIONS.DENY_MALFORMED, ['OPTIONS_OBJECT_REQUIRED']);
      },
      async revoke() {
        return deny(DURABLE_REGISTRY_DECISIONS.DENY_MALFORMED, ['OPTIONS_OBJECT_REQUIRED']);
      },
      async hasPresented() {
        return deny(DURABLE_REGISTRY_DECISIONS.DENY_MALFORMED, ['OPTIONS_OBJECT_REQUIRED']);
      },
      async consumeJti() {
        return deny(DURABLE_REGISTRY_DECISIONS.DENY_MALFORMED, ['OPTIONS_OBJECT_REQUIRED']);
      },
    });
  }

  const smuggled = rejectCallerSqlSurface(options);
  if (smuggled) {
    return Object.freeze({
      kind: 'DURABLE_AUTHORITY_REGISTRIES',
      status: 'DISABLED_CALLER_SQL',
      proofClass: DURABLE_REGISTRY_PROOF_CLASS,
      durable: false,
      async isRevoked() {
        return deny(DURABLE_REGISTRY_DECISIONS.DENY_CALLER_SQL, [`FORBIDDEN:${smuggled}`]);
      },
      async revoke() {
        return deny(DURABLE_REGISTRY_DECISIONS.DENY_CALLER_SQL, [`FORBIDDEN:${smuggled}`]);
      },
      async hasPresented() {
        return deny(DURABLE_REGISTRY_DECISIONS.DENY_CALLER_SQL, [`FORBIDDEN:${smuggled}`]);
      },
      async consumeJti() {
        return deny(DURABLE_REGISTRY_DECISIONS.DENY_CALLER_SQL, [`FORBIDDEN:${smuggled}`]);
      },
    });
  }

  if (!dbClient || typeof dbClient.query !== 'function') {
    return Object.freeze({
      kind: 'DURABLE_AUTHORITY_REGISTRIES',
      status: 'DISABLED_WITHOUT_DB_CLIENT',
      proofClass: DURABLE_REGISTRY_PROOF_CLASS,
      durable: false,
      async isRevoked() {
        return deny(DURABLE_REGISTRY_DECISIONS.DENY_DB_NOT_AUTHORIZED, [
          'DB_CLIENT_REQUIRED',
        ]);
      },
      async revoke() {
        return deny(DURABLE_REGISTRY_DECISIONS.DENY_DB_NOT_AUTHORIZED, ['DB_CLIENT_REQUIRED']);
      },
      async hasPresented() {
        return deny(DURABLE_REGISTRY_DECISIONS.DENY_DB_NOT_AUTHORIZED, ['DB_CLIENT_REQUIRED']);
      },
      async consumeJti() {
        return deny(DURABLE_REGISTRY_DECISIONS.DENY_DB_NOT_AUTHORIZED, [
          'DB_CLIENT_REQUIRED',
          'NO_ATOMIC_JTI_WITHOUT_OWNED_TXN',
        ]);
      },
    });
  }

  const requireOwnedTxn = options.requireOwnedTxn !== false;
  const defaultIssuerId = options.issuerId || null;
  const defaultAudience = options.audience || null;

  return Object.freeze({
    kind: 'DURABLE_AUTHORITY_REGISTRIES',
    status: 'SQL_TEMPLATES_READY_AWAITING_TIER3_EXECUTION',
    proofClass: DURABLE_REGISTRY_PROOF_CLASS,
    durable: true,
    sqlTemplates: DURABLE_JTI_SQL,
    note: 'NOT_PROVEN_UNTIL_DISPOSABLE_POSTGRES_RUNS',

    async isRevoked(jti, scope = {}) {
      if (!isNonEmptyString(jti)) {
        return deny(DURABLE_REGISTRY_DECISIONS.DENY_MALFORMED, ['JTI_REQUIRED']);
      }
      if (requireOwnedTxn) {
        const txn = await assertOwnedTransactionOpen(dbClient);
        if (!txn.ok) return txn;
      }
      try {
        const res = await dbClient.query(DURABLE_JTI_SQL.SELECT_REVOKED, [jti]);
        if (res.rowCount === 0) {
          return allow(['NOT_REVOKED'], { revoked: false, durable: true });
        }
        const row = res.rows[0];
        if (isNonEmptyString(scope.issuerId) && row.issuer_id !== scope.issuerId) {
          return deny(DURABLE_REGISTRY_DECISIONS.DENY_SCOPE_MISMATCH, ['ISSUER_MISMATCH']);
        }
        if (isNonEmptyString(scope.audience) && row.audience !== scope.audience) {
          return deny(DURABLE_REGISTRY_DECISIONS.DENY_SCOPE_MISMATCH, ['AUDIENCE_MISMATCH']);
        }
        return deny(DURABLE_REGISTRY_DECISIONS.DENY_REVOKED, ['JTI_REVOKED'], {
          durable: true,
        });
      } catch (error) {
        return deny(DURABLE_REGISTRY_DECISIONS.DENY_DB_ERROR, [
          error.code || error.message || 'SELECT_REVOKED_FAILED',
        ]);
      }
    },

    async revoke(jti, reason = 'REVOKED', scope = {}) {
      if (!isNonEmptyString(jti) || !isNonEmptyString(reason)) {
        return deny(DURABLE_REGISTRY_DECISIONS.DENY_MALFORMED, ['JTI_AND_REASON_REQUIRED']);
      }
      const issuerId = scope.issuerId || defaultIssuerId;
      const audience = scope.audience || defaultAudience;
      const governanceRevision = scope.governanceRevision;
      if (!isNonEmptyString(issuerId) || !isNonEmptyString(audience)
        || !isNonEmptyString(governanceRevision)) {
        return deny(DURABLE_REGISTRY_DECISIONS.DENY_MALFORMED, [
          'ISSUER_AUDIENCE_GOVERNANCE_REQUIRED',
        ]);
      }
      if (requireOwnedTxn) {
        const txn = await assertOwnedTransactionOpen(dbClient);
        if (!txn.ok) return txn;
      }
      try {
        await dbClient.query(DURABLE_JTI_SQL.INSERT_REVOCATION, [
          jti, reason, governanceRevision, issuerId, audience,
        ]);
        return allow(['REVOKED_DURABLE'], { durable: true, reason });
      } catch (error) {
        return deny(DURABLE_REGISTRY_DECISIONS.DENY_DB_ERROR, [
          error.code || error.message || 'INSERT_REVOCATION_FAILED',
        ]);
      }
    },

    async hasPresented(jti) {
      if (!isNonEmptyString(jti)) {
        return deny(DURABLE_REGISTRY_DECISIONS.DENY_MALFORMED, ['JTI_REQUIRED']);
      }
      if (requireOwnedTxn) {
        const txn = await assertOwnedTransactionOpen(dbClient);
        if (!txn.ok) return txn;
      }
      try {
        const res = await dbClient.query(DURABLE_JTI_SQL.SELECT_PRESENTED, [jti]);
        if (res.rowCount > 0) {
          return deny(DURABLE_REGISTRY_DECISIONS.DENY_REPLAY, ['JTI_ALREADY_PRESENTED'], {
            durable: true,
          });
        }
        return allow(['NOT_PRESENTED'], { presented: false, durable: true });
      } catch (error) {
        return deny(DURABLE_REGISTRY_DECISIONS.DENY_DB_ERROR, [
          error.code || error.message || 'SELECT_PRESENTED_FAILED',
        ]);
      }
    },

    /**
     * Atomic consume via PRIMARY KEY uniqueness inside caller-owned transaction.
     * On later mutation DENY/exception, caller MUST ROLLBACK so jti is released.
     */
    async consumeJti(jti, binding = {}) {
      const smuggledBinding = rejectCallerSqlSurface(binding);
      if (smuggledBinding) {
        return deny(DURABLE_REGISTRY_DECISIONS.DENY_CALLER_SQL, [
          `BINDING_FORBIDDEN:${smuggledBinding}`,
        ]);
      }
      if (!isNonEmptyString(jti)) {
        return deny(DURABLE_REGISTRY_DECISIONS.DENY_MALFORMED, ['JTI_REQUIRED']);
      }
      const bindingErr = requireBinding({
        issuerId: binding.issuerId || defaultIssuerId,
        audience: binding.audience || defaultAudience,
        ...binding,
      });
      if (bindingErr) return bindingErr;

      if (requireOwnedTxn) {
        const txn = await assertOwnedTransactionOpen(dbClient);
        if (!txn.ok) return txn;
      }

      const issuerId = binding.issuerId || defaultIssuerId;
      const audience = binding.audience || defaultAudience;

      try {
        const revoked = await dbClient.query(DURABLE_JTI_SQL.SELECT_REVOKED, [jti]);
        if (revoked.rowCount > 0) {
          return deny(DURABLE_REGISTRY_DECISIONS.DENY_REVOKED, ['JTI_REVOKED'], {
            durable: true,
          });
        }
        await dbClient.query(DURABLE_JTI_SQL.INSERT_PRESENTATION, [
          jti,
          binding.principalId,
          binding.taskId,
          binding.action,
          binding.resourceType,
          binding.resourceKey,
          binding.governanceRevision,
          issuerId,
          audience,
        ]);
        return allow(['JTI_CONSUMED_IN_OWNED_TXN'], {
          durable: true,
          binding: Object.freeze({
            principalId: binding.principalId,
            taskId: binding.taskId,
            action: binding.action,
            resourceType: binding.resourceType,
            resourceKey: binding.resourceKey,
            governanceRevision: binding.governanceRevision,
            issuerId,
            audience,
          }),
          note: 'COMMIT_REQUIRED_FOR_DURABILITY_ROLLBACK_RELEASES_JTI',
        });
      } catch (error) {
        if (error && (error.code === '23505' || /unique/i.test(String(error.message || '')))) {
          return deny(DURABLE_REGISTRY_DECISIONS.DENY_REPLAY, ['JTI_UNIQUE_CONFLICT'], {
            durable: true,
          });
        }
        return deny(DURABLE_REGISTRY_DECISIONS.DENY_DB_ERROR, [
          error.code || error.message || 'CONSUME_JTI_FAILED',
        ]);
      }
    },
  });
}

export function interpretRegistryResult(result, fallbackDecision = DURABLE_REGISTRY_DECISIONS.DENY_DB_ERROR) {
  if (!isPlainObject(result)) {
    return deny(fallbackDecision, ['REGISTRY_RESULT_MALFORMED']);
  }
  if (result.ok === true) return result;
  return deny(result.decision || fallbackDecision, result.reasons || ['REGISTRY_DENY']);
}
