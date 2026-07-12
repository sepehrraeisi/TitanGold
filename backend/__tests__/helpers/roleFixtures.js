/**
 * Disposable role fixtures for integration tests.
 * Creates users in DB, returns JWT tokens, cleans up after suite.
 */
import jwt from 'jsonwebtoken';
import { query } from '../../database/db.js';

const FIXTURE_PREFIX = 'runtime-safety-fixture';
const ROLES = ['user', 'vip', 'trader', 'admin'];

/** @type {Map<string, { id: string, token: string }>} */
const activeFixtures = new Map();

function fixtureEmail(role) {
  return `${FIXTURE_PREFIX}-${role}@titangold.test`;
}

export function signToken(userId, extra = {}) {
  return jwt.sign({ userId, ...extra }, process.env.JWT_SECRET, { expiresIn: '1h' });
}

export async function createRoleFixture(role, { active = true } = {}) {
  if (!ROLES.includes(role)) throw new Error(`Unknown role: ${role}`);
  const email = fixtureEmail(role);
  const username = `${FIXTURE_PREFIX}_${role}`;
  const result = await query(
    `INSERT INTO users (email, username, password_hash, full_name, role, is_active)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (email) DO UPDATE SET role = EXCLUDED.role, is_active = EXCLUDED.is_active
     RETURNING id, role`,
    [email, username, 'fixture_hash', `Fixture ${role}`, role, active],
  );
  const id = result.rows[0].id;
  const token = signToken(id);
  await query(
    `INSERT INTO user_sessions (user_id, token, expires_at, last_activity_at)
     VALUES ($1, $2, NOW() + INTERVAL '1 hour', NOW())
     ON CONFLICT (token) DO UPDATE SET user_id = EXCLUDED.user_id`,
    [id, token],
  );
  activeFixtures.set(role, { id, token });
  return { id, role: result.rows[0].role, token, email };
}

export async function createAllRoleFixtures() {
  const fixtures = {};
  for (const role of ROLES) {
    fixtures[role] = await createRoleFixture(role);
  }
  return fixtures;
}

export async function disableFixture(role) {
  const f = activeFixtures.get(role);
  if (!f) return;
  await query('UPDATE users SET is_active = false WHERE id = $1', [f.id]);
}

export async function deleteFixture(role) {
  const f = activeFixtures.get(role);
  if (!f) return;
  await query('DELETE FROM user_sessions WHERE user_id = $1', [f.id]);
  await query('DELETE FROM users WHERE id = $1', [f.id]);
  activeFixtures.delete(role);
}

export async function changeFixtureRole(role, newRole) {
  const f = activeFixtures.get(role);
  if (!f) return;
  await query('UPDATE users SET role = $1 WHERE id = $2', [newRole, f.id]);
}

export async function cleanupAllFixtures() {
  for (const role of [...activeFixtures.keys()]) {
    await deleteFixture(role);
  }
  await query(`DELETE FROM user_sessions WHERE token LIKE $1`, [`${FIXTURE_PREFIX}%`]).catch(() => {});
  await query(`DELETE FROM users WHERE email LIKE $1`, [`${FIXTURE_PREFIX}%@titangold.test`]).catch(() => {});
}

export { ROLES, FIXTURE_PREFIX };
