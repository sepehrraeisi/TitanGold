/**
 * S2 Owner Implementation Instruction — offline adversarial tests.
 * NON_OPERATIONAL / TEST_ONLY fixtures. No Owner enrollment. No live keys.
 */

import assert from 'node:assert/strict';
import { createPrivateKey, generateKeyPairSync, sign } from 'node:crypto';
import { test } from 'node:test';

import { canonicalJson } from '../src/workerCapabilityToken.js';
import {
  S2_OWNER_INSTRUCTION_ALG,
  S2_OWNER_INSTRUCTION_DECISIONS as D,
  S2_OWNER_INSTRUCTION_DOMAIN,
  S2_OWNER_INSTRUCTION_KIND,
  S2_OWNER_INSTRUCTION_MAX_TTL_MS,
  S2_OWNER_INSTRUCTION_PURPOSE,
  S2_OWNER_INSTRUCTION_REPOSITORY_ID,
  createOwnerInstalledS2ImplTrustDeps,
  createS2InstructionClock,
  createS2InstructionKeyRegistry,
  createS2InstructionRevocationRegistry,
  createS2InstructionVerifier,
  createTestOnlyS2ImplTrustDeps,
  generateEphemeralS2InstructionKeyPair,
  getPrivilegedS2InstructionConstructors,
  issueS2OwnerImplementationInstruction,
  verifyS2OwnerImplementationInstruction,
  withPrivilegedS2InstructionConstruction,
} from '../src/s2OwnerImplementationInstruction.js';

const SCOPE = Object.freeze([
  'tecp/src/s2OwnerImplementationInstruction.js',
  'tecp/src/s2EffectiveImplementationAuthorizationGate.js',
  'tecp/test/s2OwnerImplementationInstruction.test.js',
  'tecp/test/s2EffectiveImplementationAuthorizationGate.test.js',
]);
const SHA = 'b1027b749fe8286424fdedfa036384c8790bc830';
const DIGEST = 'f7310f6f41e8a312ec0181fd73d9b70c9a897f95f17c630eb7488f43afe3b277';
const REV = 'OPS_PILOT_001_S2_EFF_AUTH_ARCHITECTURE_GOVERNANCE_20261118';
const SLICE = 'TECP-OPS-PILOT-001-CONTROLLED-ONE-TO-FIVE-CURSOR';

const CLAIM_KEY_ORDER = Object.freeze([
  'alg', 'authorizedFileScope', 'canonicalSha', 'domain', 'exp', 'governanceRevision',
  'iat', 'iss', 'jti', 'kid', 'kind', 'nbf', 'operationClass', 'purpose', 'repositoryId',
  'rule02DigestSha256', 'sliceId',
]);

function fixtureTrust(overrides = {}) {
  return withPrivilegedS2InstructionConstruction(() => createTestOnlyS2ImplTrustDeps(overrides));
}

function baseRequest(deps, overrides = {}) {
  return {
    repositoryId: S2_OWNER_INSTRUCTION_REPOSITORY_ID,
    canonicalSha: SHA,
    rule02DigestSha256: DIGEST,
    sliceId: SLICE,
    authorizedFileScope: [...SCOPE],
    operationClass: 'IMPLEMENT',
    governanceRevision: REV,
    purpose: S2_OWNER_INSTRUCTION_PURPOSE,
    issuer: deps.issuer,
    kid: deps.installedKid,
    ttlMs: 60_000,
    ...overrides,
  };
}

function expectation(overrides = {}) {
  return {
    repositoryId: S2_OWNER_INSTRUCTION_REPOSITORY_ID,
    canonicalSha: SHA,
    rule02DigestSha256: DIGEST,
    sliceId: SLICE,
    authorizedFileScope: [...SCOPE],
    operationClass: 'IMPLEMENT',
    governanceRevision: REV,
    ...overrides,
  };
}

function depsTriple(deps, extra = {}) {
  return {
    keyRegistry: deps.keyRegistry,
    revocationRegistry: deps.revocationRegistry,
    clock: deps.clock,
    ...extra,
  };
}

function assertDeny(result, decision) {
  assert.equal(result.ok, false);
  assert.equal(result.decision, decision);
  assert.equal(result.operational, false);
  assert.equal(result.instruction, null);
}

function orderedClaims(claims) {
  const out = {};
  for (const key of CLAIM_KEY_ORDER) {
    if (Object.prototype.hasOwnProperty.call(claims, key) && claims[key] !== undefined) out[key] = claims[key];
  }
  return out;
}

function signRaw(deps, claims, domain = S2_OWNER_INSTRUCTION_DOMAIN) {
  const payload = `${domain}\n${canonicalJson(orderedClaims(claims))}`;
  const lookup = deps.keyRegistry.lookup(deps.installedKid);
  const signature = sign(null, Buffer.from(payload, 'utf8'), createPrivateKey(lookup.entry.privateKeyPem));
  return `${Buffer.from(payload).toString('base64url')}.${Buffer.from(signature).toString('base64url')}`;
}

test('POS-01 TEST_ONLY fixture signature verifies under isolated trust (NON_OPERATIONAL)', () => {
  const deps = fixtureTrust();
  const issued = issueS2OwnerImplementationInstruction(baseRequest(deps), {
    keyRegistry: deps.keyRegistry,
    clock: deps.clock,
  });
  assert.equal(issued.ok, true);
  assert.equal(issued.testOnly, true);
  assert.equal(issued.operational, false);
  const verified = verifyS2OwnerImplementationInstruction(
    issued.instruction.encoded,
    expectation(),
    depsTriple(deps, { consumeOnAllow: true }),
  );
  assert.equal(verified.ok, true);
  assert.equal(verified.decision, D.ALLOW);
  assert.equal(verified.operational, false);
  assert.equal(verified.purpose, S2_OWNER_INSTRUCTION_PURPOSE);
  assert.equal(verified.instruction.claims.kind, S2_OWNER_INSTRUCTION_KIND);
  assert.equal(verified.instruction.claims.domain, S2_OWNER_INSTRUCTION_DOMAIN);
});

test('POS-02 bindings: repository/slice/sha/digest/revision/paths match', () => {
  const deps = fixtureTrust();
  const issued = issueS2OwnerImplementationInstruction(baseRequest(deps), {
    keyRegistry: deps.keyRegistry, clock: deps.clock,
  });
  const v = verifyS2OwnerImplementationInstruction(
    issued.instruction.encoded,
    expectation(),
    depsTriple(deps, { consumeOnAllow: true }),
  );
  assert.equal(v.ok, true);
  assert.deepEqual([...v.instruction.claims.authorizedFileScope], [...SCOPE].sort());
  assert.equal(v.instruction.claims.canonicalSha, SHA);
  assert.equal(v.instruction.claims.governanceRevision, REV);
});

test('POS-03 bounded expiry + fresh JTI accepted', () => {
  const deps = fixtureTrust({ startMs: 1_700_000_000_000 });
  const issued = issueS2OwnerImplementationInstruction(
    baseRequest(deps, { ttlMs: 30_000, jti: 'freshjti001' }),
    { keyRegistry: deps.keyRegistry, clock: deps.clock },
  );
  assert.equal(issued.ok, true);
  const v = verifyS2OwnerImplementationInstruction(
    issued.instruction.encoded,
    expectation(),
    depsTriple(deps, { consumeOnAllow: true }),
  );
  assert.equal(v.ok, true);
  assert.equal(v.instruction.jti, 'freshjti001');
});

test('NEG-01 missing Owner trust DENYs', () => {
  const installed = createOwnerInstalledS2ImplTrustDeps({});
  assert.equal(installed.ok, false);
  assert.equal(installed.decision, D.DENY_OWNER_TRUST_MISSING);
});

test('NEG-02 caller-injected trust options rejected', () => {
  const r = createOwnerInstalledS2ImplTrustDeps({ publicKey: 'x', kid: 'y' });
  assert.equal(r.decision, D.DENY_CALLER_SUPPLIED_TRUST);
});

test('NEG-03 public constructors sealed', () => {
  assert.throws(() => createS2InstructionKeyRegistry(), /FORBIDDEN/);
  assert.throws(() => createS2InstructionRevocationRegistry(), /FORBIDDEN/);
  assert.throws(() => createS2InstructionClock(), /FORBIDDEN/);
  assert.throws(() => createS2InstructionVerifier(), /FORBIDDEN/);
});

test('NEG-04 forged signature DENYs', () => {
  const deps = fixtureTrust();
  const issued = issueS2OwnerImplementationInstruction(baseRequest(deps), {
    keyRegistry: deps.keyRegistry, clock: deps.clock,
  });
  const [payload] = issued.instruction.encoded.split('.');
  const forged = `${payload}.${Buffer.from('forged-signature-bytes-forged!!').toString('base64url')}`;
  assertDeny(verifyS2OwnerImplementationInstruction(forged, expectation(), depsTriple(deps)), D.DENY_INVALID_SIGNATURE);
});

test('NEG-05 wrong Ed25519 public key DENYs', () => {
  const deps = fixtureTrust();
  const issued = issueS2OwnerImplementationInstruction(baseRequest(deps), {
    keyRegistry: deps.keyRegistry, clock: deps.clock,
  });
  const other = fixtureTrust({ kid: deps.installedKid, issuer: deps.issuer });
  assertDeny(verifyS2OwnerImplementationInstruction(
    issued.instruction.encoded,
    expectation(),
    {
      keyRegistry: other.keyRegistry,
      revocationRegistry: deps.revocationRegistry,
      clock: deps.clock,
    },
  ), D.DENY_INVALID_SIGNATURE);
});

test('NEG-06 wrong KID DENYs', () => {
  const deps = fixtureTrust();
  const issued = issueS2OwnerImplementationInstruction(baseRequest(deps), {
    keyRegistry: deps.keyRegistry, clock: deps.clock,
  });
  const alt = withPrivilegedS2InstructionConstruction(() => {
    const ctors = getPrivilegedS2InstructionConstructors();
    const keys = generateEphemeralS2InstructionKeyPair();
    return ctors.createKeyRegistry([{
      kid: 'wrong-kid', issuer: deps.issuer, publicKeyPem: keys.publicKeyPem, status: 'ACTIVE',
    }]);
  });
  assertDeny(verifyS2OwnerImplementationInstruction(
    issued.instruction.encoded,
    expectation(),
    { keyRegistry: alt, revocationRegistry: deps.revocationRegistry, clock: deps.clock },
  ), D.DENY_UNKNOWN_ISSUER_OR_KID);
});

test('NEG-07 domain separation from DLP011 and live Tier-3 KIND/DOMAIN/PURPOSE', () => {
  assert.notEqual(S2_OWNER_INSTRUCTION_KIND, 'TECP_DLP011_OWNER_IMPLEMENTATION_INSTRUCTION');
  assert.notEqual(S2_OWNER_INSTRUCTION_DOMAIN, 'TECP-DLP-011-OWNER-IMPLEMENTATION-INSTRUCTION-V1');
  assert.notEqual(S2_OWNER_INSTRUCTION_PURPOSE, 'TEST_ONLY');
  assert.notEqual(S2_OWNER_INSTRUCTION_KIND, 'TECP_OPS_S2_TIER3_OWNER_CAPABILITY_V1');
  assert.equal(S2_OWNER_INSTRUCTION_PURPOSE, 'OFFLINE_IMPLEMENTATION');
});

test('NEG-08 DLP011 instruction substitution fails domain check', () => {
  const deps = fixtureTrust();
  const claims = {
    alg: S2_OWNER_INSTRUCTION_ALG,
    authorizedFileScope: [...SCOPE].sort(),
    canonicalSha: SHA,
    domain: 'TECP-DLP-011-OWNER-IMPLEMENTATION-INSTRUCTION-V1',
    exp: 1_700_000_060_000,
    governanceRevision: REV,
    iat: 1_700_000_000_000,
    iss: deps.issuer,
    jti: 'dlp011sub01',
    kid: deps.installedKid,
    kind: 'TECP_DLP011_OWNER_IMPLEMENTATION_INSTRUCTION',
    nbf: 1_700_000_000_000,
    operationClass: 'IMPLEMENT',
    purpose: 'TEST_ONLY',
    repositoryId: S2_OWNER_INSTRUCTION_REPOSITORY_ID,
    rule02DigestSha256: DIGEST,
    sliceId: SLICE,
  };
  const encoded = signRaw(deps, claims, 'TECP-DLP-011-OWNER-IMPLEMENTATION-INSTRUCTION-V1');
  assertDeny(verifyS2OwnerImplementationInstruction(encoded, expectation(), depsTriple(deps)), D.DENY_WRONG_KIND_OR_DOMAIN);
});

test('NEG-09 live Tier-3 capability substitution fails domain check', () => {
  const deps = fixtureTrust();
  const claims = {
    alg: S2_OWNER_INSTRUCTION_ALG,
    authorizedFileScope: [...SCOPE].sort(),
    canonicalSha: SHA,
    domain: 'TECP-OPS-S2-TIER3-OWNER-CAPABILITY-V1',
    exp: 1_700_000_060_000,
    governanceRevision: REV,
    iat: 1_700_000_000_000,
    iss: deps.issuer,
    jti: 'tier3sub01',
    kid: deps.installedKid,
    kind: 'TECP_OPS_S2_TIER3_OWNER_CAPABILITY_V1',
    nbf: 1_700_000_000_000,
    operationClass: 'IMPLEMENT',
    purpose: 'LIVE_TIER3',
    repositoryId: S2_OWNER_INSTRUCTION_REPOSITORY_ID,
    rule02DigestSha256: DIGEST,
    sliceId: SLICE,
  };
  const encoded = signRaw(deps, claims, 'TECP-OPS-S2-TIER3-OWNER-CAPABILITY-V1');
  assertDeny(verifyS2OwnerImplementationInstruction(encoded, expectation(), depsTriple(deps)), D.DENY_WRONG_KIND_OR_DOMAIN);
});

test('NEG-10 wrong repository DENYs', () => {
  const deps = fixtureTrust();
  const issued = issueS2OwnerImplementationInstruction(baseRequest(deps), {
    keyRegistry: deps.keyRegistry, clock: deps.clock,
  });
  assertDeny(verifyS2OwnerImplementationInstruction(
    issued.instruction.encoded,
    expectation({ repositoryId: 'other/repo' }),
    depsTriple(deps),
  ), D.DENY_WRONG_REPOSITORY);
});

test('NEG-11 wrong active AWP DENYs', () => {
  const deps = fixtureTrust();
  const issued = issueS2OwnerImplementationInstruction(baseRequest(deps), {
    keyRegistry: deps.keyRegistry, clock: deps.clock,
  });
  assertDeny(verifyS2OwnerImplementationInstruction(
    issued.instruction.encoded,
    expectation({ sliceId: 'WRONG-SLICE' }),
    depsTriple(deps),
  ), D.DENY_WRONG_SLICE);
});

test('NEG-12 wrong canonical SHA DENYs', () => {
  const deps = fixtureTrust();
  const issued = issueS2OwnerImplementationInstruction(baseRequest(deps), {
    keyRegistry: deps.keyRegistry, clock: deps.clock,
  });
  assertDeny(verifyS2OwnerImplementationInstruction(
    issued.instruction.encoded,
    expectation({ canonicalSha: '0'.repeat(40) }),
    depsTriple(deps),
  ), D.DENY_WRONG_SHA);
});

test('NEG-13 wrong Rule02 digest DENYs', () => {
  const deps = fixtureTrust();
  const issued = issueS2OwnerImplementationInstruction(baseRequest(deps), {
    keyRegistry: deps.keyRegistry, clock: deps.clock,
  });
  assertDeny(verifyS2OwnerImplementationInstruction(
    issued.instruction.encoded,
    expectation({ rule02DigestSha256: 'a'.repeat(64) }),
    depsTriple(deps),
  ), D.DENY_WRONG_DIGEST);
});

test('NEG-14 wrong governance revision DENYs', () => {
  const deps = fixtureTrust();
  const issued = issueS2OwnerImplementationInstruction(baseRequest(deps), {
    keyRegistry: deps.keyRegistry, clock: deps.clock,
  });
  assertDeny(verifyS2OwnerImplementationInstruction(
    issued.instruction.encoded,
    expectation({ governanceRevision: 'WRONG_REV' }),
    depsTriple(deps),
  ), D.DENY_WRONG_GOVERNANCE_REVISION);
});

test('NEG-15 wrong operation class DENYs', () => {
  const deps = fixtureTrust();
  const issued = issueS2OwnerImplementationInstruction(baseRequest(deps), {
    keyRegistry: deps.keyRegistry, clock: deps.clock,
  });
  assertDeny(verifyS2OwnerImplementationInstruction(
    issued.instruction.encoded,
    expectation({ operationClass: 'DEPLOY' }),
    depsTriple(deps),
  ), D.DENY_WRONG_OPERATION);
});

test('NEG-16 one extra requested path DENYs', () => {
  const deps = fixtureTrust();
  const issued = issueS2OwnerImplementationInstruction(baseRequest(deps), {
    keyRegistry: deps.keyRegistry, clock: deps.clock,
  });
  assertDeny(verifyS2OwnerImplementationInstruction(
    issued.instruction.encoded,
    expectation({ authorizedFileScope: [...SCOPE, 'tecp/src/extra.js'] }),
    depsTriple(deps),
  ), D.DENY_WRONG_SCOPE);
});

test('NEG-17 unauthorized protected path DENYs', () => {
  const deps = fixtureTrust();
  const issued = issueS2OwnerImplementationInstruction(baseRequest(deps), {
    keyRegistry: deps.keyRegistry, clock: deps.clock,
  });
  assertDeny(verifyS2OwnerImplementationInstruction(
    issued.instruction.encoded,
    expectation({ authorizedFileScope: ['.cursor/rules/titangold-current-active-work.mdc'] }),
    depsTriple(deps),
  ), D.DENY_WRONG_SCOPE);
});

test('NEG-18 missing authorized path where exact-set binding required DENYs', () => {
  const deps = fixtureTrust();
  const issued = issueS2OwnerImplementationInstruction(baseRequest(deps), {
    keyRegistry: deps.keyRegistry, clock: deps.clock,
  });
  assertDeny(verifyS2OwnerImplementationInstruction(
    issued.instruction.encoded,
    expectation({ authorizedFileScope: SCOPE.slice(0, 3) }),
    depsTriple(deps),
  ), D.DENY_WRONG_SCOPE);
});

test('NEG-19 expired instruction DENYs', () => {
  const deps = fixtureTrust({ startMs: 1_700_000_000_000 });
  const issued = issueS2OwnerImplementationInstruction(
    baseRequest(deps, { ttlMs: 1_000 }),
    { keyRegistry: deps.keyRegistry, clock: deps.clock },
  );
  deps.clock.advance(2_000);
  assertDeny(verifyS2OwnerImplementationInstruction(
    issued.instruction.encoded,
    expectation(),
    depsTriple(deps),
  ), D.DENY_EXPIRED);
});

test('NEG-20 future not-before DENYs', () => {
  const deps = fixtureTrust({ startMs: 1_700_000_000_000 });
  const issued = issueS2OwnerImplementationInstruction(
    baseRequest(deps, { nbf: 1_700_000_100_000 }),
    { keyRegistry: deps.keyRegistry, clock: deps.clock },
  );
  assertDeny(verifyS2OwnerImplementationInstruction(
    issued.instruction.encoded,
    expectation(),
    depsTriple(deps),
  ), D.DENY_NOT_YET_VALID);
});

test('NEG-21 excessive TTL DENYs at issue', () => {
  const deps = fixtureTrust();
  const issued = issueS2OwnerImplementationInstruction(
    baseRequest(deps, { ttlMs: S2_OWNER_INSTRUCTION_MAX_TTL_MS + 1 }),
    { keyRegistry: deps.keyRegistry, clock: deps.clock },
  );
  assertDeny(issued, D.DENY_EXCESSIVE_TTL);
});

test('NEG-22 revoked JTI DENYs', () => {
  const deps = fixtureTrust();
  const issued = issueS2OwnerImplementationInstruction(
    baseRequest(deps, { jti: 'revokedjti01' }),
    { keyRegistry: deps.keyRegistry, clock: deps.clock },
  );
  deps.revocationRegistry.revokeJti('revokedjti01');
  assertDeny(verifyS2OwnerImplementationInstruction(
    issued.instruction.encoded,
    expectation(),
    depsTriple(deps),
  ), D.DENY_REVOKED_JTI);
});

test('NEG-23 replayed JTI DENYs', () => {
  const deps = fixtureTrust();
  const issued = issueS2OwnerImplementationInstruction(
    baseRequest(deps, { jti: 'replayjti01' }),
    { keyRegistry: deps.keyRegistry, clock: deps.clock },
  );
  const first = verifyS2OwnerImplementationInstruction(
    issued.instruction.encoded,
    expectation(),
    depsTriple(deps, { consumeOnAllow: true }),
  );
  assert.equal(first.ok, true);
  assertDeny(verifyS2OwnerImplementationInstruction(
    issued.instruction.encoded,
    expectation(),
    depsTriple(deps, { consumeOnAllow: true }),
  ), D.DENY_REPLAYED_JTI);
});

test('NEG-24 concurrent same-JTI race: only one ALLOW (sync atomic consume)', () => {
  const deps = fixtureTrust();
  const issued = issueS2OwnerImplementationInstruction(
    baseRequest(deps, { jti: 'racejti0001' }),
    { keyRegistry: deps.keyRegistry, clock: deps.clock },
  );
  const results = [];
  for (let i = 0; i < 20; i += 1) {
    results.push(verifyS2OwnerImplementationInstruction(
      issued.instruction.encoded,
      expectation(),
      depsTriple(deps, { consumeOnAllow: true }),
    ));
  }
  const allows = results.filter((r) => r.ok === true);
  const denies = results.filter((r) => r.ok === false);
  assert.equal(allows.length, 1);
  assert.equal(denies.length, 19);
  assert.ok(denies.every((r) => r.decision === D.DENY_REPLAYED_JTI));
  assert.equal(deps.revocationRegistry.atomicConsume, true);
});

test('NEG-25 missing revocation registry DENYs', () => {
  const deps = fixtureTrust();
  const issued = issueS2OwnerImplementationInstruction(baseRequest(deps), {
    keyRegistry: deps.keyRegistry, clock: deps.clock,
  });
  assertDeny(verifyS2OwnerImplementationInstruction(
    issued.instruction.encoded,
    expectation(),
    { keyRegistry: deps.keyRegistry, clock: deps.clock, revocationRegistry: {} },
  ), D.DENY_MISSING_DEPS);
});

test('NEG-26 caller-supplied verification key rejected', () => {
  const deps = fixtureTrust();
  const issued = issueS2OwnerImplementationInstruction(baseRequest(deps), {
    keyRegistry: deps.keyRegistry, clock: deps.clock,
  });
  assertDeny(verifyS2OwnerImplementationInstruction(
    issued.instruction.encoded,
    expectation(),
    {
      ...depsTriple(deps),
      publicKeyPem: deps.keyPair.publicKeyPem,
    },
  ), D.DENY_CALLER_SUPPLIED_TRUST);
});

test('NEG-27 malformed / noncanonical payload DENYs', () => {
  const deps = fixtureTrust();
  assertDeny(verifyS2OwnerImplementationInstruction('not-valid', expectation(), depsTriple(deps)), D.DENY_MALFORMED);
  const messyJson = `{"sliceId":"${SLICE}","alg":"Ed25519","authorizedFileScope":${JSON.stringify([...SCOPE].sort())},"canonicalSha":"${SHA}","domain":"${S2_OWNER_INSTRUCTION_DOMAIN}","exp":1700000060000,"governanceRevision":"${REV}","iat":1700000000000,"iss":"${deps.issuer}","jti":"malformed01","kid":"${deps.installedKid}","kind":"${S2_OWNER_INSTRUCTION_KIND}","nbf":1700000000000,"operationClass":"IMPLEMENT","purpose":"${S2_OWNER_INSTRUCTION_PURPOSE}","repositoryId":"${S2_OWNER_INSTRUCTION_REPOSITORY_ID}","rule02DigestSha256":"${DIGEST}"}`;
  const messy = `${S2_OWNER_INSTRUCTION_DOMAIN}\n${messyJson}`;
  const lookup = deps.keyRegistry.lookup(deps.installedKid);
  const signature = sign(null, Buffer.from(messy, 'utf8'), createPrivateKey(lookup.entry.privateKeyPem));
  const encoded = `${Buffer.from(messy).toString('base64url')}.${Buffer.from(signature).toString('base64url')}`;
  assertDeny(verifyS2OwnerImplementationInstruction(encoded, expectation(), depsTriple(deps)), D.DENY_NONCANONICAL_ENCODING);
});

test('NEG-28 unknown signed field DENYs', () => {
  const deps = fixtureTrust();
  const claims = {
    alg: S2_OWNER_INSTRUCTION_ALG,
    authorizedFileScope: [...SCOPE].sort(),
    canonicalSha: SHA,
    domain: S2_OWNER_INSTRUCTION_DOMAIN,
    exp: 1_700_000_060_000,
    governanceRevision: REV,
    iat: 1_700_000_000_000,
    iss: deps.issuer,
    jti: 'unknownfld1',
    kid: deps.installedKid,
    kind: S2_OWNER_INSTRUCTION_KIND,
    nbf: 1_700_000_000_000,
    operationClass: 'IMPLEMENT',
    purpose: S2_OWNER_INSTRUCTION_PURPOSE,
    repositoryId: S2_OWNER_INSTRUCTION_REPOSITORY_ID,
    rule02DigestSha256: DIGEST,
    sliceId: SLICE,
    extraEvil: 'nope',
  };
  const payload = `${S2_OWNER_INSTRUCTION_DOMAIN}\n${JSON.stringify(claims)}`;
  const lookup = deps.keyRegistry.lookup(deps.installedKid);
  const signature = sign(null, Buffer.from(payload, 'utf8'), createPrivateKey(lookup.entry.privateKeyPem));
  const encoded = `${Buffer.from(payload).toString('base64url')}.${Buffer.from(signature).toString('base64url')}`;
  assertDeny(verifyS2OwnerImplementationInstruction(encoded, expectation(), depsTriple(deps)), D.DENY_UNKNOWN_SIGNED_FIELD);
});

test('NEG-29 wrong PURPOSE at issue DENYs', () => {
  const deps = fixtureTrust();
  assertDeny(issueS2OwnerImplementationInstruction(
    baseRequest(deps, { purpose: 'TEST_ONLY' }),
    { keyRegistry: deps.keyRegistry, clock: deps.clock },
  ), D.DENY_WRONG_PURPOSE);
});

test('NEG-30 private key never accepted in Owner trust options / runtime verify', () => {
  const deps = fixtureTrust();
  const issued = issueS2OwnerImplementationInstruction(baseRequest(deps), {
    keyRegistry: deps.keyRegistry, clock: deps.clock,
  });
  assertDeny(verifyS2OwnerImplementationInstruction(
    issued.instruction.encoded,
    expectation(),
    { ...depsTriple(deps), privateKeyPem: deps.keyPair.privateKeyPem },
  ), D.DENY_CALLER_SUPPLIED_TRUST);
});
