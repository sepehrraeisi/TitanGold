import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  DURABLE_REGISTRY_DECISIONS,
  createDurableAuthorityRegistries,
  createOfflineTestOnlyDurableRegistryDoubles,
  interpretRegistryResult,
} from '../src/durableAuthorityRegistries.js';

describe('S2 durableAuthorityRegistries offline doubles', () => {
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

  it('4) DB-backed registries deny without authorization', async () => {
    const dbRegs = createDurableAuthorityRegistries({ fake: true });
    assert.equal(dbRegs.status, 'DISABLED_WITHOUT_AUTHORIZED_DB');
    assert.equal(
      (await dbRegs.consumeJti('jti-x')).decision,
      DURABLE_REGISTRY_DECISIONS.DENY_DB_NOT_AUTHORIZED,
    );
    assert.equal(
      (await dbRegs.isRevoked('jti-x')).decision,
      DURABLE_REGISTRY_DECISIONS.DENY_DB_NOT_AUTHORIZED,
    );
  });

  it('5) interpretRegistryResult fail-closed on malformed', () => {
    const bad = interpretRegistryResult(null);
    assert.equal(bad.ok, false);
    assert.equal(bad.decision, DURABLE_REGISTRY_DECISIONS.DENY_DB_ERROR);
  });
});
