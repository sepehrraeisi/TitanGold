/**
 * TECP-DLP-011 disposable merge-effectiveness harness (TEST_ONLY / NON_OPERATIONAL).
 *
 * Attested offline doubles only. Does NOT establish production trust, live GitHub
 * provenance, real Owner key custody, or operational Worker/MCP authority.
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash, generateKeyPairSync, sign } from 'node:crypto';

import {
  GATE_AUTHORIZED_FILE_SCOPE,
  GATE_OPERATION_CLASS,
  GATE_REPOSITORY_ID,
  GATE_SLICE_ID,
  createTestOnlyAttestedCanonicalRule02Source,
  createTrustedTipAttestation,
  gateDigestText,
} from '../src/effectiveImplementationAuthorizationGate.js';
import {
  OWNER_INSTRUCTION_PURPOSE,
  createOwnerImplementationInstructionVerifier,
  createOwnerInstructionClock,
  createOwnerInstructionKeyRegistry,
  createOwnerInstructionRevocationRegistry,
  generateEphemeralOwnerInstructionKeyPair,
  issueOwnerImplementationInstruction,
  sha256Hex,
} from '../src/ownerImplementationInstruction.js';
import { canonicalJson } from '../src/workerCapabilityToken.js';
import {
  OWNER_INSTRUCTION_DOMAIN,
  OWNER_INSTRUCTION_KIND,
  OWNER_INSTRUCTION_ALG,
} from '../src/ownerImplementationInstruction.js';

const here = dirname(fileURLToPath(import.meta.url));
const ROOT = join(here, '../..');
const RULE02_PATH = join(ROOT, '.cursor/rules/titangold-current-active-work.mdc');

export const YES_TOKEN = 'YES / EXACT_SLICE_ONLY / EFFECTIVE_AFTER_THIS_GOVERNANCE_PR_MERGES';
export const CONSUMED_TOKEN = 'CONSUMED / NON-ACTIVE';
export const DEFAULT_GOVERNANCE_REVISION = 'DLP011_IMPLEMENTATION_ACTIVATION_20261103';
export const DEFAULT_ISSUER = 'tecp-dlp011-test-owner-issuer';
export const DEFAULT_KID = 'dlp011-test-owner-ed25519-1';

export const CANONICAL_MAIN_SHA_PIN = '795933be01be7305ba4fbe53d62fc3e9e2e2baff';

function b64url(buf) {
  return Buffer.from(buf).toString('base64url');
}

/**
 * Load current workspace Rule02 text (post-#266 activation tip).
 * Offline only — no network.
 */
export function loadWorkspaceRule02Text() {
  return readFileSync(RULE02_PATH, 'utf8');
}

/**
 * Synthesize a closed/consumed Rule02 from current tip by flipping AWP YES → CONSUMED.
 */
export function synthesizeClosedRule02Text(sourceText = loadWorkspaceRule02Text()) {
  return sourceText
    .replaceAll(
      `**IMPLEMENTATION_AUTHORIZED = ${YES_TOKEN}**`,
      `**IMPLEMENTATION_AUTHORIZED = ${CONSUMED_TOKEN}**`,
    )
    .replaceAll(
      `**TECP005_IMPLEMENTATION_AUTHORIZED = ${YES_TOKEN}**`,
      `**TECP005_IMPLEMENTATION_AUTHORIZED = ${CONSUMED_TOKEN}**`,
    )
    .replaceAll(
      `**TECP_DLP011_IMPLEMENTATION_AUTHORIZED = ${YES_TOKEN}**`,
      `**TECP_DLP011_IMPLEMENTATION_AUTHORIZED = ${CONSUMED_TOKEN}**`,
    );
}

/**
 * Unmerged YES-token proposal forgery helper (offline).
 * Starts from closed text and re-injects YES into AWP fields only.
 */
/**
 * Unmerged YES-token proposal text. Current post-#266 tip already carries the YES AWP
 * token — reuse it as the forged/unmerged proposal body when combined with
 * mergedProvenance=false on the attested source.
 */
export function synthesizeUnmergedYesTokenRule02Text() {
  return loadWorkspaceRule02Text();
}

export function digestRule02(text) {
  return createHash('sha256').update(String(text), 'utf8').digest('hex');
}

/**
 * Build a complete disposable harness context for DLP-011 gate tests.
 */
export function createDisposableMergeEffectivenessHarness(options = {}) {
  const keys = generateEphemeralOwnerInstructionKeyPair();
  const clock = createOwnerInstructionClock(
    Number.isSafeInteger(options.startMs) ? options.startMs : 1_700_000_000_000,
  );
  const revocationRegistry = createOwnerInstructionRevocationRegistry();
  const keyRegistry = createOwnerInstructionKeyRegistry([
    {
      kid: DEFAULT_KID,
      issuer: DEFAULT_ISSUER,
      publicKeyPem: keys.publicKeyPem,
      privateKeyPem: keys.privateKeyPem,
      algorithm: 'Ed25519',
      status: 'ACTIVE',
    },
  ]);
  const ownerInstructionVerifier = createOwnerImplementationInstructionVerifier({
    keyRegistry,
    revocationRegistry,
    clock,
    consumeOnAllow: true,
  });

  const mergedRule02Text = options.mergedRule02Text || loadWorkspaceRule02Text();
  const mergedDigest = digestRule02(mergedRule02Text);
  const canonicalSha = options.canonicalSha || CANONICAL_MAIN_SHA_PIN;

  const mergedSource = createTestOnlyAttestedCanonicalRule02Source({
    repositoryId: GATE_REPOSITORY_ID,
    canonicalSha,
    rule02Text: mergedRule02Text,
    expectedRule02DigestSha256: mergedDigest,
    mergedProvenance: true,
    activationPr: '#266',
    tipDigest: mergedDigest,
  });

  const tipAttestation = createTrustedTipAttestation({
    tipSha: canonicalSha,
    tipDigest: mergedDigest,
    observedAtMs: clock.now(),
    attestedByPrivilegedFactory: true,
  });

  function issueExactSliceInstruction(overrides = {}) {
    return issueOwnerImplementationInstruction({
      repositoryId: GATE_REPOSITORY_ID,
      canonicalSha,
      rule02DigestSha256: mergedDigest,
      sliceId: GATE_SLICE_ID,
      authorizedFileScope: [...GATE_AUTHORIZED_FILE_SCOPE],
      operationClass: GATE_OPERATION_CLASS,
      governanceRevision: DEFAULT_GOVERNANCE_REVISION,
      purpose: OWNER_INSTRUCTION_PURPOSE,
      issuer: DEFAULT_ISSUER,
      kid: DEFAULT_KID,
      ttlMs: 60_000,
      ...overrides,
    }, { keyRegistry, clock });
  }

  function buildGateInput(overrides = {}) {
    const issued = overrides.ownerInstructionEncoded != null
      ? null
      : issueExactSliceInstruction(overrides.instructionOverrides || {});
    if (issued && issued.ok !== true) {
      throw new Error(`HARNESS_ISSUE_FAILED:${issued.decision}`);
    }
    return {
      testOnlyEnvironment: true,
      canonicalRule02Source: mergedSource,
      ownerInstructionVerifier,
      tipAttestation,
      expectedCanonicalSha: canonicalSha,
      expectedRule02DigestSha256: mergedDigest,
      repositoryId: GATE_REPOSITORY_ID,
      sliceId: GATE_SLICE_ID,
      operationClass: GATE_OPERATION_CLASS,
      governanceRevision: DEFAULT_GOVERNANCE_REVISION,
      authorizedFileScope: [...GATE_AUTHORIZED_FILE_SCOPE],
      ownerInstructionEncoded: issued ? issued.instruction.encoded : overrides.ownerInstructionEncoded,
      ...overrides,
      // Prevent accidental override of critical branded objects unless explicit.
      ...(overrides.canonicalRule02Source
        ? { canonicalRule02Source: overrides.canonicalRule02Source }
        : {}),
      ...(overrides.tipAttestation ? { tipAttestation: overrides.tipAttestation } : {}),
      ...(overrides.ownerInstructionVerifier
        ? { ownerInstructionVerifier: overrides.ownerInstructionVerifier }
        : {}),
    };
  }

  /**
   * Craft a tampered instruction with invalid signature (keeps claim shape).
   */
  function forgeInvalidSignatureInstruction(baseEncoded) {
    const [payloadB64] = String(baseEncoded).split('.');
    const junkSig = b64url(Buffer.alloc(64, 7));
    return `${payloadB64}.${junkSig}`;
  }

  /**
   * Re-sign claims with a different ephemeral key (unknown kid / wrong key).
   */
  function signClaimsWithForeignKey(claims) {
    const foreign = generateKeyPairSync('ed25519');
    const ordered = {};
    const order = [
      'alg', 'authorizedFileScope', 'canonicalSha', 'domain', 'exp', 'governanceRevision',
      'iat', 'iss', 'jti', 'kid', 'kind', 'operationClass', 'purpose', 'repositoryId',
      'rule02DigestSha256', 'sliceId', 'taskId', 'workerId',
    ];
    for (const k of order) {
      if (Object.prototype.hasOwnProperty.call(claims, k) && claims[k] !== undefined) {
        ordered[k] = claims[k];
      }
    }
    const payload = `${OWNER_INSTRUCTION_DOMAIN}\n${canonicalJson(ordered)}`;
    const signature = sign(null, Buffer.from(payload, 'utf8'), foreign.privateKey);
    return `${b64url(Buffer.from(payload, 'utf8'))}.${b64url(signature)}`;
  }

  return Object.freeze({
    kind: 'TECP_DLP011_DISPOSABLE_MERGE_EFFECTIVENESS_HARNESS',
    testOnly: true,
    productionTrustEstablished: false,
    liveGithubProvenance: false,
    realOwnerKeyCustody: false,
    keys: Object.freeze({
      publicKeyPem: keys.publicKeyPem,
      // private key retained for harness-only issuance; never embed in gate results.
      privateKeyPem: keys.privateKeyPem,
    }),
    clock,
    revocationRegistry,
    keyRegistry,
    ownerInstructionVerifier,
    mergedRule02Text,
    mergedDigest,
    canonicalSha,
    mergedSource,
    tipAttestation,
    issueExactSliceInstruction,
    buildGateInput,
    forgeInvalidSignatureInstruction,
    signClaimsWithForeignKey,
    createClosedSource() {
      const text = synthesizeClosedRule02Text();
      const digest = digestRule02(text);
      return createTestOnlyAttestedCanonicalRule02Source({
        repositoryId: GATE_REPOSITORY_ID,
        canonicalSha,
        rule02Text: text,
        expectedRule02DigestSha256: digest,
        mergedProvenance: true,
        activationPr: '#266',
        tipDigest: digest,
      });
    },
    createUnmergedYesSource() {
      const text = synthesizeUnmergedYesTokenRule02Text();
      const digest = digestRule02(text);
      return createTestOnlyAttestedCanonicalRule02Source({
        repositoryId: GATE_REPOSITORY_ID,
        canonicalSha,
        rule02Text: text,
        expectedRule02DigestSha256: digest,
        mergedProvenance: false,
        tipDigest: digest,
      });
    },
    createForgedRule02Source() {
      const text = '# not a valid rule02\n**FAKE = true**\n';
      const digest = digestRule02(text);
      return createTestOnlyAttestedCanonicalRule02Source({
        repositoryId: GATE_REPOSITORY_ID,
        canonicalSha,
        rule02Text: text,
        expectedRule02DigestSha256: digest,
        mergedProvenance: true,
        activationPr: '#266',
        tipDigest: digest,
      });
    },
    tipFor(source) {
      return createTrustedTipAttestation({
        tipSha: source.canonicalSha,
        tipDigest: source.tipDigest,
        observedAtMs: clock.now(),
        attestedByPrivilegedFactory: true,
      });
    },
    digestRule02,
    gateDigestText,
    sha256Hex,
  });
}

export {
  GATE_AUTHORIZED_FILE_SCOPE,
  GATE_OPERATION_CLASS,
  GATE_REPOSITORY_ID,
  GATE_SLICE_ID,
  createTestOnlyAttestedCanonicalRule02Source,
  createTrustedTipAttestation,
  OWNER_INSTRUCTION_KIND,
  OWNER_INSTRUCTION_ALG,
};
