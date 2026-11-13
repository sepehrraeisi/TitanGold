/**
 * Supervised manual Cursor handoff instruction packets.
 *
 * Packets are Owner-facing text/JSON for paste into an existing Cursor chat.
 * They do NOT confer TECP operational authorization, Worker launch, MCP
 * mutation, dispatcher permission, or production authority.
 */

import { GOVERNANCE_REVISION } from './taskRecord.js';

export const CURSOR_TRANSPORT = 'SUPERVISED_MANUAL_CURSOR_HANDOFF_V1';

/**
 * @param {object} task frozen task record
 * @param {{ attempt: number, actorId: string, nowMs?: number }} ctx
 */
export function buildInstructionPacket(task, ctx) {
  const nowMs = Number.isFinite(ctx.nowMs) ? ctx.nowMs : Date.now();
  const attempt = ctx.attempt;
  const actorId = ctx.actorId;
  const allowlist = [...(task.fileAllowlist || [])];

  const structured = Object.freeze({
    kind: 'TECP_TASK_MANAGER_V1_INSTRUCTION_PACKET',
    transport: CURSOR_TRANSPORT,
    authorityClass: 'SUPERVISED_MANUAL_HANDOFF_NOT_TECP_OPERATIONAL_AUTHORITY',
    governanceRevision: GOVERNANCE_REVISION,
    taskId: task.taskId,
    attempt,
    actorId,
    repository: task.repository,
    baseSha: task.baseSha,
    branchName: task.branchName,
    fileAllowlist: Object.freeze(allowlist),
    goal: task.goal,
    prohibited: Object.freeze([
      'Do not edit paths outside the exact file allowlist',
      'Do not claim TECP operational authorization from this packet',
      'Do not access production databases, secrets, or remote non-authorized systems',
      'Do not enable Worker, MCP mutation, or operational dispatcher',
      'Do not merge PRs or deploy',
      'Do not invent parallel TECP control-plane authority',
      'Do not add dependencies or paid infrastructure unless the task allowlist explicitly requires a package manifest already in scope',
    ]),
    requiredOutcome: Object.freeze([
      'Implement only the authorized paths',
      'Run the tests or acceptance checks listed by the Owner goal',
      'Open or update one PR against the stated base SHA',
      'Return PR number, exact HEAD SHA, changed-file list, and test results to the Owner',
    ]),
    expectedEvidenceFormat: Object.freeze({
      prNumber: 'integer',
      headSha: '40-char git sha',
      baseSha: 'must match task.baseSha unless Owner reconciles',
      changedFiles: 'exact list from authoritative GitHub metadata',
      testSummary: 'human-readable summary; not a trusted success flag',
      notes: 'optional',
    }),
    manualReturnProcedure: Object.freeze([
      'Owner pastes this packet into the existing Cursor chat',
      'Cursor performs the engineering work under Owner supervision',
      'Owner or Cursor reports PR metadata back to the Owner',
      'Owner runs: tecp-task-manager submit / verify / accept|reject',
      'Verification uses authoritative GitHub/CLI data; caller success flags are ignored',
    ]),
    issuedAtMs: nowMs,
  });

  const markdown = [
    `# Task Manager V1 Instruction Packet`,
    ``,
    `> AUTHORITY: SUPERVISED MANUAL CURSOR HANDOFF ONLY`,
    `> This packet is NOT TECP operational authorization, fencing, Worker, MCP, dispatcher, or production authority.`,
    ``,
    `## Identity`,
    `- taskId: \`${task.taskId}\``,
    `- attempt: \`${attempt}\``,
    `- actorId: \`${actorId}\``,
    `- repository: \`${task.repository}\``,
    `- baseSha: \`${task.baseSha}\``,
    `- branch: \`${task.branchName || '(create as needed; report back)'}\``,
    `- governanceRevision: \`${GOVERNANCE_REVISION}\``,
    `- transport: \`${CURSOR_TRANSPORT}\``,
    ``,
    `## Goal`,
    task.goal,
    ``,
    `## Exact file allowlist`,
    ...allowlist.map((p) => `- \`${p}\``),
    ``,
    `## Prohibited`,
    ...structured.prohibited.map((p) => `- ${p}`),
    ``,
    `## Required outcome`,
    ...structured.requiredOutcome.map((p) => `- ${p}`),
    ``,
    `## Evidence to return`,
    `- PR number`,
    `- Exact PR HEAD SHA`,
    `- Changed file list (must be subset of allowlist)`,
    `- Test results summary`,
    ``,
    `## Manual return`,
    ...structured.manualReturnProcedure.map((p, i) => `${i + 1}. ${p}`),
    ``,
  ].join('\n');

  return Object.freeze({
    structured,
    markdown,
    issuedAtMs: nowMs,
  });
}
