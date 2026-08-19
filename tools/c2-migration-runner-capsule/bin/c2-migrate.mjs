#!/usr/bin/env node
/**
 * Capability-limited C2 launcher.
 * Allowed: up|down for 052_telegram_messages_channel_message_id_index only.
 * Never prints DATABASE_URL. Never accepts extra CLI flags.
 */

import { spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const EXPECTED_NODE = 'v20.19.5';
export const EXPECTED_PLATFORM = 'linux';
export const EXPECTED_ARCH = 'x64';
export const NODE_PG_MIGRATE_VERSION = '8.0.4';
export const PG_VERSION = '8.16.3';
export const MIGRATION_BASENAME = '052_telegram_messages_channel_message_id_index.js';
export const MIGRATION_NAME = '052_telegram_messages_channel_message_id_index';
export const EXPECTED_MIGRATION_SHA256 =
  '2c7c5723b20fd823102fb78f8cd97664453e3fcbb07ece56efb4ec0bd444f082';
export const REQUIRED_PACKAGES = Object.freeze(['node-pg-migrate', 'pg', 'glob', 'yargs']);

export function capsuleRootFrom(metaUrl) {
  return path.resolve(path.dirname(fileURLToPath(metaUrl)), '..');
}

export function sanitizeText(text) {
  if (typeof text !== 'string') return String(text);
  const secret = process.env.DATABASE_URL;
  if (!secret) return text;
  return text.split(secret).join('[REDACTED]');
}

export function fail(code, detail) {
  const suffix = detail ? `: ${sanitizeText(String(detail))}` : '';
  console.error(`${code}${suffix}`);
  process.exit(1);
}

export function assertNodeContract() {
  if (process.version !== EXPECTED_NODE) {
    fail('C2_CAPSULE_NODE_VERSION_MISMATCH', process.version);
  }
  if (process.platform !== EXPECTED_PLATFORM) {
    fail('C2_CAPSULE_ARCH_MISMATCH', process.platform);
  }
  if (process.arch !== EXPECTED_ARCH) {
    fail('C2_CAPSULE_ARCH_MISMATCH', process.arch);
  }
}

export function assertNodePathUnset() {
  const value = process.env.NODE_PATH;
  if (value != null && String(value).trim() !== '') {
    fail('C2_CAPSULE_MODULE_ESCAPE', 'NODE_PATH must be unset');
  }
}

export function assertInsideRoot(root, candidate, label) {
  const resolvedRoot = fs.realpathSync(root);
  let resolvedCandidate;
  try {
    resolvedCandidate = fs.realpathSync(candidate);
  } catch {
    fail('C2_CAPSULE_MODULE_ESCAPE', `${label} missing: ${candidate}`);
  }
  const prefix = resolvedRoot.endsWith(path.sep) ? resolvedRoot : `${resolvedRoot}${path.sep}`;
  if (resolvedCandidate !== resolvedRoot && !resolvedCandidate.startsWith(prefix)) {
    fail('C2_CAPSULE_MODULE_ESCAPE', `${label}=${resolvedCandidate}`);
  }
  return resolvedCandidate;
}

export function sha256File(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

export function localMigrateBin(root) {
  const bin = path.join(root, 'node_modules', '.bin', 'node-pg-migrate');
  if (!fs.existsSync(bin)) {
    fail('C2_CAPSULE_VERSION_MISMATCH', 'capsule-local node-pg-migrate binary missing');
  }
  const lst = fs.lstatSync(bin);
  if (lst.isSymbolicLink()) {
    const target = fs.readlinkSync(bin);
    if (path.isAbsolute(target)) {
      fail('C2_CAPSULE_UNSAFE_SYMLINK', 'absolute node-pg-migrate bin symlink');
    }
    const resolved = path.resolve(path.dirname(bin), target);
    assertInsideRoot(root, resolved, 'node-pg-migrate bin target');
  }
  return assertInsideRoot(root, bin, 'node-pg-migrate bin');
}

export function assertPackageVersions(root) {
  for (const [name, expected] of [
    ['node-pg-migrate', NODE_PG_MIGRATE_VERSION],
    ['pg', PG_VERSION],
  ]) {
    const pkgPath = path.join(root, 'node_modules', name, 'package.json');
    if (!fs.existsSync(pkgPath)) {
      fail('C2_CAPSULE_VERSION_MISMATCH', `${name} package.json missing`);
    }
    assertInsideRoot(root, pkgPath, `${name} package.json`);
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    if (pkg.version !== expected) {
      fail('C2_CAPSULE_VERSION_MISMATCH', `${name} ${pkg.version}`);
    }
  }
}

export function assertModuleIsolation(root) {
  const resolvedRoot = fs.realpathSync(root);
  const require = createRequire(path.join(resolvedRoot, 'package.json'));
  for (const name of REQUIRED_PACKAGES) {
    let filePath;
    try {
      filePath = require.resolve(name);
    } catch (error) {
      fail('C2_CAPSULE_MODULE_ESCAPE', `${name} unresolved: ${error.message}`);
    }
    assertInsideRoot(resolvedRoot, filePath, name);
    if (filePath.includes(`${path.sep}backend${path.sep}node_modules${path.sep}`)) {
      fail('C2_CAPSULE_MODULE_ESCAPE', `${name} resolved into backend/node_modules`);
    }
  }
}

export function validateMigrationsDir(dir) {
  if (!dir || typeof dir !== 'string') {
    fail('C2_CAPSULE_EXTRA_MIGRATION_FILE', 'migrations dir required');
  }
  const resolved = path.resolve(dir);
  if (!fs.existsSync(resolved)) {
    fail('C2_CAPSULE_EXTRA_MIGRATION_FILE', 'migrations dir missing');
  }
  const dirStat = fs.lstatSync(resolved);
  if (dirStat.isSymbolicLink()) {
    fail('C2_CAPSULE_UNSAFE_SYMLINK', 'migrations dir must not be a symlink');
  }
  if (!dirStat.isDirectory()) {
    fail('C2_CAPSULE_EXTRA_MIGRATION_FILE', 'migrations path is not a directory');
  }
  const entries = fs.readdirSync(resolved, { withFileTypes: true });
  if (entries.length !== 1) {
    fail(
      'C2_CAPSULE_EXTRA_MIGRATION_FILE',
      `expected exactly one file, found ${entries.length}`,
    );
  }
  const only = entries[0];
  if (only.name !== MIGRATION_BASENAME) {
    fail('C2_CAPSULE_EXTRA_MIGRATION_FILE', only.name);
  }
  const migrationPath = path.join(resolved, only.name);
  const fileStat = fs.lstatSync(migrationPath);
  if (fileStat.isSymbolicLink()) {
    fail('C2_CAPSULE_UNSAFE_SYMLINK', 'migration must not be a symlink');
  }
  if (!fileStat.isFile()) {
    fail('C2_CAPSULE_MIGRATION_HASH_MISMATCH', 'migration is not a regular file');
  }
  const digest = sha256File(migrationPath);
  if (digest !== EXPECTED_MIGRATION_SHA256) {
    fail('C2_CAPSULE_MIGRATION_HASH_MISMATCH', digest);
  }
  return resolved;
}

function cleanEnv() {
  const env = { ...process.env };
  delete env.NODE_PATH;
  const nodeOptions = env.NODE_OPTIONS || '';
  if (/(^|\s)(--require|-r|--import|--loader|--experimental-loader)\b/.test(nodeOptions)) {
    fail('C2_CAPSULE_MODULE_ESCAPE', 'NODE_OPTIONS preload is not allowed');
  }
  return env;
}

function runMigrate(root, operation, migrationsDir) {
  if (!process.env.DATABASE_URL) {
    fail('C2_CAPSULE_MISSING_DATABASE_URL', 'DATABASE_URL is required for c2-migrate');
  }
  const bin = localMigrateBin(root);
  const args = [
    '--experimental-default-type=module',
    bin,
    operation,
    MIGRATION_NAME,
    '--database-url-var',
    'DATABASE_URL',
    '--migrations-dir',
    migrationsDir,
    '--migrations-schema',
    'public',
    '--migrations-table',
    'pgmigrations',
    '--schema',
    'public',
    '--no-check-order',
    '--no-single-transaction',
  ];
  const result = spawnSync(process.execPath, args, {
    cwd: root,
    env: cleanEnv(),
    stdio: 'inherit',
  });
  if (result.error) {
    fail('C2_CAPSULE_SELF_TEST_FAILED', result.error.message);
  }
  process.exit(result.status === null ? 1 : result.status);
}

function isDirectRun() {
  const entry = process.argv[1];
  if (!entry) return false;
  try {
    return fs.realpathSync(entry) === fs.realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return path.resolve(entry) === fileURLToPath(import.meta.url);
  }
}

function main() {
  const argv = process.argv.slice(2);
  if (argv.length !== 2) {
    fail(
      'C2_CAPSULE_LAUNCHER_USAGE',
      'usage: node c2-migrate.mjs <up|down> <ONE_FILE_MIGRATIONS_DIR>',
    );
  }
  const [operation, migrationsDirArg] = argv;
  if (operation !== 'up' && operation !== 'down') {
    fail('C2_CAPSULE_LAUNCHER_USAGE', `unsupported operation ${operation}`);
  }
  const root = capsuleRootFrom(import.meta.url);
  assertNodeContract();
  assertNodePathUnset();
  assertPackageVersions(root);
  assertModuleIsolation(root);
  const migrationsDir = validateMigrationsDir(migrationsDirArg);
  runMigrate(root, operation, migrationsDir);
}

if (isDirectRun()) {
  main();
}
