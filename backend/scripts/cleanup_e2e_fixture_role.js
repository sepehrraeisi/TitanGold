#!/usr/bin/env node
/** Demote disposable E2E fixture back to user after Staging analyze/settings tests. */
import pool, { query } from '../database/db.js';

function readArg(flag) {
  const index = process.argv.indexOf(flag);
  if (index === -1 || index + 1 >= process.argv.length) return null;
  return process.argv[index + 1];
}

function requireArg(flag) {
  const value = readArg(flag);
  if (!value) throw new Error(`Missing required flag ${flag}`);
  return value;
}

function buildFixtureFullName(owner) {
  return `E2E Login Fixture (${owner})`;
}

async function main() {
  const fixtureUserId = requireArg('--fixture-user-id');
  const username = requireArg('--fixture-username');
  const email = requireArg('--fixture-email');
  const owner = requireArg('--fixture-owner');
  const targetEnv = requireArg('--target-env');
  if (targetEnv !== 'staging') {
    throw new Error('Disposable fixture cleanup is allowed only for target-env=staging');
  }

  const result = await query(
    `UPDATE users
        SET role = 'user'
      WHERE id = $1
        AND username = $2
        AND email = $3
        AND full_name = $4
        AND is_active = TRUE
      RETURNING id, username, role`,
    [fixtureUserId, username, email, buildFixtureFullName(owner)],
  );

  if (result.rowCount !== 1) {
    throw new Error(`Expected exactly one disposable fixture row for cleanup, got ${result.rowCount}`);
  }

  console.log(`E2E fixture cleaned up for username=${username}`);
}

main()
  .finally(async () => {
    await pool.end();
  })
  .catch((err) => {
    console.error(`Failed to clean up disposable login fixture: ${err.message}`);
    process.exit(1);
  });
