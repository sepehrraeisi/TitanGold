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
  createStateMachine,
  runMigration,
} = await import('../../scripts/masterKeyMigrate.mjs');
const { decryptSecret, encryptSecret } = await import('../../utils/crypto.js');

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
    getClient.mockReset();
  });

  afterAll(() => {
    process.env.MASTER_KEY = originalMasterKey;
    process.env.MASTER_KEY_PREVIOUS = originalPreviousMasterKey;
  });

  function makeLegacyValue(plaintext) {
    process.env.MASTER_KEY = legacyKey;
    delete process.env.MASTER_KEY_PREVIOUS;
    const legacy = encryptSecret(plaintext).slice(4);
    process.env.MASTER_KEY = currentKey;
    process.env.MASTER_KEY_PREVIOUS = legacyKey;
    return legacy;
  }

  test('dry-run scans mixed dataset with zero DB mutation', async () => {
    const rows = [
      { pk: '1', storedValue: makeLegacyValue('alpha') },
      { pk: '2', storedValue: encryptSecret('beta') },
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
    expect(client.query).not.toHaveBeenCalledWith(expect.stringMatching(/^UPDATE/i), expect.anything());
  });

  test('apply migrates legacy values to mk2 and resume is safe', async () => {
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

    const secondClient = createMemoryClient();
    getClient.mockResolvedValue(secondClient);
    const resumed = await runMigration({
      apply: true,
      resume: true,
      runId: 'resume-run',
      surfaces: [createSurface('exchange_connections.api_key', rows)],
      checkpointStore: createCheckpointStore({ checkpointDir }),
      batchSize: 1,
    });
    expect(resumed.counts.migrated).toBe(0);
    expect(resumed.counts.skippedMk2).toBe(0);
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

  test('compare-and-set conflict does not clobber concurrent change', async () => {
    const rows = [{ pk: '1', storedValue: makeLegacyValue('conflict') }];
    const client = createMemoryClient();
    getClient.mockResolvedValue(client);

    const summary = await runMigration({
      apply: true,
      runId: 'conflict-run',
      surfaces: [createSurface('exchange_connections.api_secret', rows, { onCompareAndSet: () => 0 })],
      checkpointStore: createCheckpointStore({ checkpointDir: fs.mkdtempSync(path.join(os.tmpdir(), 'mk-conflict-')) }),
    });

    expect(summary.counts.conflicts).toBe(1);
    expect(summary.counts.migrated).toBe(0);
    expect(rows[0].storedValue.startsWith('mk2:')).toBe(false);
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
    stateMachine.markFailed();
    expect(() => stateMachine.assertMutable()).toThrow('Mutation blocked after terminal state');
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
});
