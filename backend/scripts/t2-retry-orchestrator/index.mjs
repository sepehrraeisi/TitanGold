/**
 * Public exports for durable T2 retry orchestrator.
 */

export {
  AUTHORIZED_EFFECTS,
  AUTHORIZED_TRANSACTION,
  ALLOWED_DIFF_KINDS,
  COLLECTOR_DB_KEYS,
  ENGINE_NAME,
  EXPECTED_COLLECTOR_DB_USER,
  FORBIDDEN_DIFF_KINDS,
  State,
  TERMINAL_STATES,
  TOOL_NAME,
  TOOL_VERSION,
  ROLLBACK_ELIGIBLE_STATES,
} from './constants.mjs';

export {
  createFailClosedBoundary,
  ForbiddenLiveExecutionError,
  MUTATING_OPS,
} from './commandBoundary.mjs';

export { SecretSafeEvidence, assertSecretSafeLine } from './evidence.mjs';

export {
  assertCollectorPersistencePreconditions,
  diffFingerprints,
  diffProcessEnv,
  extractProcessEnv,
  normalizeProcess,
  selectEngineRetainExtra,
  semanticFingerprint,
  summarizeEnvEquality,
} from './semantics.mjs';

export {
  createExclusiveJournal,
  createMemoryJournalFs,
  JournalError,
  loadJournal,
  TransactionJournal,
} from './journal.mjs';

export { createLiveBoundary, createNodeJournalFs } from './liveBoundary.mjs';

export {
  createOrchestrator,
  dumpToBytes,
  sha256Buffer,
  T2Orchestrator,
  T2OrchestratorError,
} from './orchestrator.mjs';
