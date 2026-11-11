import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  DURABLE_JTI_SQL,
  DURABLE_REGISTRY_DECISIONS,
  createDurableAuthorityRegistries,
  createOfflineTestOnlyDurableRegistryDoubles,
  interpretRegistryResult,
} from '../src/durableAuthorityRegistries.js';

describe('S2 durableAuthorityRegistries Gate C+D offline', () => {
  it('1) offline doubles consume jti once and reject replay', async () => {
    const regs = createOfflineTestOnlyDurableRegistryDoubles();
    assert.equal(regs.durable, false);
    const first = await regs.consumeJti('jti-1', { taskId: 't1' });
    assert.equal(first.ok, true);
    assert.equal(first.durable, false);
    const replay = await regs.consumeJti('jti-1');
    assert.equal(replay.decision, DURABLE_REGISTRY_DECISIONS.DENY_REPLAY);
  });

  it('2) revocation evaluated before consume', async () => {
    const regs = createOfflineTestOnlyDurableRegistryDoubles();
    await regs.revoke('jti-2', 'COMPROMISE');
    const revoked = await regs.isRevoked('jti-2');
    assert.equal(revoked.decision, DURABLE_REGISTRY_DECISIONS.DENY_REVOKED);
    const consume = await regs.consumeJti('jti-2');
    assert.equal(consume.decision, DURABLE_REGISTRY_DECISIONS.DENY_REVOKED);
  });

  it('3) unavailable registry fails closed', async () => {
    const regs = createOfflineTestOnlyDurableRegistryDoubles();
    regs.setAvailable(false);
    assert.equal(
      (await regs.consumeJti('jti-3')).decision,
      DURABLE_REGISTRY_DECISIONS.DENY_UNAVAILABLE,
    );
  });

  it('4) SQL-backed registries deny without db client; reject caller SQL', async () => {
    const dbRegs = createDurableAuthorityRegistries(null, {});
    assert.equal(dbRegs.status, 'DISABLED_WITHOUT_DB_CLIENT');
    assert.equal(
      (await dbRegs.consumeJti('jti-x')).decision,
      DURABLE_REGISTRY_DECISIONS.DENY_DB_NOT_AUTHORIZED,
    );

    const smuggled = createDurableAuthorityRegistries({ query() {} }, {
      sql: 'DROP TABLE tecp_ops_authority_jti_presentation',
    });
    assert.equal(smuggled.status, 'DISABLED_CALLER_SQL');
    assert.equal(
      (await smuggled.consumeJti('jti-y')).decision,
      DURABLE_REGISTRY_DECISIONS.DENY_CALLER_SQL,
    );
  });

  it('5) interpretRegistryResult fail-closed on malformed', () => {
    const bad = interpretRegistryResult(null);
    assert.equal(bad.ok, false);
    assert.equal(bad.decision, DURABLE_REGISTRY_DECISIONS.DENY_DB_ERROR);
  });

  it('6) fixed SQL templates are parameterized and cover jti + revocation', () => {
    assert.match(DURABLE_JTI_SQL.INSERT_PRESENTATION, /\$1/);
    assert.match(DURABLE_JTI_SQL.INSERT_PRESENTATION, /tecp_ops_authority_jti_presentation/);
    assert.match(DURABLE_JTI_SQL.SELECT_REVOKED, /tecp_ops_authority_revocation/);
    assert.match(DURABLE_JTI_SQL.INSERT_REVOCATION, /ON CONFLICT/);
    assert.equal(/;\s*DROP/i.test(DURABLE_JTI_SQL.INSERT_PRESENTATION), false);
  });

  it('7) SQL-backed consume requires owned txn and complete binding', async () => {
    const calls = [];
    const fakeClient = {
      async query(sql, params) {
        calls.push({ sql: String(sql), params });
        if (/pg_current_xact_id_if_assigned/.test(sql)) {
          return { rows: [{ in_txn: false, txn_ro: 'off' }], rowCount: 1 };
        }
        if (/tecp\.dlp_write_lease_txn_owner/.test(sql)) {
          return { rows: [{ owned: '' }], rowCount: 1 };
        }
        return { rows: [], rowCount: 0 };
      },
    };
    const regs = createDurableAuthorityRegistries(fakeClient, {
      requireOwnedTxn: true,
    });
    assert.equal(regs.status, 'SQL_TEMPLATES_READY_AWAITING_TIER3_EXECUTION');
    const noTxn = await regs.consumeJti('jti-z', {
      principalId: 'p',
      taskId: 't',
      action: 'A',
      resourceType: 'R',
      resourceKey: 'k',
      governanceRevision: 'G',
      issuerId: 'iss',
      audience: 'aud',
    });
    assert.equal(noTxn.decision, DURABLE_REGISTRY_DECISIONS.DENY_NO_TRANSACTION);
  });

  it('8) SQL-backed consume inside owned txn uses INSERT and maps unique conflict', async () => {
    let phase = 0;
    const fakeClient = {
      async query(sql) {
        phase += 1;
        if (/tecp\.dlp_write_lease_txn_owner/.test(sql)) {
          return { rows: [{ owned: 'TECP_DLP_WRITE_LEASE_TXN_OWNER_V1' }], rowCount: 1 };
        }
        if (/pg_current_xact_id_if_assigned/.test(sql)) {
          return { rows: [{ in_txn: true }], rowCount: 1 };
        }
        if (/FROM tecp_ops_authority_revocation/.test(sql)) {
          return { rows: [], rowCount: 0 };
        }
        if (/INSERT INTO tecp_ops_authority_jti_presentation/.test(sql)) {
          if (phase > 6) {
            const err = new Error('duplicate key');
            err.code = '23505';
            throw err;
          }
          return { rows: [{ jti: 'jti-ok' }], rowCount: 1 };
        }
        return { rows: [], rowCount: 0 };
      },
    };
    const regs = createDurableAuthorityRegistries(fakeClient, { requireOwnedTxn: true });
    const binding = {
      principalId: 'p',
      taskId: 't',
      action: 'A',
      resourceType: 'R',
      resourceKey: 'k',
      governanceRevision: 'G',
      issuerId: 'iss',
      audience: 'aud',
    };
    const first = await regs.consumeJti('jti-ok', binding);
    assert.equal(first.ok, true);
    assert.equal(first.durable, true);
    const replay = await regs.consumeJti('jti-ok', binding);
    assert.equal(replay.decision, DURABLE_REGISTRY_DECISIONS.DENY_REPLAY);
  });
});
