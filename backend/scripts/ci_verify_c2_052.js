#!/usr/bin/env node
/**
 * C2 052 — disposable PG14 CI verifier.
 *
 * Fail-closed unless:
 *   TITAN_C2_CI_PG14=1
 *   DATABASE_URL host is localhost or 127.0.0.1
 *   DATABASE_URL database is an allowlisted titangold_c2_* disposable name
 *
 * Never targets production. Never uses production credentials.
 */

import pg from 'pg';

const INDEX_NAME = 'idx_telegram_messages_channel_message_id';
const MIGRATION_NAME = '052_telegram_messages_channel_message_id_index';
const TEST_CHANNEL = '00000000-0000-4000-8000-000000000001';
const OTHER_CHANNEL = '00000000-0000-4000-8000-000000000002';
const ALLOWED_DBS = new Set([
  'titangold_c2_test',
  'titangold_c2_named',
  'titangold_c2_wrong',
  'titangold_c2_partial',
  'titangold_c2_invalid',
  'titangold_c2_down',
]);

const command = process.argv[2];

function fail(message) {
  console.error(`FAIL: ${message}`);
  process.exit(1);
}

function pass(message) {
  console.log(`PASS: ${message}`);
}

function requireCiSafety() {
  if (process.env.TITAN_C2_CI_PG14 !== '1') {
    fail('TITAN_C2_CI_PG14 must be exactly "1"');
  }
  const urlRaw = process.env.DATABASE_URL;
  if (!urlRaw || typeof urlRaw !== 'string') {
    fail('DATABASE_URL required');
  }
  let parsed;
  try {
    parsed = new URL(urlRaw);
  } catch {
    fail('DATABASE_URL is not a valid URL');
  }
  const host = parsed.hostname;
  if (host !== 'localhost' && host !== '127.0.0.1') {
    fail(`host must be localhost or 127.0.0.1 (got ${host})`);
  }
  const db = parsed.pathname.replace(/^\//, '');
  if (!ALLOWED_DBS.has(db)) {
    fail(`database ${db} is not an allowlisted disposable C2 database`);
  }
  pass(`safety host=${host} db=${db}`);
  return urlRaw;
}

async function withClient(fn) {
  const url = requireCiSafety();
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.end();
  }
}

async function requirePg14(client) {
  const { rows } = await client.query('SHOW server_version');
  const version = rows[0].server_version;
  const major = Number(String(version).split('.')[0]);
  if (major !== 14) {
    fail(`PostgreSQL major must be 14 (got ${version})`);
  }
  pass(`server_version=${version}`);
}

async function loadIndex(client) {
  const { rows } = await client.query(
    `
    SELECT
      n.nspname AS schema_name,
      i.relname AS index_name,
      i.relkind AS relkind,
      t.relname AS table_name,
      am.amname AS method,
      ix.indisunique AS is_unique,
      ix.indisvalid AS is_valid,
      ix.indisready AS is_ready,
      ix.indnkeyatts AS key_count,
      ix.indnatts AS att_count,
      pg_get_expr(ix.indpred, ix.indrelid) AS predicate,
      pg_get_indexdef(i.oid) AS indexdef,
      (
        SELECT array_agg(a.attname ORDER BY x.ordinality)
        FROM unnest(ix.indkey) WITH ORDINALITY AS x(attnum, ordinality)
        JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = x.attnum
        WHERE x.ordinality <= ix.indnkeyatts
      ) AS key_columns
    FROM pg_class i
    JOIN pg_namespace n ON n.oid = i.relnamespace
    LEFT JOIN pg_index ix ON ix.indexrelid = i.oid
    LEFT JOIN pg_class t ON t.oid = ix.indrelid
    LEFT JOIN pg_am am ON am.oid = i.relam
    WHERE n.nspname = 'public' AND i.relname = $1
    `,
    [INDEX_NAME],
  );
  return rows[0] || null;
}

async function ledgerNames(client, table = 'pgmigrations') {
  const exists = await client.query(
    `SELECT 1 FROM pg_class c
     JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public' AND c.relname = $1`,
    [table],
  );
  if (exists.rowCount === 0) return [];
  const { rows } = await client.query(
    `SELECT name FROM ${table} ORDER BY id`,
  );
  return rows.map((row) => row.name);
}

async function relationExists(client, name) {
  const { rows } = await client.query(
    `SELECT 1 FROM pg_class c
     JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public' AND c.relname = $1`,
    [name],
  );
  return rows.length > 0;
}

function asTextArray(value) {
  if (value == null) return [];
  if (Array.isArray(value)) return value.map(String);
  const text = String(value).replace(/^\{/, '').replace(/\}$/, '');
  if (!text) return [];
  return text.split(',').map((part) => part.trim());
}

function walkPlans(node, acc = []) {
  if (!node || typeof node !== 'object') return acc;
  if (Array.isArray(node)) {
    for (const item of node) walkPlans(item, acc);
    return acc;
  }
  acc.push(node);
  if (node.Plan) walkPlans(node.Plan, acc);
  if (node.Plans) walkPlans(node.Plans, acc);
  return acc;
}

async function explainMax(client) {
  const { rows } = await client.query(
    `EXPLAIN (FORMAT JSON)
     SELECT MAX(message_id) AS max_id
     FROM telegram_messages
     WHERE channel_id = $1`,
    [TEST_CHANNEL],
  );
  return rows[0]['QUERY PLAN'];
}

function planIndexNames(planJson) {
  return walkPlans(planJson)
    .map((node) => node['Index Name'])
    .filter(Boolean);
}

async function bootstrapFixture(client) {
  await client.query('DROP TABLE IF EXISTS telegram_messages CASCADE');
  await client.query(`
    CREATE TABLE telegram_messages (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      message_id bigint NOT NULL,
      channel_id uuid
    )
  `);
  await client.query(`
    CREATE UNIQUE INDEX idx_telegram_messages_unique
      ON telegram_messages (message_id, channel_id)
  `);
  // Target channel has only low message_ids. Other rows occupy the high
  // end of the reversed unique (message_id, channel_id) index so MAX for
  // the target channel is a meaningful reversed-key walk before C2.
  await client.query(
    `
    INSERT INTO telegram_messages (message_id, channel_id)
    SELECT g, $1::uuid
    FROM generate_series(1, 800) AS g
    `,
    [TEST_CHANNEL],
  );
  await client.query(
    `
    INSERT INTO telegram_messages (message_id, channel_id)
    SELECT g, $1::uuid
    FROM generate_series(801, 24000) AS g
    `,
    [OTHER_CHANNEL],
  );
  await client.query('ANALYZE telegram_messages');
  const { rows } = await client.query('SELECT count(*)::int AS n FROM telegram_messages');
  pass(`fixture rows=${rows[0].n} target=${TEST_CHANNEL}`);
}

function assertExactC2Index(row) {
  if (!row) fail('C2 index missing');
  if (row.schema_name !== 'public') fail(`schema ${row.schema_name}`);
  if (row.table_name !== 'telegram_messages') fail(`table ${row.table_name}`);
  if (row.method !== 'btree') fail(`method ${row.method}`);
  if (row.is_unique !== false) fail('index must be non-unique');
  if (row.is_valid !== true) fail('indisvalid must be true');
  if (row.is_ready !== true) fail('indisready must be true');
  if (Number(row.key_count) !== 2) fail(`key_count ${row.key_count}`);
  if (Number(row.att_count) !== 2) fail(`att_count ${row.att_count} (INCLUDE not allowed)`);
  if (row.predicate != null) fail(`predicate ${row.predicate}`);
  const keys = asTextArray(row.key_columns);
  if (keys.join(',') !== 'channel_id,message_id') {
    fail(`key order ${keys.join(',')}`);
  }
  if (!String(row.indexdef).includes('CREATE INDEX')) fail('indexdef missing CREATE INDEX');
  if (/CREATE UNIQUE INDEX/i.test(row.indexdef)) fail('indexdef is UNIQUE');
  if (/IF NOT EXISTS/i.test(row.indexdef)) fail('IF NOT EXISTS must not appear');
  if (/\bDESC\b/i.test(row.indexdef)) fail('DESC must not appear');
  pass(`exact index ${row.indexdef}`);
}

async function provePrePlan(client) {
  const idx = await loadIndex(client);
  if (idx) fail('C2 index must be absent before 052');
  const plan = await explainMax(client);
  const names = planIndexNames(plan);
  if (names.includes(INDEX_NAME)) fail('pre-plan already uses C2 index');
  console.log('PRE_PLAN_INDEXES', names.join(',') || '(none)');
  console.log('PRE_PLAN_JSON', JSON.stringify(plan));
  pass('pre-index plan does not use C2 channel-leading index');
}

async function provePostApply(client) {
  const idx = await loadIndex(client);
  assertExactC2Index(idx);
  const names = await ledgerNames(client);
  const c2 = names.filter((n) => n === MIGRATION_NAME);
  if (c2.length !== 1) fail(`052 ledger count ${c2.length}`);
  if (names.includes('050_mexc_capability_snapshots_rollback')) fail('050 ledger present');
  if (names.includes('051_artemis_b10_decision_persistence')) fail('051 ledger present');
  if (await relationExists(client, 'mexc_capability_state_snapshots')) {
    fail('050 schema object present');
  }
  if (await relationExists(client, 'artemis_decisions')) {
    fail('051 schema object present');
  }
  pass('052 ledger=1; 050/051 ledger and schema absent');
}

async function provePostPlan(client) {
  await client.query('ANALYZE telegram_messages');
  const plan = await explainMax(client);
  const names = planIndexNames(plan);
  console.log('POST_PLAN_INDEXES', names.join(',') || '(none)');
  console.log('POST_PLAN_JSON', JSON.stringify(plan));
  if (!names.includes(INDEX_NAME)) {
    fail(`post-plan does not use ${INDEX_NAME} (used ${names.join(',') || 'none'})`);
  }
  if (names.includes('idx_telegram_messages_unique') && !names.includes(INDEX_NAME)) {
    fail('reversed unique path still selected');
  }
  pass('post-plan uses C2 channel-leading index');
}

async function proveIdempotentState(client) {
  const names = await ledgerNames(client);
  const c2 = names.filter((n) => n === MIGRATION_NAME);
  if (c2.length !== 1) fail(`052 ledger count after second up: ${c2.length}`);
  const { rows } = await client.query(
    `SELECT count(*)::int AS n FROM pg_class i
     JOIN pg_namespace n ON n.oid = i.relnamespace
     WHERE n.nspname = 'public' AND i.relname = $1`,
    [INDEX_NAME],
  );
  if (Number(rows[0].n) !== 1) fail(`duplicate index count ${rows[0].n}`);
  assertExactC2Index(await loadIndex(client));
  pass('idempotent: one ledger row, one exact valid index');
}

async function setupWrongIndex(client) {
  await bootstrapFixture(client);
  await client.query(`
    CREATE INDEX idx_telegram_messages_channel_message_id
      ON telegram_messages (channel_id)
  `);
  pass('wrong same-name index created (channel_id only)');
}

async function proveWrongUntouched(client) {
  const names = await ledgerNames(client);
  if (names.includes(MIGRATION_NAME)) fail('052 ledger must remain absent after conflict');
  const idx = await loadIndex(client);
  if (!idx) fail('wrong index was dropped');
  const keys = asTextArray(idx.key_columns);
  if (keys.join(',') !== 'channel_id') {
    fail(`wrong index was replaced; keys=${keys.join(',')}`);
  }
  pass('wrong-definition index untouched; no 052 ledger');
}

async function setupPartialTrap(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS pgmigrations (
      id SERIAL PRIMARY KEY,
      name varchar(255) NOT NULL,
      run_on timestamp NOT NULL
    )
  `);
  await client.query(`
    CREATE OR REPLACE FUNCTION c2_ci_reject_052_ledger()
    RETURNS trigger
    LANGUAGE plpgsql
    AS $$
    BEGIN
      IF NEW.name = '${MIGRATION_NAME}' THEN
        RAISE EXCEPTION 'C2_CI_SYNTHETIC_LEDGER_INSERT_REJECT';
      END IF;
      RETURN NEW;
    END;
    $$
  `);
  await client.query('DROP TRIGGER IF EXISTS c2_ci_reject_052_ledger ON pgmigrations');
  await client.query(`
    CREATE TRIGGER c2_ci_reject_052_ledger
    BEFORE INSERT ON pgmigrations
    FOR EACH ROW
    EXECUTE FUNCTION c2_ci_reject_052_ledger()
  `);
  pass('partial-success ledger INSERT trap installed');
}

async function dropPartialTrap(client) {
  await client.query('DROP TRIGGER IF EXISTS c2_ci_reject_052_ledger ON pgmigrations');
  await client.query('DROP FUNCTION IF EXISTS c2_ci_reject_052_ledger()');
  pass('partial-success ledger INSERT trap removed');
}

async function provePartialValidLedgerAbsent(client) {
  const idx = await loadIndex(client);
  assertExactC2Index(idx);
  const names = await ledgerNames(client);
  if (names.includes(MIGRATION_NAME)) fail('052 ledger present in partial-success window');
  pass('PARTIAL_SUCCESS_INDEX_VALID_LEDGER_ABSENT');
}

async function setupInvalidIndex(client) {
  await bootstrapFixture(client);
  await client.query(`
    CREATE INDEX idx_telegram_messages_channel_message_id
      ON telegram_messages (channel_id, message_id)
  `);
  await client.query(`
    UPDATE pg_index
    SET indisvalid = false
    WHERE indexrelid = 'public.idx_telegram_messages_channel_message_id'::regclass
  `);
  const idx = await loadIndex(client);
  if (!idx || idx.is_valid !== false) {
    fail('could not simulate indisvalid=false (superuser catalog update failed)');
  }
  pass('invalid same-name index simulated via pg_index.indisvalid=false');
}

async function proveInvalidRefused(client) {
  const names = await ledgerNames(client);
  if (names.includes(MIGRATION_NAME)) fail('052 ledger present after invalid-index refusal');
  const idx = await loadIndex(client);
  if (!idx) fail('invalid index was dropped');
  if (idx.is_valid !== false) fail('invalid index was repaired');
  pass('invalid-index contract: no ledger, index left invalid');
}

async function proveDownState(client) {
  const idx = await loadIndex(client);
  if (idx) fail('C2 index still present after down');
  const names = await ledgerNames(client);
  if (names.includes(MIGRATION_NAME)) fail('052 ledger still present after down');
  if (names.includes('050_mexc_capability_snapshots_rollback')) fail('050 ledger appeared');
  if (names.includes('051_artemis_b10_decision_persistence')) fail('051 ledger appeared');
  pass('down removed C2 index and 052 ledger; 050/051 untouched');
}

async function proveNamedFileIsolation(client) {
  const names = await ledgerNames(client);
  if (names.includes('050_mexc_capability_snapshots_rollback')) fail('050 ledger present');
  if (names.includes('051_artemis_b10_decision_persistence')) fail('051 ledger present');
  const c2 = names.filter((n) => n === MIGRATION_NAME);
  if (c2.length !== 1) fail(`052 ledger count ${c2.length} names=${names.join(',')}`);
  if (await relationExists(client, 'mexc_capability_state_snapshots')) fail('050 executed');
  if (await relationExists(client, 'mexc_capability_verification_runs')) fail('050 executed');
  if (await relationExists(client, 'artemis_decisions')) fail('051 executed');
  if (await relationExists(client, 'artemis_decision_evidence_refs')) fail('051 executed');
  pass('named-file isolation: 052 only; 050/051 not executed');
}

const handlers = {
  'require-pg14': (client) => requirePg14(client),
  'bootstrap-fixture': (client) => bootstrapFixture(client),
  'prove-pre-plan': (client) => provePrePlan(client),
  'prove-post-apply': (client) => provePostApply(client),
  'prove-post-plan': (client) => provePostPlan(client),
  'prove-idempotent-state': (client) => proveIdempotentState(client),
  'setup-wrong-index': (client) => setupWrongIndex(client),
  'prove-wrong-untouched': (client) => proveWrongUntouched(client),
  'setup-partial-trap': async (client) => {
    await bootstrapFixture(client);
    await setupPartialTrap(client);
  },
  'drop-partial-trap': (client) => dropPartialTrap(client),
  'prove-partial-valid-ledger-absent': (client) => provePartialValidLedgerAbsent(client),
  'setup-invalid-index': (client) => setupInvalidIndex(client),
  'prove-invalid-refused': (client) => proveInvalidRefused(client),
  'prove-down-state': (client) => proveDownState(client),
  'prove-named-file-isolation': (client) => proveNamedFileIsolation(client),
};

if (!command || command === 'safety') {
  requireCiSafety();
  process.exit(0);
}

const handler = handlers[command];
if (!handler) {
  fail(`unknown command ${command}`);
}

withClient(handler).catch((error) => {
  fail(error.stack || error.message);
});
