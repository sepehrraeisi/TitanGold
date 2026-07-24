#!/usr/bin/env node
/**
 * Create disposable login E2E fixture user in the current DATABASE_URL database.
 * Never prints generated passwords unless explicitly requested for local dev.
 */
import fs from 'fs';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import pool, { query } from '../database/db.js';

const FIXTURE_EMAIL = 'e2e-login-fixture@titangold.test';
const FIXTURE_USERNAME = 'e2e_login_fixture';

function readArg(flag) {
  const index = process.argv.indexOf(flag);
  if (index === -1 || index + 1 >= process.argv.length) return null;
  return process.argv[index + 1];
}

async function main() {
  const outputFile = readArg('--output-file');
  const quietSecrets = process.argv.includes('--quiet-secrets');
  const password = crypto.randomBytes(18).toString('base64url');
  const passwordHash = await bcrypt.hash(password, 10);

  const result = await query(
    `INSERT INTO users (email, username, password_hash, full_name, role, is_active)
     VALUES ($1, $2, $3, $4, 'user', TRUE)
     ON CONFLICT (email) DO UPDATE
       SET username = EXCLUDED.username,
           password_hash = EXCLUDED.password_hash,
           is_active = TRUE
     RETURNING id`,
    [FIXTURE_EMAIL, FIXTURE_USERNAME, passwordHash, 'E2E Login Fixture'],
  );

  const envLines = [
    `PLAYWRIGHT_LOGIN_USER=${FIXTURE_USERNAME}`,
    `PLAYWRIGHT_LOGIN_PASSWORD=${password}`,
    'RUN_LOGIN_E2E=1',
  ];

  if (process.env.GITHUB_ENV) {
    fs.appendFileSync(process.env.GITHUB_ENV, `\nPLAYWRIGHT_LOGIN_USER=${FIXTURE_USERNAME}\n`);
    fs.appendFileSync(process.env.GITHUB_ENV, `PLAYWRIGHT_LOGIN_PASSWORD=${password}\n`);
    fs.appendFileSync(process.env.GITHUB_ENV, 'RUN_LOGIN_E2E=1\n');
    console.log(`::add-mask::${password}`);
  }

  if (outputFile) {
    fs.writeFileSync(outputFile, `${envLines.join('\n')}\n`, { mode: 0o600 });
  }

  console.log(`FIXTURE_USER_ID=${result.rows[0].id}`);
  console.log(`PLAYWRIGHT_LOGIN_USER=${FIXTURE_USERNAME}`);

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
