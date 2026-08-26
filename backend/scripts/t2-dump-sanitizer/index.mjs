/**
 * Public exports for T2 dump sanitizer.
 */

export {
  AUTHORIZED_EFFECTS,
  AUTHORIZED_TRANSACTION,
  COLLECTOR_DB_KEYS,
  EXPECTED_COLLECTOR_DB_USER,
  REQUIRED_DUMP_MODE,
  State,
  TERMINAL_STATES,
  ROLLBACK_ELIGIBLE_STATES,
  TOOL_NAME,
  TOOL_VERSION,
} from './constants.mjs';

export {
  createFailClosedBoundary,
  ForbiddenLiveExecutionError,
  GlobalPm2SaveForbiddenError,
} from '../t2-retry-orchestrator/commandBoundary.mjs';

export { SecretSafeEvidence, assertSecretSafeLine } from './evidence.mjs';

export {
  captureCollectorDbLiveValues,
  compareCollectorDbLiveToPersist,
  semanticFingerprint,
} from '../t2-retry-orchestrator/semantics.mjs';

export {
  resolveDumpCollectorIdentity,
  resolveDumpEnvMutationTarget,
  structuralDiffPaths,
} from '../t2-retry-orchestrator/projection.mjs';

export { buildSanitizedTarget } from './target.mjs';

export {
  createExclusiveJournal,
  createMemoryJournalFs,
  JournalError,
  loadJournal,
  TransactionJournal,
} from './journal.mjs';

export { attachSanitizedWriteAlias, createLiveBoundary, createNodeJournalFs } from './liveBoundary.mjs';

export { createSideEffectLedger, planRollbackActions } from './sideEffectLedger.mjs';

export {
  assertLiveNoMutation,
  createDumpSanitizer,
  dumpToBytes,
  DumpSanitizer,
  DumpSanitizerError,
  sha256Buffer,
} from './orchestrator.mjs';

export {
  evaluateLiveExecutionGates,
  evaluateSanitizerExecutionGates,
  hasFlag,
  readArg,
  main,
  usage,
} from './cli.mjs';
