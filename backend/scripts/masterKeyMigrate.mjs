import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';

import { getClient } from '../database/db.js';
import { classifyCiphertext, decryptCompatibleSecret, encryptMk2Secret } from '../utils/crypto.js';

const DEFAULT_BATCH_SIZE = 100;
const DEFAULT_CHECKPOINT_DIR = path.join(process.cwd(), '.tmp', 'master-key-migration');
const TERMINAL_STATES = new Set(['FAILED', 'COMPLETED']);
const SAFE_RUN_ID = /^[A-Za-z0-9._-]{1,64}$/;

export function sanitizeError(error) {
  const message = String(error?.message || 'unknown error')
    .replace(/mk2:[0-9a-f:]+/gi, '[REDACTED_CIPHERTEXT]')
    .replace(/[0-9a-f]{64}/gi, '[REDACTED_KEY]');
  return {
    name: error?.name || 'Error',
    message,
  };
}

export function validateRunId(runId) {
  if (!SAFE_RUN_ID.test(runId || '')) {
    throw new Error('Invalid runId: use 1-64 chars from [A-Za-z0-9._-]');
  }
  return runId;
}

export function resolveCheckpointPath(checkpointDir, runId) {
  const safeRunId = validateRunId(runId);
  const baseDir = path.resolve(checkpointDir);
  const finalPath = path.resolve(baseDir, `${safeRunId}.json`);
  const relativePath = path.relative(baseDir, finalPath);
  if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
    throw new Error('Invalid runId checkpoint path traversal');
  }
  return finalPath;
}

export function createStateMachine() {
  let state = 'ACTIVE';
  let sealed = false;
  return {
    getState() {
      return state;
    },
    assertMutable() {
      if (TERMINAL_STATES.has(state) || sealed) {
        throw new Error(`Mutation blocked after terminal state: ${state}`);
      }
    },
    beginTerminal(nextState) {
      if (!TERMINAL_STATES.has(nextState)) {
        throw new Error(`Invalid terminal state: ${nextState}`);
      }
      if (sealed) {
        throw new Error('Terminal transition already sealed');
      }
      state = nextState;
      return state;
    },
    sealTerminalCheckpoint() {
      if (!TERMINAL_STATES.has(state)) {
        throw new Error('Cannot seal checkpoint before terminal state');
      }
      if (sealed) {
        throw new Error('Terminal checkpoint already sealed');
      }
      sealed = true;
    },
  };
}

export function createCheckpointStore({
  checkpointDir = DEFAULT_CHECKPOINT_DIR,
  fsImpl = fs,
} = {}) {
  return {
    checkpointDir,
    getPath(runId) {
      return resolveCheckpointPath(checkpointDir, runId);
    },
    load(runId) {
      const filePath = this.getPath(runId);
      if (!fsImpl.existsSync(filePath)) return null;
      return JSON.parse(fsImpl.readFileSync(filePath, 'utf8'));
    },
    save(runId, data) {
      fsImpl.mkdirSync(path.resolve(checkpointDir), { recursive: true, mode: 0o700 });
      const filePath = this.getPath(runId);
      fsImpl.writeFileSync(filePath, JSON.stringify(data, null, 2), { mode: 0o600 });
      return filePath;
    },
  };
}

function normalizeOptions(raw = {}) {
  const batchSize = Number.parseInt(raw.batchSize ?? DEFAULT_BATCH_SIZE, 10);
  const runId = validateRunId(raw.runId || `mk-${Date.now()}`);
  return {
    apply: Boolean(raw.apply),
    dryRun: Boolean(raw.dryRun),
    resume: Boolean(raw.resume),
    batchSize: Number.isFinite(batchSize) && batchSize > 0 ? batchSize : DEFAULT_BATCH_SIZE,
    runId,
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

function createEmptyCounts() {
  return {
    scanned: 0,
    eligibleLegacy: 0,
    migrated: 0,
    skippedMk2: 0,
    malformed: 0,
    conflicts: 0,
  };
}

function emptySurfaceSummary(lastProcessedPk = null) {
  return {
    ...createEmptyCounts(),
    lastProcessedPk,
  };
}

function mergeCounts(target, source) {
  for (const key of Object.keys(target)) {
    target[key] += source[key] || 0;
  }
}

function buildCheckpointPayload(summary, state) {
  return {
    runId: summary.runId,
    state,
    progress: Object.fromEntries(
      Object.entries(summary.surfaces).map(([id, value]) => [
        id,
        { lastProcessedPk: value.lastProcessedPk },
      ]),
    ),
    counts: summary.counts,
    remainingLegacy: summary.remainingLegacy ?? null,
    remainingMalformed: summary.remainingMalformed ?? null,
    remainingConflicts: summary.remainingConflicts ?? null,
    error: summary.error ?? null,
  };
}

async function countRemaining(surface, client, classifyFn, batchSize) {
  let afterPk = null;
  let remainingLegacy = 0;
  let remainingMalformed = 0;

  while (true) {
    const rows = await surface.listEligible(client, { afterPk, limit: batchSize });
    if (rows.length === 0) break;

    for (const row of rows) {
      const format = classifyFn(row.storedValue);
      if (format === 'legacy') remainingLegacy += 1;
      if (format === 'malformed') remainingMalformed += 1;
      afterPk = row.pk;
    }
  }

  return { remainingLegacy, remainingMalformed };
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
    counts: createEmptyCounts(),
    surfaces: {},
    checkpointPath: checkpointStore.getPath(options.runId),
    remainingLegacy: null,
    remainingMalformed: null,
    remainingConflicts: null,
  };

  const client = await clientFactory();
  try {
    for (const surface of surfaces) {
      const surfaceSummary = summary.surfaces[surface.id]
        || emptySurfaceSummary(progress[surface.id]?.lastProcessedPk || null);
      summary.surfaces[surface.id] = surfaceSummary;

      let afterPk = surfaceSummary.lastProcessedPk;
      while (true) {
        const rows = await surface.listEligible(client, { afterPk, limit: options.batchSize });
        if (rows.length === 0) break;

        for (const row of rows) {
          const rowCounts = createEmptyCounts();
          const format = classifyFn(row.storedValue);
          rowCounts.scanned += 1;

          if (format === 'mk2') {
            rowCounts.skippedMk2 += 1;
            mergeCounts(surfaceSummary, rowCounts);
            mergeCounts(summary.counts, rowCounts);
            surfaceSummary.lastProcessedPk = row.pk;
            afterPk = row.pk;
            checkpointStore.save(options.runId, buildCheckpointPayload(summary, 'ACTIVE'));
            continue;
          }

          if (format === 'malformed') {
            rowCounts.malformed += 1;
            mergeCounts(surfaceSummary, rowCounts);
            mergeCounts(summary.counts, rowCounts);
            if (options.dryRun) {
              surfaceSummary.lastProcessedPk = row.pk;
              afterPk = row.pk;
              checkpointStore.save(options.runId, buildCheckpointPayload(summary, 'ACTIVE'));
              continue;
            }
            throw new Error(`Malformed ciphertext blocks apply on surface ${surface.id}`);
          }

          if (format !== 'legacy') {
            continue;
          }

          rowCounts.eligibleLegacy += 1;

          const plaintext = decryptFn(row.storedValue);
          const migratedValue = encryptFn(plaintext);
          const verificationPlaintext = decryptFn(migratedValue);
          if (verificationPlaintext !== plaintext) {
            throw new Error(`Round-trip verification mismatch on surface ${surface.id}`);
          }

          if (options.dryRun) {
            mergeCounts(surfaceSummary, rowCounts);
            mergeCounts(summary.counts, rowCounts);
            surfaceSummary.lastProcessedPk = row.pk;
            afterPk = row.pk;
            checkpointStore.save(options.runId, buildCheckpointPayload(summary, 'ACTIVE'));
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
              rowCounts.migrated += 1;
              mergeCounts(surfaceSummary, rowCounts);
              mergeCounts(summary.counts, rowCounts);
              summary.dbMutationCount += 1;
              surfaceSummary.lastProcessedPk = row.pk;
              afterPk = row.pk;
              checkpointStore.save(options.runId, buildCheckpointPayload(summary, 'ACTIVE'));
            } else {
              await client.query('ROLLBACK');
              rowCounts.conflicts += 1;
              mergeCounts(surfaceSummary, rowCounts);
              mergeCounts(summary.counts, rowCounts);
              const conflictError = new Error(`CAS conflict blocks apply on surface ${surface.id}`);
              conflictError.alreadyRolledBack = true;
              throw conflictError;
            }
          } catch (error) {
            if (!error.alreadyRolledBack) {
              await client.query('ROLLBACK');
            }
            throw error;
          }
        }
      }
    }

    if (options.apply) {
      let remainingLegacy = 0;
      let remainingMalformed = 0;
      for (const surface of surfaces) {
        const remaining = await countRemaining(surface, client, classifyFn, options.batchSize);
        remainingLegacy += remaining.remainingLegacy;
        remainingMalformed += remaining.remainingMalformed;
      }
      summary.remainingLegacy = remainingLegacy;
      summary.remainingMalformed = remainingMalformed;
      summary.remainingConflicts = summary.counts.conflicts;
      if (remainingLegacy !== 0 || remainingMalformed !== 0 || summary.counts.conflicts !== 0) {
        throw new Error('Apply postcondition failed: unresolved legacy, malformed, or conflict rows remain');
      }
    } else {
      summary.remainingLegacy = summary.counts.eligibleLegacy;
      summary.remainingMalformed = summary.counts.malformed;
      summary.remainingConflicts = 0;
    }

    stateMachine.beginTerminal('COMPLETED');
    summary.state = 'COMPLETED';
    checkpointStore.save(options.runId, buildCheckpointPayload(summary, 'COMPLETED'));
    stateMachine.sealTerminalCheckpoint();
    return summary;
  } catch (error) {
    stateMachine.beginTerminal('FAILED');
    summary.state = 'FAILED';
    summary.error = sanitizeError(error);
    summary.remainingLegacy ??= null;
    summary.remainingMalformed ??= null;
    summary.remainingConflicts ??= summary.counts.conflicts;
    checkpointStore.save(options.runId, buildCheckpointPayload(summary, 'FAILED'));
    stateMachine.sealTerminalCheckpoint();
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
