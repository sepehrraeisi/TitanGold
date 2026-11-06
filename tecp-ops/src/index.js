/**
 * TECP-OPS-PILOT-001 CP1 public exports.
 * Safe to import: zero listeners, Workers, MCP, DB, or key generation at import time.
 */

export {
  CP1_ALG,
  CP1_CHECKPOINT,
  CP1_CONFIG,
  CP1_MAX_TTL_MS,
  CP1_MODE,
  CP1_OPERATION_CLASS,
  CP1_PATHS,
  CP1_PURPOSE,
  CP1_REPOSITORY_ID,
  CP1_SLICE_ID,
  CONFIG_DECISIONS,
  validateExactCp1Scope,
  validateOfflineTestOnlyConfig,
  canonicalJson,
  parseJsonObjectRejectDuplicates,
} from './config.js';

export {
  ATTESTATION_KINDS,
  TRUST_LEVELS,
  IDENTITY_DECISIONS,
  createTestOnlyAttestationVerifier,
  isBrandedVerifiedOperationalPrincipal,
  isPrivilegedTestOnlyAttestationVerifier,
  verifyOperationalPrincipal,
} from './operationalWorkerIdentity.js';

export {
  APPROVAL_DECISIONS,
  createInjectedClock,
  createInMemoryKeyRegistry,
  createInMemoryRevocationRegistry,
  createTestOnlyOwnerApprovalIssuer,
  generateEphemeralEd25519KeyPairForTests,
  isBrandedOwnerApprovalArtifact,
  isPrivilegedTestOnlyOwnerApprovalIssuer,
  issueOwnerApprovalArtifactForTests,
  verifyOwnerApprovalArtifact,
} from './ownerApprovalArtifact.js';

export {
  CAPABILITY_DECISIONS,
  createInMemoryReplayRegistry,
  createInMemoryReplayRegistryWithPresentation,
  createTestOnlyCapabilityIssuer,
  generateEphemeralCapabilityIssuerKeyPairForTests,
  isPrivilegedTestOnlyCapabilityIssuer,
  issueCapabilityForTests,
  verifyCapability,
} from './operationalCapabilityIssuer.js';
