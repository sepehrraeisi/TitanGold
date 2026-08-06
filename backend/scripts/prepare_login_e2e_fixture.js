#!/usr/bin/env node
/**
 * Create disposable login E2E fixture user in the current DATABASE_URL database.
 * Never prints generated passwords unless explicitly requested for local dev.
 */
import fs from 'fs';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
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

function assertDisposableFixtureInput({ username, email, owner, targetEnv }) {
  if (targetEnv !== 'staging') {
    throw new Error('Disposable login fixture preparation is allowed only for target-env=staging');
  }
  if (!/^e2e_[a-z0-9_]{3,}$/i.test(username)) {
    throw new Error('Fixture username must be explicit, disposable, and start with e2e_');
  }
  if (!/^[^@\s]+@titangold\.test$/i.test(email)) {
    throw new Error('Fixture email must use the disposable @titangold.test domain');
  }
  if (!owner || owner.trim().length < 3) {
    throw new Error('Fixture owner must be explicit and non-empty');
  }
}

async function main() {
  const outputFile = readArg('--output-file');
  const quietSecrets = process.argv.includes('--quiet-secrets');
  const username = requireArg('--fixture-username');
  const email = requireArg('--fixture-email');
  const owner = requireArg('--fixture-owner');
  const targetEnv = requireArg('--target-env');
  assertDisposableFixtureInput({ username, email, owner, targetEnv });

  const fullName = buildFixtureFullName(owner);
  const password = crypto.randomBytes(18).toString('base64url');
  const passwordHash = await bcrypt.hash(password, 10);

  const existing = await query(
    `SELECT id, email, username, full_name
       FROM users
      WHERE email = $1 OR username = $2`,
    [email, username],
  );

  for (const row of existing.rows) {
    const sameFixture =
      row.email === email && row.username === username && row.full_name === fullName;
    if (!sameFixture) {
      throw new Error('Refusing to reuse a non-disposable or differently owned login fixture');
    }
  }

  const result = await query(
    `INSERT INTO users (email, username, password_hash, full_name, role, is_active)
     VALUES ($1, $2, $3, $4, 'user', TRUE)
     ON CONFLICT (email) DO UPDATE
       SET username = EXCLUDED.username,
           password_hash = EXCLUDED.password_hash,
           full_name = EXCLUDED.full_name,
           is_active = TRUE
     WHERE users.username = EXCLUDED.username
       AND users.full_name = EXCLUDED.full_name
     RETURNING id, email, username, full_name`,
    [email, username, passwordHash, fullName],
  );

  if (result.rowCount !== 1) {
    throw new Error(`Expected exactly one disposable fixture row, got ${result.rowCount}`);
  }

  const envLines = [
    `PLAYWRIGHT_LOGIN_USER=${username}`,
    `PLAYWRIGHT_LOGIN_PASSWORD=${password}`,
    'RUN_LOGIN_E2E=1',
    `TITAN_E2E_FIXTURE_USER_ID=${result.rows[0].id}`,
    `TITAN_E2E_FIXTURE_OWNER=${owner}`,
    `TITAN_E2E_FIXTURE_EMAIL=${email}`,
    `TITAN_E2E_TARGET_ENV=${targetEnv}`,
  ];

  if (process.env.GITHUB_ENV) {
    fs.appendFileSync(process.env.GITHUB_ENV, `\nPLAYWRIGHT_LOGIN_USER=${username}\n`);
    fs.appendFileSync(process.env.GITHUB_ENV, `PLAYWRIGHT_LOGIN_PASSWORD=${password}\n`);
    fs.appendFileSync(process.env.GITHUB_ENV, 'RUN_LOGIN_E2E=1\n');
    fs.appendFileSync(process.env.GITHUB_ENV, `TITAN_E2E_FIXTURE_USER_ID=${result.rows[0].id}\n`);
    fs.appendFileSync(process.env.GITHUB_ENV, `TITAN_E2E_FIXTURE_OWNER=${owner}\n`);
    fs.appendFileSync(process.env.GITHUB_ENV, `TITAN_E2E_FIXTURE_EMAIL=${email}\n`);
    fs.appendFileSync(process.env.GITHUB_ENV, `TITAN_E2E_TARGET_ENV=${targetEnv}\n`);
    console.log(`::add-mask::${password}`);
  }

  if (outputFile) {
    fs.writeFileSync(outputFile, `${envLines.join('\n')}\n`, { mode: 0o600 });
  }

  console.log(`FIXTURE_USER_ID=${result.rows[0].id}`);
  console.log(`PLAYWRIGHT_LOGIN_USER=${username}`);
  console.log(`FIXTURE_OWNER=${owner}`);
  console.log(`FIXTURE_TARGET_ENV=${targetEnv}`);

  if (!quietSecrets && !process.env.GITHUB_ENV) {
    console.log(`PLAYWRIGHT_LOGIN_PASSWORD=${password}`);
    console.log('RUN_LOGIN_E2E=1');
  } else {
    console.log('RUN_LOGIN_E2E=1');
    console.log('PLAYWRIGHT_LOGIN_PASSWORD=<masked>');
  }

  await pool.end();
}

main().catch((err) => {
  console.error('Failed to prepare login E2E fixture:', err.message);
  process.exit(1);
});
