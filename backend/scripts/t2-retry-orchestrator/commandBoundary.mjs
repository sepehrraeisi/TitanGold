/**
 * Injected command-execution boundary for T2 orchestrator.
 * Production mutations must never run from unit tests by default.
 */

/**
 * @typedef {{
 *   exitCode: number,
 *   stdout?: string,
 *   stderr?: string,
 *   data?: unknown
 * }} CommandResult
 */

/**
 * @typedef {{
 *   listLiveProcesses: () => Promise<Array<Record<string, unknown>>>,
 *   readDump: () => Promise<{ bytes: Buffer, parsed: Array<Record<string, unknown>>, sha256: string, mode?: number }>,
 *   writeBackup: (bytes: Buffer, destPath: string) => Promise<{ sha256: string, bytes: number, mode: number }>,
 *   restoreDump: (backupBytes: Buffer, opts?: { mode: number }) => Promise<{ ok?: boolean, mode?: number } | void>,
 *   stopProcessByPmId: (pmId: number) => Promise<CommandResult>,
 *   startProcessByPmId: (pmId: number) => Promise<CommandResult>,
 *   pm2Save: () => Promise<CommandResult>,
 *   hardenActiveDumpMode: (mode?: number) => Promise<{ mode: number, ok: boolean }>,
 *   healthCheck: (port: number) => Promise<{ statusCode: number }>,
 *   collectorFunctionalCheck: () => Promise<{ accounts: number, channels: number, health: number }>,
 *   ensureDir: (path: string, mode: number) => Promise<void>,
 *   chmod: (path: string, mode: number) => Promise<void>,
 *   pathExists: (path: string) => Promise<boolean>,
 * }} T2CommandBoundary
 */

export class ForbiddenLiveExecutionError extends Error {
  constructor(message = 'LIVE_COMMAND_BOUNDARY_FORBIDDEN_IN_DEFAULT_MODE') {
    super(message);
    this.name = 'ForbiddenLiveExecutionError';
  }
}

/**
 * Fail-closed default boundary — refuses all mutations and live reads that could touch production.
 */
export function createFailClosedBoundary() {
  const deny = async (op) => {
    throw new ForbiddenLiveExecutionError(`DENIED_OP=${op}`);
  };
  return {
    listLiveProcesses: () => deny('listLiveProcesses'),
    readDump: () => deny('readDump'),
    writeBackup: () => deny('writeBackup'),
    restoreDump: () => deny('restoreDump'),
    stopProcessByPmId: () => deny('stopProcessByPmId'),
    startProcessByPmId: () => deny('startProcessByPmId'),
    pm2Save: () => deny('pm2Save'),
    hardenActiveDumpMode: () => deny('hardenActiveDumpMode'),
    healthCheck: () => deny('healthCheck'),
    collectorFunctionalCheck: () => deny('collectorFunctionalCheck'),
    ensureDir: () => deny('ensureDir'),
    chmod: () => deny('chmod'),
    pathExists: () => deny('pathExists'),
  };
}

/** Ops that mutate production/filesystem and MUST pass the central mutation guard. */
export const MUTATING_OPS = Object.freeze([
  'ensureDir',
  'writeBackup',
  'chmod',
  'stopProcessByPmId',
  'startProcessByPmId',
  'pm2Save',
  'hardenActiveDumpMode',
  'restoreDump',
]);
