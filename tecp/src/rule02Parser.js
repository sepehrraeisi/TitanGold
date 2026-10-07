/**
 * TECP-005 read-only Rule02 text parser.
 * Interprets supplied text into separated progress, TECP, and Artemis facts.
 * Does not authorize, persist, mutate the input, or perform I/O.
 */

export const CANONICAL_RULE02_PATH = '.cursor/rules/titangold-current-active-work.mdc';

export const ERROR_CODES = Object.freeze({
  MISSING_RULE02: 'MISSING_RULE02',
  MALFORMED_RULE02: 'MALFORMED_RULE02',
  DUPLICATE_ACTIVE_AUTHORITY: 'DUPLICATE_ACTIVE_AUTHORITY',
  CONTRADICTORY_AUTHORIZATION: 'CONTRADICTORY_AUTHORIZATION',
  STALE_HISTORICAL_ONLY: 'STALE_HISTORICAL_ONLY',
  MISSING_PROGRESS_SNAPSHOT: 'MISSING_PROGRESS_SNAPSHOT',
  AMBIGUOUS_ACTIVE_SECTION: 'AMBIGUOUS_ACTIVE_SECTION',
  MISSING_REQUIRED_GOVERNANCE_FACT: 'MISSING_REQUIRED_GOVERNANCE_FACT',
  CONFLICTING_ACTIVE_GOVERNANCE_FACT: 'CONFLICTING_ACTIVE_GOVERNANCE_FACT',
});

const ORIGIN = Object.freeze({
  snapshot: 'progressSnapshot',
  awp: 'activeWorkPackage',
  next: 'nextOwnerGate',
});

const PROGRESS_KEYS = new Set([
  'PROJECT_PROGRESS',
  'CURRENT_STAGE',
  'CURRENT_STAGE_PROGRESS',
  'PROGRESS_BLOCKER',
]);

const STALE_KEYS = new Set([
  'AUTHORIZED_SLICE',
  'TECP_AUTHORIZED_SLICE',
  'IMPLEMENTATION_AUTHORIZED',
  'TECP_IMPLEMENTATION_AUTHORIZED',
  'TECP005_IMPLEMENTATION_AUTHORIZED',
]);

const GOVERNANCE_KEYS = [
  'TECP_GOVERNANCE_BASE_MAIN_SHA',
  'GOVERNANCE_REVISION',
  'GOVERNANCE_BASE_MAIN_SHA',
];

const STRUCTURED_SCALAR_KEYS = new Set([
  'RISK_TIER',
  'AUTHORITY_CLASS',
  'IMPLEMENTATION_START_CONDITIONS',
  'COMPLETION_GATE',
  'COMPLETION_GATE_STATUS',
  'LIFECYCLE_PRECEDENCE_RULE',
  'TECP005_PRIOR_IMPLEMENTATION_AUTHORIZATION',
  'PRIOR_SLICE',
  'TECP_005_STATUS',
]);

const STRUCTURED_LIST_KEYS = new Set([
  'AUTHORIZED_FILE_SCOPE',
  'PROTECTED_PATHS',
  'STOP_CONDITIONS',
]);

const REQUIRED_STRUCTURED_KEYS = [
  'RISK_TIER',
  'AUTHORITY_CLASS',
  'AUTHORIZED_FILE_SCOPE',
  'PROTECTED_PATHS',
  'STOP_CONDITIONS',
  'IMPLEMENTATION_START_CONDITIONS',
  'COMPLETION_GATE',
  'COMPLETION_GATE_STATUS',
  'LIFECYCLE_PRECEDENCE_RULE',
  'TECP005_PRIOR_IMPLEMENTATION_AUTHORIZATION',
  'PRIOR_SLICE',
  'TECP_005_STATUS',
];

const CLOSED_STATUS = 'CLOSED / FROZEN / VERIFIED';
const LIFECYCLE_RULE = 'CLOSED_FROZEN_VERIFIED_CONSUMES_PRIOR_IMPLEMENTATION_AUTHORIZATION';
const CONSUMED_AUTH = 'CONSUMED / NON-ACTIVE';

export class Rule02ParseError extends Error {
  constructor(code, details = {}) {
    super(code);
    this.name = 'Rule02ParseError';
    this.code = code;
    this.details = freezeDeep(details);
  }
}

export function parseRule02(text, metadata) {
  assertText(text);
  const sourceMeta = readMetadata(metadata);
  const sections = splitSections(text).map((section) => ({
    ...section,
    flags: classifyHeading(section.title),
    assignments: extractAssignments(section.lines),
  }));

  const hybrids = sections.filter((section) => isHybrid(section.flags));
  if (hybrids.length > 0) {
    throw new Rule02ParseError(ERROR_CODES.AMBIGUOUS_ACTIVE_SECTION, {
      reason: 'hybrid_heading',
      heading: hybrids[0].title,
    });
  }

  const snapshots = sections.filter((section) => section.flags.snapshot);
  const nextGates = sections.filter((section) => section.flags.nextGate);
  if (snapshots.length > 1) {
    throw new Rule02ParseError(ERROR_CODES.AMBIGUOUS_ACTIVE_SECTION, {
      reason: 'multiple_snapshots',
      heading: snapshots[1].title,
    });
  }
  if (nextGates.length > 1) {
    throw new Rule02ParseError(ERROR_CODES.AMBIGUOUS_ACTIVE_SECTION, {
      reason: 'multiple_next_owner_gates',
      heading: nextGates[1].title,
    });
  }

  const activeAwps = sections.filter((section) => isActiveAwp(section.flags));
  const excluded = sections.filter((section) => isExcluded(section.flags));

  if (snapshots.length === 0) {
    if (activeAwps.length === 0 && nextGates.length === 0 && excluded.some(hasStaleAuthority)) {
      throw new Rule02ParseError(ERROR_CODES.STALE_HISTORICAL_ONLY, {
        reason: 'historical_only',
      });
    }
    throw new Rule02ParseError(ERROR_CODES.MISSING_PROGRESS_SNAPSHOT, {
      reason: 'absent',
    });
  }

  if (activeAwps.length > 1) {
    throw new Rule02ParseError(ERROR_CODES.DUPLICATE_ACTIVE_AUTHORITY, {
      headings: activeAwps.map((section) => section.title),
    });
  }

  const state = createState();
  applySnapshot(state, snapshots[0]);
  const awp = activeAwps.length === 1 ? activeAwps[0] : null;
  if (awp) applyAwp(state, awp);
  if (nextGates.length === 1) applyNextGate(state, nextGates[0]);

  return freezeDeep(buildResult(state, sourceMeta, awp, excluded));
}

function assertText(text) {
  if (text === undefined || text === null) {
    throw new Rule02ParseError(ERROR_CODES.MISSING_RULE02, { reason: 'null' });
  }
  if (typeof text !== 'string') {
    throw new Rule02ParseError(ERROR_CODES.MALFORMED_RULE02, { reason: 'non_string' });
  }
  if (text.trim().length === 0) {
    throw new Rule02ParseError(ERROR_CODES.MISSING_RULE02, { reason: 'empty' });
  }
}

function readMetadata(metadata) {
  if (metadata === undefined || metadata === null) {
    return { sha: null, revision: null };
  }
  if (typeof metadata !== 'object' || Array.isArray(metadata)) {
    throw new Rule02ParseError(ERROR_CODES.MALFORMED_RULE02, { reason: 'metadata' });
  }
  return {
    sha: readMetaString(metadata, ['sourceSha', 'sha']),
    revision: readMetaString(metadata, ['revision', 'sourceRevision']),
  };
}

function readMetaString(metadata, keys) {
  const present = keys.filter((key) => metadata[key] !== undefined && metadata[key] !== null);
  if (present.length === 0) return null;
  const values = present.map((key) => {
    if (typeof metadata[key] !== 'string') {
      throw new Rule02ParseError(ERROR_CODES.MALFORMED_RULE02, { reason: 'metadata' });
    }
    const trimmed = metadata[key].trim();
    return trimmed.length === 0 ? null : trimmed;
  });
  const unique = [];
  for (const value of values) {
    if (!unique.includes(value)) unique.push(value);
  }
  if (unique.length > 1) {
    throw new Rule02ParseError(ERROR_CODES.MALFORMED_RULE02, { reason: 'metadata' });
  }
  return unique[0];
}

function splitSections(text) {
  const sections = [];
  let current = null;
  let inFence = false;
  for (const raw of text.split(/\r?\n/)) {
    const trimmed = raw.trim();
    if (trimmed.startsWith('```')) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    const heading = trimmed.match(/^(#{2,6})\s+(\S.*)$/);
    if (heading) {
      current = { title: heading[2].trim(), lines: [] };
      sections.push(current);
      continue;
    }
    if (current) current.lines.push(raw);
  }
  return sections;
}

function classifyHeading(title) {
  return {
    historical: /^Historical\b/.test(title),
    superseded: title.includes('SUPERSEDED AS ACTIVE AUTHORITY'),
    closeout: title.includes('CLOSEOUT'),
    awp: title.includes('Active Work Package'),
    snapshot: title.startsWith('Canonical Project Progress Snapshot'),
    nextGate: title === 'Next Owner gate',
  };
}

function isHybrid(flags) {
  if (flags.historical && flags.awp) return true;
  if (flags.historical && flags.snapshot) return true;
  if (flags.historical && flags.nextGate) return true;
  if (flags.snapshot && flags.awp) return true;
  if (flags.snapshot && flags.nextGate) return true;
  if (flags.awp && flags.nextGate) return true;
  return false;
}

function isActiveAwp(flags) {
  return flags.awp && !flags.historical && !flags.superseded && !flags.closeout;
}

function isExcluded(flags) {
  if (isHybrid(flags)) return false;
  return flags.historical || flags.superseded || flags.closeout;
}

function hasStaleAuthority(section) {
  return section.assignments.some((assignment) => STALE_KEYS.has(assignment.key));
}

function extractAssignments(lines) {
  const assignments = [];
  for (const raw of lines) {
    const assignment = parseAssignmentLine(raw);
    if (assignment) assignments.push(assignment);
  }
  return assignments;
}

function parseAssignmentLine(raw) {
  let line = raw.trim();
  if (line.startsWith('- ') || line.startsWith('* ')) line = line.slice(2).trim();
  if (line.startsWith('**') && line.endsWith('**') && line.length > 4) {
    const inner = line.slice(2, -2).trim();
    if (!inner.includes('**')) line = inner;
  }
  const match = line.match(/^([A-Z][A-Z0-9_]*)(?:\s*\(([^)]+)\))?\s*=\s*(.+)$/);
  if (!match) return null;
  const value = cleanValue(match[3]);
  if (!value) return null;
  return {
    key: match[1],
    label: match[2] ? match[2].trim() : null,
    value,
  };
}

function cleanValue(raw) {
  let value = raw.trim();
  if (value.startsWith('`') && value.endsWith('`') && value.length >= 2) {
    value = value.slice(1, -1).trim();
  }
  return value;
}

function primaryToken(value) {
  const separator = value.indexOf(' / ');
  if (separator === -1) return value.trim();
  return value.slice(0, separator).trim();
}

function createState() {
  return {
    progress: {
      PROJECT_PROGRESS: null,
      CURRENT_STAGE: null,
      CURRENT_STAGE_PROGRESS: null,
      NEXT_GATE: null,
      PROGRESS_BLOCKER: null,
    },
    nextGateOrigin: null,
    tecpSlice: null,
    tecpImpl: null,
    tecp005Impl: null,
    awpImpl: null,
    tecpNextGate: null,
    status005: null,
    statusWorkstream: null,
    artemisSlice: null,
    stage10: null,
    stage11: null,
    governance: null,
    sliceId: null,
    officialName: null,
  };
}

function contradict(field, previous, value, origin) {
  throw new Rule02ParseError(ERROR_CODES.CONTRADICTORY_AUTHORIZATION, {
    field,
    left: previous.value,
    right: value,
    leftOrigin: previous.origin,
    rightOrigin: origin,
  });
}

function putSame(slot, field, value, origin) {
  const token = primaryToken(value);
  if (!slot.current) {
    slot.current = { value, token, origin, field };
    return slot.current;
  }
  if (slot.current.token !== token) contradict(field, slot.current, value, origin);
  return slot.current;
}

function remember(state, bucket, field, value, origin) {
  if (!state._slots) state._slots = {};
  if (!state._slots[bucket]) state._slots[bucket] = { current: null };
  const saved = putSame(state._slots[bucket], field, value, origin);
  return saved;
}

function noteStructuredFact(state, key, value) {
  if (!state.structuredFacts) state.structuredFacts = new Map();
  const existing = state.structuredFacts.get(key);
  if (existing === undefined) {
    state.structuredFacts.set(key, value);
    return;
  }
  if (existing !== value) {
    throw new Rule02ParseError(ERROR_CODES.CONFLICTING_ACTIVE_GOVERNANCE_FACT, { field: key });
  }
}

function splitStructuredList(raw, field) {
  const parts = String(raw).split(' | ').map((part) => part.trim());
  if (parts.length === 0 || parts.some((part) => part.length === 0)) {
    throw new Rule02ParseError(ERROR_CODES.MISSING_REQUIRED_GOVERNANCE_FACT, { field });
  }
  return parts;
}

function structuredGovernance(state) {
  const facts = state.structuredFacts;
  if (!facts || facts.size === 0) return null;

  for (const key of REQUIRED_STRUCTURED_KEYS) {
    const value = facts.get(key);
    if (value === undefined || !String(value).trim()) {
      throw new Rule02ParseError(ERROR_CODES.MISSING_REQUIRED_GOVERNANCE_FACT, { field: key });
    }
  }

  const status = facts.get('TECP_005_STATUS');
  const rule = facts.get('LIFECYCLE_PRECEDENCE_RULE');
  const prior = facts.get('TECP005_PRIOR_IMPLEMENTATION_AUTHORIZATION');
  if (rule !== LIFECYCLE_RULE) {
    throw new Rule02ParseError(ERROR_CODES.CONFLICTING_ACTIVE_GOVERNANCE_FACT, { field: 'LIFECYCLE_PRECEDENCE_RULE' });
  }
  if (status !== CLOSED_STATUS) {
    throw new Rule02ParseError(ERROR_CODES.CONFLICTING_ACTIVE_GOVERNANCE_FACT, { field: 'TECP_005_STATUS' });
  }
  if (prior !== CONSUMED_AUTH) {
    throw new Rule02ParseError(ERROR_CODES.CONFLICTING_ACTIVE_GOVERNANCE_FACT, { field: 'TECP005_PRIOR_IMPLEMENTATION_AUTHORIZATION' });
  }

  const raw = state.awpImpl
    ? state.awpImpl.value
    : (state.tecp005Impl ? state.tecp005Impl.value : '');
  if (!String(raw).trim()) {
    throw new Rule02ParseError(ERROR_CODES.MISSING_REQUIRED_GOVERNANCE_FACT, { field: 'IMPLEMENTATION_AUTHORIZED' });
  }
  if (state.awpImpl && state.tecp005Impl && state.awpImpl.value !== state.tecp005Impl.value) {
    throw new Rule02ParseError(ERROR_CODES.CONFLICTING_ACTIVE_GOVERNANCE_FACT, { field: 'IMPLEMENTATION_AUTHORIZED' });
  }

  return {
    governanceFacts: {
      riskTier: facts.get('RISK_TIER'),
      authorityClass: facts.get('AUTHORITY_CLASS'),
      authorizedFileScope: splitStructuredList(facts.get('AUTHORIZED_FILE_SCOPE'), 'AUTHORIZED_FILE_SCOPE'),
      protectedPaths: splitStructuredList(facts.get('PROTECTED_PATHS'), 'PROTECTED_PATHS'),
      stopConditions: splitStructuredList(facts.get('STOP_CONDITIONS'), 'STOP_CONDITIONS'),
      implementationStartConditions: facts.get('IMPLEMENTATION_START_CONDITIONS'),
      completionGate: facts.get('COMPLETION_GATE'),
      completionGateStatus: facts.get('COMPLETION_GATE_STATUS'),
    },
    lifecyclePrecedence: {
      rule,
      consumedSlice: facts.get('PRIOR_SLICE'),
      rawImplementationAuthorization: raw,
      implementationAuthorizationEffective: CONSUMED_AUTH,
      status,
    },
  };
}

function applySnapshot(state, section) {
  for (const assignment of section.assignments) {
    routeCommon(state, assignment, ORIGIN.snapshot, { fromSnapshot: true, domain: null });
  }
}

function applyAwp(state, section) {
  const domain = awpDomain(section);
  state.awpDomain = domain;
  for (const assignment of section.assignments) {
    if (STRUCTURED_SCALAR_KEYS.has(assignment.key) || STRUCTURED_LIST_KEYS.has(assignment.key)) {
      if (!String(assignment.value).trim()) {
        throw new Rule02ParseError(ERROR_CODES.MISSING_REQUIRED_GOVERNANCE_FACT, { field: assignment.key });
      }
      noteStructuredFact(state, assignment.key, assignment.value);
      if (assignment.key !== 'TECP_005_STATUS') continue;
    }
    if (assignment.key === 'SLICE_ID') {
      state.sliceId = remember(state, 'sliceId', 'SLICE_ID', assignment.value, ORIGIN.awp).value;
      if (domain === 'tecp' || primaryToken(assignment.value).startsWith('TECP-')) {
        noteTepSlice(state, 'SLICE_ID', assignment.value, ORIGIN.awp);
      }
      continue;
    }
    if (assignment.key === 'OFFICIAL_NAME') {
      state.officialName = remember(state, 'officialName', 'OFFICIAL_NAME', assignment.value, ORIGIN.awp).value;
      continue;
    }
    if (assignment.key === 'IMPLEMENTATION_AUTHORIZED' && domain === 'tecp') {
      state.awpImpl = remember(state, 'awpImpl', 'IMPLEMENTATION_AUTHORIZED', assignment.value, ORIGIN.awp);
      if (state.tecp005Impl && state.tecp005Impl.token !== state.awpImpl.token) {
        contradict('IMPLEMENTATION_AUTHORIZED', state.tecp005Impl, assignment.value, ORIGIN.awp);
      }
      continue;
    }
    if (assignment.key === 'AUTHORIZED_SLICE' && !assignment.label && domain === 'tecp' && primaryToken(assignment.value).startsWith('TECP-')) {
      noteTepSlice(state, 'AUTHORIZED_SLICE', assignment.value, ORIGIN.awp);
      continue;
    }
    routeCommon(state, assignment, ORIGIN.awp, { fromSnapshot: false, domain });
  }
}

function applyNextGate(state, section) {
  state.sawNextGate = true;
  for (const assignment of section.assignments) {
    routeCommon(state, assignment, ORIGIN.next, { fromSnapshot: false, domain: null });
  }
}

function routeCommon(state, assignment, origin, context) {
  const { key, label, value } = assignment;

  if (PROGRESS_KEYS.has(key)) {
    if (!context.fromSnapshot) {
      const current = state.progress[key];
      if (current && primaryToken(current) !== primaryToken(value)) {
        contradict(key, { value: current, origin: ORIGIN.snapshot }, value, origin);
      }
      return;
    }
    if (!state.progress[key]) state.progress[key] = value;
    else if (primaryToken(state.progress[key]) !== primaryToken(value)) {
      contradict(key, { value: state.progress[key], origin: ORIGIN.snapshot }, value, origin);
    }
    return;
  }

  if (key === 'NEXT_GATE') {
    if (origin === ORIGIN.awp) {
      if (state.progress.NEXT_GATE && primaryToken(state.progress.NEXT_GATE) !== primaryToken(value)) {
        contradict(key, { value: state.progress.NEXT_GATE, origin: state.nextGateOrigin }, value, origin);
      }
      return;
    }
    if (!state.progress.NEXT_GATE) {
      state.progress.NEXT_GATE = value;
      state.nextGateOrigin = origin;
      return;
    }
    if (primaryToken(state.progress.NEXT_GATE) !== primaryToken(value)) {
      contradict(key, { value: state.progress.NEXT_GATE, origin: state.nextGateOrigin }, value, origin);
    }
    return;
  }

  if (key === 'TECP_AUTHORIZED_SLICE' || key === 'TECP_PARALLEL_AUTHORIZED_SLICE') {
    noteTepSlice(state, key, value, origin);
    return;
  }
  if (key === 'TECP_IMPLEMENTATION_AUTHORIZED') {
    state.tecpImpl = remember(state, 'tecpImpl', key, value, origin);
    return;
  }
  if (key === 'TECP005_IMPLEMENTATION_AUTHORIZED') {
    state.tecp005Impl = remember(state, 'tecp005Impl', key, value, origin);
    if (state.awpImpl && state.awpImpl.token !== state.tecp005Impl.token) {
      contradict(key, state.awpImpl, value, origin);
    }
    return;
  }
  if (key === 'TECP_005_STATUS') {
    state.status005 = remember(state, 'status005', key, value, origin);
    return;
  }
  if (key === 'TECP_WORKSTREAM_STATUS') {
    state.statusWorkstream = remember(state, 'statusWorkstream', key, value, origin);
    return;
  }
  if (key === 'TECP_NEXT_GATE') {
    state.tecpNextGate = remember(state, 'tecpNextGate', key, value, origin);
    return;
  }
  if (key === 'AUTHORIZED_SLICE' || key === 'ARTEMIS_AUTHORIZED_SLICE' || (label && /artemis/i.test(label) && key === 'AUTHORIZED_SLICE')) {
    noteArtemisSlice(state, key, value, origin);
    return;
  }
  if (key === 'STAGE10_IMPLEMENTATION_AUTHORIZED') {
    state.stage10 = remember(state, 'stage10', key, value, origin);
    return;
  }
  if (key === 'STAGE11_IMPLEMENTATION_AUTHORIZED') {
    state.stage11 = remember(state, 'stage11', key, value, origin);
    return;
  }
  if (GOVERNANCE_KEYS.includes(key)) {
    const next = remember(state, `gov:${key}`, key, value, origin);
    if (!state.governance) state.governance = next;
    return;
  }
}

function noteTepSlice(state, field, value, origin) {
  const token = primaryToken(value);
  if (!state.tecpSlice) {
    state.tecpSlice = { value, token, origin, field };
    return;
  }
  if (state.tecpSlice.token !== token) contradict(field, state.tecpSlice, value, origin);
  if (field === 'TECP_AUTHORIZED_SLICE' && state.tecpSlice.field !== 'TECP_AUTHORIZED_SLICE') {
    state.tecpSlice = { value, token, origin, field };
  }
}

function noteArtemisSlice(state, field, value, origin) {
  const token = primaryToken(value);
  if (!state.artemisSlice) {
    state.artemisSlice = { value, token, origin, field };
    return;
  }
  if (state.artemisSlice.token !== token) contradict(field, state.artemisSlice, value, origin);
  if (field === 'AUTHORIZED_SLICE' && state.artemisSlice.field !== 'AUTHORIZED_SLICE') {
    state.artemisSlice = { value, token, origin, field };
  }
}

function awpDomain(section) {
  if (/TECP-\d+/.test(section.title)) return 'tecp';
  if (section.assignments.some((assignment) => assignment.key.startsWith('TECP'))) return 'tecp';
  const slice = section.assignments.find((assignment) => assignment.key === 'SLICE_ID');
  if (slice && primaryToken(slice.value).startsWith('TECP-')) return 'tecp';
  return 'artemis';
}

function buildResult(state, sourceMeta, awp, excluded) {
  const missing = [];
  for (const key of ['PROJECT_PROGRESS', 'CURRENT_STAGE', 'CURRENT_STAGE_PROGRESS', 'NEXT_GATE', 'PROGRESS_BLOCKER']) {
    if (!state.progress[key]) missing.push(key);
  }
  if (!state.tecpSlice || state.tecpSlice.field !== 'TECP_AUTHORIZED_SLICE') missing.push('TECP_AUTHORIZED_SLICE');
  if (!state.tecpImpl) missing.push('TECP_IMPLEMENTATION_AUTHORIZED');
  if (!state.status005 && !state.statusWorkstream) missing.push('TECP_STATUS');
  if (!state.artemisSlice) missing.push('AUTHORIZED_SLICE');
  if (missing.length > 0) {
    missing.sort();
    throw new Rule02ParseError(ERROR_CODES.MALFORMED_RULE02, {
      reason: 'missing_fields',
      fields: missing,
    });
  }

  const tecpToken = state.tecpSlice.token;
  const identifiers = [];
  if (tecpToken !== 'NONE') identifiers.push(tecpToken);
  if (state.sliceId) {
    const sliceToken = primaryToken(state.sliceId);
    if (sliceToken !== 'NONE' && !identifiers.includes(sliceToken)) identifiers.push(sliceToken);
  }
  if (state.artemisSlice.token !== 'NONE' && !identifiers.includes(state.artemisSlice.token)) {
    identifiers.push(state.artemisSlice.token);
  }

  const notes = [];
  if (state.nextGateOrigin === ORIGIN.next) notes.push('NEXT_GATE_FROM_NEXT_OWNER_GATE');

  const regions = ['progressSnapshot'];
  if (awp) regions.push('activeWorkPackage');
  if (state.sawNextGate) regions.push('nextOwnerGate');

  const exclusion = {
    historical: excluded.filter((section) => section.flags.historical).length,
    closeout: excluded.filter((section) => section.flags.closeout).length,
    superseded: excluded.filter((section) => section.flags.superseded).length,
  };

  const structured = structuredGovernance(state);

  const result = {
    progress: {
      PROJECT_PROGRESS: state.progress.PROJECT_PROGRESS,
      CURRENT_STAGE: state.progress.CURRENT_STAGE,
      CURRENT_STAGE_PROGRESS: state.progress.CURRENT_STAGE_PROGRESS,
      NEXT_GATE: state.progress.NEXT_GATE,
      PROGRESS_BLOCKER: state.progress.PROGRESS_BLOCKER,
    },
    tecp: {
      TECP_AUTHORIZED_SLICE: state.tecpSlice.value,
      TECP_IMPLEMENTATION_AUTHORIZED: state.tecpImpl.value,
      TECP_NEXT_GATE: state.tecpNextGate ? state.tecpNextGate.value : null,
      status: state.status005 ? state.status005.value : state.statusWorkstream.value,
      implementationAuthorizationState: {
        TECP_IMPLEMENTATION_AUTHORIZED: state.tecpImpl.value,
        TECP005_IMPLEMENTATION_AUTHORIZED: state.tecp005Impl ? state.tecp005Impl.value : null,
        activeWorkPackage: state.awpImpl ? state.awpImpl.value : null,
      },
    },
    artemis: {
      AUTHORIZED_SLICE: state.artemisSlice.value,
      STAGE10_IMPLEMENTATION_AUTHORIZED: state.stage10 ? state.stage10.value : null,
      STAGE11_IMPLEMENTATION_AUTHORIZED: state.stage11 ? state.stage11.value : null,
    },
    authority: {
      activeSliceIdentifiers: identifiers,
      activeWorkPackage: awp
        ? {
          heading: awp.title,
          sliceId: state.sliceId,
          officialName: state.officialName,
          domain: state.awpDomain,
        }
        : null,
      exclusion,
      governanceRevision: state.governance ? state.governance.value : null,
      sourceSha: sourceMeta.sha,
    },
    source: {
      sha: sourceMeta.sha,
      revision: sourceMeta.revision,
      canonicalPath: CANONICAL_RULE02_PATH,
    },
    diagnostics: {
      notes,
      activeRegions: regions,
      excludedSectionCount: excluded.length,
    },
  };
  if (!structured) return result;
  return {
    progress: result.progress,
    tecp: result.tecp,
    artemis: result.artemis,
    authority: result.authority,
    governanceFacts: structured.governanceFacts,
    lifecyclePrecedence: structured.lifecyclePrecedence,
    source: result.source,
    diagnostics: result.diagnostics,
  };
}

function freezeDeep(value) {
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) {
    for (const entry of value) freezeDeep(entry);
    return Object.freeze(value);
  }
  for (const key of Object.keys(value)) freezeDeep(value[key]);
  return Object.freeze(value);
}
