/**
 * TECP-019: a presentation-only projection of an already parsed Rule02 result.
 * Not an authorization decision, capability, validator, or execution gateway.
 */
const UNKNOWN_VIEW = Object.freeze({
  tecpSliceId: 'UNKNOWN',
  nextOwnerGate: 'UNKNOWN',
  activeWorkPackageImplementationAuthorization: 'UNKNOWN',
  completionGate: 'UNKNOWN',
  completionGateStatus: 'UNKNOWN',
  effectivePermissionIndicator: 'NO_AUTHORITY',
});

const CURRENT_SLICE = 'TECP-019-LOCAL-GOVERNANCE-READ-MODEL';
const PREVIOUS_SLICE = 'TECP-018-SINGLE-CURSOR';
const LEGACY_RULE = 'CLOSED_FROZEN_VERIFIED_CONSUMES_PRIOR_IMPLEMENTATION_AUTHORIZATION';
const CURRENT_GATE = CURRENT_SLICE;
const RAW_IMPLEMENTATION = 'YES / EXACT_SLICE_ONLY / EFFECTIVE_AFTER_THIS_GOVERNANCE_PR_MERGES';
const SNAPSHOT_IMPLEMENTATION = 'NO / UNTIL_THIS_GOVERNANCE_PR_MERGES';
const START_CONDITIONS = 'THIS_GOVERNANCE_PR_MERGED / EXACT_TWO_NEW_FILES_ONLY / NO_RUNTIME_OR_MCP_SURFACE_CHANGE';
const SCOPE = Object.freeze([
  'tecp/src/governanceReadModel.js',
  'tecp/test/governanceReadModel.test.js',
]);

function plainObject(value) {
  return value !== null && typeof value === 'object'
    && !Array.isArray(value)
    && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
}

function primaryToken(value) {
  return typeof value === 'string' ? value.split(' / ', 1)[0].trim() : '';
}

function safeStatus(value, maxLength = 200) {
  return typeof value === 'string' && value.length > 0 && value.length <= maxLength
    && value.trim() === value && /^[A-Za-z0-9][A-Za-z0-9 _./-]*$/.test(value)
    && !/(?:^|[_ /-])(?:SECRET|TOKEN|PASSWORD|PRIVATE_KEY|API_KEY|AUTHORIZATION_HEADER)(?:$|[_ /-])/i.test(value);
}

function denseStringArray(value) {
  return Array.isArray(value) && value.every((item) => typeof item === 'string' && item.length > 0);
}

/**
 * Project a narrowly allowlisted status snapshot, never grant authority.
 * Bad/missing/contradictory values produce a frozen all-UNKNOWN snapshot.
 */
export function projectGovernanceReadModel(parsed) {
  try {
    if (!plainObject(parsed) || !plainObject(parsed.tecp)
      || !plainObject(parsed.authority) || !plainObject(parsed.governanceFacts)
      || !plainObject(parsed.lifecyclePrecedence)) return UNKNOWN_VIEW;

    const tecp = parsed.tecp;
    const authority = parsed.authority;
    const facts = parsed.governanceFacts;
    const lifecycle = parsed.lifecyclePrecedence;
    const awp = authority.activeWorkPackage;
    const authorization = tecp.implementationAuthorizationState;
    if (!plainObject(awp) || !plainObject(authorization)) return UNKNOWN_VIEW;

    const sliceId = primaryToken(tecp.TECP_AUTHORIZED_SLICE);
    if (sliceId !== CURRENT_SLICE || primaryToken(awp.sliceId) !== sliceId
      || primaryToken(awp.officialName) !== sliceId || awp.domain !== 'tecp') {
      return UNKNOWN_VIEW;
    }

    if (!denseStringArray(authority.activeSliceIdentifiers)
      || authority.activeSliceIdentifiers.filter((id) => id.startsWith('TECP-')).length !== 1
      || !authority.activeSliceIdentifiers.includes(sliceId)) return UNKNOWN_VIEW;

    const raw = authorization.activeWorkPackage;
    if (raw !== RAW_IMPLEMENTATION
      || tecp.TECP_IMPLEMENTATION_AUTHORIZED !== SNAPSHOT_IMPLEMENTATION
      || authorization.TECP_IMPLEMENTATION_AUTHORIZED !== tecp.TECP_IMPLEMENTATION_AUTHORIZED
      || authorization.TECP005_IMPLEMENTATION_AUTHORIZED !== RAW_IMPLEMENTATION
      || !safeStatus(tecp.TECP_IMPLEMENTATION_AUTHORIZED)
      || !safeStatus(lifecycle.rawImplementationAuthorization)
      || lifecycle.rawImplementationAuthorization !== raw) return UNKNOWN_VIEW;

    // An old compatibility authorization is never an active new permission.
    if (lifecycle.consumedSlice !== PREVIOUS_SLICE
      || lifecycle.status !== 'CLOSED / FROZEN / VERIFIED'
      || lifecycle.implementationAuthorizationEffective !== 'CONSUMED / NON-ACTIVE'
      || lifecycle.rule !== LEGACY_RULE) return UNKNOWN_VIEW;

    if (facts.authorityClass !== 'ENGINEERING_CONTROL_PLANE'
      || facts.riskTier !== 'Tier 2'
      || !denseStringArray(facts.authorizedFileScope)
      || facts.authorizedFileScope.length !== SCOPE.length
      || !SCOPE.every((file) => facts.authorizedFileScope.includes(file))
      || !denseStringArray(facts.protectedPaths) || facts.protectedPaths.length === 0
      || !denseStringArray(facts.stopConditions) || facts.stopConditions.length === 0
      || facts.implementationStartConditions !== START_CONDITIONS) return UNKNOWN_VIEW;

    const gate = tecp.TECP_NEXT_GATE;
    if (gate !== CURRENT_GATE
      || facts.completionGate !== 'TECP019_LOCAL_GOVERNANCE_READ_MODEL_COMPLETE'
      || !safeStatus(facts.completionGateStatus)) return UNKNOWN_VIEW;

    return Object.freeze({
      tecpSliceId: sliceId,
      nextOwnerGate: gate,
      activeWorkPackageImplementationAuthorization: raw,
      completionGate: facts.completionGate,
      completionGateStatus: facts.completionGateStatus,
      effectivePermissionIndicator: 'NO_AUTHORITY',
    });
  } catch {
    // Even unexpected input types/proxies cannot produce a permission grant.
    return UNKNOWN_VIEW;
  }
}
