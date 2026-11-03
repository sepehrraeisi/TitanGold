/**
 * TECP-DLP-011 disposable merge-effectiveness harness (TEST_ONLY / NON_OPERATIONAL).
 *
 * Acts as the privileged trust installer for disposable proof scenarios.
 * Option A residual: same-process callers of createDisposableEffectiveAuthorizationTrustRoot
 * are outside the proven untrusted-request adversarial boundary.
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash, generateKeyPairSync, sign } from 'node:crypto';

import {
  DISPOSABLE_TRUST_INJECTION_TOKEN,
  GATE_AUTHORIZED_FILE_SCOPE,
  GATE_OPERATION_CLASS,
  GATE_REPOSITORY_ID,
  GATE_SLICE_ID,
  advanceTrustRootClock,
  consumeTrustRootJti,
  createDisposableEffectiveAuthorizationTrustRoot,
  driftTrustRootTip,
  gateDigestText,
  getTrustRootPublicView,
  installUnavailableClockOnTrustRoot,
  issueOwnerInstructionFromTrustRoot,
  replaceTrustRootProvenance,
  revokeTrustRootJti,
} from '../src/effectiveImplementationAuthorizationGate.js';
import {
  OWNER_INSTRUCTION_ALG,
  OWNER_INSTRUCTION_DOMAIN,
  OWNER_INSTRUCTION_KIND,
  sha256Hex,
} from '../src/ownerImplementationInstruction.js';
import { canonicalJson } from '../src/workerCapabilityToken.js';

const here = dirname(fileURLToPath(import.meta.url));
const ROOT = join(here, '../..');
const RULE02_PATH = join(ROOT, '.cursor/rules/titangold-current-active-work.mdc');

export const YES_TOKEN = 'YES / EXACT_SLICE_ONLY / EFFECTIVE_AFTER_THIS_GOVERNANCE_PR_MERGES';
export const CONSUMED_TOKEN = 'CONSUMED / NON-ACTIVE';
export const DEFAULT_GOVERNANCE_REVISION = 'DLP011_IMPLEMENTATION_ACTIVATION_20261103';
export const CANONICAL_MAIN_SHA_PIN = '795933be01be7305ba4fbe53d62fc3e9e2e2baff';

function b64url(buf) {
  return Buffer.from(buf).toString('base64url');
}

export function loadWorkspaceRule02Text() {
  return readFileSync(RULE02_PATH, 'utf8');
}

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

export function synthesizeUnmergedYesTokenRule02Text() {
  return loadWorkspaceRule02Text();
}

export function digestRule02(text) {
  return createHash('sha256').update(String(text), 'utf8').digest('hex');
}

export function createDisposableMergeEffectivenessHarness(options = {}) {
  const mergedRule02Text = options.mergedRule02Text || loadWorkspaceRule02Text();
  const canonicalSha = options.canonicalSha || CANONICAL_MAIN_SHA_PIN;
  const mergedProvenance = options.mergedProvenance !== false;

  const { trustRoot, installerCapability } = createDisposableEffectiveAuthorizationTrustRoot({
    privilegedTrustInjection: DISPOSABLE_TRUST_INJECTION_TOKEN,
    canonicalSha,
    disposableRule02Override: mergedRule02Text,
    mergedProvenance,
    activationPr: mergedProvenance ? '#266' : null,
    startMs: Number.isSafeInteger(options.startMs) ? options.startMs : 1_700_000_000_000,
  });

  function view() {
    return getTrustRootPublicView(trustRoot);
  }

  function issueExactSliceInstruction(overrides = {}) {
    return issueOwnerInstructionFromTrustRoot(installerCapability, {
      governanceRevision: DEFAULT_GOVERNANCE_REVISION,
      ...overrides,
    });
  }

  function buildGateInput(overrides = {}) {
    const v = view();
    const issued = overrides.ownerInstructionEncoded != null
      ? null
      : issueExactSliceInstruction(overrides.instructionOverrides || {});
    if (issued && issued.ok !== true) {
      throw new Error(`HARNESS_ISSUE_FAILED:${issued.decision}`);
    }
    const {
      instructionOverrides: _ignore,
      ...rest
    } = overrides;
    return {
      testOnlyEnvironment: true,
      trustRoot,
      expectedCanonicalSha: v.canonicalSha,
      expectedRule02DigestSha256: v.rule02DigestSha256,
      repositoryId: GATE_REPOSITORY_ID,
      sliceId: GATE_SLICE_ID,
      operationClass: GATE_OPERATION_CLASS,
      governanceRevision: DEFAULT_GOVERNANCE_REVISION,
      authorizedFileScope: [...GATE_AUTHORIZED_FILE_SCOPE],
      ownerInstructionEncoded: issued ? issued.instruction.encoded : overrides.ownerInstructionEncoded,
      ...rest,
      trustRoot: rest.trustRoot || trustRoot,
    };
  }

  function forgeInvalidSignatureInstruction(baseEncoded) {
    const [payloadB64] = String(baseEncoded).split('.');
    const junkSig = b64url(Buffer.alloc(64, 7));
    return `${payloadB64}.${junkSig}`;
  }

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

  function useClosedProvenance() {
    const text = synthesizeClosedRule02Text();
    return replaceTrustRootProvenance(installerCapability, {
      privilegedTrustInjection: DISPOSABLE_TRUST_INJECTION_TOKEN,
      rule02Text: text,
      mergedProvenance: true,
      activationPr: '#266',
    });
  }

  function useUnmergedYesProvenance() {
    const text = synthesizeUnmergedYesTokenRule02Text();
    return replaceTrustRootProvenance(installerCapability, {
      privilegedTrustInjection: DISPOSABLE_TRUST_INJECTION_TOKEN,
      rule02Text: text,
      mergedProvenance: false,
    });
  }

  function useForgedRule02Provenance() {
    const text = '# not a valid rule02\n**FAKE = true**\n';
    return replaceTrustRootProvenance(installerCapability, {
      privilegedTrustInjection: DISPOSABLE_TRUST_INJECTION_TOKEN,
      rule02Text: text,
      mergedProvenance: true,
      activationPr: '#266',
    });
  }

  return Object.freeze({
    kind: 'TECP_DLP011_DISPOSABLE_MERGE_EFFECTIVENESS_HARNESS',
    testOnly: true,
    productionTrustEstablished: false,
    liveGithubProvenance: false,
    realOwnerKeyCustody: false,
    sameProcessTrustInstallerResidual: true,
    acceptanceDisposition: 'A_DISPOSABLE_LIMITED',
    trustRoot,
    installerCapability,
    view,
    get mergedDigest() { return view().rule02DigestSha256; },
    get canonicalSha() { return view().canonicalSha; },
    get publicKeyPem() { return view().publicKeyPem; },
    issueExactSliceInstruction,
    buildGateInput,
    forgeInvalidSignatureInstruction,
    signClaimsWithForeignKey,
    useClosedProvenance,
    useUnmergedYesProvenance,
    useForgedRule02Provenance,
    advanceClock: (ms) => advanceTrustRootClock(installerCapability, ms),
    revokeJti: (jti) => revokeTrustRootJti(installerCapability, jti),
    consumeJti: (jti) => consumeTrustRootJti(installerCapability, jti),
    driftTip: (spec) => driftTrustRootTip(installerCapability, spec),
    installUnavailableClock: () => installUnavailableClockOnTrustRoot(installerCapability),
    replaceProvenance: (spec) => replaceTrustRootProvenance(installerCapability, {
      privilegedTrustInjection: DISPOSABLE_TRUST_INJECTION_TOKEN,
      ...spec,
    }),
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
  DISPOSABLE_TRUST_INJECTION_TOKEN,
  OWNER_INSTRUCTION_KIND,
  OWNER_INSTRUCTION_ALG,
};
