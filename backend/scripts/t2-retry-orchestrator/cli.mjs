#!/usr/bin/env node
/**
 * Fail-closed CLI for T2 retry orchestrator.
 *
 * Default invocation does NOT mutate production.
 * Live mutation requires ALL of:
 *   --run-id
 *   --authorization-file
 *   --acknowledge-production-mutation=YES
 *   --execute
 *   --backup-root
 *   matching TOOL_VERSION
 *
 * Without --execute, the CLI only validates flags / prints tool metadata and exits 2.
 *
 * This CLI intentionally does not wire a live PM2 boundary in this source-fix gate.
 * A future Owner-authorized execution gate must inject/confirm a live adapter separately.
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
    'Required for future live execution (NOT enabled by this CLI alone):',
    '  --run-id <id>',
    '  --authorization-file <path>',
    '  --acknowledge-production-mutation=YES',
    '  --backup-root <dir>',
    '  --execute',
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
  const ack = readArg(argv, '--acknowledge-production-mutation');
  const expectedVersion = readArg(argv, '--expected-tool-version') || TOOL_VERSION;

  if (!execute) {
    console.error(
      JSON.stringify({
        tool: TOOL_NAME,
        version: TOOL_VERSION,
        mode: 'NON_MUTATING_DEFAULT',
        message:
          'Refusing execution. Pass --execute plus authorization inputs only under Owner one-shot gate. Live PM2 adapter is not auto-wired.',
      }),
    );
    process.exit(2);
  }

  if (ack !== 'YES') {
    console.error('ERROR: --acknowledge-production-mutation=YES is required');
    process.exit(2);
  }
  if (!runId || !authFile || !backupRoot) {
    console.error('ERROR: --run-id, --authorization-file, and --backup-root are required');
    process.exit(2);
  }

  let authorization;
  try {
    authorization = JSON.parse(fs.readFileSync(authFile, 'utf8'));
  } catch {
    console.error('ERROR: authorization file unreadable/unparseable');
    process.exit(2);
  }

  // Fail-closed: this CLI does not attach a live PM2 boundary.
  // Future execution gate must replace createFailClosedBoundary with an audited live adapter.
  const orch = createOrchestrator({
    commands: createFailClosedBoundary(),
    authorization,
    runId,
    backupRoot,
    productionModeAcknowledged: true,
    expectedToolVersion: expectedVersion,
  });

  console.error(
    JSON.stringify({
      tool: TOOL_NAME,
      version: TOOL_VERSION,
      mode: 'EXECUTE_REQUESTED_BUT_LIVE_ADAPTER_NOT_WIRED',
      state: orch.state,
      message:
        'Source-fix gate: live PM2 command boundary is intentionally fail-closed. Do not treat this CLI as production-ready execution until a separate Owner gate wires an audited adapter.',
    }),
  );
  process.exit(3);
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
