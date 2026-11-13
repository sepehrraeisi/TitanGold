#!/usr/bin/env node
/**
 * Owner-facing CLI for TECP Task Manager V1.
 *
 * Local same-UID acknowledgement is NOT independently authenticated Owner
 * identity. Supervised manual Cursor handoff only — no automatic execution.
 */

import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createTaskManager, TASK_STATUSES, GOVERNANCE_REVISION } from './taskManager.js';
import { CURSOR_TRANSPORT } from './instructionPacket.js';

function printHelp() {
  const text = `
tecp-task-manager — single-Cursor Task Manager V1 (supervised manual handoff)

Authority: LOCAL V1 WORKFLOW ONLY — not production TECP authz/fencing/Worker/MCP/dispatch.
Transport: ${CURSOR_TRANSPORT}
Governance: ${GOVERNANCE_REVISION}

Require data dir:
  export TECP_TASK_MANAGER_DATA_DIR=/absolute/owner/owned/state/dir
  # or pass --data-dir /absolute/path

Commands:
  create   --task-id ID --owner ACTOR --repo OWNER/NAME --base-sha SHA \\
           --goal "..." --allow PATH [--allow PATH...] [--depends ID] [--branch NAME]
  claim    --task-id ID --actor ACTOR [--actor-type CURSOR_WORKER]
  prepare  --task-id ID --actor ACTOR
  start    --task-id ID --actor ACTOR          # ACK_RUNNING
  submit   --task-id ID --actor ACTOR --pr N [--head-sha SHA]
  verify   --task-id ID [--actor ACTOR]
  reconcile --task-id ID --actor ACTOR --attempt N --base-sha SHA \\
           --governance-pr N --governance-merge-sha SHA \\
           --implementation-pr N --implementation-head-sha SHA \\
           --implementation-merge-sha SHA --owner-ack TEXT
  accept   --task-id ID --actor ACTOR [--note TEXT]
  reject   --task-id ID --actor ACTOR [--reason TEXT]
  status   [--task-id ID]
  recover  --task-id ID [--actor ACTOR] [--reason TEXT]
  next

Reconciliation notes:
  - Preserves historical FAILED verification; never rewrites FAIL to PASS.
  - Requires explicit --owner-ack text (actor name alone is insufficient).
  - Local same-UID CLI identity is NOT independently authenticated Owner authority.
  - Successful reconcile does NOT auto-accept; run accept separately afterward.

Flags:
  --json          machine-readable JSON on stdout
  --data-dir DIR  override TECP_TASK_MANAGER_DATA_DIR
  --help

Examples:
  export TECP_TASK_MANAGER_DATA_DIR="$HOME/.local/share/tecp-task-manager-v1"
  node src/cli.js create --task-id demo-1 --owner owner-1 --repo sepehrraeisi/TitanGold \\
    --base-sha $(git rev-parse HEAD) --goal "Add docs" --allow docs/example.md
  node src/cli.js claim --task-id demo-1 --actor cursor-1
  node src/cli.js prepare --task-id demo-1 --actor cursor-1
  # Owner pastes instruction markdown into existing Cursor chat
  node src/cli.js start --task-id demo-1 --actor cursor-1
  node src/cli.js submit --task-id demo-1 --actor cursor-1 --pr 123 --head-sha <sha>
  node src/cli.js verify --task-id demo-1
  node src/cli.js accept --task-id demo-1 --actor owner-1
  node src/cli.js next
`.trim();
  console.log(text);
}

function parseArgs(argv) {
  const args = {
    _: [],
    flags: {},
    multi: { allow: [], depends: [] },
  };
  let i = 0;
  while (i < argv.length) {
    const a = argv[i];
    if (a === '--help' || a === '-h') {
      args.flags.help = true;
      i += 1;
      continue;
    }
    if (a === '--json') {
      args.flags.json = true;
      i += 1;
      continue;
    }
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const val = argv[i + 1];
      if (val === undefined || val.startsWith('--')) {
        args.flags[key] = true;
        i += 1;
        continue;
      }
      if (key === 'allow') {
        args.multi.allow.push(val);
      } else if (key === 'depends') {
        args.multi.depends.push(val);
      } else {
        args.flags[key] = val;
      }
      i += 2;
      continue;
    }
    args._.push(a);
    i += 1;
  }
  return args;
}

function emit(human, payload, asJson) {
  if (asJson) {
    console.log(JSON.stringify(payload, null, 2));
  } else {
    console.log(human);
    if (payload && payload.ok === false) {
      console.error(`code=${payload.code}`);
    }
  }
}

async function main(argv = process.argv.slice(2)) {
  const parsed = parseArgs(argv);
  if (parsed.flags.help || parsed._.length === 0) {
    printHelp();
    process.exitCode = parsed._.length === 0 ? 1 : 0;
    return;
  }

  const command = parsed._[0];
  const dataDir = parsed.flags['data-dir'] || process.env.TECP_TASK_MANAGER_DATA_DIR;
  if (!dataDir) {
    emit(
      'ERROR: set TECP_TASK_MANAGER_DATA_DIR or pass --data-dir to an owner-owned absolute directory outside tracked repo files.',
      { ok: false, code: 'MISSING_DATA_DIR' },
      parsed.flags.json,
    );
    process.exitCode = 2;
    return;
  }
  if (!path.isAbsolute(dataDir)) {
    emit(
      'ERROR: data dir must be absolute.',
      { ok: false, code: 'DATA_DIR_NOT_ABSOLUTE' },
      parsed.flags.json,
    );
    process.exitCode = 2;
    return;
  }

  let manager;
  try {
    manager = await createTaskManager({ dataDir });
  } catch (err) {
    emit(
      `ERROR opening store: ${err.message}`,
      { ok: false, code: err.code || 'STORE_OPEN_FAILED', message: err.message },
      parsed.flags.json,
    );
    process.exitCode = 3;
    return;
  }

  try {
    let out;
    switch (command) {
      case 'create': {
        out = await manager.create({
          taskId: parsed.flags['task-id'],
          ownerActorId: parsed.flags.owner,
          repository: parsed.flags.repo,
          baseSha: parsed.flags['base-sha'],
          goal: parsed.flags.goal,
          fileAllowlist: parsed.multi.allow,
          dependsOnTaskIds: parsed.multi.depends,
          branchName: parsed.flags.branch || null,
        });
        emit(
          out.ok
            ? `CREATED ${out.task.taskId} status=${out.task.status}`
            : `CREATE failed`,
          out,
          parsed.flags.json,
        );
        break;
      }
      case 'claim': {
        out = await manager.claim({
          taskId: parsed.flags['task-id'],
          actorId: parsed.flags.actor,
          actorType: parsed.flags['actor-type'] || 'CURSOR_WORKER',
        });
        emit(
          out.ok
            ? `CLAIMED ${out.task.taskId} attempt=${out.task.attempt} actor=${out.task.actorId}`
            : `CLAIM failed`,
          out,
          parsed.flags.json,
        );
        break;
      }
      case 'prepare': {
        out = await manager.prepare({
          taskId: parsed.flags['task-id'],
          actorId: parsed.flags.actor,
        });
        if (out.ok && !parsed.flags.json) {
          console.log(`PREPARED ${out.task.taskId}`);
          console.log('----- BEGIN INSTRUCTION PACKET (paste into Cursor) -----');
          console.log(out.instruction.markdown);
          console.log('----- END INSTRUCTION PACKET -----');
        } else {
          emit(out.ok ? `PREPARED ${out.task.taskId}` : 'PREPARE failed', out, parsed.flags.json);
        }
        break;
      }
      case 'start': {
        out = await manager.ackRunning({
          taskId: parsed.flags['task-id'],
          actorId: parsed.flags.actor,
        });
        emit(
          out.ok ? `RUNNING_ACK ${out.task.taskId}` : 'START failed',
          out,
          parsed.flags.json,
        );
        break;
      }
      case 'submit': {
        out = await manager.submitEvidence({
          taskId: parsed.flags['task-id'],
          actorId: parsed.flags.actor,
          prNumber: Number(parsed.flags.pr),
          headShaHint: parsed.flags['head-sha'] || null,
        });
        emit(
          out.ok ? `EVIDENCE_SUBMITTED ${out.task.taskId} pr=${parsed.flags.pr}` : 'SUBMIT failed',
          out,
          parsed.flags.json,
        );
        break;
      }
      case 'verify': {
        out = await manager.verify({
          taskId: parsed.flags['task-id'],
          actorId: parsed.flags.actor || 'owner-verifier',
        });
        emit(
          out.ok
            ? `VERIFIED ${out.task.taskId} (Owner accept still required; not merged)`
            : `VERIFY ${out.code}`,
          out,
          parsed.flags.json,
        );
        break;
      }
      case 'reconcile': {
        out = await manager.reconcile({
          taskId: parsed.flags['task-id'],
          actorId: parsed.flags.actor,
          expectedAttempt: Number(parsed.flags.attempt),
          expectedBaseSha: parsed.flags['base-sha'],
          governancePrNumber: Number(parsed.flags['governance-pr']),
          expectedGovernanceMergeSha: parsed.flags['governance-merge-sha'],
          implementationPrNumber: Number(parsed.flags['implementation-pr']),
          expectedImplementationHeadSha: parsed.flags['implementation-head-sha'],
          expectedImplementationMergeSha: parsed.flags['implementation-merge-sha'],
          ownerAcknowledgement: parsed.flags['owner-ack'],
        });
        if (out.ok && !parsed.flags.json) {
          console.log(
            `RECONCILED ${out.task.taskId} code=${out.code} `
            + `(historical FAIL preserved; Owner ACCEPT still required)`,
          );
          console.log(
            'LIMITATION: local same-UID CLI acknowledgement is NOT independently authenticated Owner authority.',
          );
          if (out.task.reconciliation && out.task.reconciliation.limitations) {
            for (const line of out.task.reconciliation.limitations) {
              console.log(`  - ${line}`);
            }
          }
        } else {
          emit(
            out.ok ? `RECONCILED ${out.task.taskId}` : `RECONCILE ${out.code}`,
            out,
            parsed.flags.json,
          );
        }
        break;
      }
      case 'accept': {
        out = await manager.accept({
          taskId: parsed.flags['task-id'],
          actorId: parsed.flags.actor,
          acknowledgement: parsed.flags.note || null,
        });
        emit(
          out.ok
            ? `OWNER_ACCEPTED ${out.task.taskId} (local CLI ack; same-UID limitation applies)`
            : 'ACCEPT failed',
          out,
          parsed.flags.json,
        );
        break;
      }
      case 'reject': {
        out = await manager.reject({
          taskId: parsed.flags['task-id'],
          actorId: parsed.flags.actor,
          reason: parsed.flags.reason || null,
        });
        emit(
          out.ok ? `OWNER_REJECTED ${out.task.taskId}` : 'REJECT failed',
          out,
          parsed.flags.json,
        );
        break;
      }
      case 'status': {
        out = await manager.status({ taskId: parsed.flags['task-id'] });
        if (parsed.flags.json) {
          emit('', out, true);
        } else if (!out.ok) {
          emit('STATUS failed', out, false);
        } else if (out.task) {
          const t = out.task;
          console.log(`${t.taskId}  ${t.status}  attempt=${t.attempt}  actor=${t.actorId || '-'}`);
          console.log(`  repo=${t.repository} base=${t.baseSha}`);
          console.log(`  allow=${t.fileAllowlist.join(', ')}`);
          if (t.verification) {
            console.log(
              `  verification=${t.verification.decision}/${t.verification.code}`,
            );
          }
          if (t.reconciliation) {
            console.log(
              `  reconciliation=${t.reconciliation.decision}/${t.reconciliation.code} `
              + `(historical FAIL preserved; accept separate)`,
            );
          }
        } else {
          for (const t of out.tasks) {
            console.log(`${t.taskId}\t${t.status}\tattempt=${t.attempt}\tactor=${t.actorId || '-'}`);
          }
          console.log(`total=${out.tasks.length}`);
        }
        break;
      }
      case 'recover': {
        out = await manager.recover({
          taskId: parsed.flags['task-id'],
          actorId: parsed.flags.actor || 'owner-1',
          reason: parsed.flags.reason || 'MANUAL',
        });
        emit(
          out.ok ? `RECOVERY ${out.task.taskId} -> ${out.task.status}` : 'RECOVER failed',
          out,
          parsed.flags.json,
        );
        break;
      }
      case 'next': {
        out = await manager.next();
        emit(
          out.ok ? `NEXT ${out.task.taskId}` : `NEXT none (${out.code})`,
          out,
          parsed.flags.json,
        );
        break;
      }
      default:
        emit(`Unknown command: ${command}`, { ok: false, code: 'UNKNOWN_COMMAND' }, parsed.flags.json);
        printHelp();
        process.exitCode = 1;
        out = { ok: false };
    }
    if (out && out.ok === false) process.exitCode = 1;
  } finally {
    await manager.close();
  }
}

const isDirect = process.argv[1]
  && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;

if (isDirect) {
  main().catch((err) => {
    console.error(err);
    process.exitCode = 1;
  });
}

export { main, parseArgs };
