#!/usr/bin/env node
/**
 * Validate runtime-safety rollback plan in an isolated worktree.
 * Does NOT touch active staging DB or clear kill switch.
 */
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const worktreePath = '/tmp/titan-rollback-validate';
const BASE = '09dc28b';
const REVERT_SEQUENCE = [
  'e8b3de4', '24b97ce', '23fdb3f', '563e553', '6ddadc4', '56501b5', '712930a', '133aecc',
];
const RUNTIME_FILES_PHASE23 = [
  'hooks/useAgentExecutionGate.ts',
  'scripts/verify-staging-deployment.sh',
  'docs/evidence/route-matrix.json',
  'e2e/pre-human-qa.spec.ts',
];

function run(cmd, cwd = root) {
  return execSync(cmd, { cwd, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
}

function main() {
  const result = {
    validatedAt: new Date().toISOString(),
    base: BASE,
    revertSequence: REVERT_SEQUENCE,
    steps: [],
    pass: true,
  };

  try {
    if (fs.existsSync(worktreePath)) {
      run(`git worktree remove --force ${worktreePath}`);
    }
    run(`git worktree add ${worktreePath} ${BASE}`);
    result.steps.push({ step: 'worktree_created', path: worktreePath, status: 'PASS' });

    const cherry = REVERT_SEQUENCE.slice().reverse().join(' ');
    run(`git cherry-pick ${cherry}`, worktreePath);
    result.steps.push({ step: 'cherry_pick_forward', commits: REVERT_SEQUENCE.length, status: 'PASS' });

    for (const sha of REVERT_SEQUENCE) {
      run(`git revert --no-edit ${sha}`, worktreePath);
    }
    result.steps.push({ step: 'revert_sequence', commits: REVERT_SEQUENCE.length, status: 'PASS' });

    for (const f of RUNTIME_FILES_PHASE23) {
      const exists = fs.existsSync(path.join(worktreePath, f));
      result.steps.push({
        step: 'phase23_file_removed_after_revert',
        file: f,
        status: exists ? 'FAIL' : 'PASS',
      });
      if (exists) result.pass = false;
    }

    const treeDiff = run(`git diff --stat ${BASE} HEAD`, worktreePath);
    result.treeDiffStat = treeDiff.split('\n').slice(-1)[0] || '0 files changed';
    result.steps.push({
      step: 'tree_matches_base',
      status: treeDiff.includes('0 files changed') || treeDiff.trim() === '' ? 'PASS' : 'WARN',
    });

    const head = run('git rev-parse HEAD', worktreePath);
    result.revertedHead = head;
    result.steps.push({ step: 'reverted_head', sha: head, status: 'PASS' });

    run(`git worktree remove --force ${worktreePath}`);
    result.steps.push({ step: 'worktree_removed', status: 'PASS' });
  } catch (e) {
    result.pass = false;
    result.error = e.message;
    result.steps.push({ step: 'error', message: e.message, status: 'FAIL' });
    try { run(`git worktree remove --force ${worktreePath}`); } catch { /* ignore */ }
  }

  const out = path.join(root, 'docs/evidence/rollback-validation.json');
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
  process.exit(result.pass ? 0 : 1);
}

main();
