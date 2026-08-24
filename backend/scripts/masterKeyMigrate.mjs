import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';

import { getClient } from '../database/db.js';
import { classifyCiphertext, decryptCompatibleSecret, encryptMk2Secret } from '../utils/crypto.js';

const DEFAULT_BATCH_SIZE = 100;
const DEFAULT_CHECKPOINT_DIR = path.join(process.cwd(), '.tmp', 'master-key-migration');
const TERMINAL_STATES = new Set(['FAILED', 'COMPLETED']);

function sanitizeError(error) {
  const message = String(error?.message || 'unknown error')
    .replace(/mk2:[0-9a-f:]+/gi, '[REDACTED_CIPHERTEXT]')
    .replace(/[0-9a-f]{64}/gi, '[REDACTED_KEY]');
  return {
    name: error?.name || 'Error',
    message,
  };
}

export function createStateMachine() {
  let state = 'ACTIVE';
  return {
    getState() {
      return state;
    },
    assertMutable() {
      if (TERMINAL_STATES.has(state)) {
        throw new Error(`Mutation blocked after terminal state: ${state}`);
      }
    },
    markFailed() {
      state = 'FAILED';
    },
    markCompleted() {
      state = 'COMPLETED';
    },
  };
}

export function createCheckpointStore({
  checkpointDir = DEFAULT_CHECKPOINT_DIR,
  fsImpl = fs,
} = {}) {
  return {
    getPath(runId) {
      return path.join(checkpointDir, `${runId}.json`);
    },
    load(runId) {
      const filePath = this.getPath(runId);
      if (!fsImpl.existsSync(filePath)) return null;
      return JSON.parse(fsImpl.readFileSync(filePath, 'utf8'));
    },
    save(runId, data) {
      fsImpl.mkdirSync(checkpointDir, { recursive: true, mode: 0o700 });
      const filePath = this.getPath(runId);
      fsImpl.writeFileSync(filePath, JSON.stringify(data, null, 2), { mode: 0o600 });
      return filePath;
    },
  };
}

function normalizeOptions(raw = {}) {
  const batchSize = Number.parseInt(raw.batchSize ?? DEFAULT_BATCH_SIZE, 10);
  return {
    apply: Boolean(raw.apply),
    dryRun: Boolean(raw.dryRun),
    resume: Boolean(raw.resume),
    batchSize: Number.isFinite(batchSize) && batchSize > 0 ? batchSize : DEFAULT_BATCH_SIZE,
    runId: raw.runId || `mk-${Date.now()}`,
    logger: raw.logger || console,
  };
}

export function classifyValue(value) {
  return classifyCiphertext(value);
}

function createTextSurface({
  id,
  table,
  column,
  updatedAt = true,
}) {
  const afterClause = '($1::uuid IS NULL OR id::text > $1::text)';
  return {
    id,
    async listEligible(client, { afterPk, limit }) {
      const sql = `
        SELECT id::text AS pk, ${column} AS stored_value
        FROM ${table}
        WHERE ${column} IS NOT NULL
          AND ${afterClause}
        ORDER BY id::text ASC
        LIMIT $2
      `;
      const result = await client.query(sql, [afterPk || null, limit]);
      return result.rows.map((row) => ({
        pk: row.pk,
        storedValue: row.stored_value,
      }));
    },
    async compareAndSet(client, { pk, previousValue, nextValue }) {
      const sql = `
        UPDATE ${table}
        SET ${column} = $1
            ${updatedAt ? ', updated_at = NOW()' : ''}
        WHERE id::text = $2
          AND ${column} IS NOT DISTINCT FROM $3
      `;
      const result = await client.query(sql, [nextValue, pk, previousValue]);
      return result.rowCount;
    },
  };
}

function createJsonbSurface({
  id,
  table,
  column,
  jsonPath,
  updatedAt = true,
}) {
  const pgPath = `{${jsonPath.join(',')}}`;
  const afterClause = '($1::uuid IS NULL OR id::text > $1::text)';
  return {
    id,
    async listEligible(client, { afterPk, limit }) {
      const sql = `
        SELECT id::text AS pk,
               ${column}::text AS container_json,
               ${column} #>> '${pgPath}' AS stored_value
        FROM ${table}
        WHERE ${column} IS NOT NULL
          AND ${column} #>> '${pgPath}' IS NOT NULL
          AND ${afterClause}
        ORDER BY id::text ASC
        LIMIT $2
      `;
      const result = await client.query(sql, [afterPk || null, limit]);
      return result.rows.map((row) => ({
        pk: row.pk,
        storedValue: row.stored_value,
        containerJson: row.container_json,
      }));
    },
    async compareAndSet(client, { pk, previousContainerJson, previousValue, nextValue }) {
      const sql = `
        UPDATE ${table}
        SET ${column} = jsonb_set(${column}, '${pgPath}', to_jsonb($1::text), true)
            ${updatedAt ? ', updated_at = NOW()' : ''}
        WHERE id::text = $2
          AND ${column}::text = $3
          AND ${column} #>> '${pgPath}' IS NOT DISTINCT FROM $4
      `;
      const result = await client.query(sql, [nextValue, pk, previousContainerJson, previousValue]);
      return result.rowCount;
    },
  };
}

export function createDefaultSurfaceRegistry() {
  return [
    createTextSurface({
      id: 'api_integrations.api_key_encrypted',
      table: 'api_integrations',
      column: 'api_key_encrypted',
    }),
    createTextSurface({
      id: 'exchange_connections.api_key',
      table: 'exchange_connections',
      column: 'api_key',
    }),
    createTextSurface({
      id: 'exchange_connections.api_secret',
      table: 'exchange_connections',
      column: 'api_secret',
    }),
    createTextSurface({
      id: 'telegram_publishers.bot_token_encrypted',
      table: 'telegram_publishers',
      column: 'bot_token_encrypted',
    }),
    createJsonbSurface({
      id: 'data_sources.credentials.encrypted',
      table: 'data_sources',
      column: 'credentials',
      jsonPath: ['encrypted'],
    }),
  ];
}

export async function createPgClient() {
  return getClient();
}

export async function runMigration({
  clientFactory = createPgClient,
  surfaces = createDefaultSurfaceRegistry(),
  checkpointStore = createCheckpointStore(),
  decryptFn = decryptCompatibleSecret,
  encryptFn = encryptMk2Secret,
  classifyFn = classifyValue,
  ...rawOptions
} = {}) {
  const options = normalizeOptions(rawOptions);
  if (options.apply === options.dryRun) {
    throw new Error('Choose exactly one mode: --dry-run or --apply');
  }

  const stateMachine = createStateMachine();
  const checkpoint = options.resume ? checkpointStore.load(options.runId) : null;
  const progress = checkpoint?.progress || {};
  const summary = {
    runId: options.runId,
    mode: options.apply ? 'apply' : 'dry-run',
    state: 'ACTIVE',
    dbMutationCount: 0,
    counts: {
      scanned: 0,
      eligibleLegacy: 0,
      migrated: 0,
      skippedMk2: 0,
      malformed: 0,
      conflicts: 0,
    },
    surfaces: {},
    checkpointPath: checkpointStore.getPath(options.runId),
  };

  const client = await clientFactory();
  try {
    for (const surface of surfaces) {
      const surfaceSummary = summary.surfaces[surface.id] || {
        scanned: 0,
        eligibleLegacy: 0,
        migrated: 0,
        skippedMk2: 0,
        malformed: 0,
        conflicts: 0,
        lastProcessedPk: progress[surface.id]?.lastProcessedPk || null,
      };
      summary.surfaces[surface.id] = surfaceSummary;

      let afterPk = surfaceSummary.lastProcessedPk;
      while (true) {
        const rows = await surface.listEligible(client, { afterPk, limit: options.batchSize });
        if (rows.length === 0) break;

        for (const row of rows) {
          const format = classifyFn(row.storedValue);
          surfaceSummary.scanned += 1;
          summary.counts.scanned += 1;
          surfaceSummary.lastProcessedPk = row.pk;
          afterPk = row.pk;

          if (format === 'mk2') {
            surfaceSummary.skippedMk2 += 1;
            summary.counts.skippedMk2 += 1;
            continue;
          }

          if (format === 'malformed') {
            surfaceSummary.malformed += 1;
            summary.counts.malformed += 1;
            continue;
          }

          if (format !== 'legacy') {
            continue;
          }

          surfaceSummary.eligibleLegacy += 1;
          summary.counts.eligibleLegacy += 1;

          const plaintext = decryptFn(row.storedValue);
          const migratedValue = encryptFn(plaintext);
          const verificationPlaintext = decryptFn(migratedValue);
          if (verificationPlaintext !== plaintext) {
            throw new Error(`Round-trip verification mismatch on surface ${surface.id}`);
          }

          if (options.dryRun) {
            continue;
          }

          stateMachine.assertMutable();
          await client.query('BEGIN');
          try {
            const updated = await surface.compareAndSet(client, {
              pk: row.pk,
              previousValue: row.storedValue,
              previousContainerJson: row.containerJson,
              nextValue: migratedValue,
            });
            if (updated === 1) {
              await client.query('COMMIT');
              surfaceSummary.migrated += 1;
              summary.counts.migrated += 1;
              summary.dbMutationCount += 1;
            } else {
              await client.query('ROLLBACK');
              surfaceSummary.conflicts += 1;
              summary.counts.conflicts += 1;
            }
          } catch (error) {
            await client.query('ROLLBACK');
            throw error;
          }
        }

        checkpointStore.save(options.runId, {
          runId: options.runId,
          state: 'ACTIVE',
          progress: Object.fromEntries(
            Object.entries(summary.surfaces).map(([id, value]) => [
              id,
              { lastProcessedPk: value.lastProcessedPk },
            ]),
          ),
          counts: summary.counts,
        });
      }
    }

    stateMachine.markCompleted();
    summary.state = 'COMPLETED';
    checkpointStore.save(options.runId, {
      runId: options.runId,
      state: 'COMPLETED',
      progress: Object.fromEntries(
        Object.entries(summary.surfaces).map(([id, value]) => [
          id,
          { lastProcessedPk: value.lastProcessedPk },
        ]),
      ),
      counts: summary.counts,
    });
    return summary;
  } catch (error) {
    stateMachine.markFailed();
    summary.state = 'FAILED';
    summary.error = sanitizeError(error);
    checkpointStore.save(options.runId, {
      runId: options.runId,
      state: 'FAILED',
      progress: Object.fromEntries(
        Object.entries(summary.surfaces).map(([id, value]) => [
          id,
          { lastProcessedPk: value.lastProcessedPk },
        ]),
      ),
      counts: summary.counts,
      error: summary.error,
    });
    throw error;
  } finally {
    client.release?.();
  }
}

export function parseCliArgs(argv) {
  const options = {
    dryRun: false,
    apply: false,
    resume: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--dry-run') options.dryRun = true;
    else if (arg === '--apply') options.apply = true;
    else if (arg === '--resume') options.resume = true;
    else if (arg === '--run-id') options.runId = argv[i + 1];
    else if (arg === '--batch-size') options.batchSize = argv[i + 1];
  }
  return options;
}

async function main() {
  const options = parseCliArgs(process.argv.slice(2));
  const summary = await runMigration(options);
  console.log(JSON.stringify({
    runId: summary.runId,
    mode: summary.mode,
    state: summary.state,
    counts: summary.counts,
    dbMutationCount: summary.dbMutationCount,
    checkpointPath: summary.checkpointPath,
  }, null, 2));
}

const invokedUrl = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : null;
if (invokedUrl && import.meta.url === invokedUrl) {
  main().catch((error) => {
    console.error(JSON.stringify({ state: 'FAILED', error: sanitizeError(error) }, null, 2));
    process.exitCode = 1;
  });
}
