import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  CANONICAL_RULE02_PATH,
  ERROR_CODES,
  Rule02ParseError,
  parseRule02,
} from '../src/rule02Parser.js';

const here = dirname(fileURLToPath(import.meta.url));
const fixtures = join(here, 'fixtures');
const parserSourcePath = join(here, '../src/rule02Parser.js');
const serviceSourcePath = join(here, '../src/service.js');
const indexSourcePath = join(here, '../src/index.js');
const packagePath = join(here, '../package.json');
const rule02Path = join(here, '../../.cursor/rules/titangold-current-active-work.mdc');

const FORBIDDEN_SOURCE = [
  "from 'node:http'",
  "from 'node:https'",
  "from 'node:net'",
  "from 'node:tls'",
  "from 'node:dns'",
  "from 'node:fs'",
  "from 'node:child_process'",
  "from 'fs'",
  "from 'http'",
  "from 'https'",
  "from 'net'",
  'fetch(',
  'writeFile',
  'appendFile',
  'unlink',
  'rmSync',
  'mkdir',
  'spawn(',
  'exec(',
  'execSync',
  'XMLHttpRequest',
  'WebSocket',
  'createService',
  "from 'pg'",
  "from 'redis'",
  'node:sqlite',
];

function load(name) {
  return readFileSync(join(fixtures, name), 'utf8');
}

function expectCode(fn, code) {
  assert.throws(fn, (error) => {
    assert.ok(error instanceof Rule02ParseError);
    assert.equal(error.code, code);
    assert.equal(error.message, code);
    return true;
  });
}

test('valid canonical-style active authority parse', () => {
  const parsed = parseRule02(load('valid-canonical.md'), {
    sourceSha: 'supplied-sha',
    revision: 'supplied-rev',
  });
  assert.deepEqual(parsed, {
    progress: {
      PROJECT_PROGRESS: '4/10',
      CURRENT_STAGE: 'ARTEMIS_CORE_STAGE_11_PAPER_SIMULATED_FULL_CHAIN_READINESS',
      CURRENT_STAGE_PROGRESS: '11/15',
      NEXT_GATE: 'STAGE11_GOVERNANCE_DISCOVERY',
      PROGRESS_BLOCKER: 'NONE',
    },
    tecp: {
      TECP_AUTHORIZED_SLICE: 'TECP-005-RULE02-PARSER / EFFECTIVE_AFTER_MERGE',
      TECP_IMPLEMENTATION_AUTHORIZED: 'NO / UNTIL_THIS_GOVERNANCE_PR_MERGES',
      TECP_NEXT_GATE: 'TECP-005-RULE02-PARSER IMPLEMENTATION',
      status: 'AUTHORIZED / NOT_STARTED / EFFECTIVE_AFTER_MERGE',
      implementationAuthorizationState: {
        TECP_IMPLEMENTATION_AUTHORIZED: 'NO / UNTIL_THIS_GOVERNANCE_PR_MERGES',
        TECP005_IMPLEMENTATION_AUTHORIZED: 'YES / EXACT_SLICE_ONLY / EFFECTIVE_AFTER_MERGE',
        activeWorkPackage: 'YES / EXACT_SLICE_ONLY / EFFECTIVE_AFTER_MERGE',
      },
    },
    artemis: {
      AUTHORIZED_SLICE: 'NONE / NO_ACTIVE_IMPLEMENTATION_AUTHORIZATION',
      STAGE10_IMPLEMENTATION_AUTHORIZED: 'NO / CLOSED',
      STAGE11_IMPLEMENTATION_AUTHORIZED: 'NO / GOVERNANCE_DISCOVERY_ONLY',
    },
    authority: {
      activeSliceIdentifiers: ['TECP-005-RULE02-PARSER'],
      activeWorkPackage: {
        heading: 'Active Work Package — TECP-005 RULE02 PARSER',
        sliceId: 'TECP-005-RULE02-PARSER',
        officialName: 'TECP-005-RULE02-PARSER',
        domain: 'tecp',
      },
      exclusion: {
        historical: 1,
        closeout: 1,
        superseded: 1,
      },
      governanceRevision: 'abc123def',
      sourceSha: 'supplied-sha',
    },
    source: {
      sha: 'supplied-sha',
      revision: 'supplied-rev',
      canonicalPath: CANONICAL_RULE02_PATH,
    },
    diagnostics: {
      notes: ['NEXT_GATE_FROM_NEXT_OWNER_GATE'],
      activeRegions: ['progressSnapshot', 'activeWorkPackage', 'nextOwnerGate'],
      excludedSectionCount: 2,
    },
  });
  assert.deepEqual(Object.keys(parsed), [
    'progress',
    'tecp',
    'artemis',
    'authority',
    'source',
    'diagnostics',
  ]);
});

test('deterministic repeated parse result', () => {
  const text = load('valid-canonical.md');
  const metadata = { sha: 'same-sha', sourceRevision: 'same-rev' };
  const first = parseRule02(text, metadata);
  const second = parseRule02(text, metadata);
  assert.equal(JSON.stringify(first), JSON.stringify(second));
  assert.throws(() => {
    first.progress.PROJECT_PROGRESS = 'changed';
  }, TypeError);
  const third = parseRule02(text, metadata);
  assert.equal(third.progress.PROJECT_PROGRESS, '4/10');
  assert.equal(third.source.sha, 'same-sha');
  assert.equal(third.source.revision, 'same-rev');
});

test('TECP and Artemis separation', () => {
  const parsed = parseRule02(load('valid-canonical.md'));
  assert.equal(parsed.tecp.TECP_AUTHORIZED_SLICE.startsWith('TECP-005-RULE02-PARSER'), true);
  assert.equal(parsed.artemis.AUTHORIZED_SLICE.startsWith('NONE'), true);
  assert.equal(
    parsed.tecp.TECP_IMPLEMENTATION_AUTHORIZED,
    'NO / UNTIL_THIS_GOVERNANCE_PR_MERGES',
  );
  assert.equal(
    parsed.tecp.implementationAuthorizationState.TECP005_IMPLEMENTATION_AUTHORIZED,
    'YES / EXACT_SLICE_ONLY / EFFECTIVE_AFTER_MERGE',
  );
  assert.equal(parsed.artemis.STAGE10_IMPLEMENTATION_AUTHORIZED, 'NO / CLOSED');
  assert.equal(parsed.artemis.STAGE11_IMPLEMENTATION_AUTHORIZED, 'NO / GOVERNANCE_DISCOVERY_ONLY');
  assert.equal(parsed.tecp.TECP_NEXT_GATE, 'TECP-005-RULE02-PARSER IMPLEMENTATION');
  assert.equal(parsed.progress.NEXT_GATE, 'STAGE11_GOVERNANCE_DISCOVERY');
});

test('progress snapshot extraction', () => {
  const parsed = parseRule02(load('valid-canonical.md'));
  assert.deepEqual(parsed.progress, {
    PROJECT_PROGRESS: '4/10',
    CURRENT_STAGE: 'ARTEMIS_CORE_STAGE_11_PAPER_SIMULATED_FULL_CHAIN_READINESS',
    CURRENT_STAGE_PROGRESS: '11/15',
    NEXT_GATE: 'STAGE11_GOVERNANCE_DISCOVERY',
    PROGRESS_BLOCKER: 'NONE',
  });
});

test('historical block ignored', () => {
  const parsed = parseRule02(load('valid-canonical.md'));
  assert.equal(parsed.authority.activeSliceIdentifiers.includes('TECP-003-SERVICE-SKELETON'), false);
  assert.equal(parsed.authority.activeSliceIdentifiers.includes('TECP-004-DATABASE-FOUNDATION'), false);
  assert.equal(parsed.tecp.TECP_IMPLEMENTATION_AUTHORIZED.includes('UNTIL_PR_174_MERGES'), false);
  assert.equal(parsed.authority.exclusion.historical, 1);
});

test('superseded block ignored', () => {
  const parsed = parseRule02(load('valid-canonical.md'));
  assert.equal(parsed.authority.exclusion.superseded, 1);
  assert.equal(parsed.authority.exclusion.closeout, 1);
  assert.equal(parsed.diagnostics.excludedSectionCount, 2);
  assert.equal(parsed.authority.activeWorkPackage.heading.includes('TECP-005'), true);
  assert.equal(parsed.authority.activeSliceIdentifiers.includes('SHOULD-NOT-APPLY'), false);
});

test('missing Rule02', () => {
  expectCode(() => parseRule02(undefined), ERROR_CODES.MISSING_RULE02);
  expectCode(() => parseRule02(null), ERROR_CODES.MISSING_RULE02);
  expectCode(() => parseRule02(''), ERROR_CODES.MISSING_RULE02);
  expectCode(() => parseRule02(' \n\t '), ERROR_CODES.MISSING_RULE02);
});

test('malformed input', () => {
  expectCode(() => parseRule02(42), ERROR_CODES.MALFORMED_RULE02);
  expectCode(() => parseRule02(load('malformed-snapshot.md')), ERROR_CODES.MALFORMED_RULE02);
  expectCode(() => parseRule02(load('valid-canonical.md'), []), ERROR_CODES.MALFORMED_RULE02);
  expectCode(() => parseRule02(load('valid-canonical.md'), { sourceSha: 7 }), ERROR_CODES.MALFORMED_RULE02);
});

test('duplicate active authority', () => {
  expectCode(() => parseRule02(load('duplicate-active-authority.md')), ERROR_CODES.DUPLICATE_ACTIVE_AUTHORITY);
});

test('contradictory authorization', () => {
  assert.throws(
    () => parseRule02(load('contradictory-authorization.md')),
    (error) => {
      assert.equal(error.code, ERROR_CODES.CONTRADICTORY_AUTHORIZATION);
      assert.equal(error.details.field, 'AUTHORIZED_SLICE');
      assert.equal(error.details.left, 'NONE / NO_ACTIVE');
      assert.equal(error.details.right, 'LIVE / AUTHORIZED');
      return true;
    },
  );
});

test('historical-only stale authority', () => {
  expectCode(() => parseRule02(load('historical-only.md')), ERROR_CODES.STALE_HISTORICAL_ONLY);
});

test('missing progress snapshot', () => {
  expectCode(() => parseRule02(load('missing-snapshot.md')), ERROR_CODES.MISSING_PROGRESS_SNAPSHOT);
  expectCode(() => parseRule02('plain text without headings'), ERROR_CODES.MISSING_PROGRESS_SNAPSHOT);
});

test('ambiguous active section', () => {
  expectCode(() => parseRule02(load('ambiguous-heading.md')), ERROR_CODES.AMBIGUOUS_ACTIVE_SECTION);
  const twoSnapshots = [
    '## Canonical Project Progress Snapshot',
    '**PROJECT_PROGRESS = 4/10**',
    '## Canonical Project Progress Snapshot',
    '**PROJECT_PROGRESS = 5/10**',
  ].join('\n');
  expectCode(() => parseRule02(twoSnapshots), ERROR_CODES.AMBIGUOUS_ACTIVE_SECTION);
});

test('source SHA and revision passthrough when supplied', () => {
  const without = parseRule02(load('valid-canonical.md'));
  assert.equal(without.source.sha, null);
  assert.equal(without.source.revision, null);
  assert.equal(without.authority.sourceSha, null);
  assert.equal(without.authority.governanceRevision, 'abc123def');
  assert.equal(without.source.canonicalPath, '.cursor/rules/titangold-current-active-work.mdc');
  const withMeta = parseRule02(load('valid-canonical.md'), {
    sourceSha: 'explicit-sha',
    revision: 'explicit-rev',
  });
  assert.equal(withMeta.source.sha, 'explicit-sha');
  assert.equal(withMeta.source.revision, 'explicit-rev');
  assert.equal(withMeta.authority.sourceSha, 'explicit-sha');
  assert.equal(withMeta.authority.governanceRevision, 'abc123def');
});

test('parser does not mutate input', () => {
  const text = load('valid-canonical.md');
  const before = text;
  const metadata = { sourceSha: 'sha', revision: 'rev', nested: { keep: true } };
  const metadataBefore = JSON.stringify(metadata);
  parseRule02(text, metadata);
  assert.equal(text, before);
  assert.equal(JSON.stringify(metadata), metadataBefore);
  assert.deepEqual(metadata.nested, { keep: true });
});

test('parser has zero network DB and filesystem write authority', () => {
  const source = readFileSync(parserSourcePath, 'utf8');
  for (const pattern of FORBIDDEN_SOURCE) {
    assert.equal(source.includes(pattern), false, pattern);
  }
  assert.equal(source.includes('rule02Parser'), false);
  const service = readFileSync(serviceSourcePath, 'utf8');
  const index = readFileSync(indexSourcePath, 'utf8');
  assert.equal(service.includes('rule02Parser'), false);
  assert.equal(index.includes('rule02Parser'), false);
  const pkg = JSON.parse(readFileSync(packagePath, 'utf8'));
  assert.equal(pkg.dependencies, undefined);
  assert.equal(pkg.devDependencies, undefined);
});

test('checked-in Rule02 exposes one normalized TECP active package', () => {
  const before = readFileSync(rule02Path);
  const text = before.toString('utf8');
  const first = parseRule02(text, { sourceSha: '9c489c60c2500d7f50ae5a258750df1a0cee1daa' });
  const second = parseRule02(text, { sourceSha: '9c489c60c2500d7f50ae5a258750df1a0cee1daa' });
  assert.deepEqual(first, second);
  assert.equal(first.progress.PROJECT_PROGRESS, '4/10');
  assert.equal(first.progress.NEXT_GATE, 'STAGE11_GOVERNANCE_DISCOVERY');
  assert.equal(first.artemis.STAGE11_IMPLEMENTATION_AUTHORIZED, 'NO / GOVERNANCE_DISCOVERY_ONLY');
  assert.equal(first.artemis.AUTHORIZED_SLICE, 'NONE / NO_ACTIVE_IMPLEMENTATION_AUTHORIZATION');
  assert.deepEqual(first.authority.activeSliceIdentifiers, ['TECP-005-RULE02-PARSER']);
  assert.equal(first.authority.activeWorkPackage.domain, 'tecp');
  assert.equal(first.authority.activeWorkPackage.sliceId, 'TECP-005-RULE02-PARSER');
  assert.equal(first.tecp.TECP_IMPLEMENTATION_AUTHORIZED, 'NO / UNTIL_THIS_GOVERNANCE_PR_MERGES');
  assert.equal(
    first.tecp.implementationAuthorizationState.TECP005_IMPLEMENTATION_AUTHORIZED,
    'YES / EXACT_SLICE_ONLY / EFFECTIVE_AFTER_THIS_GOVERNANCE_PR_MERGES',
  );
  const after = readFileSync(rule02Path);
  assert.deepEqual(before, after);
});
