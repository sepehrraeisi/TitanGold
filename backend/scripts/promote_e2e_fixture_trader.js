#!/usr/bin/env node
/** Promote disposable E2E fixture to trader for analyze/settings Staging tests. */
import pool, { query } from '../database/db.js';
import {
  assertCanonicalStagingDeployEnv,
  assertSafeFixtureIdentity,
  buildFixtureFullName,
  requireArg,
} from './e2eFixtureSafety.js';

export async function promoteFixtureRole({
  fixtureUserId,
  username,
  email,
  owner,
  targetEnv,
  deployEnv = process.env.TITAN_DEPLOY_ENV,
  dbQuery = query,
} = {}) {
  assertCanonicalStagingDeployEnv({ targetEnv, deployEnv });
  assertSafeFixtureIdentity({
    username,
    email,
    owner,
    fixtureUserId,
    requireId: true,
  });

  const result = await dbQuery(
    `UPDATE users
        SET role = 'trader'
      WHERE id = $1
        AND username = $2
        AND email = $3
        AND full_name = $4
        AND is_active = TRUE
      RETURNING id, username, role`,
    [fixtureUserId, username, email, buildFixtureFullName(owner)],
  );

  if (result.rowCount !== 1) {
    throw new Error(`Expected exactly one disposable fixture row for role promotion, got ${result.rowCount}`);
  }

  return result.rows[0];
}

async function main() {
  const fixtureUserId = requireArg(process.argv, '--fixture-user-id');
  const username = requireArg(process.argv, '--fixture-username');
  const email = requireArg(process.argv, '--fixture-email');
  const owner = requireArg(process.argv, '--fixture-owner');
  const targetEnv = requireArg(process.argv, '--target-env');

  const row = await promoteFixtureRole({
    fixtureUserId,
    username,
    email,
    owner,
    targetEnv,
  });

  console.log(`E2E fixture role=trader for username=${row.username}`);
}

const isDirectRun =
  process.argv[1] &&
  (process.argv[1].endsWith('promote_e2e_fixture_trader.js') ||
    process.argv[1].includes('promote_e2e_fixture_trader'));

if (isDirectRun) {
  main()
    .finally(async () => {
      await pool.end();
    })
    .catch((err) => {
      console.error(`Failed to promote disposable login fixture: ${err.message}`);
      process.exit(1);
    });
}
