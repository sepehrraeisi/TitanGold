/**
 * TECP-DLP-009: disposable, NON_OPERATIONAL full-local SCRAM cutover proof.
 *
 * This is a TEST helper, not a deployable authentication broker.
 * The frozen DLP-001 harness is used only while bootstrapping its own
 * disposable cluster. No frozen harness helper is used after HBA cutover.
 *
 * PRE_CUTOVER_TRUST_WINDOW = NOT_SEALED / BOOTSTRAP_ONLY
 * SAME_UID / IN_PROCESS_JS / STOLEN_SECRET / LIVE_WRITER_CLIENT = NOT_SEALED
 * POST_CUTOVER_NEW_LOCAL_PRIVILEGED_LOGIN = testable only with fresh sessions.
 */
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

import { createDisposablePgHarness } from './disposablePgHarness.js';

const { Client } = pg;
const HERE = dirname(fileURLToPath(import.meta.url));
const PROOF_DATABASE = 'dlp_proof';

export const DLP009_LOGIN_ROLES = Object.freeze([
  'dlp_proof',
  'dlp_authz_composition_proof',
  'dlp_composition_proof',
  'dlp_audit_owner',
  'dlp_audit_proof',
  'dlp_sealed_restricted_caller',
]);

export const DLP009_WRITER_ROLE = 'dlp_authz_composition_proof';
export const DLP009_RESTRICTED_ROLE = 'dlp_sealed_restricted_caller';
export const DLP009_HBA = [
  '# DLP-009 disposable-only, full local authn',
  'local all all scram-sha-256',
  'host all all 0.0.0.0/0 reject',
  'host all all ::/0 reject',
  '',
].join('\n');

const SCHEMA_FILES = Object.freeze([
  'disposableTaskClaimLeaseSchema.sql',
  'disposableAuditEvidenceSchema.sql',
  'disposableTaskClaimLeaseAuditSchema.sql',
  'disposableAuthenticatedCompositionSchema.sql',
  'disposableSealedWriteSchema.sql',
]);

function blocked(reason) {
  // Never attach a raw PostgreSQL error, SQL text or credentials.
  return new Error('BLOCKED: DLP009_' + reason);
}

function assertEnvironment() {
  for (const name of Object.keys(process.env)) {
    if (name === 'DATABASE_URL' || /^(PGHOST|PGPORT|PGDATABASE|PGUSER|PGPASSWORD|POSTGRES_)/i.test(name)) {
      throw blocked('AMBIENT_DATABASE_CONFIGURATION');
    }
  }
}

/** Strictly validate all effective rules, including order and host denial. */
export function assertFullLocalScramHba(hba) {
  if (typeof hba !== 'string') throw blocked('HBA_NOT_TEXT');
  const lines = hba.split(/\r?\n/).map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'));
  const expected = [
    'local all all scram-sha-256',
    'host all all 0.0.0.0/0 reject',
    'host all all ::/0 reject',
  ];
  const normalized = lines.map((line) => line.replace(/\s+/g, ' ').toLowerCase());
  if (normalized.length !== expected.length || normalized.some((line, i) => line !== expected[i])) {
    throw blocked('HBA_NOT_EXACT_SCRAM_ONLY_LOCAL_AND_HOST_REJECT');
  }
  return true;
}

function assertInitialTrustHba(hba) {
  const lines = hba.split(/\r?\n/).map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'))
    .map((line) => line.replace(/\s+/g, ' ').toLowerCase());
  if (lines.length !== 3 || lines[0] !== 'local all all trust'
    || lines[1] !== 'host all all 0.0.0.0/0 reject'
    || lines[2] !== 'host all all ::/0 reject') {
    throw blocked('UNEXPECTED_FROZEN_BOOTSTRAP_HBA');
  }
}

function loginConfig(harness, role, password) {
  const config = {
    host: harness.socketDir,
    port: harness.socketPort,
    user: role,
    database: PROOF_DATABASE,
    connectionTimeoutMillis: 2000,
    application_name: 'dlp009_authn_test',
  };
  if (password !== undefined) config.password = password;
  return config;
}

function assertRoleName(role) {
  if (!DLP009_LOGIN_ROLES.includes(role)) throw blocked('UNKNOWN_LOGIN_ROLE');
}

async function closeClient(client) {
  if (client) {
    try { await client.end(); } catch { /* teardown still terminates cluster */ }
  }
}

async function assertNoOtherClientSessions(admin) {
  const sessions = await admin.query(
    "SELECT count(*)::int AS n FROM pg_stat_activity " +
    "WHERE backend_type = 'client backend' AND pid <> pg_backend_pid()",
  );
  if (sessions.rows.length !== 1 || sessions.rows[0].n !== 0) {
    throw blocked('STALE_OR_UNACCOUNTED_CLIENT_SESSION');
  }
}

function assertParsedHbaRules(rules) {
  if (!Array.isArray(rules) || rules.length !== 3 || rules.some((r) => r.error !== null)) {
    throw blocked('HBA_PARSE_ERROR_OR_UNEXPECTED_RULE');
  }
  const expected = [
    ['local', 'scram-sha-256', null],
    ['host', 'reject', '0.0.0.0'],
    ['host', 'reject', '::'],
  ];
  for (let i = 0; i < expected.length; i += 1) {
    const r = rules[i];
    if (r.type !== expected[i][0] || r.auth_method !== expected[i][1]
      || (expected[i][2] !== null && !String(r.address).startsWith(expected[i][2]))
      || !Array.isArray(r.database) || r.database.join(',') !== 'all'
      || !Array.isArray(r.user_name) || r.user_name.join(',') !== 'all') {
      throw blocked('HBA_PARSER_MISMATCH');
    }
  }
}

function newCredential() {
  return randomBytes(32).toString('hex');
}

function assertExpectedRoles(rows) {
  const found = rows.map((r) => r.rolname).sort();
  const expected = [...DLP009_LOGIN_ROLES].sort();
  if (JSON.stringify(found) !== JSON.stringify(expected)) {
    throw blocked('PRIVILEGED_LOGIN_INVENTORY_CHANGED');
  }
  if (!rows.some((r) => r.rolname === 'dlp_proof' && r.rolsuper === true)) {
    throw blocked('HARNESS_SUPERUSER_INVENTORY_CHANGED');
  }
  if (rows.filter((r) => r.rolsuper === true).length !== 1) {
    throw blocked('UNEXPECTED_SUPERUSER');
  }
}

function classifyAuthFailure(error, mode) {
  if (error && error.code === '28P01') return 'SERVER_PASSWORD_REJECT';
  // node-postgres refuses to run SCRAM without a string password;
  // this is a CLIENT-SIDE missing-credential refusal, NOT a server 28P01.
  if (mode === 'missing' && error && typeof error.message === 'string'
    && /SASL:.*client password must be a string/i.test(error.message)) {
    return 'CLIENT_MISSING_PASSWORD_REJECT';
  }
  throw blocked('AUTHENTICATION_NEGATIVE_PROBE_INCONCLUSIVE');
}

/**
 * Start a completely isolated disposable PG14 cluster, bootstrap all frozen
 * schemas, change ALL LOGIN passwords, atomically install restrictive HBA,
 * and verify fresh SCRAM authentication after all trust sessions are closed.
 *
 * Never return credentials or an unconstrained connection factory.
 * Test-only callbacks temporarily receive explicitly authenticated clients;
 * a live privileged client remains a retained trust root.
 */
export async function createDisposableFullLocalScramProof(options = {}) {
  assertEnvironment();
  if (options.failAt && ![
    'AFTER_BOOTSTRAP', 'AFTER_HBA_SWAP', 'AFTER_RELOAD',
  ].includes(options.failAt)) throw blocked('INVALID_FAILPOINT');

  let harness;
  let bootstrap;
  let stopped = false;
  let stopping = false;
  let cutoverVerified = false;
  const secrets = new Map();

  async function stop() {
    if (stopped) return Object.freeze({ cleaned: true, alreadyStopped: true });
    if (stopping) throw blocked('CLEANUP_ALREADY_IN_PROGRESS');
    stopping = true;
    try {
      await closeClient(bootstrap);
      bootstrap = null;
      const cleanup = harness ? harness.stop() : { cleaned: true, terminated: true };
      if (!cleanup.cleaned || !cleanup.terminated) throw blocked('CLEANUP_NOT_PROVEN');
      stopped = true; // Never report success before verified termination.
      return Object.freeze({ cleaned: true, terminated: true });
    } finally {
      stopping = false;
      // Map.clear drops references; JS string memory zeroization is NOT proven.
      secrets.clear();
    }
  }

  async function probeLogin(role, mode) {
    if (stopped) throw blocked('PROOF_ALREADY_STOPPED');
    assertRoleName(role);
    if (!['valid', 'missing', 'wrong'].includes(mode)) throw blocked('INVALID_PROBE');
    const pass = mode === 'valid' ? secrets.get(role)
      : mode === 'wrong' ? newCredential() : undefined;
    const client = new Client(loginConfig(harness, role, pass));
    try {
      await client.connect();
      if (mode !== 'valid') throw blocked('PASSWORDLESS_OR_BAD_SECRET_LOGIN_ALLOWED');
      const r = await client.query(
        'SELECT session_user::text AS session_user, current_user::text AS current_user',
      );
      if (r.rows[0]?.session_user !== role || r.rows[0]?.current_user !== role) {
        throw blocked('LOGIN_ROLE_MISMATCH');
      }
      return Object.freeze({ role, mode, result: 'AUTHENTICATED' });
    } catch (error) {
      if (mode === 'valid') throw blocked('VALID_SCRAM_LOGIN_FAILED');
      // A valid connection caught as a negative-probe error must NOT be
      // classified as an authentication refusal.
      if (error && String(error.message).includes('PASSWORDLESS_OR_BAD_SECRET_LOGIN_ALLOWED')) {
        throw error;
      }
      return Object.freeze({ role, mode, result: classifyAuthFailure(error, mode) });
    } finally {
      await closeClient(client);
    }
  }

  async function withAuthenticatedClient(role, callback) {
    if (!cutoverVerified || stopped) throw blocked('SCRAM_CUTOVER_NOT_VERIFIED');
    assertRoleName(role);
    if (typeof callback !== 'function') throw blocked('CALLBACK_REQUIRED');
    const client = new Client(loginConfig(harness, role, secrets.get(role)));
    try {
      await client.connect();
      const identity = await client.query('SELECT session_user::text AS name');
      if (identity.rows[0]?.name !== role) throw blocked('AUTHENTICATED_ROLE_MISMATCH');
      return await callback(client);
    } finally {
      await closeClient(client);
    }
  }

  async function assertNoLegacySessions() {
    if (!cutoverVerified || stopped) throw blocked('SCRAM_CUTOVER_NOT_VERIFIED');
    return withAuthenticatedClient('dlp_proof', async (admin) => {
      await assertNoOtherClientSessions(admin);
      return true;
    });
  }

  async function assertTcpStillRejected() {
    if (!cutoverVerified || stopped) throw blocked('SCRAM_CUTOVER_NOT_VERIFIED');
    await withAuthenticatedClient('dlp_proof', async (admin) => {
      const runtime = await admin.query('SHOW listen_addresses');
      if (runtime.rows[0]?.listen_addresses !== '') {
        throw blocked('TCP_LISTEN_ADDRESSES_CHANGED_AFTER_CUTOVER');
      }
    });
    const tcp = new Client({
      host: '127.0.0.1',
      port: harness.socketPort,
      user: 'dlp_proof',
      database: PROOF_DATABASE,
      password: secrets.get('dlp_proof'),
      connectionTimeoutMillis: 1000,
    });
    try {
      await tcp.connect();
      throw blocked('TCP_CONNECTED_AFTER_CUTOVER');
    } catch (error) {
      if (error && String(error.message).includes('TCP_CONNECTED_AFTER_CUTOVER')) throw error;
      if (!error || error.code !== 'ECONNREFUSED') {
        throw blocked('TCP_NEGATIVE_PROBE_INCONCLUSIVE');
      }
      return true;
    } finally {
      await closeClient(tcp);
    }
  }

  try {
    harness = createDisposablePgHarness();
    if (typeof options.onHarnessCreated === 'function') {
      options.onHarnessCreated({ root: harness.root });
    }
    const isolation = await harness.proveIsolation();
    assert.equal(isolation.listenAddresses, '');
    assert.equal(isolation.tcpRejected, true);
    await harness.createProofDatabase();

    bootstrap = await harness.createClient();
    await bootstrap.query("SET application_name = 'dlp009_trust_bootstrap'");
    for (const schemaFile of SCHEMA_FILES) {
      await bootstrap.query(readFileSync(join(HERE, schemaFile), 'utf8'));
    }
    const inventory = await bootstrap.query(
      'SELECT rolname::text AS rolname, rolsuper FROM pg_roles ' +
      'WHERE rolcanlogin = true ORDER BY rolname',
    );
    assertExpectedRoles(inventory.rows);
    await assertNoOtherClientSessions(bootstrap);

    await bootstrap.query("SET password_encryption = 'scram-sha-256'");
    for (const row of inventory.rows) {
      const role = row.rolname;
      const secret = newCredential();
      secrets.set(role, secret);
      // Exact validated role names and hex-only randomly generated secrets.
      // No interpolated user input and no raw SQL/error reporting.
      const quotedRole = '"' + role.replace(/"/g, '""') + '"';
      await bootstrap.query("ALTER ROLE " + quotedRole + " PASSWORD '" + secret + "'");
    }
    const stored = await bootstrap.query(
      'SELECT rolname::text AS name, rolpassword FROM pg_authid ' +
      'WHERE rolcanlogin = true ORDER BY rolname',
    );
    if (stored.rows.length !== DLP009_LOGIN_ROLES.length ||
      stored.rows.some((r) => !String(r.rolpassword).startsWith('SCRAM-SHA-256$'))) {
      throw blocked('NOT_ALL_LOGIN_ROLES_HAVE_SCRAM_SECRETS');
    }
    if (options.failAt === 'AFTER_BOOTSTRAP') throw blocked('INJECTED_BOOTSTRAP_FAILURE');

    const hbaPath = join(harness.dataDir, 'pg_hba.conf');
    if (resolve(hbaPath) !== resolve(join(harness.dataDir, 'pg_hba.conf'))) {
      throw blocked('HBA_PATH_INVALID');
    }
    const actualHba = await bootstrap.query('SHOW hba_file');
    if (resolve(actualHba.rows[0]?.hba_file || '') !== resolve(hbaPath)) {
      throw blocked('POSTGRES_USING_OTHER_HBA_FILE');
    }
    assertInitialTrustHba(readFileSync(hbaPath, 'utf8'));
    assertFullLocalScramHba(DLP009_HBA);

    // A fresh disposable data directory and atomic same-dir rename.
    // On any failure, terminate the isolated cluster; NEVER restore trust.
    const tempHba = join(harness.dataDir, 'pg_hba.conf.dlp009.tmp');
    writeFileSync(tempHba, DLP009_HBA, { encoding: 'utf8', flag: 'wx', mode: 0o600 });
    renameSync(tempHba, hbaPath);
    assertFullLocalScramHba(readFileSync(hbaPath, 'utf8'));
    if (options.failAt === 'AFTER_HBA_SWAP') throw blocked('INJECTED_HBA_FAILURE');

    const reload = await bootstrap.query('SELECT pg_reload_conf() AS success');
    if (reload.rows[0]?.success !== true) throw blocked('POSTGRES_RELOAD_FAILED');
    const rules = await bootstrap.query(
      'SELECT type, database, user_name, address, auth_method, error ' +
      'FROM pg_hba_file_rules ORDER BY line_number',
    );
    assertParsedHbaRules(rules.rows);
    if (options.failAt === 'AFTER_RELOAD') throw blocked('INJECTED_RELOAD_FAILURE');

    // The originally trust-authenticated superuser session remains privileged
    // until DISCONNECTED; HBA reload alone never revokes it.
    await closeClient(bootstrap);
    bootstrap = null;

    // Poll for evidence that reload applies to *new* connections.
    let liveRulesVerified = false;
    for (let attempt = 0; attempt < 30; attempt += 1) {
      const wrong = await probeLogin('dlp_proof', 'wrong');
      if (wrong.result === 'SERVER_PASSWORD_REJECT') {
        liveRulesVerified = true;
        break;
      }
      await new Promise((resolveDelay) => setTimeout(resolveDelay, 100));
    }
    if (!liveRulesVerified) throw blocked('HBA_RELOAD_NOT_EFFECTIVE');
    for (const role of DLP009_LOGIN_ROLES) {
      const ok = await probeLogin(role, 'valid');
      const wrong = await probeLogin(role, 'wrong');
      const missing = await probeLogin(role, 'missing');
      if (ok.result !== 'AUTHENTICATED' || wrong.result !== 'SERVER_PASSWORD_REJECT'
        || !['SERVER_PASSWORD_REJECT', 'CLIENT_MISSING_PASSWORD_REJECT'].includes(missing.result)) {
        throw blocked('SCRAM_AUTH_MATRIX_FAILED');
      }
    }
    cutoverVerified = true;
    await assertNoLegacySessions();
    await assertTcpStillRejected();

    // Inspect disposable log before declaring success; never print its contents.
    // A postmaster-side failed ALTER ROLE can otherwise echo SQL and credentials.
    const privateLog = readFileSync(harness.logFile, 'utf8');
    for (const credential of secrets.values()) {
      if (privateLog.includes(credential)) throw blocked('CREDENTIAL_FOUND_IN_PG_LOG');
    }

    // No production DB handle or credential escapes this test object.
    return Object.freeze({
      mode: 'NON_OPERATIONAL_DISPOSABLE_ONLY',
      architecture: 'OPTION_B_REVISED_STAGED_SCRAM',
      roles: DLP009_LOGIN_ROLES,
      isolation: Object.freeze({ unixOnly: true, tcpRejected: true }),
      withAuthenticatedClient,
      probeLogin,
      assertNoLegacySessions,
      assertTcpStillRejected,
      stop,
    });
  } catch (error) {
    try {
      await stop();
    } catch {
      throw blocked('SETUP_FAILED_AND_CLEANUP_NOT_PROVEN');
    }
    // All failures are sanitized. Never expose PostgreSQL SQL text or password.
    const message = String(error && error.message || '');
    if (message.startsWith('BLOCKED: DLP009_')) throw error;
    throw blocked('SETUP_OR_CUTOVER_FAILED');
  }
}
