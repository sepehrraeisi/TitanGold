/**
 * @jest-environment node
 */

import fs from 'fs';
import os from 'os';
import path from 'path';
import { jest } from '@jest/globals';

const getClient = jest.fn();
jest.unstable_mockModule('../../database/db.js', () => ({
  getClient,
}));

const {
  createCheckpointStore,
  resolveCheckpointPath,
  createStateMachine,
  runMigration,
} = await import('../../scripts/masterKeyMigrate.mjs');
const { decryptSecret, encryptSecret } = await import('../../utils/crypto.js');
const { encryptLegacySecret, encryptManagedSecret } = await import('../../utils/cryptoKeyring.js');

function createMemoryClient() {
  return {
    query: jest.fn(async (sql) => {
      if (sql === 'BEGIN' || sql === 'COMMIT' || sql === 'ROLLBACK') {
        return { rowCount: 0, rows: [] };
      }
      throw new Error(`Unexpected SQL: ${sql}`);
    }),
    release: jest.fn(),
  };
}

function createSurface(id, rows, options = {}) {
  let attempts = 0;
  return {
    id,
    async listEligible(_client, { afterPk, limit }) {
      return rows
        .filter((row) => afterPk == null || row.pk > afterPk)
        .slice(0, limit)
        .map((row) => ({ ...row }));
    },
    async compareAndSet(_client, payload) {
      attempts += 1;
      if (options.onCompareAndSet) {
        return options.onCompareAndSet(payload, attempts);
      }
      const row = rows.find((item) => item.pk === payload.pk);
      if (!row) return 0;
      if (row.storedValue !== payload.previousValue) return 0;
      row.storedValue = payload.nextValue;
      return 1;
    },
  };
}

describe('MASTER_KEY migration tooling', () => {
  const originalMasterKey = process.env.MASTER_KEY;
  const originalPreviousMasterKey = process.env.MASTER_KEY_PREVIOUS;
  const legacyKey = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
  const currentKey = 'abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789';

  beforeEach(() => {
    process.env.MASTER_KEY = currentKey;
    process.env.MASTER_KEY_PREVIOUS = legacyKey;
    delete process.env.MASTER_KEY_WRITE_MODE;
    getClient.mockReset();
  });

  afterAll(() => {
    process.env.MASTER_KEY = originalMasterKey;
    process.env.MASTER_KEY_PREVIOUS = originalPreviousMasterKey;
  });

  function makeLegacyValue(plaintext) {
    process.env.MASTER_KEY = legacyKey;
    delete process.env.MASTER_KEY_PREVIOUS;
    const legacy = encryptLegacySecret(plaintext);
    process.env.MASTER_KEY = currentKey;
    process.env.MASTER_KEY_PREVIOUS = legacyKey;
    return legacy;
  }

  test('compatibility deployment default writes legacy and cutover writes mk2', () => {
    process.env.MASTER_KEY = legacyKey;
    delete process.env.MASTER_KEY_PREVIOUS;
    const preCutover = encryptSecret('legacy-phase');
    expect(preCutover.startsWith('mk2:')).toBe(false);

    process.env.MASTER_KEY = currentKey;
    process.env.MASTER_KEY_PREVIOUS = legacyKey;
    process.env.MASTER_KEY_WRITE_MODE = 'mk2';
    const postCutover = encryptSecret('mk2-phase');

    expect(postCutover.startsWith('mk2:')).toBe(true);
    expect(decryptSecret(preCutover)).toBe('legacy-phase');
    expect(decryptSecret(postCutover)).toBe('mk2-phase');
  });

  test('dry-run scans mixed dataset with zero DB mutation', async () => {
    const rows = [
      { pk: '1', storedValue: makeLegacyValue('alpha') },
      { pk: '2', storedValue: encryptManagedSecret('beta', { writeMode: 'mk2' }) },
      { pk: '3', storedValue: 'not-a-ciphertext' },
    ];
    const client = createMemoryClient();
    getClient.mockResolvedValue(client);

    const summary = await runMigration({
      dryRun: true,
      runId: 'dry-run-zero-mutation',
      surfaces: [createSurface('api_integrations.api_key_encrypted', rows)],
      checkpointStore: createCheckpointStore({ checkpointDir: fs.mkdtempSync(path.join(os.tmpdir(), 'mk-dry-')) }),
    });

    expect(summary.dbMutationCount).toBe(0);
    expect(summary.counts.eligibleLegacy).toBe(1);
    expect(summary.counts.skippedMk2).toBe(1);
    expect(summary.counts.malformed).toBe(1);
    expect(summary.remainingMalformed).toBe(1);
    expect(client.query).not.toHaveBeenCalledWith(expect.stringMatching(/^UPDATE/i), expect.anything());
  });

  test('apply migrates legacy values to mk2 and proves zero legacy postcondition', async () => {
    const rows = [
      { pk: '1', storedValue: makeLegacyValue('resume-a') },
      { pk: '2', storedValue: makeLegacyValue('resume-b') },
    ];
    const client = createMemoryClient();
    getClient.mockResolvedValue(client);
    const checkpointDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mk-resume-'));

    const summary = await runMigration({
      apply: true,
      runId: 'resume-run',
      surfaces: [createSurface('exchange_connections.api_key', rows)],
      checkpointStore: createCheckpointStore({ checkpointDir }),
      batchSize: 1,
    });

    expect(summary.counts.migrated).toBe(2);
    expect(rows.every((row) => row.storedValue.startsWith('mk2:'))).toBe(true);
    expect(decryptSecret(rows[0].storedValue)).toBe('resume-a');
    expect(summary.remainingLegacy).toBe(0);
    expect(summary.remainingMalformed).toBe(0);
    expect(summary.remainingConflicts).toBe(0);
  });

  test('second apply run is idempotent because mk2 rows are skipped', async () => {
    const rows = [{ pk: '1', storedValue: makeLegacyValue('stable') }];
    const client = createMemoryClient();
    getClient.mockResolvedValue(client);
    await runMigration({
      apply: true,
      runId: 'idempotent-1',
      surfaces: [createSurface('telegram_publishers.bot_token_encrypted', rows)],
      checkpointStore: createCheckpointStore({ checkpointDir: fs.mkdtempSync(path.join(os.tmpdir(), 'mk-idem-')) }),
    });

    const secondClient = createMemoryClient();
    getClient.mockResolvedValue(secondClient);
    const second = await runMigration({
      apply: true,
      runId: 'idempotent-2',
      surfaces: [createSurface('telegram_publishers.bot_token_encrypted', rows)],
      checkpointStore: createCheckpointStore({ checkpointDir: fs.mkdtempSync(path.join(os.tmpdir(), 'mk-idem-2-')) }),
    });
    expect(second.counts.migrated).toBe(0);
    expect(second.counts.skippedMk2).toBe(1);
  });

  test('failed row does not advance durable checkpoint and resume retries exact row', async () => {
    const rows = [
      { pk: '1', storedValue: makeLegacyValue('row-1') },
      { pk: '2', storedValue: makeLegacyValue('row-2') },
      { pk: '3', storedValue: makeLegacyValue('row-3') },
    ];
    const client = createMemoryClient();
    getClient.mockResolvedValue(client);
    const checkpointDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mk-failed-row-'));
    const transient = { failed: false };

    const failingSurface = createSurface('exchange_connections.api_key', rows, {
      onCompareAndSet: (payload) => {
        const row = rows.find((item) => item.pk === payload.pk);
        if (payload.pk === '2' && !transient.failed) {
          transient.failed = true;
          throw new Error('synthetic-row-two-failure');
        }
        row.storedValue = payload.nextValue;
        return 1;
      },
    });

    await expect(runMigration({
      apply: true,
      runId: 'failed-row-resume',
      surfaces: [failingSurface],
      checkpointStore: createCheckpointStore({ checkpointDir }),
      batchSize: 1,
    })).rejects.toThrow('synthetic-row-two-failure');

    const failedCheckpoint = JSON.parse(fs.readFileSync(path.join(checkpointDir, 'failed-row-resume.json'), 'utf8'));
    expect(failedCheckpoint.progress['exchange_connections.api_key'].lastProcessedPk).toBe('1');
    expect(rows[0].storedValue.startsWith('mk2:')).toBe(true);
    expect(rows[1].storedValue.startsWith('mk2:')).toBe(false);
    expect(rows[2].storedValue.startsWith('mk2:')).toBe(false);

    const resumeClient = createMemoryClient();
    getClient.mockResolvedValue(resumeClient);
    const resumed = await runMigration({
      apply: true,
      resume: true,
      runId: 'failed-row-resume',
      surfaces: [failingSurface],
      checkpointStore: createCheckpointStore({ checkpointDir }),
      batchSize: 1,
    });
    expect(resumed.counts.migrated).toBe(2);
    expect(rows.every((row) => row.storedValue.startsWith('mk2:'))).toBe(true);
  });

  test('compare-and-set conflict cannot complete apply and resume reconsiders row', async () => {
    const rows = [{ pk: '1', storedValue: makeLegacyValue('conflict') }];
    const client = createMemoryClient();
    getClient.mockResolvedValue(client);
    const checkpointDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mk-conflict-'));
    let conflictActive = true;
    const conflictSurface = createSurface('exchange_connections.api_secret', rows, {
      onCompareAndSet: (payload) => {
        if (conflictActive) {
          return 0;
        }
        const row = rows.find((item) => item.pk === payload.pk);
        row.storedValue = payload.nextValue;
        return 1;
      },
    });

    await expect(runMigration({
      apply: true,
      runId: 'conflict-run',
      surfaces: [conflictSurface],
      checkpointStore: createCheckpointStore({ checkpointDir }),
    })).rejects.toThrow('CAS conflict blocks apply');
    expect(rows[0].storedValue.startsWith('mk2:')).toBe(false);

    const failedCheckpoint = JSON.parse(fs.readFileSync(path.join(checkpointDir, 'conflict-run.json'), 'utf8'));
    expect(failedCheckpoint.progress['exchange_connections.api_secret'].lastProcessedPk).not.toBe('1');

    conflictActive = false;
    const resumeClient = createMemoryClient();
    getClient.mockResolvedValue(resumeClient);
    const resumed = await runMigration({
      apply: true,
      resume: true,
      runId: 'conflict-run',
      surfaces: [conflictSurface],
      checkpointStore: createCheckpointStore({ checkpointDir }),
    });
    expect(resumed.counts.migrated).toBe(1);
    expect(rows[0].storedValue.startsWith('mk2:')).toBe(true);
  });

  test('round-trip mismatch blocks persistence and terminal stop prevents more mutation', async () => {
    const rows = [{ pk: '1', storedValue: makeLegacyValue('boom') }];
    const client = createMemoryClient();
    getClient.mockResolvedValue(client);

    await expect(runMigration({
      apply: true,
      runId: 'roundtrip-fail',
      surfaces: [createSurface('api_integrations.api_key_encrypted', rows)],
      checkpointStore: createCheckpointStore({ checkpointDir: fs.mkdtempSync(path.join(os.tmpdir(), 'mk-fail-')) }),
      decryptFn: (value) => {
        if (value.startsWith('mk2:')) return 'different-plaintext';
        return decryptSecret(value);
      },
    })).rejects.toThrow('Round-trip verification mismatch');

    expect(client.query).not.toHaveBeenCalledWith('BEGIN');

    const stateMachine = createStateMachine();
    stateMachine.beginTerminal('FAILED');
    stateMachine.sealTerminalCheckpoint();
    expect(() => stateMachine.assertMutable()).toThrow('Mutation blocked after terminal state');
    expect(() => stateMachine.sealTerminalCheckpoint()).toThrow('Terminal checkpoint already sealed');
  });

  test('malformed apply cannot complete and dry-run remains mutation-free', async () => {
    const rows = [{ pk: '1', storedValue: 'malformed-value' }];
    const dryClient = createMemoryClient();
    getClient.mockResolvedValue(dryClient);

    const drySummary = await runMigration({
      dryRun: true,
      runId: 'malformed-dry',
      surfaces: [createSurface('api_integrations.api_key_encrypted', rows)],
      checkpointStore: createCheckpointStore({ checkpointDir: fs.mkdtempSync(path.join(os.tmpdir(), 'mk-malformed-dry-')) }),
    });
    expect(drySummary.dbMutationCount).toBe(0);
    expect(drySummary.counts.malformed).toBe(1);
    expect(dryClient.query).not.toHaveBeenCalledWith('BEGIN');

    const applyClient = createMemoryClient();
    getClient.mockResolvedValue(applyClient);
    await expect(runMigration({
      apply: true,
      runId: 'malformed-apply',
      surfaces: [createSurface('api_integrations.api_key_encrypted', rows)],
      checkpointStore: createCheckpointStore({ checkpointDir: fs.mkdtempSync(path.join(os.tmpdir(), 'mk-malformed-apply-')) }),
    })).rejects.toThrow('Malformed ciphertext blocks apply');
  });

  test('sanitized failure path does not leak plaintext into checkpoint', async () => {
    const sensitivePlaintext = 'plaintext-never-log';
    const rows = [{ pk: '1', storedValue: makeLegacyValue(sensitivePlaintext) }];
    const client = createMemoryClient();
    getClient.mockResolvedValue(client);
    const checkpointDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mk-sanitize-'));

    process.env.MASTER_KEY_PREVIOUS = '1111111111111111111111111111111111111111111111111111111111111111';
    await expect(runMigration({
      apply: true,
      runId: 'sanitize-run',
      surfaces: [createSurface('api_integrations.api_key_encrypted', rows)],
      checkpointStore: createCheckpointStore({ checkpointDir }),
    })).rejects.toThrow();

    const checkpointBody = fs.readFileSync(path.join(checkpointDir, 'sanitize-run.json'), 'utf8');
    expect(checkpointBody).not.toContain(sensitivePlaintext);
    expect(checkpointBody).not.toMatch(/[0-9a-f]{64}/i);
  });

  test('unsafe runId/path traversal is rejected', () => {
    expect(() => resolveCheckpointPath('/tmp/master-key', '../escape')).toThrow('Invalid runId');
    expect(() => createCheckpointStore({ checkpointDir: '/tmp/master-key' }).getPath('../../bad')).toThrow('Invalid runId');
  });
});
