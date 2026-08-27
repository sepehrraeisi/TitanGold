/**
 * Public exports for durable T2 retry orchestrator.
 */

export {
  AUTHORIZED_EFFECTS,
  AUTHORIZED_TRANSACTION,
  ALLOWED_DIFF_KINDS,
  COLLECTOR_DB_KEYS,
  COLLECTOR_DB_PRESTATE,
  ENGINE_NAME,
  EXPECTED_COLLECTOR_DB_USER,
  FORBIDDEN_DIFF_KINDS,
  LEGACY_AUTHORIZED_TRANSACTION_1_4_0,
  LEGACY_AUTHORIZED_TRANSACTION_1_5_0,
  LEGACY_AUTHORIZED_TRANSACTION_1_6_0,
  LEGACY_AUTHORIZED_TRANSACTION_1_6_1,
  DUMP_ENGINE_MAPPING_MODE,
  LIVE_ENGINE_PAIR_MODE,
  REQUIRED_POST_SAVE_DUMP_MODE,
  REQUIRED_PROJECTED_DUMP_MODE,
  SESSION_IDE_ENV_KEYS,
  State,
  TERMINAL_STATES,
  TOOL_NAME,
  TOOL_VERSION,
  ROLLBACK_ELIGIBLE_STATES,
  SUPPORTED_ENV_SHAPES,
} from './constants.mjs';

export {
  createFailClosedBoundary,
  ForbiddenLiveExecutionError,
  GlobalPm2SaveForbiddenError,
  MUTATING_OPS,
} from './commandBoundary.mjs';

export { SecretSafeEvidence, assertSecretSafeLine } from './evidence.mjs';

export {
  assertExpectedLivePostState,
  assertCollectorPersistencePreconditions,
  assertEntriesEnvShapes,
  assertExactDumpPhysicalPreEquivalent,
  assertLiveFleetPmIdIntegrity,
  assertPreEquivalent,
  captureCollectorDbLiveValues,
  classifyCollectorDbPrestate,
  compareCollectorDbLiveToPersist,
  diffFingerprints,
  diffLiveFingerprints,
  diffDumpFingerprints,
  diffProcessEnv,
  diffStableConfig,
  extractProcessEnv,
  extractProcessEnvResult,
  normalizeProcess,
  resolveCanonicalPathConsensus,
  selectEngineRetainExtra,
  semanticFingerprint,
  summarizeEnvEquality,
} from './semantics.mjs';

export {
  assertUnauthorizedLiveEnvNotPersisted,
  buildExpectedProjectedDump,
  dumpRecordStableKey,
  resolveDumpCollectorIdentity,
  resolveDumpEngineIdentities,
  resolveDumpEnvMutationTarget,
  structuralDiffPaths,
} from './projection.mjs';

export {
  assertSymmetricProjectedDumpResurrectCompatibility,
  assertZeroUnclassifiedPersistedFields,
  compareDumpEngineResurrectSemantics,
  RESURRECT_IGNORED_FIELDS,
  RESURRECT_TOP_LEVEL_FIELDS,
} from './resurrectSemantics.mjs';

export {
  CANONICAL_COMPARE_FIELDS,
  PM2_FIELD_CLASSIFICATION,
  PROVEN_REGENERATED_OR_VOLATILE,
  DUMP_PROCESS_LIST_DELETED_FIELDS,
  PM2_DUMP_TRANSFORM_FIELDS,
  DUMP_APP_ENV_PROVENANCE_SCOPE,
  buildEnginePm2SemanticSignature,
  buildPm2EffectiveSemanticModel,
  buildApplicationEnvKeysContext,
  buildProcessNameClassAppEnvProvenance,
  deriveLiveApplicationEnvKeyContext,
  entryProcessName,
  compareEnginePm2Semantics,
  compareProcessPm2Semantics,
  assertFleetPm2SemanticModelComplete,
  deepStableSerialize,
  deepStructuralEqual,
  resolveRawPm2Entry,
  readApplicationEnvValue,
  effectiveInstancesValue,
  effectiveInstancesSemantics,
  PM2_NESTED_ENV_VOLATILE_KEYS,
} from './pm2SemanticModel.mjs';

export {
  buildProductionDumpShapeFixture,
  buildLiveEnginePairMatchingFixture,
} from './productionDumpShapeFixture.mjs';

export { runProductionCompatibilityProof } from './productionCompatibilityProof.mjs';

export { assertSanitizedPreBaselineProof } from './sanitizedBaseline.mjs';

export {
  createExclusiveJournal,
  createMemoryJournalFs,
  JournalError,
  loadJournal,
  TransactionJournal,
} from './journal.mjs';

export { createLiveBoundary, createNodeJournalFs } from './liveBoundary.mjs';

export {
  APPLY_STATE,
  createSideEffectLedger,
  planRollbackActions,
  setRollbackApplyState,
} from './sideEffectLedger.mjs';

export {
  evaluateLiveExecutionGates,
  hasFlag,
  readArg,
} from './cli.mjs';

export {
  createOrchestrator,
  dumpToBytes,
  sha256Buffer,
  T2Orchestrator,
  T2OrchestratorError,
} from './orchestrator.mjs';
