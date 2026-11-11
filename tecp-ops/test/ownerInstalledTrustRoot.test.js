import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  TRUST_ROOT_AUDIENCE,
  TRUST_ROOT_DECISIONS,
  createOperationalOwnerTrustRootInstaller,
  createTestOnlyOwnerTrustRootInstaller,
  generateEphemeralTrustRootKeyPairForTests,
  isBrandedOwnerInstalledTrustRoot,
  isPrivilegedTestOnlyOwnerTrustRootInstaller,
  rejectCallerSuppliedTrustRegistry,
} from '../src/ownerInstalledTrustRoot.js';

const GOV = 'OPS_PILOT_001_S2_EXACT_17_PATH_GOVERNANCE_20261110';

describe('S2 ownerInstalledTrustRoot offline contract', () => {
  it('1) TEST_ONLY install binds issuer/kid/audience/governance and brands root', () => {
    const keys = generateEphemeralTrustRootKeyPairForTests();
    const installer = createTestOnlyOwnerTrustRootInstaller();
    assert.equal(isPrivilegedTestOnlyOwnerTrustRootInstaller(installer), true);
    const installed = installer.install({
      issuerId: 'ops-rla-issuer',
      kid: 'ops-kid-1',
      audience: TRUST_ROOT_AUDIENCE,
      governanceRevision: GOV,
      publicKeyPem: keys.publicKeyPem,
    });
    assert.equal(installed.ok, true);
    assert.equal(installed.operationalOwnerCustodyProven, false);
    assert.equal(isBrandedOwnerInstalledTrustRoot(installed.trustRoot), true);
    const lookup = installed.trustRoot.lookup({
      kid: 'ops-kid-1',
      issuerId: 'ops-rla-issuer',
      audience: TRUST_ROOT_AUDIENCE,
      governanceRevision: GOV,
    });
    assert.equal(lookup.ok, true);
  });

  it('2) rejects private key embedding and env/fs secret paths', () => {
    const installer = createTestOnlyOwnerTrustRootInstaller();
    const deniedPk = installer.install({
      issuerId: 'x',
      kid: 'k',
      governanceRevision: GOV,
      publicKeyPem: 'not-a-key',
      privateKeyPem: 'SECRET',
    });
    assert.equal(deniedPk.ok, false);
    assert.equal(deniedPk.decision, TRUST_ROOT_DECISIONS.DENY_PRIVATE_KEY_EMBEDDED);

    const deniedFs = installer.install({
      issuerId: 'x',
      kid: 'k',
      governanceRevision: GOV,
      publicKeyPem: 'not-a-key',
      filePath: '/secrets/owner.pem',
    });
    assert.equal(deniedFs.ok, false);
    assert.equal(deniedFs.decision, TRUST_ROOT_DECISIONS.DENY_ENV_OR_FS_SECRET_LOAD);
  });

  it('3) rejects worker/caller supplied registries', () => {
    const keys = generateEphemeralTrustRootKeyPairForTests();
    const installer = createTestOnlyOwnerTrustRootInstaller();
    const denied = installer.install({
      issuerId: 'ops-rla-issuer',
      kid: 'ops-kid-1',
      governanceRevision: GOV,
      publicKeyPem: keys.publicKeyPem,
      workerSuppliedRegistry: { kid: 'evil' },
    });
    assert.equal(denied.decision, TRUST_ROOT_DECISIONS.DENY_WORKER_SUPPLIED_REGISTRY);

    const reject = rejectCallerSuppliedTrustRegistry({
      trustRoot: { kid: 'forged' },
      keyRegistry: {},
    });
    assert.equal(reject.ok, false);
    assert.equal(reject.decision, TRUST_ROOT_DECISIONS.DENY_WORKER_SUPPLIED_REGISTRY);
  });

  it('4) wrong issuer/audience/governance and revoked kid deny', () => {
    const keys = generateEphemeralTrustRootKeyPairForTests();
    const installer = createTestOnlyOwnerTrustRootInstaller();
    const installed = installer.install({
      issuerId: 'ops-rla-issuer',
      kid: 'ops-kid-1',
      audience: TRUST_ROOT_AUDIENCE,
      governanceRevision: GOV,
      publicKeyPem: keys.publicKeyPem,
    });
    const root = installed.trustRoot;
    assert.equal(root.lookup({ kid: 'ops-kid-1', issuerId: 'other' }).ok, false);
    assert.equal(root.lookup({ kid: 'ops-kid-1', audience: 'WRONG' }).ok, false);
    assert.equal(root.lookup({ kid: 'ops-kid-1', governanceRevision: 'WRONG' }).ok, false);
    root.revokeKid('ops-kid-1');
    assert.equal(
      root.lookup({ kid: 'ops-kid-1' }).decision,
      TRUST_ROOT_DECISIONS.DENY_REVOKED_KID,
    );
  });

  it('5) operational installer is NOT_OPERATIONALLY_ACTIVATED', () => {
    const op = createOperationalOwnerTrustRootInstaller();
    assert.equal(op.status, 'NOT_OPERATIONALLY_ACTIVATED');
    const result = op.install({
      issuerId: 'ops',
      kid: 'k',
      governanceRevision: GOV,
      publicKeyPem: 'x',
    });
    assert.equal(result.ok, false);
    assert.equal(result.decision, TRUST_ROOT_DECISIONS.DENY_OPERATIONAL_INSTALLER_INACTIVE);
  });

  it('6) rotation retires previous kid', () => {
    const keys1 = generateEphemeralTrustRootKeyPairForTests();
    const keys2 = generateEphemeralTrustRootKeyPairForTests();
    const installer = createTestOnlyOwnerTrustRootInstaller();
    const installed = installer.install({
      issuerId: 'ops-rla-issuer',
      kid: 'ops-kid-1',
      governanceRevision: GOV,
      publicKeyPem: keys1.publicKeyPem,
    });
    const rotated = installed.trustRoot.rotatePublicKey({
      kid: 'ops-kid-2',
      publicKeyPem: keys2.publicKeyPem,
      retireKid: 'ops-kid-1',
    });
    assert.equal(rotated.ok, true);
    assert.equal(installed.trustRoot.lookup({ kid: 'ops-kid-1' }).ok, false);
    assert.equal(installed.trustRoot.lookup({ kid: 'ops-kid-2' }).ok, true);
  });
});
