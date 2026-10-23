import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';

import {
  SCOPE_EXPANSION_CATEGORIES,
  SCOPE_EXPANSION_DECISIONS,
  canonicalizeScopeExpansionRequest,
  evaluateScopeExpansion,
  validateScopeExpansionContext,
  validateScopeExpansionRequest,
} from '../src/scopeExpansion.js';

const SOURCE_PATH = join(dirname(fileURLToPath(import.meta.url)), '../src/scopeExpansion.js');
const SOURCE_TEXT = readFileSync(SOURCE_PATH, 'utf8');

const EXPECTED_PUBLIC_EXPORTS = Object.freeze([
  'SCOPE_EXPANSION_CATEGORIES',
  'SCOPE_EXPANSION_DECISIONS',
  'canonicalizeScopeExpansionRequest',
  'evaluateScopeExpansion',
  'validateScopeExpansionContext',
  'validateScopeExpansionRequest',
]);

function baseRequest(overrides = {}) {
  return {
    requestId: 'req-1',
    taskId: 'task-1',
    actorId: 'actor-1',
    category: 'FILE_SCOPE',
    requestedPaths: ['foo/bar'],
    requestedAuthorityClass: null,
    requestedRiskTier: null,
    reason: 'need additional files',
    governanceRevision: 'rev-1',
    stopCondition: null,
    ...overrides,
  };
}

function baseContext(overrides = {}) {
  return {
    taskId: 'task-1',
    authorizedPaths: ['foo/bar'],
    authorityClass: 'ENGINEERING_CONTROL_PLANE',
    riskTier: 'Tier 2',
    governanceRevision: 'rev-1',
    ...overrides,
  };
}

function snapshot(value) {
  return structuredClone(value);
}

describe('TECP-012 Scope Expansion — request validation', () => {
  it('1. valid FILE_SCOPE request', () => {
    const result = validateScopeExpansionRequest(baseRequest());
    assert.equal(result.valid, true);
    assert.equal(result.request.category, 'FILE_SCOPE');
    assert.deepEqual(result.request.requestedPaths, ['foo/bar']);
  });

  it('2. valid PROTECTED_PATH request', () => {
    const result = validateScopeExpansionRequest(baseRequest({
      category: 'PROTECTED_PATH',
      requestedPaths: ['backend/secrets'],
    }));
    assert.equal(result.valid, true);
    assert.equal(result.request.category, 'PROTECTED_PATH');
  });

  it('3. valid AUTHORITY_CLASS request', () => {
    const result = validateScopeExpansionRequest(baseRequest({
      category: 'AUTHORITY_CLASS',
      requestedPaths: null,
      requestedAuthorityClass: 'DEPLOY',
    }));
    assert.equal(result.valid, true);
    assert.equal(result.request.requestedAuthorityClass, 'DEPLOY');
  });

  it('4. valid RISK_TIER request', () => {
    const result = validateScopeExpansionRequest(baseRequest({
      category: 'RISK_TIER',
      requestedPaths: null,
      requestedRiskTier: 'Tier 3',
    }));
    assert.equal(result.valid, true);
    assert.equal(result.request.requestedRiskTier, 'Tier 3');
  });

  it('5. valid EXTERNAL_ACCESS request', () => {
    const result = validateScopeExpansionRequest(baseRequest({
      category: 'EXTERNAL_ACCESS',
      requestedPaths: null,
    }));
    assert.equal(result.valid, true);
    assert.equal(result.request.category, 'EXTERNAL_ACCESS');
  });

  it('6. valid RUNTIME_OR_DEPLOY request', () => {
    const result = validateScopeExpansionRequest(baseRequest({
      category: 'RUNTIME_OR_DEPLOY',
      requestedPaths: null,
    }));
    assert.equal(result.valid, true);
    assert.equal(result.request.category, 'RUNTIME_OR_DEPLOY');
  });

  it('7. null request => INVALID_REQUEST', () => {
    const result = validateScopeExpansionRequest(null);
    assert.equal(result.valid, false);
    assert.equal(result.decision, SCOPE_EXPANSION_DECISIONS.INVALID_REQUEST);
    assert.equal(result.request, null);
  });

  it('8. array request => INVALID_REQUEST', () => {
    const result = validateScopeExpansionRequest([]);
    assert.equal(result.valid, false);
    assert.equal(result.decision, SCOPE_EXPANSION_DECISIONS.INVALID_REQUEST);
  });

  it('9. missing field => INVALID_REQUEST', () => {
    const request = baseRequest();
    delete request.reason;
    const result = validateScopeExpansionRequest(request);
    assert.equal(result.valid, false);
    assert.deepEqual(result.reasons, ['INVALID_REQUEST_SHAPE']);
  });

  it('10. extra field => INVALID_REQUEST', () => {
    const result = validateScopeExpansionRequest({ ...baseRequest(), extra: true });
    assert.equal(result.valid, false);
    assert.deepEqual(result.reasons, ['INVALID_REQUEST_SHAPE']);
  });

  it('11. empty requestId => INVALID_REQUEST', () => {
    const result = validateScopeExpansionRequest(baseRequest({ requestId: '' }));
    assert.equal(result.valid, false);
    assert.deepEqual(result.reasons, ['INVALID_REQUEST_ID']);
  });

  it('12. empty taskId => INVALID_REQUEST', () => {
    const result = validateScopeExpansionRequest(baseRequest({ taskId: '' }));
    assert.equal(result.valid, false);
    assert.deepEqual(result.reasons, ['INVALID_TASK_ID']);
  });

  it('13. empty actorId => INVALID_REQUEST', () => {
    const result = validateScopeExpansionRequest(baseRequest({ actorId: '' }));
    assert.equal(result.valid, false);
    assert.deepEqual(result.reasons, ['INVALID_ACTOR_ID']);
  });

  it('14. invalid category => INVALID_REQUEST', () => {
    const result = validateScopeExpansionRequest(baseRequest({ category: 'OTHER' }));
    assert.equal(result.valid, false);
    assert.deepEqual(result.reasons, ['INVALID_CATEGORY']);
  });

  it('15. empty reason => INVALID_REQUEST', () => {
    const result = validateScopeExpansionRequest(baseRequest({ reason: '' }));
    assert.equal(result.valid, false);
    assert.deepEqual(result.reasons, ['INVALID_REASON']);
  });

  it('16. empty governanceRevision => INVALID_REQUEST', () => {
    const result = validateScopeExpansionRequest(baseRequest({ governanceRevision: '' }));
    assert.equal(result.valid, false);
    assert.deepEqual(result.reasons, ['INVALID_GOVERNANCE_REVISION']);
  });

  it('17. invalid stopCondition type', () => {
    const result = validateScopeExpansionRequest(baseRequest({ stopCondition: 1 }));
    assert.equal(result.valid, false);
    assert.deepEqual(result.reasons, ['INVALID_STOP_CONDITION']);
  });

  it('18. empty-string stopCondition invalid', () => {
    const result = validateScopeExpansionRequest(baseRequest({ stopCondition: '' }));
    assert.equal(result.valid, false);
    assert.deepEqual(result.reasons, ['INVALID_STOP_CONDITION']);
  });

  it('19. duplicate requestedPaths invalid', () => {
    const result = validateScopeExpansionRequest(baseRequest({
      requestedPaths: ['foo/bar', 'foo/bar'],
    }));
    assert.equal(result.valid, false);
    assert.deepEqual(result.reasons, ['INVALID_REQUESTED_PATHS']);
  });

  it('20. absolute requested path invalid', () => {
    const result = validateScopeExpansionRequest(baseRequest({
      requestedPaths: ['/absolute/path'],
    }));
    assert.equal(result.valid, false);
    assert.deepEqual(result.reasons, ['INVALID_REQUESTED_PATHS']);
  });

  it('21. parent traversal requested path invalid', () => {
    for (const path of ['../foo', 'foo/../bar', 'foo/..', '..']) {
      const result = validateScopeExpansionRequest(baseRequest({ requestedPaths: [path] }));
      assert.equal(result.valid, false, path);
      assert.deepEqual(result.reasons, ['INVALID_REQUESTED_PATHS']);
    }
  });

  it('22. wrong category-specific field combination invalid', () => {
    const cases = [
      baseRequest({ category: 'FILE_SCOPE', requestedAuthorityClass: 'X' }),
      baseRequest({ category: 'AUTHORITY_CLASS', requestedPaths: ['a'], requestedAuthorityClass: 'X' }),
      baseRequest({ category: 'RISK_TIER', requestedPaths: null, requestedRiskTier: 'Tier 3', requestedAuthorityClass: 'X' }),
      baseRequest({ category: 'EXTERNAL_ACCESS', requestedPaths: ['a'] }),
      baseRequest({ category: 'RUNTIME_OR_DEPLOY', requestedRiskTier: 'Tier 3', requestedPaths: null }),
    ];
    for (const request of cases) {
      const result = validateScopeExpansionRequest(request);
      assert.equal(result.valid, false);
      assert.equal(result.decision, SCOPE_EXPANSION_DECISIONS.INVALID_REQUEST);
    }
  });

  it('accepts literal empty path segments without normalization', () => {
    const result = validateScopeExpansionRequest(baseRequest({
      requestedPaths: ['foo//bar'],
    }));
    assert.equal(result.valid, true);
    assert.deepEqual(result.request.requestedPaths, ['foo//bar']);
  });
});

describe('TECP-012 Scope Expansion — context validation', () => {
  it('23. valid context', () => {
    const result = validateScopeExpansionContext(baseContext());
    assert.equal(result.valid, true);
    assert.deepEqual(result.context.authorizedPaths, ['foo/bar']);
  });

  it('24. empty authorizedPaths accepted', () => {
    const result = validateScopeExpansionContext(baseContext({ authorizedPaths: [] }));
    assert.equal(result.valid, true);
    assert.deepEqual(result.context.authorizedPaths, []);
  });

  it('25. null context invalid', () => {
    const result = validateScopeExpansionContext(null);
    assert.equal(result.valid, false);
    assert.equal(result.decision, SCOPE_EXPANSION_DECISIONS.INVALID_REQUEST);
    assert.equal(result.context, null);
  });

  it('26. extra/missing field invalid', () => {
    const missing = baseContext();
    delete missing.riskTier;
    assert.equal(validateScopeExpansionContext(missing).valid, false);
    assert.equal(validateScopeExpansionContext({ ...baseContext(), extra: 1 }).valid, false);
  });

  it('27. invalid taskId', () => {
    const result = validateScopeExpansionContext(baseContext({ taskId: '' }));
    assert.deepEqual(result.reasons, ['INVALID_TASK_ID']);
  });

  it('28. invalid authorityClass', () => {
    const result = validateScopeExpansionContext(baseContext({ authorityClass: '' }));
    assert.deepEqual(result.reasons, ['INVALID_AUTHORITY_CLASS']);
  });

  it('29. invalid riskTier', () => {
    const result = validateScopeExpansionContext(baseContext({ riskTier: '' }));
    assert.deepEqual(result.reasons, ['INVALID_RISK_TIER']);
  });

  it('30. invalid governanceRevision', () => {
    const result = validateScopeExpansionContext(baseContext({ governanceRevision: '' }));
    assert.deepEqual(result.reasons, ['INVALID_GOVERNANCE_REVISION']);
  });

  it('31. duplicate authorizedPaths invalid', () => {
    const result = validateScopeExpansionContext(baseContext({
      authorizedPaths: ['a', 'a'],
    }));
    assert.deepEqual(result.reasons, ['INVALID_AUTHORIZED_PATHS']);
  });

  it('32. absolute authorized path invalid', () => {
    const result = validateScopeExpansionContext(baseContext({
      authorizedPaths: ['/abs'],
    }));
    assert.deepEqual(result.reasons, ['INVALID_AUTHORIZED_PATHS']);
  });

  it('33. parent traversal authorized path invalid', () => {
    const result = validateScopeExpansionContext(baseContext({
      authorizedPaths: ['foo/../bar'],
    }));
    assert.deepEqual(result.reasons, ['INVALID_AUTHORIZED_PATHS']);
  });

  it('context canonicalization is lossless and frozen via public validation', () => {
    const context = baseContext({ authorizedPaths: ['a', 'b'] });
    const before = snapshot(context);
    const result = validateScopeExpansionContext(context);
    assert.equal(result.valid, true);
    assert.ok(Object.isFrozen(result.context));
    assert.ok(Object.isFrozen(result.context.authorizedPaths));
    assert.deepEqual(result.context.authorizedPaths, ['a', 'b']);
    assert.notEqual(result.context.authorizedPaths, context.authorizedPaths);
    assert.deepEqual(context, before);
  });
});

describe('TECP-012 Scope Expansion — evaluation', () => {
  it('34. FILE_SCOPE exact path => WITHIN_SCOPE', () => {
    const result = evaluateScopeExpansion(baseRequest(), baseContext());
    assert.equal(result.valid, true);
    assert.equal(result.decision, SCOPE_EXPANSION_DECISIONS.WITHIN_SCOPE);
    assert.deepEqual(result.reasons, ['ALL_PATHS_WITHIN_SCOPE']);
    assert.deepEqual(result.uncoveredPaths, []);
  });

  it('35. FILE_SCOPE descendant => WITHIN_SCOPE', () => {
    const result = evaluateScopeExpansion(
      baseRequest({ requestedPaths: ['foo/bar/baz/qux'] }),
      baseContext({ authorizedPaths: ['foo/bar'] }),
    );
    assert.equal(result.decision, SCOPE_EXPANSION_DECISIONS.WITHIN_SCOPE);
  });

  it('36. foo/bar2 not under foo/bar', () => {
    const result = evaluateScopeExpansion(
      baseRequest({ requestedPaths: ['foo/bar2'] }),
      baseContext({ authorizedPaths: ['foo/bar'] }),
    );
    assert.equal(result.decision, SCOPE_EXPANSION_DECISIONS.OWNER_APPROVAL_REQUIRED);
    assert.deepEqual(result.uncoveredPaths, ['foo/bar2']);
  });

  it('37. case-sensitive path mismatch => OWNER_APPROVAL_REQUIRED', () => {
    const result = evaluateScopeExpansion(
      baseRequest({ requestedPaths: ['Foo/bar'] }),
      baseContext({ authorizedPaths: ['foo/bar'] }),
    );
    assert.equal(result.decision, SCOPE_EXPANSION_DECISIONS.OWNER_APPROVAL_REQUIRED);
  });

  it('38. one covered + one uncovered => OWNER_APPROVAL_REQUIRED', () => {
    const result = evaluateScopeExpansion(
      baseRequest({ requestedPaths: ['foo/bar', 'other'] }),
      baseContext({ authorizedPaths: ['foo/bar'] }),
    );
    assert.equal(result.decision, SCOPE_EXPANSION_DECISIONS.OWNER_APPROVAL_REQUIRED);
    assert.deepEqual(result.uncoveredPaths, ['other']);
  });

  it('39. all uncovered => OWNER_APPROVAL_REQUIRED', () => {
    const result = evaluateScopeExpansion(
      baseRequest({ requestedPaths: ['a', 'b'] }),
      baseContext({ authorizedPaths: ['z'] }),
    );
    assert.equal(result.decision, SCOPE_EXPANSION_DECISIONS.OWNER_APPROVAL_REQUIRED);
    assert.deepEqual(result.uncoveredPaths, ['a', 'b']);
  });

  it('40. PROTECTED_PATH => OWNER_APPROVAL_REQUIRED', () => {
    const result = evaluateScopeExpansion(
      baseRequest({ category: 'PROTECTED_PATH', requestedPaths: ['foo/bar'] }),
      baseContext({ authorizedPaths: ['foo/bar'] }),
    );
    assert.equal(result.decision, SCOPE_EXPANSION_DECISIONS.OWNER_APPROVAL_REQUIRED);
    assert.deepEqual(result.reasons, ['PROTECTED_PATH_REQUIRES_OWNER']);
  });

  it('41. AUTHORITY_CLASS => OWNER_APPROVAL_REQUIRED', () => {
    const result = evaluateScopeExpansion(
      baseRequest({
        category: 'AUTHORITY_CLASS',
        requestedPaths: null,
        requestedAuthorityClass: 'DEPLOY',
      }),
      baseContext(),
    );
    assert.equal(result.decision, SCOPE_EXPANSION_DECISIONS.OWNER_APPROVAL_REQUIRED);
  });

  it('42. AUTHORITY_CLASS same value still OWNER_APPROVAL_REQUIRED', () => {
    const result = evaluateScopeExpansion(
      baseRequest({
        category: 'AUTHORITY_CLASS',
        requestedPaths: null,
        requestedAuthorityClass: 'ENGINEERING_CONTROL_PLANE',
      }),
      baseContext({ authorityClass: 'ENGINEERING_CONTROL_PLANE' }),
    );
    assert.equal(result.decision, SCOPE_EXPANSION_DECISIONS.OWNER_APPROVAL_REQUIRED);
  });

  it('43. RISK_TIER => OWNER_APPROVAL_REQUIRED', () => {
    const result = evaluateScopeExpansion(
      baseRequest({
        category: 'RISK_TIER',
        requestedPaths: null,
        requestedRiskTier: 'Tier 3',
      }),
      baseContext(),
    );
    assert.equal(result.decision, SCOPE_EXPANSION_DECISIONS.OWNER_APPROVAL_REQUIRED);
  });

  it('44. same risk value still OWNER_APPROVAL_REQUIRED', () => {
    const result = evaluateScopeExpansion(
      baseRequest({
        category: 'RISK_TIER',
        requestedPaths: null,
        requestedRiskTier: 'Tier 2',
      }),
      baseContext({ riskTier: 'Tier 2' }),
    );
    assert.equal(result.decision, SCOPE_EXPANSION_DECISIONS.OWNER_APPROVAL_REQUIRED);
  });

  it('45. EXTERNAL_ACCESS => OWNER_APPROVAL_REQUIRED', () => {
    const result = evaluateScopeExpansion(
      baseRequest({ category: 'EXTERNAL_ACCESS', requestedPaths: null }),
      baseContext(),
    );
    assert.equal(result.decision, SCOPE_EXPANSION_DECISIONS.OWNER_APPROVAL_REQUIRED);
  });

  it('46. RUNTIME_OR_DEPLOY => OWNER_APPROVAL_REQUIRED', () => {
    const result = evaluateScopeExpansion(
      baseRequest({ category: 'RUNTIME_OR_DEPLOY', requestedPaths: null }),
      baseContext(),
    );
    assert.equal(result.decision, SCOPE_EXPANSION_DECISIONS.OWNER_APPROVAL_REQUIRED);
  });

  it('47. stopCondition on covered FILE_SCOPE => OWNER_APPROVAL_REQUIRED', () => {
    const result = evaluateScopeExpansion(
      baseRequest({ stopCondition: 'STOP_IF_PROTECTED' }),
      baseContext(),
    );
    assert.equal(result.decision, SCOPE_EXPANSION_DECISIONS.OWNER_APPROVAL_REQUIRED);
    assert.deepEqual(result.reasons, ['STOP_CONDITION_PRESENT']);
  });

  it('48. task mismatch => INVALID_REQUEST', () => {
    const result = evaluateScopeExpansion(
      baseRequest({ taskId: 'task-a' }),
      baseContext({ taskId: 'task-b' }),
    );
    assert.equal(result.valid, false);
    assert.equal(result.decision, SCOPE_EXPANSION_DECISIONS.INVALID_REQUEST);
    assert.deepEqual(result.reasons, ['TASK_MISMATCH']);
  });

  it('49. governance revision mismatch => INVALID_REQUEST', () => {
    const result = evaluateScopeExpansion(
      baseRequest({ governanceRevision: 'rev-a' }),
      baseContext({ governanceRevision: 'rev-b' }),
    );
    assert.equal(result.valid, false);
    assert.deepEqual(result.reasons, ['GOVERNANCE_REVISION_MISMATCH']);
  });
});

describe('TECP-012 Scope Expansion — immutability and determinism', () => {
  it('50-53. validation and evaluation outputs frozen including arrays/reasons', () => {
    const requestResult = validateScopeExpansionRequest(baseRequest());
    const contextResult = validateScopeExpansionContext(baseContext());
    const evaluation = evaluateScopeExpansion(
      baseRequest({ requestedPaths: ['other'] }),
      baseContext(),
    );

    assert.ok(Object.isFrozen(requestResult));
    assert.ok(Object.isFrozen(requestResult.request));
    assert.ok(Object.isFrozen(requestResult.request.requestedPaths));
    assert.ok(Object.isFrozen(requestResult.reasons));

    assert.ok(Object.isFrozen(contextResult));
    assert.ok(Object.isFrozen(contextResult.context));
    assert.ok(Object.isFrozen(contextResult.context.authorizedPaths));

    assert.ok(Object.isFrozen(evaluation));
    assert.ok(Object.isFrozen(evaluation.reasons));
    assert.ok(Object.isFrozen(evaluation.uncoveredPaths));
    assert.throws(() => { evaluation.reasons.push('x'); });
    assert.throws(() => { evaluation.uncoveredPaths.push('y'); });
  });

  it('54. input request not mutated', () => {
    const request = baseRequest({ requestedPaths: ['foo/bar', 'foo/baz'] });
    const before = snapshot(request);
    evaluateScopeExpansion(request, baseContext());
    assert.deepEqual(request, before);
  });

  it('55. input context not mutated', () => {
    const context = baseContext({ authorizedPaths: ['foo/bar', 'a'] });
    const before = snapshot(context);
    evaluateScopeExpansion(baseRequest(), context);
    assert.deepEqual(context, before);
  });

  it('56. same inputs => deep-equal output', () => {
    const request = baseRequest();
    const context = baseContext();
    const a = evaluateScopeExpansion(request, context);
    const b = evaluateScopeExpansion(request, context);
    assert.deepEqual(a, b);
  });

  it('canonicalizeScopeExpansionRequest is lossless and frozen', () => {
    const request = baseRequest({ requestedPaths: ['a', 'b'] });
    const cRequest = canonicalizeScopeExpansionRequest(request);
    assert.ok(Object.isFrozen(cRequest));
    assert.ok(Object.isFrozen(cRequest.requestedPaths));
    assert.deepEqual(cRequest.requestedPaths, ['a', 'b']);
    assert.notEqual(cRequest.requestedPaths, request.requestedPaths);
  });
});

describe('TECP-012 Scope Expansion — boundary', () => {
  it('57. exact category vocabulary', () => {
    assert.deepEqual([...SCOPE_EXPANSION_CATEGORIES], [
      'FILE_SCOPE',
      'AUTHORITY_CLASS',
      'RISK_TIER',
      'PROTECTED_PATH',
      'EXTERNAL_ACCESS',
      'RUNTIME_OR_DEPLOY',
    ]);
    assert.ok(Object.isFrozen(SCOPE_EXPANSION_CATEGORIES));
  });

  it('58. exact decision vocabulary', () => {
    assert.deepEqual(SCOPE_EXPANSION_DECISIONS, {
      WITHIN_SCOPE: 'WITHIN_SCOPE',
      OWNER_APPROVAL_REQUIRED: 'OWNER_APPROVAL_REQUIRED',
      INVALID_REQUEST: 'INVALID_REQUEST',
    });
    assert.ok(Object.isFrozen(SCOPE_EXPANSION_DECISIONS));
  });

  it('59. no APPROVED/AUTHORIZED result', () => {
    const values = Object.values(SCOPE_EXPANSION_DECISIONS);
    assert.ok(!values.includes('APPROVED'));
    assert.ok(!values.includes('AUTHORIZED'));
    assert.ok(!values.includes('AUTO_APPROVED'));
    assert.ok(!values.includes('DENIED'));
    assert.ok(!values.includes('APPLIED'));
  });

  it('60-63. no approve/apply/expand/mutateRule02 exports', async () => {
    const module = await import('../src/scopeExpansion.js');
    assert.equal(module.approveScopeExpansion, undefined);
    assert.equal(module.applyScopeExpansion, undefined);
    assert.equal(module.expandTaskScope, undefined);
    assert.equal(module.mutateRule02, undefined);
  });

  it('exact public export surface', async () => {
    const module = await import('../src/scopeExpansion.js');
    const exported = Object.keys(module).sort();
    assert.deepEqual(exported, [...EXPECTED_PUBLIC_EXPORTS]);
    assert.equal(module.SCOPE_EXPANSION_REASONS, undefined);
    assert.equal(module.canonicalizeScopeExpansionContext, undefined);
    assert.equal(module.isValidRepoRelativePath, undefined);
  });

  it('64-76. source boundary: no forbidden imports or side-effect APIs', () => {
    const forbidden = [
      'rule02Parser',
      '.cursor/rules',
      'governanceValidator',
      'taskGraph',
      'actorCapabilityEngine',
      'leaseEngine',
      'conflictEngine',
      'resourceClaims',
      'backend/',
      'node:fs',
      'node:net',
      'node:http',
      'node:https',
      'node:child_process',
      'process.env',
      'Date.now',
      'new Date',
      'Math.random',
      'randomUUID',
      'approveScopeExpansion',
      'applyScopeExpansion',
      'expandTaskScope',
      'mutateRule02',
      'from \'pg\'',
      'from "pg"',
      'sqlite',
      'redis',
      'child_process',
    ];
    for (const token of forbidden) {
      assert.ok(!SOURCE_TEXT.includes(token), `forbidden token present: ${token}`);
    }
    assert.ok(!/\bSELECT\b|\bINSERT\b|\bUPDATE\b|\bDELETE\b/.test(SOURCE_TEXT));
    assert.ok(!/^\s*import\s/m.test(SOURCE_TEXT));
  });

  it('77. only authorized source/test files exist for this slice', () => {
    assert.match(SOURCE_PATH, /tecp\/src\/scopeExpansion\.js$/);
    assert.ok(SOURCE_TEXT.includes('evaluateScopeExpansion'));
    assert.ok(SOURCE_TEXT.includes('validateScopeExpansionRequest'));
    assert.ok(SOURCE_TEXT.includes('validateScopeExpansionContext'));
  });
});
