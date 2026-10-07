/**
 * TECP-007 Actor Capability Engine.
 * Control-plane only. Further-restricts a Governance Validator decision.
 * Does not authenticate, read credentials, map application roles, or expand authority.
 *
 * Decision precedence (fail closed):
 * 1. missing or invalid context, including missing governanceDecision
 * 2. invalid actor object or missing actorId / actorType
 *    (same decision class as step 1: DENY_MISSING_CONTEXT)
 * 3. unknown actor type
 * 4. unknown capability
 * 5. governance deny (governanceDecision.allowed !== true) => DENY_GOVERNANCE
 * 6. authority-boundary violation
 * 7. capability not granted by the frozen TECP matrix
 * 8. ALLOW
 *
 * Governance precedence: GOVERNANCE_DENY => FINAL_DENY.
 * No actor/capability grant overrides a governance deny.
 */

export const TECP_ACTOR_TYPES = Object.freeze([
  'OWNER',
  'CHATGPT_INTEGRATOR',
  'CURSOR_WORKER',
  'DISCOVERY_WORKER',
  'CI',
  'GITHUB',
  'DEPLOY',
  'RUNTIME_PROBE',
  'HUMAN_QA',
  'CONTROL_PLANE',
  'WALRUS',
]);

export const TECP_CAPABILITIES = Object.freeze([
  'READ_GOVERNANCE',
  'REQUEST_IMPLEMENTATION',
  'SUBMIT_EVIDENCE',
  'CLAIM_TASK',
  'RELEASE_TASK',
  'REQUEST_SCOPE_EXPANSION',
  'REQUEST_DEPLOY',
  'APPROVE_HUMAN_QA',
  'APPROVE_MERGE',
  'OBSERVE_RUNTIME',
]);

export const CAPABILITY_DECISIONS = Object.freeze({
  ALLOW: 'ALLOW',
  DENY_UNKNOWN_ACTOR: 'DENY_UNKNOWN_ACTOR',
  DENY_UNKNOWN_CAPABILITY: 'DENY_UNKNOWN_CAPABILITY',
  DENY_CAPABILITY_NOT_GRANTED: 'DENY_CAPABILITY_NOT_GRANTED',
  DENY_GOVERNANCE: 'DENY_GOVERNANCE',
  DENY_AUTHORITY_BOUNDARY: 'DENY_AUTHORITY_BOUNDARY',
  DENY_MISSING_CONTEXT: 'DENY_MISSING_CONTEXT',
});

export const DECISION_PRECEDENCE = Object.freeze([
  'MISSING_OR_INVALID_CONTEXT',
  'INVALID_ACTOR_OBJECT',
  'UNKNOWN_ACTOR_TYPE',
  'UNKNOWN_CAPABILITY',
  'GOVERNANCE_DENY',
  'AUTHORITY_BOUNDARY',
  'CAPABILITY_NOT_GRANTED',
  'ALLOW',
]);

export const TECP_AUTHORITY_BOUNDARY = 'TECP_CONTROL_PLANE';

const ALL_CAPABILITIES = Object.freeze([...TECP_CAPABILITIES]);

const POLICY_GRANTS = Object.freeze({
  OWNER: ALL_CAPABILITIES,
  CHATGPT_INTEGRATOR: Object.freeze([
    'READ_GOVERNANCE',
    'REQUEST_IMPLEMENTATION',
    'SUBMIT_EVIDENCE',
    'REQUEST_SCOPE_EXPANSION',
    'OBSERVE_RUNTIME',
  ]),
  CURSOR_WORKER: Object.freeze([
    'READ_GOVERNANCE',
    'SUBMIT_EVIDENCE',
    'CLAIM_TASK',
    'RELEASE_TASK',
  ]),
  DISCOVERY_WORKER: Object.freeze([
    'READ_GOVERNANCE',
    'SUBMIT_EVIDENCE',
  ]),
  CI: Object.freeze([
    'SUBMIT_EVIDENCE',
    'OBSERVE_RUNTIME',
  ]),
  GITHUB: Object.freeze([
    'SUBMIT_EVIDENCE',
  ]),
  DEPLOY: Object.freeze([
    'SUBMIT_EVIDENCE',
    'OBSERVE_RUNTIME',
  ]),
  RUNTIME_PROBE: Object.freeze([
    'SUBMIT_EVIDENCE',
    'OBSERVE_RUNTIME',
  ]),
  HUMAN_QA: Object.freeze([
    'READ_GOVERNANCE',
    'SUBMIT_EVIDENCE',
    'APPROVE_HUMAN_QA',
  ]),
  CONTROL_PLANE: Object.freeze([
    'READ_GOVERNANCE',
    'SUBMIT_EVIDENCE',
    'OBSERVE_RUNTIME',
  ]),
  WALRUS: Object.freeze([
    'READ_GOVERNANCE',
  ]),
});

export const TECP_CAPABILITY_POLICY = Object.freeze(
  Object.fromEntries(
    TECP_ACTOR_TYPES.map((actorType) => [actorType, POLICY_GRANTS[actorType]]),
  ),
);

const ACTOR_TYPE_SET = new Set(TECP_ACTOR_TYPES);
const CAPABILITY_SET = new Set(TECP_CAPABILITIES);

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function freezeResult(allowed, decision, reasons, actor, capability, matchedPolicy) {
  return Object.freeze({
    allowed,
    decision,
    reasons: Object.freeze([...reasons]),
    actor,
    capability,
    matchedPolicy,
  });
}

function deny(decision, reason, actor, capability) {
  return freezeResult(false, decision, [reason], actor, capability, null);
}

function copyActor(actor) {
  return Object.freeze({
    actorId: actor.actorId,
    actorType: actor.actorType,
  });
}

function capabilityEcho(capability) {
  return typeof capability === 'string' ? capability : null;
}

/**
 * @param {{ actorId?: unknown, actorType?: unknown } | null | undefined} actor
 * @param {string} capability
 * @param {{ governanceDecision?: { allowed?: unknown, decision?: unknown }, authorityBoundary?: unknown } | null | undefined} context
 */
export function evaluateCapability(actor, capability, context) {
  if (!isObject(context)) {
    return deny(
      CAPABILITY_DECISIONS.DENY_MISSING_CONTEXT,
      'MISSING_CONTEXT',
      null,
      capabilityEcho(capability),
    );
  }

  const governanceDecision = context.governanceDecision;
  if (!isObject(governanceDecision)) {
    return deny(
      CAPABILITY_DECISIONS.DENY_MISSING_CONTEXT,
      'MISSING_GOVERNANCE_DECISION',
      null,
      capabilityEcho(capability),
    );
  }
  if (!Object.prototype.hasOwnProperty.call(governanceDecision, 'allowed')
    || typeof governanceDecision.decision !== 'string'
    || governanceDecision.decision.length === 0) {
    return deny(
      CAPABILITY_DECISIONS.DENY_MISSING_CONTEXT,
      'INCOMPLETE_GOVERNANCE_DECISION',
      null,
      capabilityEcho(capability),
    );
  }

  if (!isObject(actor)
    || typeof actor.actorId !== 'string'
    || actor.actorId.length === 0
    || typeof actor.actorType !== 'string'
    || actor.actorType.length === 0) {
    return deny(
      CAPABILITY_DECISIONS.DENY_MISSING_CONTEXT,
      'INVALID_ACTOR',
      null,
      capabilityEcho(capability),
    );
  }

  const actorCopy = copyActor(actor);

  if (!ACTOR_TYPE_SET.has(actor.actorType)) {
    return deny(
      CAPABILITY_DECISIONS.DENY_UNKNOWN_ACTOR,
      'UNKNOWN_ACTOR',
      actorCopy,
      capabilityEcho(capability),
    );
  }

  if (typeof capability !== 'string' || !CAPABILITY_SET.has(capability)) {
    return deny(
      CAPABILITY_DECISIONS.DENY_UNKNOWN_CAPABILITY,
      'UNKNOWN_CAPABILITY',
      actorCopy,
      capabilityEcho(capability),
    );
  }

  if (governanceDecision.allowed !== true) {
    return deny(
      CAPABILITY_DECISIONS.DENY_GOVERNANCE,
      'GOVERNANCE_DENY',
      actorCopy,
      capability,
    );
  }

  const boundary = context.authorityBoundary;
  const boundaryAbsent = boundary === undefined || boundary === null || boundary === '';
  if (!boundaryAbsent && boundary !== TECP_AUTHORITY_BOUNDARY) {
    return deny(
      CAPABILITY_DECISIONS.DENY_AUTHORITY_BOUNDARY,
      'AUTHORITY_BOUNDARY',
      actorCopy,
      capability,
    );
  }

  const grants = POLICY_GRANTS[actor.actorType];
  if (!grants.includes(capability)) {
    return deny(
      CAPABILITY_DECISIONS.DENY_CAPABILITY_NOT_GRANTED,
      'CAPABILITY_NOT_GRANTED',
      actorCopy,
      capability,
    );
  }

  return freezeResult(
    true,
    CAPABILITY_DECISIONS.ALLOW,
    ['CAPABILITY_GRANTED'],
    actorCopy,
    capability,
    Object.freeze({
      actorType: actor.actorType,
      capability,
    }),
  );
}
