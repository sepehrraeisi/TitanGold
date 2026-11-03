/**
 * TECP-DLP-011 disposable merge-effectiveness harness (TEST_ONLY / NON_OPERATIONAL).
 *
 * Acts as the privileged trust installer for disposable proof scenarios.
 * Option A residual: same-process callers of createDisposableEffectiveAuthorizationTrustRoot
 * are outside the proven untrusted-request adversarial boundary.
 *
 * Historical proof context is pinned to the approved DLP-011 activation-era Rule02
 * (git blob fa8c90186e155f2d3386e4065a44f1dc5762cc1c / SHA256 e6761d0c…).
 * Live closeout Rule02 is never used as silent fallback for historical cases.
 *
 * DLP-011F: checked-in fixture is the reproducible offline source of truth.
 * Optional git-blob verification is opt-in via TECP_DLP011_ALLOW_GIT_BLOB_FALLBACK=1
 * and still content-addressed + SHA256-checked — never live workspace Rule02.
 */

import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash, generateKeyPairSync, sign } from 'node:crypto';
import { execFileSync } from 'node:child_process';

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
const LIVE_RULE02_PATH = join(ROOT, '.cursor/rules/titangold-current-active-work.mdc');
const HISTORICAL_FIXTURE_PATH = join(here, 'fixtures/dlp011ActivationEraRule02.mdc');

export const YES_TOKEN = 'YES / EXACT_SLICE_ONLY / EFFECTIVE_AFTER_THIS_GOVERNANCE_PR_MERGES';
export const CONSUMED_TOKEN = 'CONSUMED / NON-ACTIVE';
export const DEFAULT_GOVERNANCE_REVISION = 'DLP011_IMPLEMENTATION_ACTIVATION_20261103';
export const HISTORICAL_GOVERNANCE_REVISION = DEFAULT_GOVERNANCE_REVISION;
export const CANONICAL_MAIN_SHA_PIN = '795933be01be7305ba4fbe53d62fc3e9e2e2baff';

/** Immutable Git blob of Rule02 at DLP-011 activation/merge baseline fbafb224. */
export const HISTORICAL_RULE02_GIT_BLOB_SHA = 'fa8c90186e155f2d3386e4065a44f1dc5762cc1c';
/** SHA256 of that blob's UTF-8 bytes (must match checked-in fixture). */
export const HISTORICAL_RULE02_SHA256 =
  'e6761d0cd06f9444e97ba45c5ed1962d614f89973151435861f5ce55bfd1156c';

/**
 * Explicit latch for TEST_ONLY harness Rule02 text overrides.
 * Untrusted callers cannot supply mergedRule02Text without this flag.
 * Does NOT grant production authority; gate + Owner instruction still apply.
 */
export const PRIVILEGED_HARNESS_RULE02_OVERRIDE = Symbol.for(
  'TECP_DLP011_PRIVILEGED_HARNESS_RULE02_OVERRIDE',
);

function b64url(buf) {
  return Buffer.from(buf).toString('base64url');
}

export function digestRule02(text) {
  return createHash('sha256').update(String(text), 'utf8').digest('hex');
}

export function verifyHistoricalRule02Text(text, sourceLabel = 'CALLER') {
  if (typeof text !== 'string' || text.length < 100) {
    throw new Error(`HISTORICAL_RULE02_MISSING_OR_EMPTY:${sourceLabel}`);
  }
  const digest = digestRule02(text);
  if (digest !== HISTORICAL_RULE02_SHA256) {
    throw new Error(
      `HISTORICAL_RULE02_DIGEST_MISMATCH:${sourceLabel}:expected=${HISTORICAL_RULE02_SHA256}:actual=${digest}`,
    );
  }
  if (!text.includes(`**GOVERNANCE_REVISION = ${HISTORICAL_GOVERNANCE_REVISION}**`)) {
    throw new Error(`HISTORICAL_RULE02_REVISION_MISSING:${sourceLabel}`);
  }
  if (!text.includes(`**IMPLEMENTATION_AUTHORIZED = ${YES_TOKEN}**`)) {
    throw new Error(`HISTORICAL_RULE02_YES_TOKEN_MISSING:${sourceLabel}`);
  }
  return text;
}

function tryReadHistoricalFixtureFile() {
  if (!existsSync(HISTORICAL_FIXTURE_PATH)) {
    return null;
  }
  return verifyHistoricalRule02Text(
    readFileSync(HISTORICAL_FIXTURE_PATH, 'utf8'),
    'FIXTURE_FILE',
  );
}

function gitBlobFallbackEnabled() {
  return process.env.TECP_DLP011_ALLOW_GIT_BLOB_FALLBACK === '1';
}

function tryReadHistoricalGitBlob() {
  if (!gitBlobFallbackEnabled()) {
    return null;
  }
  const gitDir = process.env.TECP_GIT_DIR || ROOT;
  try {
    const text = execFileSync(
      'git',
      ['cat-file', '-p', HISTORICAL_RULE02_GIT_BLOB_SHA],
      {
        cwd: gitDir,
        encoding: 'utf8',
        maxBuffer: 8 * 1024 * 1024,
        stdio: ['ignore', 'pipe', 'pipe'],
      },
    );
    return verifyHistoricalRule02Text(text, 'GIT_BLOB');
  } catch (err) {
    if (err && String(err.message || err).startsWith('HISTORICAL_RULE02_')) {
      throw err;
    }
    return null;
  }
}

/**
 * Immutable activation-era Rule02 for historical DLP-011 disposable proof.
 * Primary source: checked-in fixture (offline, CI-reproducible).
 * Optional secondary: git blob when TECP_DLP011_ALLOW_GIT_BLOB_FALLBACK=1.
 * Fail closed: never silently falls back to live workspace Rule02.
 */
export function loadHistoricalActivationRule02Text() {
  const fromFixture = tryReadHistoricalFixtureFile();
  if (fromFixture != null) {
    return fromFixture;
  }
  const fromGit = tryReadHistoricalGitBlob();
  if (fromGit != null) {
    return fromGit;
  }
  throw new Error(
    'HISTORICAL_RULE02_UNAVAILABLE:missing_fixture;git_fallback_disabled_or_failed;no_live_fallback',
  );
}

/**
 * Current workspace Rule02 (live closeout / current governance).
 * Used only for current-live governance separation tests — never for historical proof inputs.
 */
export function loadLiveWorkspaceRule02Text() {
  return readFileSync(LIVE_RULE02_PATH, 'utf8');
}

/**
 * Compatibility alias → historical activation Rule02 only.
 * Prefer loadHistoricalActivationRule02Text() or loadLiveWorkspaceRule02Text() explicitly.
 * Never reads mutable live workspace Rule02.
 */
export function loadWorkspaceRule02Text() {
  return loadHistoricalActivationRule02Text();
}

export function synthesizeClosedRule02Text(sourceText = loadHistoricalActivationRule02Text()) {
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
  return loadHistoricalActivationRule02Text();
}

function resolveHarnessRule02Text(options) {
  if (options.mergedRule02Text == null) {
    return loadHistoricalActivationRule02Text();
  }
  if (options.privilegedRule02Override !== true
    && options.privilegedRule02Override !== PRIVILEGED_HARNESS_RULE02_OVERRIDE) {
    throw new Error(
      'PRIVILEGED_HARNESS_RULE02_OVERRIDE_REQUIRED:mergedRule02Text_rejected_without_explicit_flag',
    );
  }
  // Privileged TEST_ONLY override: still disposable-only; does not claim production authority.
  return String(options.mergedRule02Text);
}

export function createDisposableMergeEffectivenessHarness(options = {}) {
  const mergedRule02Text = resolveHarnessRule02Text(options);
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
    historicalRule02Pinned: true,
    historicalRule02Sha256: HISTORICAL_RULE02_SHA256,
    privilegedRule02OverrideUsed: options.mergedRule02Text != null,
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
  HISTORICAL_FIXTURE_PATH,
  LIVE_RULE02_PATH,
};
