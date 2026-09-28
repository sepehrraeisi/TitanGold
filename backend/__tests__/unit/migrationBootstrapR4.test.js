/**
 * R4 — Migration / Bootstrap Reconciliation (library-only unit proof)
 *
 * Proves repository-owned migration discovery, dual-051 preservation,
 * setup_migrations.js no-mark-without-execute invariant, schema bootstrap
 * authority markers, and favorites/retention/B10 path presence.
 *
 * Does NOT connect to Production DB. Does NOT execute migrations.
 */

import { describe, it, expect } from '@jest/globals';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BACKEND = path.resolve(__dirname, '../..');
const REPO_ROOT = path.resolve(BACKEND, '..');
const MIGRATIONS_DIR = path.join(BACKEND, 'database/migrations');
const SCHEMA_SQL = path.join(REPO_ROOT, 'database/schema.sql');
const SETUP_SCRIPT = path.join(BACKEND, 'scripts/setup_migrations.js');
const MIGRATE_JS = path.join(BACKEND, 'database/migrate.js');

function listMigrationBasenames() {
  return fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql') || f.endsWith('.js'))
    .filter((f) => !f.startsWith('.'));
}

/** Mirror node-pg-migrate numeric-prefix sort with --no-check-order discovery. */
function sortLikeRunner(names) {
  return [...names].sort((a, b) => {
    const na = parseInt(a, 10);
    const nb = parseInt(b, 10);
    const aNum = Number.isFinite(na);
    const bNum = Number.isFinite(nb);
    if (aNum && bNum && na !== nb) return na - nb;
    if (aNum && !bNum) return -1;
    if (!aNum && bNum) return 1;
    return a.localeCompare(b);
  });
}

function ledgerIdentity(basename) {
  return basename.replace(/\.(sql|js)$/, '');
}

describe('R4 migration bootstrap reconciliation', () => {
  it('canonical runner entrypoints and migrations dir exist', () => {
    expect(fs.existsSync(MIGRATE_JS)).toBe(true);
    expect(fs.existsSync(SETUP_SCRIPT)).toBe(true);
    expect(fs.existsSync(MIGRATIONS_DIR)).toBe(true);
    expect(fs.existsSync(SCHEMA_SQL)).toBe(true);

    const migrateSrc = fs.readFileSync(MIGRATE_JS, 'utf8');
    expect(migrateSrc).toContain('--migrations-dir database/migrations');
    expect(migrateSrc).toContain('--no-check-order');
  });

  it('setup_migrations.js creates ledger only and never inserts applied rows', () => {
    const src = fs.readFileSync(SETUP_SCRIPT, 'utf8');
    expect(src).toContain('CREATE TABLE IF NOT EXISTS pgmigrations');
    expect(src).toMatch(/LEDGERED_APPLIED must never mean NOT_EXECUTED/i);
    expect(src).toMatch(/does NOT insert migration names/i);
    expect(src).toMatch(/NO mark-without-execute/i);
    // Fail closed: no INSERT INTO pgmigrations in this script
    expect(src).not.toMatch(/INSERT\s+INTO\s+pgmigrations/i);
  });

  it('preserves both 051 semantic histories with distinct ledger identities', () => {
    const names = listMigrationBasenames();
    expect(names).toContain('051_artemis_b10_decision_persistence.sql');
    expect(names).toContain('051_data_retention_60d_telegram.sql');

    const idB10 = ledgerIdentity('051_artemis_b10_decision_persistence.sql');
    const idRet = ledgerIdentity('051_data_retention_60d_telegram.sql');
    expect(idB10).not.toBe(idRet);
    expect(idB10).toBe('051_artemis_b10_decision_persistence');
    expect(idRet).toBe('051_data_retention_60d_telegram');
  });

  it('runner discovery order places artemis 051 before retention 051, then 052–055', () => {
    const sorted = sortLikeRunner(listMigrationBasenames());
    const iB10 = sorted.indexOf('051_artemis_b10_decision_persistence.sql');
    const iRet = sorted.indexOf('051_data_retention_60d_telegram.sql');
    const i050 = sorted.indexOf('050_mexc_capability_snapshots_rollback.sql');
    const i052 = sorted.indexOf('052_telegram_messages_channel_message_id_index.js');
    const i053 = sorted.indexOf('053_artemis_market_context_observation_sot.sql');
    const i054 = sorted.indexOf('054_artemis_observed_outcome_sot.sql');
    const i055 = sorted.indexOf('055_artemis_observed_outcome_evaluation_sot.sql');
    const i049 = sorted.indexOf('049_mexc_capability_states.sql');

    expect(i049).toBeGreaterThanOrEqual(0);
    expect(i050).toBeGreaterThan(i049);
    expect(iB10).toBeGreaterThan(i050);
    expect(iRet).toBeGreaterThan(iB10);
    expect(i052).toBeGreaterThan(iRet);
    expect(i053).toBeGreaterThan(i052);
    expect(i054).toBeGreaterThan(i053);
    expect(i055).toBeGreaterThan(i054);
  });

  it('050 migration is present and uses IF NOT EXISTS (safe on clean DB)', () => {
    const p = path.join(MIGRATIONS_DIR, '050_mexc_capability_snapshots_rollback.sql');
    expect(fs.existsSync(p)).toBe(true);
    const src = fs.readFileSync(p, 'utf8');
    expect(src).toMatch(/CREATE TABLE IF NOT EXISTS\s+mexc_capability_state_snapshots/i);
  });

  it('retention migration is whitelist-batched DELETE and non-secret', () => {
    const p = path.join(MIGRATIONS_DIR, '051_data_retention_60d_telegram.sql');
    const src = fs.readFileSync(p, 'utf8');
    expect(src).toContain('prune_table_by_age');
    expect(src).toContain('prune_logs');
    expect(src).toMatch(/NOT IN \('telegram_messages', 'collected_data', 'request_logs'\)/);
    expect(src).not.toMatch(/password|api[_-]?key|secret|BEGIN RSA/i);
    expect(src).not.toMatch(/\/home\/ubuntu/);
  });

  it('schema.sql is bootstrap base with favorites SERIAL+asset_id and monitoring/telegram DDL', () => {
    const src = fs.readFileSync(SCHEMA_SQL, 'utf8');
    expect(src).toMatch(/CREATE TABLE favorites\s*\([\s\S]*?id SERIAL PRIMARY KEY/);
    expect(src).toMatch(/asset_id VARCHAR\(50\) NOT NULL/);
    expect(src).toContain('idx_favorite_alerts_user_id');
    expect(src).toMatch(/CREATE TABLE telegram_messages\s*\(/);
    expect(src).toMatch(/CREATE TABLE request_logs\s*\(/);
    expect(src).toMatch(/CREATE TABLE error_logs\s*\(/);
    expect(src).toMatch(/CREATE EXTENSION IF NOT EXISTS ["']?pgcrypto["']?/);
    // Must not hardcode Production DB name in COMMENT
    expect(src).not.toMatch(/COMMENT ON DATABASE\s+titangold_db/i);
    expect(src).toMatch(/current_database\(\)/);
  });

  it('004 favorites migration is idempotent and does not DROP CASCADE favorites', () => {
    const p = path.join(MIGRATIONS_DIR, '004_create_favorites_tables.sql');
    const src = fs.readFileSync(p, 'utf8');
    expect(src).not.toMatch(/DROP TABLE IF EXISTS favorites/i);
    expect(src).not.toMatch(/DROP TABLE IF EXISTS favorite_alerts/i);
    expect(src).toMatch(/CREATE TABLE IF NOT EXISTS favorites/);
    expect(src).toMatch(/id SERIAL PRIMARY KEY/);
    expect(src).toMatch(/asset_id VARCHAR\(50\) NOT NULL/);
    expect(src).toContain('idx_favorite_alerts_user_id');
    expect(src).not.toMatch(/CREATE INDEX(?:\s+IF NOT EXISTS)?\s+idx_alerts_user_id\s+ON\s+favorite_alerts/i);
  });

  it('duplicate numeric prefixes do not collide on ledger identity (basename)', () => {
    const ids = listMigrationBasenames().map(ledgerIdentity);
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
  });
});
