#!/usr/bin/env node
/**
 * Fail-closed CLI for T2 retry orchestrator.
 *
 * Default: non-mutating.
 * Live adapter selected ONLY when ALL gates are present:
 *   --execute
 *   --run-id
 *   --authorization-file
 *   --acknowledge-production-mutation=YES
 *   --backup-root
 *   --journal-root (optional; defaults to backup-root)
 *   --expected-tool-version matching TOOL_VERSION
 *
 * This source task must not invoke live execution.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  AUTHORIZED_TRANSACTION,
  TOOL_NAME,
  TOOL_VERSION,
} from './constants.mjs';
import { createFailClosedBoundary } from './commandBoundary.mjs';
import { createLiveBoundary, createNodeJournalFs } from './liveBoundary.mjs';
import { createOrchestrator, T2OrchestratorError } from './orchestrator.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function readArg(argv, name) {
  const idx = argv.indexOf(name);
  if (idx === -1 || idx + 1 >= argv.length) return null;
  return argv[idx + 1];
}

function hasFlag(argv, name) {
  return argv.includes(name);
}

function usage() {
  return [
    `Usage: node ${path.relative(process.cwd(), path.join(__dirname, 'cli.mjs'))} [options]`,
    '',
    'Default: non-mutating / fail-closed.',
    '',
    'Live execution requires ALL of:',
    '  --execute',
    '  --run-id <id>',
    '  --authorization-file <path>',
    '  --acknowledge-production-mutation=YES',
    '  --backup-root <dir>',
    '  --expected-tool-version ' + TOOL_VERSION,
    '',
    `Tool: ${TOOL_NAME}@${TOOL_VERSION}`,
    `Authorized transaction id: ${AUTHORIZED_TRANSACTION}`,
  ].join('\n');
}

function main(argv = process.argv.slice(2)) {
  if (hasFlag(argv, '--help') || hasFlag(argv, '-h')) {
    console.log(usage());
    process.exit(0);
  }

  const execute = hasFlag(argv, '--execute');
  const runId = readArg(argv, '--run-id');
  const authFile = readArg(argv, '--authorization-file');
  const backupRoot = readArg(argv, '--backup-root');
  const journalRoot = readArg(argv, '--journal-root') || backupRoot;
  const ack = readArg(argv, '--acknowledge-production-mutation');
  const expectedVersion = readArg(argv, '--expected-tool-version') || TOOL_VERSION;

  if (!execute) {
    console.error(
      JSON.stringify({
        tool: TOOL_NAME,
        version: TOOL_VERSION,
        mode: 'NON_MUTATING_DEFAULT',
        message:
          'Refusing execution. Pass --execute plus full authorization gates only under Owner one-shot.',
      }),
    );
    process.exit(2);
  }

  const gatesSatisfied =
    ack === 'YES' &&
    Boolean(runId) &&
    Boolean(authFile) &&
    Boolean(backupRoot) &&
    Boolean(journalRoot) &&
    expectedVersion === TOOL_VERSION;

  if (!gatesSatisfied) {
    console.error(
      JSON.stringify({
        error: 'EXECUTION_GATES_INCOMPLETE',
        message:
          'Live adapter requires --acknowledge-production-mutation=YES, --run-id, --authorization-file, --backup-root, and matching --expected-tool-version',
      }),
    );
    process.exit(2);
  }

  let authorization;
  try {
    authorization = JSON.parse(fs.readFileSync(authFile, 'utf8'));
  } catch {
    console.error('ERROR: authorization file unreadable/unparseable');
    process.exit(2);
  }

  // Live adapter is repo-owned and audited, but only selected when gatesSatisfied===true.
  const commands = createLiveBoundary({ gatesSatisfied: true });
  const orch = createOrchestrator({
    commands,
    authorization,
    runId,
    backupRoot,
    journalRoot,
    journalFs: createNodeJournalFs(),
    productionModeAcknowledged: true,
    expectedToolVersion: expectedVersion,
  });

  // Deliberately do NOT auto-runTransaction here without an additional
  // --confirm-run-transaction flag, so casual invocation cannot mutate.
  if (!hasFlag(argv, '--confirm-run-transaction')) {
    console.error(
      JSON.stringify({
        tool: TOOL_NAME,
        version: TOOL_VERSION,
        mode: 'GATES_OK_ADAPTER_SELECTED_RUN_NOT_CONFIRMED',
        state: orch.state,
        message:
          'Live adapter selected. Pass --confirm-run-transaction only under Owner one-shot to execute.',
      }),
    );
    process.exit(3);
  }

  orch
    .runTransaction()
    .then((state) => {
      console.log(JSON.stringify({ ok: true, state, runId }));
      process.exit(state === 'COMPLETED' ? 0 : 1);
    })
    .catch((err) => {
      console.error(
        JSON.stringify({
          ok: false,
          error: err.code || 'ERROR',
          message: String(err.message || err),
        }),
      );
      process.exit(1);
    });
}

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
