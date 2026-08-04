#!/usr/bin/env node
/** Promote disposable E2E fixture to trader for analyze/settings Staging tests. */
import pool, { query } from '../database/db.js';

const username = process.argv[2] || 'e2e_login_fixture';
await query(`UPDATE users SET role = 'trader' WHERE username = $1`, [username]);
await pool.end();
console.log(`E2E fixture role=trader for username=${username}`);
