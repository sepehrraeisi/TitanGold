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

test('checked-in Rule02 live authority invariants', () => {
  const before = readFileSync(rule02Path);
  const text = before.toString('utf8');
  const primary = (value) => String(value ?? '').split(' / ')[0].trim();
  const first = parseRule02(text);
  const second = parseRule02(text);
  assert.deepEqual(first, second);

  const ratio = /^\d+\/\d+$/;
  assert.match(first.progress.PROJECT_PROGRESS, ratio);
  assert.match(first.progress.CURRENT_STAGE_PROGRESS, ratio);
  for (const ratioValue of [first.progress.PROJECT_PROGRESS, first.progress.CURRENT_STAGE_PROGRESS]) {
    const [done, total] = ratioValue.split('/').map(Number);
    assert.equal(Number.isInteger(done) && Number.isInteger(total), true);
    assert.equal(total >= 1 && done >= 0 && done <= total, true);
  }
  for (const field of ['CURRENT_STAGE', 'NEXT_GATE', 'PROGRESS_BLOCKER']) {
    assert.equal(typeof first.progress[field], 'string');
    assert.equal(first.progress[field].length > 0, true);
  }

  const identifiers = first.authority.activeSliceIdentifiers;
  assert.equal(Array.isArray(identifiers), true);
  assert.equal(identifiers.length, 1);
  const activeSlice = identifiers[0];
  assert.equal(typeof activeSlice, 'string');
  assert.equal(activeSlice.length > 0, true);
  assert.equal(activeSlice, primary(first.tecp.TECP_AUTHORIZED_SLICE));
  assert.equal(activeSlice, primary(first.authority.activeWorkPackage.sliceId));
  assert.equal(activeSlice, primary(first.authority.activeWorkPackage.officialName));
  assert.equal(first.authority.activeWorkPackage.domain, 'tecp');
  assert.equal(first.diagnostics.activeRegions.filter((region) => region === 'activeWorkPackage').length, 1);

  const artemisSlice = primary(first.artemis.AUTHORIZED_SLICE);
  assert.equal(artemisSlice.length > 0, true);
  assert.notEqual(artemisSlice, activeSlice);
  assert.equal(identifiers.includes(artemisSlice), false);

  const diagnosticText = JSON.stringify(first.diagnostics);
  for (const code of ['DUPLICATE_ACTIVE_AUTHORITY', 'CONTRADICTORY_AUTHORIZATION', 'AMBIGUOUS_ACTIVE_SECTION', 'MALFORMED_RULE02']) {
    assert.equal(diagnosticText.includes(code), false);
  }

  const after = readFileSync(rule02Path);
  assert.deepEqual(before, after);
  assert.equal(text, before.toString('utf8'));
});

const STRUCTURED_YES = 'YES / EXACT_SLICE_ONLY / EFFECTIVE_AFTER_THIS_GOVERNANCE_PR_MERGES';
const STRUCTURED_SCOPE = 'tecp/src/rule02Parser.js | tecp/test/rule02Parser.test.js | tecp/test/fixtures/';
const STRUCTURED_PATHS = 'tecp/src/config.js | tecp/src/service.js';
const STRUCTURED_STOPS = 'SECOND_PARSER_OWNER | EXTERNAL_DEPENDENCY_REQUIRED';
const STRUCTURED_RULE = 'CLOSED_FROZEN_VERIFIED_CONSUMES_PRIOR_IMPLEMENTATION_AUTHORIZATION';

function structuredDocument(overrides = {}, options = {}) {
  const facts = {
    RISK_TIER: 'Tier 2',
    AUTHORITY_CLASS: 'ENGINEERING_CONTROL_PLANE',
    AUTHORIZED_FILE_SCOPE: STRUCTURED_SCOPE,
    PROTECTED_PATHS: STRUCTURED_PATHS,
    STOP_CONDITIONS: STRUCTURED_STOPS,
    IMPLEMENTATION_START_CONDITIONS: 'THIS_GOVERNANCE_PR_MERGED',
    COMPLETION_GATE: 'TECP005A_STRUCTURED_GOVERNANCE_FACTS_COMPLETE',
    COMPLETION_GATE_STATUS: 'NOT_REACHED',
    LIFECYCLE_PRECEDENCE_RULE: STRUCTURED_RULE,
    TECP005_PRIOR_IMPLEMENTATION_AUTHORIZATION: 'CONSUMED / NON-ACTIVE',
    PRIOR_SLICE: 'TECP-005-RULE02-PARSER',
    TECP_005_STATUS: 'CLOSED / FROZEN / VERIFIED',
    IMPLEMENTATION_AUTHORIZED: STRUCTURED_YES,
    ...overrides,
  };
  const lines = [];
  for (const [key, value] of Object.entries(facts)) {
    if (value === null) continue;
    if (key === 'PROTECTED_PATHS') lines.push(`${key} = ${value}`);
    else lines.push(`**${key} = ${value}**`);
  }
  return `## Canonical Project Progress Snapshot
**PROJECT_PROGRESS = 4/10**
**CURRENT_STAGE = ARTEMIS_CORE_STAGE_11_PAPER_SIMULATED_FULL_CHAIN_READINESS**
**CURRENT_STAGE_PROGRESS = 11/15**
**NEXT_GATE = STAGE11_GOVERNANCE_DISCOVERY**
**PROGRESS_BLOCKER = NONE**
**TECP_AUTHORIZED_SLICE = TECP-005A-RULE02-STRUCTURED-GOVERNANCE-FACTS**
**TECP_IMPLEMENTATION_AUTHORIZED = NO / UNTIL_THIS_GOVERNANCE_PR_MERGES**
**AUTHORIZED_SLICE = NONE / NO_ACTIVE_IMPLEMENTATION_AUTHORIZATION**

### Active Work Package — TECP-005A
**SLICE_ID = TECP-005A-RULE02-STRUCTURED-GOVERNANCE-FACTS**
**OFFICIAL_NAME = TECP_005A_RULE02_STRUCTURED_GOVERNANCE_FACTS**
**TECP_AUTHORIZED_SLICE = TECP-005A-RULE02-STRUCTURED-GOVERNANCE-FACTS**
${lines.join('\n')}
${options.awpExtra || ''}

## Next Owner gate
**TECP_NEXT_GATE = TECP-005A-RULE02-STRUCTURED-GOVERNANCE-FACTS**
${options.tail || ''}
`;
}

test('structured RISK_TIER extraction', () => {
  const parsed = parseRule02(structuredDocument());
  assert.equal(parsed.governanceFacts.riskTier, 'Tier 2');
});

test('structured AUTHORITY_CLASS extraction', () => {
  const parsed = parseRule02(structuredDocument());
  assert.equal(parsed.governanceFacts.authorityClass, 'ENGINEERING_CONTROL_PLANE');
});

test('authorized file scope array extraction', () => {
  const parsed = parseRule02(structuredDocument());
  assert.deepEqual(parsed.governanceFacts.authorizedFileScope, [
    'tecp/src/rule02Parser.js',
    'tecp/test/rule02Parser.test.js',
    'tecp/test/fixtures/',
  ]);
});

test('protected paths array extraction', () => {
  const parsed = parseRule02(structuredDocument());
  assert.deepEqual(parsed.governanceFacts.protectedPaths, [
    'tecp/src/config.js',
    'tecp/src/service.js',
  ]);
});

test('stop conditions array extraction', () => {
  const parsed = parseRule02(structuredDocument());
  assert.deepEqual(parsed.governanceFacts.stopConditions, [
    'SECOND_PARSER_OWNER',
    'EXTERNAL_DEPENDENCY_REQUIRED',
  ]);
});

test('implementation start conditions extraction', () => {
  const parsed = parseRule02(structuredDocument());
  assert.equal(parsed.governanceFacts.implementationStartConditions, 'THIS_GOVERNANCE_PR_MERGED');
});

test('completion gate extraction', () => {
  const parsed = parseRule02(structuredDocument());
  assert.equal(parsed.governanceFacts.completionGate, 'TECP005A_STRUCTURED_GOVERNANCE_FACTS_COMPLETE');
});

test('completion gate status extraction', () => {
  const parsed = parseRule02(structuredDocument());
  assert.equal(parsed.governanceFacts.completionGateStatus, 'NOT_REACHED');
});

test('lifecycle precedence output', () => {
  const parsed = parseRule02(structuredDocument());
  assert.equal(parsed.lifecyclePrecedence.rule, STRUCTURED_RULE);
  assert.equal(parsed.lifecyclePrecedence.consumedSlice, 'TECP-005-RULE02-PARSER');
  assert.equal(parsed.lifecyclePrecedence.status, 'CLOSED / FROZEN / VERIFIED');
});

test('consumed authorization effective-state behavior', () => {
  const parsed = parseRule02(structuredDocument());
  assert.equal(parsed.lifecyclePrecedence.implementationAuthorizationEffective, 'CONSUMED / NON-ACTIVE');
});

test('raw implementation authorization preserved', () => {
  const parsed = parseRule02(structuredDocument());
  assert.equal(parsed.lifecyclePrecedence.rawImplementationAuthorization, STRUCTURED_YES);
  assert.equal(parsed.tecp.implementationAuthorizationState.activeWorkPackage, STRUCTURED_YES);
});

test('historical structured governance values ignored', () => {
  const parsed = parseRule02(structuredDocument({}, {
    tail: `### Historical — older structured facts
**RISK_TIER = Tier 1**
**AUTHORIZED_FILE_SCOPE = backend/legacy.js**`,
  }));
  assert.equal(parsed.governanceFacts.riskTier, 'Tier 2');
  assert.deepEqual(parsed.governanceFacts.authorizedFileScope, [
    'tecp/src/rule02Parser.js',
    'tecp/test/rule02Parser.test.js',
    'tecp/test/fixtures/',
  ]);
});

test('closeout structured governance values ignored', () => {
  const parsed = parseRule02(structuredDocument({}, {
    tail: `### TECP structured facts CLOSEOUT
**RISK_TIER = Tier 9**
**AUTHORITY_CLASS = HISTORICAL_ONLY**`,
  }));
  assert.equal(parsed.governanceFacts.riskTier, 'Tier 2');
  assert.equal(parsed.governanceFacts.authorityClass, 'ENGINEERING_CONTROL_PLANE');
});

test('superseded structured governance values ignored', () => {
  const parsed = parseRule02(structuredDocument({}, {
    tail: `### Active Work Package — prior slice SUPERSEDED AS ACTIVE AUTHORITY
**RISK_TIER = Tier 9**
**AUTHORIZED_FILE_SCOPE = superseded/path.js**`,
  }));
  assert.equal(parsed.governanceFacts.riskTier, 'Tier 2');
  assert.deepEqual(parsed.governanceFacts.authorizedFileScope[0], 'tecp/src/rule02Parser.js');
});

test('missing required governance fact fails closed', () => {
  assert.throws(
    () => parseRule02(structuredDocument({ RISK_TIER: null })),
    (error) => error instanceof Rule02ParseError && error.code === ERROR_CODES.MISSING_REQUIRED_GOVERNANCE_FACT,
  );
  assert.throws(
    () => parseRule02(structuredDocument({ LIFECYCLE_PRECEDENCE_RULE: null })),
    (error) => error instanceof Rule02ParseError && error.code === ERROR_CODES.MISSING_REQUIRED_GOVERNANCE_FACT,
  );
  assert.throws(
    () => parseRule02(structuredDocument({ TECP005_PRIOR_IMPLEMENTATION_AUTHORIZATION: null })),
    (error) => error instanceof Rule02ParseError && error.code === ERROR_CODES.MISSING_REQUIRED_GOVERNANCE_FACT,
  );
});

test('conflicting active governance fact fails closed', () => {
  assert.throws(
    () => parseRule02(structuredDocument({}, { awpExtra: '**RISK_TIER = Tier 9**' })),
    (error) => error instanceof Rule02ParseError && error.code === ERROR_CODES.CONFLICTING_ACTIVE_GOVERNANCE_FACT,
  );
  assert.throws(
    () => parseRule02(structuredDocument({ TECP_005_STATUS: 'OPEN / NOT_CLOSED' })),
    (error) => error instanceof Rule02ParseError && error.code === ERROR_CODES.CONFLICTING_ACTIVE_GOVERNANCE_FACT,
  );
  assert.throws(
    () => parseRule02(structuredDocument({
      TECP005_PRIOR_IMPLEMENTATION_AUTHORIZATION: 'YES / STILL_ACTIVE',
    })),
    (error) => error instanceof Rule02ParseError && error.code === ERROR_CODES.CONFLICTING_ACTIVE_GOVERNANCE_FACT,
  );
  assert.throws(
    () => parseRule02(structuredDocument({
      LIFECYCLE_PRECEDENCE_RULE: 'SOME_OTHER_RULE',
    })),
    (error) => error instanceof Rule02ParseError && error.code === ERROR_CODES.CONFLICTING_ACTIVE_GOVERNANCE_FACT,
  );
});

test('TECP and Artemis independence preserved with structured facts', () => {
  const parsed = parseRule02(structuredDocument());
  assert.equal(parsed.tecp.TECP_AUTHORIZED_SLICE, 'TECP-005A-RULE02-STRUCTURED-GOVERNANCE-FACTS');
  assert.equal(parsed.artemis.AUTHORIZED_SLICE, 'NONE / NO_ACTIVE_IMPLEMENTATION_AUTHORIZATION');
  assert.equal(JSON.stringify(parsed.tecp).includes('TECP-006'), false);
});

test('current canonical Rule02 structured governance facts', () => {
  const before = readFileSync(rule02Path);
  const text = before.toString('utf8');
  const primary = (value) => String(value ?? '').split(' / ')[0].trim();
  const nonEmptyString = (value) => typeof value === 'string' && value.trim().length > 0;
  const denseStringArray = (value) => Array.isArray(value)
    && value.every((member) => typeof member === 'string' && member.trim().length > 0);

  const first = parseRule02(text);
  const second = parseRule02(text);
  assert.deepEqual(first, second);

  const facts = first.governanceFacts;
  assert.equal(facts != null && typeof facts === 'object' && !Array.isArray(facts), true);
  assert.equal(nonEmptyString(facts.riskTier), true);
  assert.equal(nonEmptyString(facts.authorityClass), true);
  assert.equal(denseStringArray(facts.authorizedFileScope), true);
  assert.equal(facts.authorizedFileScope.length > 0, true);
  assert.equal(denseStringArray(facts.protectedPaths), true);
  assert.equal(denseStringArray(facts.stopConditions), true);
  assert.equal(nonEmptyString(facts.implementationStartConditions), true);
  assert.equal(nonEmptyString(facts.completionGate), true);
  assert.equal(nonEmptyString(facts.completionGateStatus), true);
  assert.deepEqual(facts.authorizedFileScope, second.governanceFacts.authorizedFileScope);
  assert.deepEqual(facts.protectedPaths, second.governanceFacts.protectedPaths);
  assert.deepEqual(facts.stopConditions, second.governanceFacts.stopConditions);

  const activeSlice = primary(first.tecp.TECP_AUTHORIZED_SLICE);
  const workPackage = first.authority.activeWorkPackage;
  assert.equal(activeSlice.length > 0, true);
  assert.equal(activeSlice, primary(workPackage.sliceId));
  assert.equal(activeSlice, primary(workPackage.officialName));
  assert.equal(workPackage.domain, 'tecp');

  const artemisSlice = primary(first.artemis.AUTHORIZED_SLICE);
  assert.notEqual(artemisSlice, activeSlice);
  assert.equal(first.authority.activeSliceIdentifiers.includes(artemisSlice), false);

  const diagnosticText = JSON.stringify(first.diagnostics);
  for (const code of [
    'DUPLICATE_ACTIVE_AUTHORITY',
    'CONTRADICTORY_AUTHORIZATION',
    'AMBIGUOUS_ACTIVE_SECTION',
    'MALFORMED_RULE02',
  ]) {
    assert.equal(diagnosticText.includes(code), false);
  }
  assert.equal(
    first.diagnostics.activeRegions.filter((region) => region === 'activeWorkPackage').length,
    1,
  );

  if (first.lifecyclePrecedence != null) {
    const life = first.lifecyclePrecedence;
    for (const field of [
      'rule',
      'consumedSlice',
      'rawImplementationAuthorization',
      'implementationAuthorizationEffective',
      'status',
    ]) {
      assert.equal(nonEmptyString(life[field]), true, field);
    }
    const effective = life.implementationAuthorizationEffective;
    if (/CONSUMED|NON-ACTIVE/.test(effective)) {
      assert.notEqual(primary(effective), 'YES');
    }
    assert.deepEqual(life, second.lifecyclePrecedence);
  }

  const after = readFileSync(rule02Path);
  assert.deepEqual(before, after);
  assert.equal(text, before.toString('utf8'));
});

test('deterministic repeated structured parse', () => {
  const input = structuredDocument();
  assert.deepEqual(parseRule02(input), parseRule02(input));
});

test('structured parse does not mutate input', () => {
  const input = structuredDocument();
  const before = `${input}`;
  parseRule02(input);
  assert.equal(input, before);
});

test('structured parse has zero side effects', () => {
  const cwd = process.cwd();
  parseRule02(structuredDocument());
  assert.equal(process.cwd(), cwd);
  const source = readFileSync(parserSourcePath, 'utf8');
  for (const token of FORBIDDEN_SOURCE) {
    assert.equal(source.includes(token), false);
  }
});
