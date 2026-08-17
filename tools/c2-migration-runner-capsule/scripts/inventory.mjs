#!/usr/bin/env node
/**
 * Capsule lock validation, native scan, and machine-readable inventory writer.
 * No secrets. No DATABASE_URL. Stable key ordering.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  EXPECTED_ARCH,
  EXPECTED_NODE,
  EXPECTED_PLATFORM,
  NODE_PG_MIGRATE_VERSION,
  PG_VERSION,
  fail,
  sha256File,
} from '../bin/c2-migrate.mjs';
import { scanNativeAndUnsafe } from '../bin/c2-self-test.mjs';

const FORMAT_VERSION = 1;
const ALLOWED_HOST = 'registry.npmjs.org';

function stableStringify(value) {
  return `${JSON.stringify(sortValue(value), null, 2)}\n`;
}

function sortValue(value) {
  if (Array.isArray(value)) return value.map(sortValue);
  if (value && typeof value === 'object') {
    const out = {};
    for (const key of Object.keys(value).sort()) {
      out[key] = sortValue(value[key]);
    }
    return out;
  }
  return value;
}

export function validateLockfile(lockPath) {
  const lock = JSON.parse(fs.readFileSync(lockPath, 'utf8'));
  if (lock.lockfileVersion !== 3) {
    fail('C2_CAPSULE_MANIFEST_MISMATCH', `lockfileVersion ${lock.lockfileVersion}`);
  }
  const packages = lock.packages || {};
  const root = packages[''] || {};
  const deps = root.dependencies || {};
  if (deps['node-pg-migrate'] !== NODE_PG_MIGRATE_VERSION) {
    fail('C2_CAPSULE_VERSION_MISMATCH', `lock node-pg-migrate ${deps['node-pg-migrate']}`);
  }
  if (deps.pg !== PG_VERSION) {
    fail('C2_CAPSULE_VERSION_MISMATCH', `lock pg ${deps.pg}`);
  }
  if (root.devDependencies && Object.keys(root.devDependencies).length) {
    fail('C2_CAPSULE_MANIFEST_MISMATCH', 'devDependencies present');
  }
  const inventory = [];
  for (const [key, meta] of Object.entries(packages)) {
    if (key === '') continue;
    if (key.includes('pg-native') || (meta.name && meta.name === 'pg-native')) {
      fail('C2_CAPSULE_UNEXPECTED_NATIVE_CODE', 'pg-native present');
    }
    const resolved = meta.resolved || '';
    const integrity = meta.integrity || '';
    if (meta.link || resolved.startsWith('file:') || resolved.startsWith('git+') || resolved.startsWith('git:')) {
      fail('C2_CAPSULE_MANIFEST_MISMATCH', `non-registry dependency ${key}`);
    }
    if (typeof resolved === 'string' && resolved.includes('workspace:')) {
      fail('C2_CAPSULE_MANIFEST_MISMATCH', `workspace dependency ${key}`);
    }
    if (!resolved.startsWith('https://')) {
      fail('C2_CAPSULE_MANIFEST_MISMATCH', `non-https resolved ${key}`);
    }
    const host = new URL(resolved).host;
    if (host !== ALLOWED_HOST) {
      fail('C2_CAPSULE_MANIFEST_MISMATCH', `unexpected registry ${host}`);
    }
    if (!integrity) {
      fail('C2_CAPSULE_MANIFEST_MISMATCH', `missing integrity ${key}`);
    }
    if (meta.hasInstallScript) {
      fail('C2_CAPSULE_MANIFEST_MISMATCH', `hasInstallScript ${key}`);
    }
    inventory.push({
      key,
      name: meta.name || key.split('node_modules/').pop(),
      version: meta.version,
      resolved,
      integrity,
      optional: Boolean(meta.optional),
    });
  }
  inventory.sort((a, b) => a.key.localeCompare(b.key));
  const npm = packages['node_modules/node-pg-migrate'];
  const pg = packages['node_modules/pg'];
  if (!npm || npm.version !== NODE_PG_MIGRATE_VERSION) {
    fail('C2_CAPSULE_VERSION_MISMATCH', 'node-pg-migrate lock entry');
  }
  if (!pg || pg.version !== PG_VERSION) {
    fail('C2_CAPSULE_VERSION_MISMATCH', 'pg lock entry');
  }
  return {
    packageCount: inventory.length,
    inventory,
    nodePgMigrateIntegrity: npm.integrity,
    pgIntegrity: pg.integrity,
  };
}

function collectRuntimeEntries(root) {
  const entries = [];
  const skip = new Set(['.git', '.env', '.npm', '.cache']);
  const stack = [root];
  while (stack.length) {
    const current = stack.pop();
    const names = fs.readdirSync(current).sort();
    for (const name of names) {
      if (skip.has(name)) continue;
      const full = path.join(current, name);
      const rel = path.relative(root, full);
      const lst = fs.lstatSync(full);
      if (lst.isDirectory()) {
        stack.push(full);
        continue;
      }
      if (lst.isSymbolicLink()) {
        entries.push({
          path: rel.split(path.sep).join('/'),
          sha256: null,
          size: lst.size,
          type: 'symlink',
          symlinkTarget: fs.readlinkSync(full),
        });
        continue;
      }
      if (!lst.isFile()) {
        fail('C2_CAPSULE_UNSAFE_SYMLINK', `unsupported type ${rel}`);
      }
      entries.push({
        path: rel.split(path.sep).join('/'),
        sha256: sha256File(full),
        size: lst.size,
        type: 'file',
        symlinkTarget: null,
      });
    }
  }
  entries.sort((a, b) => a.path.localeCompare(b.path));
  return entries;
}

export function writeManifests(root, extra = {}) {
  const lockPath = path.join(root, 'package-lock.json');
  const lockInfo = validateLockfile(lockPath);
  scanNativeAndUnsafe(root);
  fs.mkdirSync(path.join(root, 'manifests'), { recursive: true });
  const files = collectRuntimeEntries(root).filter(
    (item) => !item.path.startsWith('manifests/'),
  );
  const filesPath = path.join(root, 'manifests', 'files.json');
  fs.writeFileSync(filesPath, stableStringify(files));
  const filesSha = sha256File(filesPath);
  const launcherPath = path.join(root, 'bin', 'c2-migrate.mjs');
  const capsuleManifest = {
    formatVersion: FORMAT_VERSION,
    sourceCommit: extra.sourceCommit || '',
    nodeModel: 'N1',
    nodeVersionRequired: EXPECTED_NODE,
    platform: EXPECTED_PLATFORM,
    arch: EXPECTED_ARCH,
    nodePgMigrateVersion: NODE_PG_MIGRATE_VERSION,
    pgVersion: PG_VERSION,
    packageLockSha256: sha256File(lockPath),
    launcherSha256: sha256File(launcherPath),
    fileManifestSha256: filesSha,
    sourceDateEpoch: extra.sourceDateEpoch || '',
    rootDependencies: {
      'node-pg-migrate': NODE_PG_MIGRATE_VERSION,
      pg: PG_VERSION,
    },
    packageCount: lockInfo.packageCount,
    packages: lockInfo.inventory,
  };
  const manifestPath = path.join(root, 'manifests', 'capsule-manifest.json');
  fs.writeFileSync(manifestPath, stableStringify(capsuleManifest));
  const inventoryPath = path.join(root, 'manifests', 'inventory.json');
  fs.writeFileSync(
    inventoryPath,
    stableStringify({
      formatVersion: FORMAT_VERSION,
      sourceCommit: extra.sourceCommit || '',
      packageLockSha256: capsuleManifest.packageLockSha256,
      packageCount: lockInfo.packageCount,
      packages: lockInfo.inventory,
    }),
  );
  return {
    filesSha,
    packageLockSha256: capsuleManifest.packageLockSha256,
    packageCount: lockInfo.packageCount,
    manifestPath,
  };
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

if (isDirectRun()) {
  const mode = process.argv[2];
  if (mode === '--validate-lock') {
    const lockPath = process.argv[3];
    const info = validateLockfile(lockPath);
    console.log(JSON.stringify({ ok: true, packageCount: info.packageCount }));
    process.exit(0);
  }
  if (mode === '--write') {
    const root = process.argv[3];
    const result = writeManifests(root, {
      sourceCommit: process.env.SOURCE_COMMIT || '',
      sourceDateEpoch: process.env.SOURCE_DATE_EPOCH || '',
    });
    console.log(JSON.stringify({ ok: true, ...result }));
    process.exit(0);
  }
  fail('C2_CAPSULE_SELF_TEST_FAILED', 'usage: inventory.mjs --validate-lock|--write');
}
