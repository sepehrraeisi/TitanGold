/**
 * C2 — telegram_messages channel-leading access path.
 *
 * Index:
 *   CREATE INDEX CONCURRENTLY idx_telegram_messages_channel_message_id
 *     ON public.telegram_messages (channel_id, message_id);
 *
 * NON-UNIQUE btree. No DESC. No INCLUDE. No predicate. No IF NOT EXISTS.
 *
 * Transaction:
 *   pgm.noTransaction() is mandatory. CREATE/DROP INDEX CONCURRENTLY cannot
 *   run inside a transaction block. Compatible with --no-single-transaction.
 *
 * Self-contained: no application / collector / env imports.
 *
 * Non-atomic DDL vs pgmigrations ledger (Owner reconciliation, no auto-repair):
 *   A READY_TO_APPLY — index absent, 052 ledger absent
 *   B APPLIED_EXACT — index valid exact, 052 ledger present
 *   C PARTIAL_SUCCESS_INDEX_VALID_LEDGER_ABSENT — valid exact index, ledger absent
 *   D PARTIAL_FAILURE_INVALID_INDEX — invalid/unready same-name, ledger absent
 *   E LEDGER_SCHEMA_DIVERGENCE — index absent, 052 ledger present
 *   F INDEX_DEFINITION_CONFLICT — same-name wrong definition
 *
 * This migration never silently reconciles C/D/E/F into pgmigrations.
 */

const INDEX_NAME = 'idx_telegram_messages_channel_message_id';
const TABLE_NAME = 'telegram_messages';
const TABLE_SCHEMA = 'public';
const KEY_COLUMNS = Object.freeze(['channel_id', 'message_id']);

const SAME_NAME_SQL = `
  SELECT
    n.nspname AS schema_name,
    i.relname AS index_name,
    i.relkind AS relkind,
    t.relname AS table_name,
    tn.nspname AS table_schema,
    am.amname AS method,
    ix.indisunique AS is_unique,
    ix.indisvalid AS is_valid,
    ix.indisready AS is_ready,
    ix.indnkeyatts AS key_count,
    ix.indnatts AS att_count,
    pg_get_expr(ix.indpred, ix.indrelid) AS predicate,
    (
      SELECT array_agg(a.attname ORDER BY x.ordinality)
      FROM unnest(ix.indkey) WITH ORDINALITY AS x(attnum, ordinality)
      JOIN pg_attribute a
        ON a.attrelid = t.oid AND a.attnum = x.attnum
      WHERE x.ordinality <= ix.indnkeyatts
    ) AS key_columns,
    (
      SELECT array_agg(
        CASE (ix.indoption[x.ordinality - 1] & 1)
          WHEN 1 THEN 'DESC'
          ELSE 'ASC'
        END
        ORDER BY x.ordinality
      )
      FROM unnest(ix.indkey) WITH ORDINALITY AS x(attnum, ordinality)
      WHERE x.ordinality <= ix.indnkeyatts
    ) AS key_dirs
  FROM pg_class i
  JOIN pg_namespace n ON n.oid = i.relnamespace
  LEFT JOIN pg_index ix ON ix.indexrelid = i.oid
  LEFT JOIN pg_class t ON t.oid = ix.indrelid
  LEFT JOIN pg_namespace tn ON tn.oid = t.relnamespace
  LEFT JOIN pg_am am ON am.oid = i.relam
  WHERE n.nspname = $1
    AND i.relname = $2
`;

function stop(code, detail) {
  const suffix = detail ? `: ${detail}` : '';
  throw new Error(`${code}${suffix}`);
}

function asTextArray(value) {
  if (value == null) return [];
  if (Array.isArray(value)) return value.map(String);
  const text = String(value).replace(/^\{/, '').replace(/\}$/, '');
  if (!text) return [];
  return text.split(',').map((part) => part.trim());
}

function isExactC2Index(row) {
  if (!row) return false;
  if (row.relkind !== 'i') return false;
  if (row.schema_name !== TABLE_SCHEMA) return false;
  if (row.table_schema !== TABLE_SCHEMA) return false;
  if (row.table_name !== TABLE_NAME) return false;
  if (row.method !== 'btree') return false;
  if (row.is_unique === true) return false;
  if (Number(row.key_count) !== KEY_COLUMNS.length) return false;
  if (Number(row.att_count) !== KEY_COLUMNS.length) return false;
  if (row.predicate != null) return false;
  const keys = asTextArray(row.key_columns);
  if (keys.length !== KEY_COLUMNS.length) return false;
  for (let i = 0; i < KEY_COLUMNS.length; i += 1) {
    if (keys[i] !== KEY_COLUMNS[i]) return false;
  }
  const dirs = asTextArray(row.key_dirs);
  if (dirs.some((dir) => dir === 'DESC')) return false;
  return true;
}

async function loadSameName(pgm) {
  const rows = await pgm.db.select(SAME_NAME_SQL, [TABLE_SCHEMA, INDEX_NAME]);
  return rows[0] || null;
}

function classifyExistingForUp(row) {
  if (row.relkind !== 'i' || row.table_name == null) {
    return 'C2_052_INDEX_DEFINITION_CONFLICT_STOP';
  }
  if (row.is_valid === false || row.is_ready === false) {
    return 'C2_052_INDEX_INVALID_STOP';
  }
  if (!isExactC2Index(row)) {
    return 'C2_052_INDEX_DEFINITION_CONFLICT_STOP';
  }
  return 'C2_052_INDEX_ALREADY_EXISTS_STOP';
}

function assertExactC2IndexForDown(row) {
  if (!row) {
    stop(
      'C2_052_DOWN_INDEX_MISSING_STOP',
      'index absent while down was requested; ledger must not be silently deleted',
    );
  }
  if (row.is_valid === false || row.is_ready === false) {
    // Exact keys/table still required. Invalid same-name on the wrong
    // definition is a conflict, not an authorized drop.
    if (!isExactC2Index({ ...row, is_valid: true, is_ready: true })) {
      stop(
        'C2_052_INDEX_DEFINITION_CONFLICT_STOP',
        'invalid same-name index is not the intended C2 definition',
      );
    }
    return;
  }
  if (!isExactC2Index(row)) {
    const detail = [
      `table=${row.table_schema}.${row.table_name}`,
      `keys=${asTextArray(row.key_columns).join(',')}`,
      `unique=${row.is_unique}`,
      `predicate=${row.predicate}`,
    ].join(' ');
    stop('C2_052_INDEX_DEFINITION_CONFLICT_STOP', detail);
  }
}

const indexOptions = {
  name: INDEX_NAME,
  concurrently: true,
  unique: false,
  ifNotExists: false,
  method: 'btree',
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @returns {Promise<void>}
 */
export const up = async (pgm) => {
  pgm.noTransaction();

  const existing = await loadSameName(pgm);
  if (existing) {
    stop(classifyExistingForUp(existing), `public.${INDEX_NAME} already present`);
  }

  pgm.createIndex(
    { schema: TABLE_SCHEMA, name: TABLE_NAME },
    [...KEY_COLUMNS],
    indexOptions,
  );
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @returns {Promise<void>}
 */
export const down = async (pgm) => {
  pgm.noTransaction();

  const existing = await loadSameName(pgm);
  assertExactC2IndexForDown(existing);

  pgm.dropIndex(
    { schema: TABLE_SCHEMA, name: TABLE_NAME },
    [...KEY_COLUMNS],
    {
      name: INDEX_NAME,
      concurrently: true,
      ifExists: false,
    },
  );
};
