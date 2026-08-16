#!/usr/bin/env node
/**
 * Artemis B10 — disposable PG14 CI verification for migration 051.
 *
 * Fail-closed unless:
 *   TITAN_B10_CI_PG14=1
 *   DATABASE_URL host is localhost or 127.0.0.1
 *   DATABASE_URL database is titangold_b10_test
 *
 * Never targets production. Never mutates durable live state.
 */

import pg from 'pg';

const EXPECTED_MIGRATION_NAME = '051_artemis_b10_decision_persistence';
const MIGRATIONS_TABLE = 'b10_pgmigrations';

function fail(message) {
  console.error(`FAIL: ${message}`);
  process.exit(1);
}

function pass(message) {
  console.log(`PASS: ${message}`);
}

function requireCiSafety() {
  if (process.env.TITAN_B10_CI_PG14 !== '1') {
    fail('TITAN_B10_CI_PG14 must be exactly "1"');
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
  if (db !== 'titangold_b10_test') {
    fail(`database must be titangold_b10_test (got ${db})`);
  }

  pass(`safety host=${host} db=${db}`);
  return urlRaw;
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

async function requireLedger(client) {
  const { rows } = await client.query(
    `SELECT name, run_on FROM ${MIGRATIONS_TABLE} ORDER BY id`,
  );
  if (rows.length !== 1) {
    fail(`expected exactly one ${MIGRATIONS_TABLE} row, got ${rows.length}`);
  }
  if (rows[0].name !== EXPECTED_MIGRATION_NAME) {
    fail(`expected ledger name ${EXPECTED_MIGRATION_NAME}, got ${rows[0].name}`);
  }
  pass(`ledger recorded ${rows[0].name}`);
}

async function tableExists(client, table) {
  const { rows } = await client.query(
    `SELECT 1 FROM information_schema.tables
     WHERE table_schema='public' AND table_name=$1`,
    [table],
  );
  return rows.length === 1;
}

async function requireTables(client) {
  for (const t of ['artemis_decisions', 'artemis_decision_evidence_refs']) {
    if (!(await tableExists(client, t))) fail(`missing table ${t}`);
    pass(`table ${t} exists`);
  }
}

async function constraintDef(client, table, name) {
  const { rows } = await client.query(
    `SELECT pg_get_constraintdef(c.oid, true) AS def, c.contype
     FROM pg_constraint c
     JOIN pg_class t ON t.oid = c.conrelid
     JOIN pg_namespace n ON n.oid = t.relnamespace
     WHERE n.nspname='public' AND t.relname=$1 AND c.conname=$2`,
    [table, name],
  );
  if (!rows.length) fail(`missing constraint ${table}.${name}`);
  return rows[0];
}

async function requirePk(client, table, expectedCols) {
  const { rows } = await client.query(
    `SELECT a.attname
     FROM pg_index i
     JOIN pg_class t ON t.oid = i.indrelid
     JOIN pg_namespace n ON n.oid = t.relnamespace
     JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(i.indkey)
     WHERE n.nspname='public' AND t.relname=$1 AND i.indisprimary
     ORDER BY array_position(i.indkey, a.attnum)`,
    [table],
  );
  const cols = rows.map((r) => r.attname);
  if (cols.join(',') !== expectedCols.join(',')) {
    fail(`PK ${table} expected (${expectedCols.join(',')}) got (${cols.join(',')})`);
  }
  pass(`PK ${table}(${expectedCols.join(',')})`);
}

async function requireFkRestrict(client) {
  const { rows } = await client.query(
    `SELECT pg_get_constraintdef(c.oid, true) AS def
     FROM pg_constraint c
     JOIN pg_class t ON t.oid = c.conrelid
     JOIN pg_namespace n ON n.oid = t.relnamespace
     WHERE n.nspname='public'
       AND t.relname='artemis_decision_evidence_refs'
       AND c.contype='f'`,
  );
  const hit = rows.find(
    (r) =>
      /decision_id/.test(r.def)
      && /artemis_decisions/.test(r.def)
      && /ON DELETE RESTRICT/i.test(r.def),
  );
  if (!hit) fail('FK evidence_refs.decision_id → artemis_decisions ON DELETE RESTRICT missing');
  pass(`FK RESTRICT: ${hit.def}`);
}

async function requireChecks(client) {
  const checks = [
    ['artemis_decisions', 'artemis_decisions_payload_bytes_chk', /payload_bytes > 0/i],
    ['artemis_decisions', 'artemis_decisions_payload_sha256_chk', /\[0-9a-f\]\{64\}/i],
    ['artemis_decisions', 'artemis_decisions_canonicalization_version_chk', /btrim\(canonicalization_version\)/i],
    ['artemis_decisions', 'artemis_decisions_writer_nonempty_chk', /btrim\(writer\)/i],
    ['artemis_decisions', 'artemis_decisions_decision_eligible_false_chk', /decision_eligible IS FALSE/i],
    ['artemis_decisions', 'artemis_decisions_execution_eligible_false_chk', /execution_eligible IS FALSE/i],
    ['artemis_decisions', 'artemis_decisions_payload_object_chk', /jsonb_typeof\(decision_payload\) = 'object'/i],
    ['artemis_decision_evidence_refs', 'artemis_decision_evidence_refs_ordinal_chk', /ordinal >= 0 AND ordinal < 32/i],
    ['artemis_decision_evidence_refs', 'artemis_decision_evidence_refs_agent_nonempty_chk', /btrim\(agent_id\)/i],
    ['artemis_decision_evidence_refs', 'artemis_decision_evidence_refs_payload_object_chk', /jsonb_typeof\(ref_payload\) = 'object'/i],
  ];
  for (const [table, name, re] of checks) {
    const row = await constraintDef(client, table, name);
    if (row.contype !== 'c') fail(`${name} is not a CHECK`);
    if (!re.test(row.def)) fail(`${name} semantics mismatch: ${row.def}`);
    pass(`CHECK ${name}`);
  }
}

async function requireIndexes(client) {
  const required = [
    'idx_artemis_decisions_context_created',
    'idx_artemis_decisions_symbol_created',
    'idx_artemis_decision_evidence_refs_agent_run',
  ];
  for (const name of required) {
    const { rows } = await client.query(
      `SELECT pg_get_indexdef(i.oid) AS def
       FROM pg_class i
       JOIN pg_namespace n ON n.oid = i.relnamespace
       WHERE n.nspname='public' AND i.relname=$1 AND i.relkind='i'`,
      [name],
    );
    if (!rows.length) fail(`missing index ${name}`);
    pass(`index ${name}`);
    if (name === 'idx_artemis_decisions_symbol_created') {
      const def = rows[0].def;
      if (!/WHERE/i.test(def) || !/symbol IS NOT NULL/i.test(def)) {
        fail(`partial predicate missing on ${name}: ${def}`);
      }
      pass(`partial index predicate symbol IS NOT NULL`);
    }
  }
}

async function requireTypes(client) {
  const expected = {
    artemis_decisions: {
      decision_id: 'uuid',
      decision_payload: 'jsonb',
      created_at: 'timestamptz',
      decision_eligible: 'bool',
      payload_bytes: 'int4',
      writer: 'text',
    },
    artemis_decision_evidence_refs: {
      decision_id: 'uuid',
      ordinal: 'int4',
      ref_payload: 'jsonb',
      analysis_timestamp: 'timestamptz',
      agent_id: 'text',
    },
  };
  for (const [table, cols] of Object.entries(expected)) {
    for (const [col, udt] of Object.entries(cols)) {
      const { rows } = await client.query(
        `SELECT t.typname AS udt
         FROM pg_attribute a
         JOIN pg_class c ON c.oid=a.attrelid
         JOIN pg_namespace n ON n.oid=c.relnamespace
         JOIN pg_type t ON t.oid=a.atttypid
         WHERE n.nspname='public' AND c.relname=$1 AND a.attname=$2
           AND a.attnum>0 AND NOT a.attisdropped`,
        [table, col],
      );
      if (!rows.length || rows[0].udt !== udt) {
        fail(`type ${table}.${col} expected ${udt} got ${rows[0]?.udt || 'MISSING'}`);
      }
    }
  }
  pass('important column types');
}

async function requireComments(client) {
  const checks = [
    ['artemis_decisions', null, /B10 append-only ArtemisDecision store/i],
    ['artemis_decision_evidence_refs', null, /Decision-safe evidence refs/i],
    ['artemis_decisions', 'decision_payload', /Exact validated canonical ArtemisDecision/i],
    ['artemis_decisions', 'payload_sha256', /Lowercase SHA-256/i],
    ['artemis_decisions', 'canonicalization_version', /titangold-json-c14n-1/i],
  ];
  for (const [table, column, re] of checks) {
    let comment;
    if (column == null) {
      const { rows } = await client.query(
        `SELECT obj_description(c.oid, 'pg_class') AS comment
         FROM pg_class c
         JOIN pg_namespace n ON n.oid=c.relnamespace
         WHERE n.nspname='public' AND c.relname=$1`,
        [table],
      );
      comment = rows[0]?.comment;
    } else {
      const { rows } = await client.query(
        `SELECT col_description(c.oid, a.attnum) AS comment
         FROM pg_class c
         JOIN pg_namespace n ON n.oid=c.relnamespace
         JOIN pg_attribute a ON a.attrelid=c.oid
         WHERE n.nspname='public' AND c.relname=$1 AND a.attname=$2`,
        [table, column],
      );
      comment = rows[0]?.comment;
    }
    if (!comment || !re.test(comment)) {
      fail(`comment mismatch ${table}.${column || '(table)'}: ${comment || 'MISSING'}`);
    }
  }
  pass('expected comments');
}

function baseDecision(over = {}) {
  return {
    decision_id: over.decision_id || '11111111-1111-4111-8111-111111111101',
    decision_context_id: over.decision_context_id || '22222222-2222-4222-8222-222222222201',
    schema_version: '1.0.0',
    contract_version: 'artemis-decision-1.0.0',
    created_at: '2026-08-10T12:10:00.000Z',
    analysis_at: '2026-08-10T12:00:00.000Z',
    synthesis_outcome: 'UNSPECIFIED',
    classification: 'ADVISORY',
    maturity_stage: 'STAGE_0',
    decision_eligible: false,
    execution_eligible: false,
    decision_payload: over.decision_payload || { ok: true },
    payload_sha256: over.payload_sha256 || 'a'.repeat(64),
    payload_bytes: over.payload_bytes ?? 16,
    canonicalization_version: 'titangold-json-c14n-1',
    writer: 'ci-b10-verify',
    ...over,
  };
}

async function insertParent(client, over = {}) {
  const d = baseDecision(over);
  await client.query(
    `INSERT INTO artemis_decisions (
      decision_id, decision_context_id, schema_version, contract_version,
      created_at, analysis_at, synthesis_outcome, classification, maturity_stage,
      decision_eligible, execution_eligible, decision_payload, payload_sha256,
      payload_bytes, canonicalization_version, writer
    ) VALUES (
      $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb,$13,$14,$15,$16
    )`,
    [
      d.decision_id,
      d.decision_context_id,
      d.schema_version,
      d.contract_version,
      d.created_at,
      d.analysis_at,
      d.synthesis_outcome,
      d.classification,
      d.maturity_stage,
      d.decision_eligible,
      d.execution_eligible,
      JSON.stringify(d.decision_payload),
      d.payload_sha256,
      d.payload_bytes,
      d.canonicalization_version,
      d.writer,
    ],
  );
  return d.decision_id;
}

async function expectCheckFail(client, label, constraintName, sql, params) {
  const sp = `sp_${label.replace(/[^a-z0-9_]/gi, '_')}`;
  await client.query(`SAVEPOINT ${sp}`);
  try {
    await client.query(sql, params);
    await client.query(`ROLLBACK TO SAVEPOINT ${sp}`);
    fail(`${label}: expected CHECK failure but insert succeeded`);
  } catch (err) {
    await client.query(`ROLLBACK TO SAVEPOINT ${sp}`);
    if (err.code !== '23514') {
      fail(`${label}: expected SQLSTATE 23514 got ${err.code || err.message}`);
    }
    const cname = err.constraint || '';
    if (cname !== constraintName) {
      fail(`${label}: expected constraint ${constraintName} got ${cname || 'NONE'}`);
    }
    pass(`negative ${label} → ${constraintName}`);
  }
}

async function negativeChecks(client) {
  await client.query('BEGIN');
  try {
    const parentId = await insertParent(client, {
      decision_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    });

    await expectCheckFail(
      client,
      'decision_eligible_true',
      'artemis_decisions_decision_eligible_false_chk',
      `INSERT INTO artemis_decisions (
        decision_id, decision_context_id, schema_version, contract_version,
        created_at, analysis_at, synthesis_outcome, classification, maturity_stage,
        decision_eligible, execution_eligible, decision_payload, payload_sha256,
        payload_bytes, canonicalization_version, writer
      ) VALUES (
        'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','22222222-2222-4222-8222-222222222201',
        '1.0.0','artemis-decision-1.0.0','2026-08-10T12:10:00.000Z','2026-08-10T12:00:00.000Z',
        'UNSPECIFIED','ADVISORY','STAGE_0', true, false, '{"ok":true}'::jsonb,
        $1, 16, 'titangold-json-c14n-1', 'ci'
      )`,
      ['b'.repeat(64)],
    );

    await expectCheckFail(
      client,
      'execution_eligible_true',
      'artemis_decisions_execution_eligible_false_chk',
      `INSERT INTO artemis_decisions (
        decision_id, decision_context_id, schema_version, contract_version,
        created_at, analysis_at, synthesis_outcome, classification, maturity_stage,
        decision_eligible, execution_eligible, decision_payload, payload_sha256,
        payload_bytes, canonicalization_version, writer
      ) VALUES (
        'cccccccc-cccc-4ccc-8ccc-cccccccccccc','22222222-2222-4222-8222-222222222201',
        '1.0.0','artemis-decision-1.0.0','2026-08-10T12:10:00.000Z','2026-08-10T12:00:00.000Z',
        'UNSPECIFIED','ADVISORY','STAGE_0', false, true, '{"ok":true}'::jsonb,
        $1, 16, 'titangold-json-c14n-1', 'ci'
      )`,
      ['c'.repeat(64)],
    );

    await expectCheckFail(
      client,
      'bad_sha',
      'artemis_decisions_payload_sha256_chk',
      `INSERT INTO artemis_decisions (
        decision_id, decision_context_id, schema_version, contract_version,
        created_at, analysis_at, synthesis_outcome, classification, maturity_stage,
        decision_eligible, execution_eligible, decision_payload, payload_sha256,
        payload_bytes, canonicalization_version, writer
      ) VALUES (
        'dddddddd-dddd-4ddd-8ddd-dddddddddddd','22222222-2222-4222-8222-222222222201',
        '1.0.0','artemis-decision-1.0.0','2026-08-10T12:10:00.000Z','2026-08-10T12:00:00.000Z',
        'UNSPECIFIED','ADVISORY','STAGE_0', false, false, '{"ok":true}'::jsonb,
        'NOT_A_HASH', 16, 'titangold-json-c14n-1', 'ci'
      )`,
      [],
    );

    await expectCheckFail(
      client,
      'payload_bytes_zero',
      'artemis_decisions_payload_bytes_chk',
      `INSERT INTO artemis_decisions (
        decision_id, decision_context_id, schema_version, contract_version,
        created_at, analysis_at, synthesis_outcome, classification, maturity_stage,
        decision_eligible, execution_eligible, decision_payload, payload_sha256,
        payload_bytes, canonicalization_version, writer
      ) VALUES (
        'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee','22222222-2222-4222-8222-222222222201',
        '1.0.0','artemis-decision-1.0.0','2026-08-10T12:10:00.000Z','2026-08-10T12:00:00.000Z',
        'UNSPECIFIED','ADVISORY','STAGE_0', false, false, '{"ok":true}'::jsonb,
        $1, 0, 'titangold-json-c14n-1', 'ci'
      )`,
      ['e'.repeat(64)],
    );

    await expectCheckFail(
      client,
      'payload_bytes_high',
      'artemis_decisions_payload_bytes_chk',
      `INSERT INTO artemis_decisions (
        decision_id, decision_context_id, schema_version, contract_version,
        created_at, analysis_at, synthesis_outcome, classification, maturity_stage,
        decision_eligible, execution_eligible, decision_payload, payload_sha256,
        payload_bytes, canonicalization_version, writer
      ) VALUES (
        'ffffffff-ffff-4fff-8fff-ffffffffffff','22222222-2222-4222-8222-222222222201',
        '1.0.0','artemis-decision-1.0.0','2026-08-10T12:10:00.000Z','2026-08-10T12:00:00.000Z',
        'UNSPECIFIED','ADVISORY','STAGE_0', false, false, '{"ok":true}'::jsonb,
        $1, 16385, 'titangold-json-c14n-1', 'ci'
      )`,
      ['f'.repeat(64)],
    );

    await expectCheckFail(
      client,
      'ordinal_32',
      'artemis_decision_evidence_refs_ordinal_chk',
      `INSERT INTO artemis_decision_evidence_refs (
        decision_id, ordinal, agent_id, evidence_contract_version, ref_payload
      ) VALUES ($1, 32, 'trend', 'artemis-evidence-1.0.0', '{"ok":true}'::jsonb)`,
      [parentId],
    );
  } finally {
    await client.query('ROLLBACK');
    pass('verification transaction rolled back');
  }
}

async function main() {
  const databaseUrl = requireCiSafety();
  const client = new pg.Client({
    connectionString: databaseUrl,
    connectionTimeoutMillis: 10000,
    statement_timeout: 30000,
  });
  await client.connect();
  try {
    await requirePg14(client);
    await requireLedger(client);
    await requireTables(client);
    await requirePk(client, 'artemis_decisions', ['decision_id']);
    await requirePk(client, 'artemis_decision_evidence_refs', ['decision_id', 'ordinal']);
    await requireFkRestrict(client);
    await requireChecks(client);
    await requireIndexes(client);
    await requireTypes(client);
    await requireComments(client);
    await negativeChecks(client);
    console.log('B10_PG14_051_CI_VERIFY=PASS');
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error('FAIL: unexpected error', err?.message || err);
  process.exit(1);
});
