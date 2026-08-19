#!/usr/bin/env node
/**
 * Production-safe capsule self-test. No database connection. No npm. No network.
 */

import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  EXPECTED_ARCH,
  EXPECTED_NODE,
  EXPECTED_PLATFORM,
  NODE_PG_MIGRATE_VERSION,
  PG_VERSION,
  assertInsideRoot,
  assertModuleIsolation,
  assertNodeContract,
  assertNodePathUnset,
  assertPackageVersions,
  capsuleRootFrom,
  fail,
  localMigrateBin,
  sha256File,
} from './c2-migrate.mjs';

const ELF_MAGIC = Buffer.from([0x7f, 0x45, 0x4c, 0x46]);

function walkFiles(root) {
  const out = [];
  const stack = [root];
  while (stack.length) {
    const current = stack.pop();
    const entries = fs.readdirSync(current, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(full);
      } else {
        out.push({ full, entry });
      }
    }
  }
  return out;
}

export function scanNativeAndUnsafe(root) {
  const resolvedRoot = fs.realpathSync(root);
  const prefix = resolvedRoot.endsWith(path.sep) ? resolvedRoot : `${resolvedRoot}${path.sep}`;
  let nodeCount = 0;
  let elfCount = 0;
  for (const { full, entry } of walkFiles(root)) {
    if (entry.isSymbolicLink()) {
      const target = fs.readlinkSync(full);
      if (path.isAbsolute(target)) {
        fail('C2_CAPSULE_UNSAFE_SYMLINK', `absolute ${path.relative(root, full)}`);
      }
      const resolved = fs.realpathSync(full);
      if (resolved !== resolvedRoot && !resolved.startsWith(prefix)) {
        fail('C2_CAPSULE_UNSAFE_SYMLINK', `escape ${path.relative(root, full)}`);
      }
      continue;
    }
    if (!entry.isFile()) {
      fail('C2_CAPSULE_UNSAFE_SYMLINK', `unexpected type ${path.relative(root, full)}`);
    }
    const st = fs.statSync(full);
    if (st.mode & 0o4000 || st.mode & 0o2000) {
      fail('C2_CAPSULE_UNSAFE_SYMLINK', `setuid/setgid ${path.relative(root, full)}`);
    }
    if (full.endsWith('.node')) {
      nodeCount += 1;
    }
    const fd = fs.openSync(full, 'r');
    const buf = Buffer.alloc(4);
    const n = fs.readSync(fd, buf, 0, 4, 0);
    fs.closeSync(fd);
    if (n === 4 && buf.equals(ELF_MAGIC)) {
      elfCount += 1;
    }
  }
  if (nodeCount !== 0 || elfCount !== 0) {
    fail(
      'C2_CAPSULE_UNEXPECTED_NATIVE_CODE',
      `*.node=${nodeCount} elf=${elfCount}`,
    );
  }
  return { nodeCount, elfCount };
}

function listNonManifestFiles(root) {
  const out = [];
  const stack = [root];
  while (stack.length) {
    const current = stack.pop();
    for (const name of fs.readdirSync(current)) {
      const full = path.join(current, name);
      const rel = path.relative(root, full).split(path.sep).join('/');
      if (rel === 'manifests' || rel.startsWith('manifests/')) {
        if (fs.lstatSync(full).isDirectory()) stack.push(full);
        continue;
      }
      const lst = fs.lstatSync(full);
      if (lst.isDirectory()) {
        stack.push(full);
      } else {
        out.push(rel);
      }
    }
  }
  return out.sort();
}

function verifyFileManifest(root) {
  const manifestPath = path.join(root, 'manifests', 'files.json');
  if (!fs.existsSync(manifestPath)) {
    return { present: false };
  }
  const items = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  if (!Array.isArray(items)) {
    fail('C2_CAPSULE_MANIFEST_MISMATCH', 'files.json is not an array');
  }
  for (const item of items) {
    const full = path.join(root, item.path);
    if (item.path.split(path.sep).includes('..') || path.isAbsolute(item.path)) {
      fail('C2_CAPSULE_MANIFEST_MISMATCH', item.path);
    }
    if (!fs.existsSync(full)) {
      fail('C2_CAPSULE_MANIFEST_MISMATCH', `missing ${item.path}`);
    }
    const lst = fs.lstatSync(full);
    if (item.type === 'symlink') {
      if (!lst.isSymbolicLink()) fail('C2_CAPSULE_MANIFEST_MISMATCH', `not symlink ${item.path}`);
      const target = fs.readlinkSync(full);
      if (target !== item.symlinkTarget) {
        fail('C2_CAPSULE_MANIFEST_MISMATCH', `symlink target ${item.path}`);
      }
      continue;
    }
    if (!lst.isFile()) fail('C2_CAPSULE_MANIFEST_MISMATCH', `not file ${item.path}`);
    if (Number(lst.size) !== Number(item.size)) {
      fail('C2_CAPSULE_MANIFEST_MISMATCH', `size ${item.path}`);
    }
    const digest = sha256File(full);
    if (digest !== item.sha256) {
      fail('C2_CAPSULE_MANIFEST_MISMATCH', `hash ${item.path}`);
    }
  }
  const listed = new Set(items.map((item) => item.path));
  for (const rel of listNonManifestFiles(root)) {
    if (!listed.has(rel)) {
      fail('C2_CAPSULE_MANIFEST_MISMATCH', `unlisted ${rel}`);
    }
  }
  const inventoryPath = path.join(root, 'manifests', 'capsule-manifest.json');
  if (fs.existsSync(inventoryPath)) {
    const manifest = JSON.parse(fs.readFileSync(inventoryPath, 'utf8'));
    if (manifest.nodePgMigrateVersion !== NODE_PG_MIGRATE_VERSION) {
      fail('C2_CAPSULE_VERSION_MISMATCH', manifest.nodePgMigrateVersion);
    }
    if (manifest.pgVersion !== PG_VERSION) {
      fail('C2_CAPSULE_VERSION_MISMATCH', manifest.pgVersion);
    }
    if (manifest.nodeVersionRequired !== EXPECTED_NODE) {
      fail('C2_CAPSULE_NODE_VERSION_MISMATCH', manifest.nodeVersionRequired);
    }
    const lockPath = path.join(root, 'package-lock.json');
    const lockSha = sha256File(lockPath);
    if (manifest.packageLockSha256 && manifest.packageLockSha256 !== lockSha) {
      fail('C2_CAPSULE_MANIFEST_MISMATCH', 'package-lock SHA256');
    }
  }
  return { present: true, count: items.length };
}

function assertNoDbApiImported() {
  const handles = process._getActiveHandles?.() || [];
  for (const handle of handles) {
    if (handle instanceof net.Socket && handle.remoteAddress) {
      fail('C2_CAPSULE_SELF_TEST_FAILED', 'unexpected network handle');
    }
  }
}

function main() {
  try {
    if (process.argv.slice(2).length !== 0) {
      fail('C2_CAPSULE_SELF_TEST_FAILED', 'c2-self-test accepts no arguments');
    }
    const root = capsuleRootFrom(import.meta.url);
    assertNodeContract();
    assertNodePathUnset();
    assertPackageVersions(root);
    assertModuleIsolation(root);
    localMigrateBin(root);
    const native = scanNativeAndUnsafe(root);
    const manifest = verifyFileManifest(root);
    assertNoDbApiImported();
    console.log(
      JSON.stringify({
        ok: true,
        node: process.version,
        platform: process.platform,
        arch: process.arch,
        nodePgMigrate: NODE_PG_MIGRATE_VERSION,
        pg: PG_VERSION,
        expectedNode: EXPECTED_NODE,
        expectedPlatform: EXPECTED_PLATFORM,
        expectedArch: EXPECTED_ARCH,
        native,
        manifest,
      }),
    );
  } catch (error) {
    if (error && error.message && String(error.message).startsWith('C2_CAPSULE_')) {
      throw error;
    }
    fail('C2_CAPSULE_SELF_TEST_FAILED', error.stack || error.message);
  }
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
  main();
}
