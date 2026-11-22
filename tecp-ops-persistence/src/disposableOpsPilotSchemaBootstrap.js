/**
 * Fixed allowlist disposable schema bootstrap for Suite A live orchestration.
 * No import-time FS / DB / subprocess / network side effects.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import {
  LIVE_SUITE_EXECUTION_AUTHORITY_PROOF_CLASS,
  OPS_PILOT_CANONICAL_REPO_ROOT,
  OPS_PILOT_DB_EXECUTION_AUTHORIZED,
  OPS_PILOT_HARNESS_DECISIONS,
  OPS_PILOT_TIER3_AUTHORIZED,
  assertLiveSuiteExecutionAuthorityForSuite,
  isLiveSuiteExecutionAuthority,
  isOwnedClusterClient,
  isOwnedConnectedClusterClient,
} from './disposableOpsPilotDbHarness.js';

export const SCHEMA_BOOTSTRAP_PROOF_CLASS = 'DISPOSABLE_OPS_PILOT_SCHEMA_BOOTSTRAP_V1';
export const SCHEMA_BOOTSTRAP_TARGET_DATABASE = 'dlp_proof';

export const SCHEMA_BOOTSTRAP_DECISIONS = Object.freeze({
  ALLOW: 'ALLOW',
  DENY_NOT_AUTHORIZED: 'DENY_NOT_AUTHORIZED',
  DENY_CLIENT: 'DENY_CLIENT',
  DENY_ALLOWLIST: 'DENY_ALLOWLIST',
  DENY_PARTIAL_APPLY: 'DENY_PARTIAL_APPLY',
  DENY_VERIFICATION: 'DENY_VERIFICATION',
  DENY_DB_ERROR: 'DENY_DB_ERROR',
});

export const SCHEMA_BOOTSTRAP_ALLOWLIST = Object.freeze([
  'tecp-persistence/test/disposableSchema.sql',
  'tecp-persistence/test/disposableTaskClaimLeaseSchema.sql',
  'tecp-persistence/test/disposableAuditEvidenceSchema.sql',
  'tecp-persistence/test/disposableTaskClaimLeaseAuditSchema.sql',
  'tecp-ops-persistence/test/disposableOpsPilotAuthoritySchema.sql',
  'tecp-ops-persistence/test/disposableOpsPilotSchema.sql',
]);

const REQUIRED_VERIFICATION_OBJECTS = Object.freeze([
  { schema: 'public', name: 'dlp_write_lease', kind: 'table' },
  { schema: 'public', name: 'dlp_write_resource_fence', kind: 'table' },
  { schema: 'public', name: 'dlp_task', kind: 'table' },
  { schema: 'public', name: 'dlp_audit_event', kind: 'table' },
  { schema: 'public', name: 'tecp_ops_authority_jti_presentation', kind: 'table' },
  { schema: 'public', name: 'tecp_ops_authority_revocation', kind: 'table' },
]);

function deny(decision, reasons = [], extra = {}) {
  return Object.freeze({
    ok: false,
    allowed: false,
    decision,
    reasons: Object.freeze([...reasons]),
    proofClass: SCHEMA_BOOTSTRAP_PROOF_CLASS,
    sqlBacked: false,
    ...extra,
  });
}

function allow(reasons = [], extra = {}) {
  return Object.freeze({
    ok: true,
    allowed: true,
    decision: SCHEMA_BOOTSTRAP_DECISIONS.ALLOW,
    reasons: Object.freeze([...reasons]),
    proofClass: SCHEMA_BOOTSTRAP_PROOF_CLASS,
    sqlBacked: true,
    ...extra,
  });
}

function resolveAllowlistedSchemaPath(relativePath) {
  const normalized = String(relativePath || '').replace(/\\/g, '/');
  if (!SCHEMA_BOOTSTRAP_ALLOWLIST.includes(normalized)) {
    return null;
  }
  const abs = resolve(OPS_PILOT_CANONICAL_REPO_ROOT, normalized);
  const root = resolve(OPS_PILOT_CANONICAL_REPO_ROOT);
  if (!abs.startsWith(root)) {
    return null;
  }
  return abs;
}

function splitSqlStatements(sqlText) {
  return String(sqlText || '')
    .split(';')
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && !s.startsWith('--'));
}

function assertLiveAuthority(input = {}) {
  if (input.offlineWiringProbe === true || input.authorizesRealSql !== true) {
    return deny(SCHEMA_BOOTSTRAP_DECISIONS.DENY_NOT_AUTHORIZED, [
      'OFFLINE_OR_NON_SQL_AUTHORITY_CANNOT_BOOTSTRAP',
    ]);
  }
  if (OPS_PILOT_DB_EXECUTION_AUTHORIZED !== false || OPS_PILOT_TIER3_AUTHORIZED !== false) {
    return deny(SCHEMA_BOOTSTRAP_DECISIONS.DENY_NOT_AUTHORIZED, [
      'MODULE_CONSTANTS_MUST_REMAIN_FALSE',
    ]);
  }
  const authority = input.liveExecutionAuthority;
  if (!isLiveSuiteExecutionAuthority(authority)
    || authority.proofClass !== LIVE_SUITE_EXECUTION_AUTHORITY_PROOF_CLASS) {
    return deny(SCHEMA_BOOTSTRAP_DECISIONS.DENY_NOT_AUTHORIZED, [
      'RUNNER_ISSUED_LIVE_SUITE_AUTHORITY_REQUIRED',
    ]);
  }
  const auth = assertLiveSuiteExecutionAuthorityForSuite(
    authority,
    input.suitePath,
    input.repositoryHeadSha,
  );
  if (!auth.ok || auth.authorizesRealSql !== true) {
    return deny(SCHEMA_BOOTSTRAP_DECISIONS.DENY_NOT_AUTHORIZED, [
      'LIVE_SQL_AUTHORITY_REQUIRED',
      ...(auth.reasons || []),
    ]);
  }
  return allow(['LIVE_AUTHORITY_VERIFIED']);
}

async function applyAllowlistedSchemaFile(client, relative) {
  const abs = resolveAllowlistedSchemaPath(relative);
  if (!abs) {
    return deny(SCHEMA_BOOTSTRAP_DECISIONS.DENY_ALLOWLIST, ['SCHEMA_PATH_NOT_ALLOWLISTED', relative]);
  }
  let sqlText;
  try {
    sqlText = readFileSync(abs, 'utf8');
  } catch (error) {
    return deny(SCHEMA_BOOTSTRAP_DECISIONS.DENY_ALLOWLIST, [
      'SCHEMA_FILE_READ_FAILED',
      relative,
      error.message || String(error),
    ]);
  }
  const statements = splitSqlStatements(sqlText);
  for (const stmt of statements) {
    await client.query(stmt);
  }
  return allow(['SCHEMA_FILE_APPLIED'], {
    relative,
    bytes: Buffer.byteLength(sqlText, 'utf8'),
    statementCount: statements.length,
  });
}

export async function applyDisposableOpsPilotSchemaBootstrap(input = {}) {
  const phase = input.phase === 'PREAMBLE_ONLY' || input.phase === 'APPLY_SCHEMAS'
    ? input.phase
  : 'FULL';
  const authorityCheck = assertLiveAuthority(input);
  if (!authorityCheck.ok) {
    return authorityCheck;
  }

  const adminClient = input.clusterClient;
  const dlpClient = input.dlpProofClient;
  if (!adminClient || typeof adminClient.query !== 'function') {
    return deny(SCHEMA_BOOTSTRAP_DECISIONS.DENY_CLIENT, ['POSTGRES_ADMIN_CLIENT_REQUIRED']);
  }
  if (!isOwnedClusterClient(adminClient) || !isOwnedConnectedClusterClient(adminClient)) {
    return deny(SCHEMA_BOOTSTRAP_DECISIONS.DENY_CLIENT, [
      'OWNED_CONNECTED_ADMIN_CLIENT_REQUIRED',
    ]);
  }
  if ((phase === 'FULL' || phase === 'APPLY_SCHEMAS')
    && (!dlpClient || typeof dlpClient.query !== 'function')) {
    return deny(SCHEMA_BOOTSTRAP_DECISIONS.DENY_CLIENT, ['DLP_PROOF_CLIENT_REQUIRED']);
  }
  if (dlpClient && (!isOwnedClusterClient(dlpClient) || !isOwnedConnectedClusterClient(dlpClient))) {
    return deny(SCHEMA_BOOTSTRAP_DECISIONS.DENY_CLIENT, [
      'OWNED_CONNECTED_DLP_PROOF_CLIENT_REQUIRED',
    ]);
  }

  const applied = [];
  try {
    const exists = await adminClient.query(
      'SELECT 1 AS present FROM pg_database WHERE datname = $1',
      [SCHEMA_BOOTSTRAP_TARGET_DATABASE],
    );
    if (exists.rowCount === 0) {
      await adminClient.query(`CREATE DATABASE ${SCHEMA_BOOTSTRAP_TARGET_DATABASE}`);
      applied.push({
        step: 'CREATE_DATABASE',
        sqlBacked: true,
        evidence: { database: SCHEMA_BOOTSTRAP_TARGET_DATABASE },
      });
    } else {
      applied.push({
        step: 'CREATE_DATABASE',
        sqlBacked: true,
        skipped: 'ALREADY_PRESENT',
        evidence: { database: SCHEMA_BOOTSTRAP_TARGET_DATABASE },
      });
    }

    if (phase === 'PREAMBLE_ONLY') {
      return allow(['SCHEMA_BOOTSTRAP_PREAMBLE_ONLY'], {
        applied: Object.freeze(applied),
        phase: 'PREAMBLE_ONLY',
        schemaBootstrapEvidence: Object.freeze({
          database: SCHEMA_BOOTSTRAP_TARGET_DATABASE,
          preambleOnly: true,
        }),
      });
    }

    const schemaClient = dlpClient;
    for (const relative of SCHEMA_BOOTSTRAP_ALLOWLIST) {
      const fileResult = await applyAllowlistedSchemaFile(schemaClient, relative);
      if (!fileResult.ok) {
        return deny(fileResult.decision, fileResult.reasons || ['SCHEMA_APPLY_FAILED'], {
          applied: Object.freeze([...applied]),
          partial: relative,
        });
      }
      applied.push({
        step: 'APPLY_SCHEMA',
        relative,
        sqlBacked: true,
        bytes: fileResult.bytes,
        statementCount: fileResult.statementCount,
      });
    }

    const verification = [];
    for (const obj of REQUIRED_VERIFICATION_OBJECTS) {
      const probe = await schemaClient.query(
        'SELECT to_regclass($1) AS reg',
        [`${obj.schema}.${obj.name}`],
      );
      const present = probe.rows?.[0]?.reg != null;
      verification.push({ ...obj, present, sqlBacked: true });
      if (!present) {
        return deny(SCHEMA_BOOTSTRAP_DECISIONS.DENY_VERIFICATION, [
          'REQUIRED_OBJECT_MISSING',
          `${obj.schema}.${obj.name}`,
        ], {
          applied: Object.freeze([...applied]),
          verification: Object.freeze(verification),
        });
      }
    }

    return allow(['SCHEMA_BOOTSTRAP_COMPLETE'], {
      applied: Object.freeze(applied),
      verification: Object.freeze(verification),
      schemaBootstrapEvidence: Object.freeze({
        database: SCHEMA_BOOTSTRAP_TARGET_DATABASE,
        filesApplied: SCHEMA_BOOTSTRAP_ALLOWLIST.length,
        objectsVerified: verification.length,
      }),
    });
  } catch (error) {
    const hadSql = applied.some((a) => a.sqlBacked === true);
    return deny(SCHEMA_BOOTSTRAP_DECISIONS.DENY_PARTIAL_APPLY, [
      'BOOTSTRAP_FAILED_FAIL_CLOSED',
      error.code || error.message || String(error),
    ], {
      applied: Object.freeze(applied),
      sqlBacked: hadSql,
    });
  }
}