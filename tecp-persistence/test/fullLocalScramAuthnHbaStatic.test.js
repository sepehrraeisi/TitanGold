/**
 * TECP-DLP-009 pure/static fail-closed HBA checks.
 * No PostgreSQL cluster is started in this test file.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

import {
  DLP009_HBA,
  DLP009_LOGIN_ROLES,
  DLP009_WRITER_ROLE,
  assertFullLocalScramHba,
} from './disposableFullLocalScramCutover.js';

const here = dirname(fileURLToPath(import.meta.url));

test('HBA exact full-local SCRAM policy accepted; host sockets rejected', () => {
  assert.equal(assertFullLocalScramHba(DLP009_HBA), true);
  assert.match(DLP009_HBA, /local all all scram-sha-256/);
  assert.match(DLP009_HBA, /host all all 0\.0\.0\.0\/0 reject/);
  assert.match(DLP009_HBA, /host all all ::\/0 reject/);
});

test('writer-only SCRAM plus local trust fallback rejected (admin bypass)', () => {
  assert.throws(
    () => assertFullLocalScramHba(
      'local all dlp_authz_composition_proof scram-sha-256\nlocal all all trust\n' +
      'host all all 0.0.0.0/0 reject\nhost all all ::/0 reject\n',
    ),
    /BLOCKED: DLP009_HBA_NOT_EXACT_SCRAM_ONLY_LOCAL_AND_HOST_REJECT/,
  );
});

test('a superuser trust entry anywhere is rejected', () => {
  assert.throws(
    () => assertFullLocalScramHba(
      'local all dlp_proof trust\n' + DLP009_HBA,
    ),
    /BLOCKED/,
  );
  assert.throws(
    () => assertFullLocalScramHba(
      DLP009_HBA + 'local all dlp_proof trust\n',
    ),
    /BLOCKED/,
  );
});

test('no md5, peer, password, include, allow-host or silently absent host reject', () => {
  const variants = [
    DLP009_HBA.replace('scram-sha-256', 'md5'),
    DLP009_HBA.replace('scram-sha-256', 'peer'),
    DLP009_HBA.replace('scram-sha-256', 'password'),
    DLP009_HBA.replace('0.0.0.0/0 reject', '0.0.0.0/0 scram-sha-256'),
    DLP009_HBA.replace('::/0 reject', '::/0 trust'),
    DLP009_HBA.replace('host all all ::/0 reject', ''),
    DLP009_HBA + 'include extra-roles.conf\n',
    DLP009_HBA + 'local replication all trust\n',
  ];
  for (const hba of variants) assert.throws(() => assertFullLocalScramHba(hba), /BLOCKED/);
  assert.throws(() => assertFullLocalScramHba(undefined), /BLOCKED/);
});

test('all six local login principals are included in strict inventory', () => {
  assert.equal(DLP009_WRITER_ROLE, 'dlp_authz_composition_proof');
  assert.deepEqual([...DLP009_LOGIN_ROLES].sort(), [
    'dlp_proof', 'dlp_authz_composition_proof', 'dlp_composition_proof',
    'dlp_audit_owner', 'dlp_audit_proof', 'dlp_sealed_restricted_caller',
  ].sort());
  assert.equal(Object.isFrozen(DLP009_LOGIN_ROLES), true);
});

test('cutover helper retains no ambient connection URL / TCP permission / trust restoration', () => {
  const helper = readFileSync(join(here, 'disposableFullLocalScramCutover.js'), 'utf8');
  assert.match(helper, /assertEnvironment\(\)/);
  assert.match(helper, /createDisposablePgHarness\(\)/);
  assert.match(helper, /assertInitialTrustHba\(/);
  assert.match(helper, /assertFullLocalScramHba\(/);
  assert.match(helper, /pg_reload_conf\(\)/);
  assert.match(helper, /pg_hba_file_rules/);
  assert.match(helper, /assertNoOtherClientSessions\(/);
  assert.match(helper, /'SERVER_PASSWORD_REJECT'/);
  assert.match(helper, /await closeClient\(bootstrap\)/);
  assert.match(helper, /await stop\(\)/);
  assert.doesNotMatch(helper, /listen_addresses\s*=\s*['"]\*['"]/);
  // Bootstrap intentionally recognizes frozen TRUST; only restoration/writing TRUST is forbidden.
  assert.doesNotMatch(helper, /writeFileSync\(\s*hbaPath\s*,\s*['"]local\s+all\s+all\s+trust/i);
  assert.doesNotMatch(helper, /process\.env\.PGPASSWORD\s*=/);
  assert.doesNotMatch(helper, /console\.(log|error|warn)\(/);
});
