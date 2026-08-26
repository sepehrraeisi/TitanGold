#!/usr/bin/env node
/**
 * Fail-closed CLI for T2 retry orchestrator.
 *
 * Default: non-mutating.
 * Live adapter selected ONLY when ALL gates are present AND explicit:
 *   --execute
 *   --run-id
 *   --authorization-file
 *   --acknowledge-production-mutation=YES
 *   --backup-root
 *   --journal-root  (MUST be explicit; never defaulted to backup-root)
 *   --expected-tool-version  (MUST be explicit; no default for live path)
 *   --confirm-run-transaction
 *   --clean-pre-file
 *   --expected-clean-pre-sha
 *   --expected-active-dump-sha
 *
 * This source task must not invoke live execution.
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import {
  AUTHORIZED_TRANSACTION,
  TOOL_NAME,
  TOOL_VERSION,
} from './constants.mjs';
import { createLiveBoundary, createNodeJournalFs } from './liveBoundary.mjs';
import { createOrchestrator, T2OrchestratorError } from './orchestrator.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function readArg(argv, name) {
  const idx = argv.indexOf(name);
  if (idx === -1 || idx + 1 >= argv.length) return null;
  return argv[idx + 1];
}

export function hasFlag(argv, name) {
  return argv.includes(name);
}

export function usage() {
  return [
    `Usage: node ${path.relative(process.cwd(), path.join(__dirname, 'cli.mjs'))} [options]`,
    '',
    'Default: non-mutating / fail-closed.',
    '',
    'Live execution requires ALL of (all explicit — no defaults):',
    '  --execute',
    '  --run-id <id>',
    '  --authorization-file <path>',
    '  --acknowledge-production-mutation=YES',
    '  --backup-root <dir>',
    '  --journal-root <dir>',
    '  --expected-tool-version ' + TOOL_VERSION,
    '  --confirm-run-transaction',
    '  --clean-pre-file <path>',
    '  --expected-clean-pre-sha <sha256>',
    '  --expected-active-dump-sha <sha256>',
    '',
    `Tool: ${TOOL_NAME}@${TOOL_VERSION}`,
    `Authorized transaction id: ${AUTHORIZED_TRANSACTION}`,
  ].join('\n');
}

/**
 * Complete live execution gate decision.
 * --expected-tool-version MUST be present on argv (not defaulted).
 * --journal-root MUST be present on argv (never defaulted to backup-root).
 * --confirm-run-transaction is part of the gate, not a later convenience.
 */
export function evaluateLiveExecutionGates(argv = []) {
  const execute = hasFlag(argv, '--execute');
  const runId = readArg(argv, '--run-id');
  const authFile = readArg(argv, '--authorization-file');
  const backupRoot = readArg(argv, '--backup-root');
  const journalRoot = readArg(argv, '--journal-root');
  const ack = readArg(argv, '--acknowledge-production-mutation');
  const hasExplicitVersion = argv.includes('--expected-tool-version');
  const expectedVersion = hasExplicitVersion ? readArg(argv, '--expected-tool-version') : null;
  const confirmRun = hasFlag(argv, '--confirm-run-transaction');
  const cleanPreFile = readArg(argv, '--clean-pre-file');
  const expectedCleanPreSha = readArg(argv, '--expected-clean-pre-sha');
  const expectedActiveDumpSha = readArg(argv, '--expected-active-dump-sha');

  const missing = [];
  if (!execute) missing.push('--execute');
  if (!runId) missing.push('--run-id');
  if (!authFile) missing.push('--authorization-file');
  if (ack !== 'YES') missing.push('--acknowledge-production-mutation=YES');
  if (!backupRoot) missing.push('--backup-root');
  if (!journalRoot) missing.push('--journal-root');
  if (!hasExplicitVersion || expectedVersion == null) missing.push('--expected-tool-version');
  if (!confirmRun) missing.push('--confirm-run-transaction');
  if (!cleanPreFile) missing.push('--clean-pre-file');
  if (!expectedCleanPreSha) missing.push('--expected-clean-pre-sha');
  if (!expectedActiveDumpSha) missing.push('--expected-active-dump-sha');

  if (missing.length > 0) {
    return {
      ok: false,
      error: 'EXECUTION_GATES_INCOMPLETE',
      missing,
      expectedVersion,
      runId,
      authFile,
      backupRoot,
      journalRoot,
      cleanPreFile,
      expectedCleanPreSha,
      expectedActiveDumpSha,
    };
  }

  if (expectedVersion !== TOOL_VERSION) {
    return {
      ok: false,
      error: 'TOOL_VERSION_MISMATCH',
      expectedVersion,
      toolVersion: TOOL_VERSION,
      runId,
      authFile,
      backupRoot,
      journalRoot,
      cleanPreFile,
      expectedCleanPreSha,
      expectedActiveDumpSha,
    };
  }

  return {
    ok: true,
    expectedVersion,
    runId,
    authFile,
    backupRoot,
    journalRoot,
    confirmRun: true,
    cleanPreFile,
    expectedCleanPreSha,
    expectedActiveDumpSha,
  };
}

export function main(argv = process.argv.slice(2), { exit = process.exit, stdout = console.log, stderr = console.error } = {}) {
  if (hasFlag(argv, '--help') || hasFlag(argv, '-h')) {
    stdout(usage());
    exit(0);
    return;
  }

  const execute = hasFlag(argv, '--execute');
  if (!execute) {
    stderr(
      JSON.stringify({
        tool: TOOL_NAME,
        version: TOOL_VERSION,
        mode: 'NON_MUTATING_DEFAULT',
        message:
          'Refusing execution. Pass --execute plus full authorization gates only under Owner one-shot.',
      }),
    );
    exit(2);
    return;
  }

  const gates = evaluateLiveExecutionGates(argv);
  if (!gates.ok) {
    stderr(
      JSON.stringify({
        error: gates.error,
        missing: gates.missing || undefined,
        expectedVersion: gates.expectedVersion,
        toolVersion: TOOL_VERSION,
        message:
          'Live adapter requires explicit --execute, --run-id, --authorization-file, --acknowledge-production-mutation=YES, --backup-root, --expected-tool-version matching TOOL_VERSION, and --confirm-run-transaction',
      }),
    );
    exit(2);
    return;
  }

  let authorization;
  try {
    authorization = JSON.parse(fs.readFileSync(gates.authFile, 'utf8'));
  } catch {
    stderr('ERROR: authorization file unreadable/unparseable');
    exit(2);
    return;
  }

  let cleanPreDump;
  let actualCleanPreSha;
  try {
    const cleanBytes = fs.readFileSync(gates.cleanPreFile);
    actualCleanPreSha = crypto.createHash('sha256').update(cleanBytes).digest('hex');
    cleanPreDump = JSON.parse(cleanBytes.toString('utf8'));
  } catch {
    stderr('ERROR: clean-pre-file unreadable/unparseable');
    exit(2);
    return;
  }

  // Live adapter only when complete gate decision is ok (includes confirm).
  const commands = createLiveBoundary({ gatesSatisfied: true });
  const orch = createOrchestrator({
    commands,
    authorization,
    runId: gates.runId,
    backupRoot: gates.backupRoot,
    journalRoot: gates.journalRoot,
    journalFs: createNodeJournalFs(),
    productionModeAcknowledged: true,
    expectedToolVersion: gates.expectedVersion,
    cleanPreDump,
    expectedCleanPreSha: gates.expectedCleanPreSha,
    actualCleanPreSha,
    expectedActiveDumpSha: gates.expectedActiveDumpSha,
  });

  return orch
    .runTransaction()
    .then((state) => {
      stdout(JSON.stringify({ ok: true, state, runId: gates.runId }));
      exit(state === 'COMPLETED' ? 0 : 1);
    })
    .catch((err) => {
      stderr(
        JSON.stringify({
          ok: false,
          error: err.code || 'ERROR',
          message: String(err.message || err),
        }),
      );
      exit(1);
    });
}

const isDirect =
  process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

if (isDirect) {
  try {
    main();
  } catch (err) {
    if (err instanceof T2OrchestratorError) {
      console.error(JSON.stringify({ error: err.code, message: err.message }));
      process.exit(1);
    }
    console.error(JSON.stringify({ error: 'UNHANDLED', message: String(err?.message || err) }));
    process.exit(1);
  }
}
