'use strict';

/**
 * TECP-017 Titan MCP — pure in-memory MCP surface contract.
 * Validates and canonicalizes one MCP surface descriptor. No transport,
 * process, network, credential, persistence, or tool-execution authority.
 */

export const MCP_SURFACE_VALIDATION_DECISIONS = Object.freeze({
  VALID: 'VALID',
  INVALID_SURFACE: 'INVALID_SURFACE',
  INVALID_SURFACE_ID: 'INVALID_SURFACE_ID',
  INVALID_SURFACE_NAME: 'INVALID_SURFACE_NAME',
  INVALID_PROTOCOL_FAMILY: 'INVALID_PROTOCOL_FAMILY',
  INVALID_SURFACE_MODE: 'INVALID_SURFACE_MODE',
  INVALID_TOOL_COUNT: 'INVALID_TOOL_COUNT',
  INVALID_RESOURCE_COUNT: 'INVALID_RESOURCE_COUNT',
});

export const MCP_PROTOCOL_FAMILIES = Object.freeze({
  MCP: 'MCP',
});

export const MCP_SURFACE_MODES = Object.freeze({
  LOCAL_IN_MEMORY: 'LOCAL_IN_MEMORY',
});

const CANONICAL_KEY_ORDER = Object.freeze([
  'surfaceId',
  'surfaceName',
  'protocolFamily',
  'surfaceMode',
  'toolCount',
  'resourceCount',
]);

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.length > 0;
}

function isNonNegativeInteger(value) {
  return Number.isInteger(value) && value >= 0;
}

function hasExactKeys(value, keys) {
  const actual = Object.keys(value);
  if (actual.length !== keys.length) {
    return false;
  }
  const expected = new Set(keys);
  for (const key of actual) {
    if (!expected.has(key)) {
      return false;
    }
  }
  return true;
}

function freezeDeep(value) {
  if (value === null || typeof value !== 'object') {
    return value;
  }
  for (const nested of Object.values(value)) {
    freezeDeep(nested);
  }
  return Object.freeze(value);
}

function invalidResult(decision) {
  return freezeDeep({
    valid: false,
    decision,
    reasons: [decision],
    surface: null,
  });
}

/**
 * @param {object} surface
 * @returns {Readonly<{
 *   surfaceId: string,
 *   surfaceName: string,
 *   protocolFamily: string,
 *   surfaceMode: string,
 *   toolCount: number,
 *   resourceCount: number
 * }>}
 */
export function canonicalizeMcpSurface(surface) {
  return Object.freeze({
    surfaceId: surface.surfaceId,
    surfaceName: surface.surfaceName,
    protocolFamily: surface.protocolFamily,
    surfaceMode: surface.surfaceMode,
    toolCount: surface.toolCount,
    resourceCount: surface.resourceCount,
  });
}

/**
 * @param {unknown} surface
 * @returns {Readonly<{
 *   valid: boolean,
 *   decision: string,
 *   reasons: ReadonlyArray<string>,
 *   surface: object | null
 * }>}
 */
export function validateMcpSurface(surface) {
  if (!isPlainObject(surface) || !hasExactKeys(surface, CANONICAL_KEY_ORDER)) {
    return invalidResult(MCP_SURFACE_VALIDATION_DECISIONS.INVALID_SURFACE);
  }

  if (!isNonEmptyString(surface.surfaceId)) {
    return invalidResult(MCP_SURFACE_VALIDATION_DECISIONS.INVALID_SURFACE_ID);
  }

  if (!isNonEmptyString(surface.surfaceName)) {
    return invalidResult(MCP_SURFACE_VALIDATION_DECISIONS.INVALID_SURFACE_NAME);
  }

  if (surface.protocolFamily !== MCP_PROTOCOL_FAMILIES.MCP) {
    return invalidResult(MCP_SURFACE_VALIDATION_DECISIONS.INVALID_PROTOCOL_FAMILY);
  }

  if (surface.surfaceMode !== MCP_SURFACE_MODES.LOCAL_IN_MEMORY) {
    return invalidResult(MCP_SURFACE_VALIDATION_DECISIONS.INVALID_SURFACE_MODE);
  }

  if (!isNonNegativeInteger(surface.toolCount) || surface.toolCount !== 0) {
    return invalidResult(MCP_SURFACE_VALIDATION_DECISIONS.INVALID_TOOL_COUNT);
  }

  if (!isNonNegativeInteger(surface.resourceCount) || surface.resourceCount !== 0) {
    return invalidResult(MCP_SURFACE_VALIDATION_DECISIONS.INVALID_RESOURCE_COUNT);
  }

  const canonical = canonicalizeMcpSurface(surface);
  return freezeDeep({
    valid: true,
    decision: MCP_SURFACE_VALIDATION_DECISIONS.VALID,
    reasons: [],
    surface: canonical,
  });
}
