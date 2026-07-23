#!/usr/bin/env node
/**
 * Create disposable login E2E fixture user in the current DATABASE_URL database.
 * Prints safe env exports only — never prints the generated password after setup.
 */
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { query } from '../database/db.js';

const FIXTURE_EMAIL = 'e2e-login-fixture@titangold.test';
const FIXTURE_USERNAME = 'e2e_login_fixture';

async function main() {
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

  console.log(`FIXTURE_USER_ID=${result.rows[0].id}`);
  console.log(`PLAYWRIGHT_LOGIN_USER=${FIXTURE_USERNAME}`);
  console.log(`PLAYWRIGHT_LOGIN_PASSWORD=${password}`);
  console.log('RUN_LOGIN_E2E=1');
}

main().catch((err) => {
  console.error('Failed to prepare login E2E fixture:', err.message);
  process.exit(1);
});
