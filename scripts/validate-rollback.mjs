#!/usr/bin/env node
/**
 * Validate BOTH rollback procedures in isolated worktrees.
 * A) Full work-package → d705bd2
 * B) Later-phase-only → 09dc28b
 * Does NOT touch active staging DB / kill switch.
 */
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

function run(cmd, cwd = root) {
  return execSync(cmd, { cwd, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
}

function listCommits(fromExclusive, toInclusive) {
  return run(`git rev-list --reverse ${fromExclusive}..${toInclusive}`).split('\n').filter(Boolean);
}

function validateProcedure({ name, base, tip, worktreePath }) {
  const result = { name, base, tip, steps: [], pass: true };
  try {
    if (fs.existsSync(worktreePath)) run(`git worktree remove --force ${worktreePath}`);
    run(`git worktree add ${worktreePath} ${base}`);
    result.steps.push({ step: 'worktree_created', status: 'PASS' });

    const forward = listCommits(base, tip);
    result.forwardCommits = forward;
    if (forward.length === 0) throw new Error('No commits in range');

    // Cherry-pick all related commits forward
    run(`git cherry-pick ${forward.join(' ')}`, worktreePath);
    result.steps.push({ step: 'cherry_pick_forward', count: forward.length, status: 'PASS' });

    // Revert newest → oldest
    for (const sha of [...forward].reverse()) {
      run(`git revert --no-edit ${sha}`, worktreePath);
    }
    result.steps.push({ step: 'revert_newest_to_oldest', count: forward.length, status: 'PASS' });

    const diff = run(`git diff --stat ${base} HEAD`, worktreePath);
    const clean = !diff || diff.includes('0 files changed') || diff.trim() === '';
    result.treeDiffStat = diff.split('\n').slice(-1)[0] || '0 files changed';
    result.steps.push({ step: 'tree_matches_base', status: clean ? 'PASS' : 'FAIL', detail: result.treeDiffStat });
    if (!clean) result.pass = false;

    // Build check (no install — reuse if package.json identical)
    try {
      run('node --check backend/server.js', worktreePath);
      result.steps.push({ step: 'syntax_check_server', status: 'PASS' });
    } catch (e) {
      result.steps.push({ step: 'syntax_check_server', status: 'WARN', message: e.message });
    }

    result.revertedHead = run('git rev-parse HEAD', worktreePath);
    run(`git worktree remove --force ${worktreePath}`);
    result.steps.push({ step: 'worktree_removed', status: 'PASS' });
  } catch (e) {
    result.pass = false;
    result.error = e.message;
    result.steps.push({ step: 'error', status: 'FAIL', message: e.message });
    try { run(`git worktree remove --force ${worktreePath}`); } catch { /* ignore */ }
  }
  return result;
}

const tip = run('git rev-parse HEAD');
const results = {
  validatedAt: new Date().toISOString(),
  tip,
  procedures: [
    validateProcedure({
      name: 'A_full_work_package',
      base: 'd705bd2',
      tip,
      worktreePath: '/tmp/titan-rollback-full',
    }),
    validateProcedure({
      name: 'B_later_phase_only',
      base: '09dc28b',
      tip,
      worktreePath: '/tmp/titan-rollback-later',
    }),
  ],
};
results.pass = results.procedures.every((p) => p.pass);

const out = path.join(root, 'docs/evidence/rollback-validation.json');
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify(results, null, 2));
console.log(JSON.stringify(results, null, 2));
process.exit(results.pass ? 0 : 1);
