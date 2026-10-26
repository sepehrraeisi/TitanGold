'use strict';

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';
import {
  MCP_PROTOCOL_FAMILIES,
  MCP_SURFACE_MODES,
  MCP_SURFACE_VALIDATION_DECISIONS,
  canonicalizeMcpSurface,
  validateMcpSurface,
} from '../src/titanMcp.js';

const SOURCE_PATH = fileURLToPath(new URL('../src/titanMcp.js', import.meta.url));
const SOURCE_TEXT = readFileSync(SOURCE_PATH, 'utf8');

const CANONICAL_KEY_ORDER = Object.freeze([
  'surfaceId',
  'surfaceName',
  'protocolFamily',
  'surfaceMode',
  'toolCount',
  'resourceCount',
]);

const EXPECTED_DECISIONS = Object.freeze([
  'VALID',
  'INVALID_SURFACE',
  'INVALID_SURFACE_ID',
  'INVALID_SURFACE_NAME',
  'INVALID_PROTOCOL_FAMILY',
  'INVALID_SURFACE_MODE',
  'INVALID_TOOL_COUNT',
  'INVALID_RESOURCE_COUNT',
]);

const FORBIDDEN_SOURCE_TOKENS = Object.freeze([
  'startMcpServer',
  'stopMcpServer',
  'bindTransport',
  'registerTool',
  'callTool',
  'listTools',
  'listResources',
  'readResource',
  'writeResource',
  'connectGithub',
  'connectLinear',
  'spawnProcess',
  'child_process',
  'worker_threads',
  'createServer',
  'listen(',
  'fetch(',
  'Date.now',
  'randomUUID',
  'Math.random',
  'auditEvent',
  'idempotencyOps',
  'recovery',
  'evidenceLedger',
  'leaseEngine',
  'conflictEngine',
  'scopeExpansion',
]);

function validSurface(overrides = {}) {
  return {
    surfaceId: 'surface-1',
    surfaceName: 'Titan Local MCP',
    protocolFamily: 'MCP',
    surfaceMode: 'LOCAL_IN_MEMORY',
    toolCount: 0,
    resourceCount: 0,
    ...overrides,
  };
}

function assertFrozen(value) {
  assert.equal(Object.isFrozen(value), true);
}

describe('TECP-017 Titan MCP — public contract', () => {
  it('exports only authorized API surface', async () => {
    const mod = await import('../src/titanMcp.js');
    assert.deepEqual(
      Object.keys(mod).sort(),
      [
        'MCP_PROTOCOL_FAMILIES',
        'MCP_SURFACE_MODES',
        'MCP_SURFACE_VALIDATION_DECISIONS',
        'canonicalizeMcpSurface',
        'validateMcpSurface',
      ].sort(),
    );
  });

  it('decision vocabulary is exact and frozen', () => {
    assertFrozen(MCP_SURFACE_VALIDATION_DECISIONS);
    assert.deepEqual(
      Object.keys(MCP_SURFACE_VALIDATION_DECISIONS).sort(),
      [...EXPECTED_DECISIONS].sort(),
    );
    for (const decision of EXPECTED_DECISIONS) {
      assert.equal(MCP_SURFACE_VALIDATION_DECISIONS[decision], decision);
    }
  });

  it('protocol family and surface mode vocabularies are exact and frozen', () => {
    assertFrozen(MCP_PROTOCOL_FAMILIES);
    assertFrozen(MCP_SURFACE_MODES);
    assert.deepEqual(MCP_PROTOCOL_FAMILIES, { MCP: 'MCP' });
    assert.deepEqual(MCP_SURFACE_MODES, { LOCAL_IN_MEMORY: 'LOCAL_IN_MEMORY' });
  });
});

describe('TECP-017 Titan MCP — validateMcpSurface', () => {
  it('accepts a valid surface', () => {
    const result = validateMcpSurface(validSurface());
    assert.equal(result.valid, true);
    assert.equal(result.decision, 'VALID');
    assert.deepEqual(result.reasons, []);
    assert.deepEqual(result.surface, validSurface());
  });

  it('rejects null / array / non-object as INVALID_SURFACE', () => {
    for (const value of [null, undefined, [], 'x', 1, true]) {
      assert.equal(validateMcpSurface(value).decision, 'INVALID_SURFACE');
    }
  });

  it('rejects missing / extra / wrong keys as INVALID_SURFACE', () => {
    const { surfaceId, ...missing } = validSurface();
    assert.equal(validateMcpSurface(missing).decision, 'INVALID_SURFACE');
    assert.equal(
      validateMcpSurface({ ...validSurface(), extra: 'x' }).decision,
      'INVALID_SURFACE',
    );
  });

  it('rejects empty / non-string surfaceId', () => {
    assert.equal(
      validateMcpSurface(validSurface({ surfaceId: '' })).decision,
      'INVALID_SURFACE_ID',
    );
    assert.equal(
      validateMcpSurface(validSurface({ surfaceId: 1 })).decision,
      'INVALID_SURFACE_ID',
    );
  });

  it('rejects empty / non-string surfaceName', () => {
    assert.equal(
      validateMcpSurface(validSurface({ surfaceName: '' })).decision,
      'INVALID_SURFACE_NAME',
    );
    assert.equal(
      validateMcpSurface(validSurface({ surfaceName: null })).decision,
      'INVALID_SURFACE_NAME',
    );
  });

  it('rejects non-MCP protocolFamily (case-sensitive)', () => {
    assert.equal(
      validateMcpSurface(validSurface({ protocolFamily: 'mcp' })).decision,
      'INVALID_PROTOCOL_FAMILY',
    );
    assert.equal(
      validateMcpSurface(validSurface({ protocolFamily: 'HTTP' })).decision,
      'INVALID_PROTOCOL_FAMILY',
    );
  });

  it('rejects non-LOCAL_IN_MEMORY surfaceMode including transport modes', () => {
    for (const mode of ['STDIO', 'HTTP', 'SSE', 'WEBSOCKET', 'REMOTE', 'HOSTED', 'local_in_memory']) {
      assert.equal(
        validateMcpSurface(validSurface({ surfaceMode: mode })).decision,
        'INVALID_SURFACE_MODE',
        mode,
      );
    }
  });

  it('rejects non-zero / non-integer toolCount', () => {
    for (const toolCount of [1, -1, 0.5, '0', null, true]) {
      assert.equal(
        validateMcpSurface(validSurface({ toolCount })).decision,
        'INVALID_TOOL_COUNT',
        String(toolCount),
      );
    }
  });

  it('rejects non-zero / non-integer resourceCount', () => {
    for (const resourceCount of [1, -1, 0.5, '0', null, true]) {
      assert.equal(
        validateMcpSurface(validSurface({ resourceCount })).decision,
        'INVALID_RESOURCE_COUNT',
        String(resourceCount),
      );
    }
  });

  it('precedence: surfaceId before surfaceName', () => {
    assert.equal(
      validateMcpSurface(validSurface({ surfaceId: '', surfaceName: '' })).decision,
      'INVALID_SURFACE_ID',
    );
  });

  it('precedence: surfaceName before protocolFamily', () => {
    assert.equal(
      validateMcpSurface(validSurface({ surfaceName: '', protocolFamily: 'HTTP' })).decision,
      'INVALID_SURFACE_NAME',
    );
  });

  it('precedence: protocolFamily before surfaceMode', () => {
    assert.equal(
      validateMcpSurface(validSurface({ protocolFamily: 'HTTP', surfaceMode: 'STDIO' })).decision,
      'INVALID_PROTOCOL_FAMILY',
    );
  });

  it('precedence: surfaceMode before toolCount', () => {
    assert.equal(
      validateMcpSurface(validSurface({ surfaceMode: 'STDIO', toolCount: 1 })).decision,
      'INVALID_SURFACE_MODE',
    );
  });

  it('precedence: toolCount before resourceCount', () => {
    assert.equal(
      validateMcpSurface(validSurface({ toolCount: 1, resourceCount: 1 })).decision,
      'INVALID_TOOL_COUNT',
    );
  });

  it('valid result contract: frozen copy + reasons', () => {
    const input = validSurface();
    const result = validateMcpSurface(input);
    assert.equal(result.valid, true);
    assert.equal(result.decision, 'VALID');
    assert.deepEqual(result.reasons, []);
    assert.notEqual(result.surface, input);
    assertFrozen(result);
    assertFrozen(result.reasons);
    assertFrozen(result.surface);
  });

  it('invalid result contract: frozen + null surface', () => {
    const result = validateMcpSurface(null);
    assert.equal(result.valid, false);
    assert.equal(result.surface, null);
    assert.deepEqual(result.reasons, [result.decision]);
    assertFrozen(result);
    assertFrozen(result.reasons);
  });

  it('input not mutated on validate', () => {
    const input = validSurface();
    const snapshot = JSON.stringify(input);
    validateMcpSurface(input);
    assert.equal(JSON.stringify(input), snapshot);
  });

  it('same input => deep-equal validation output', () => {
    const input = validSurface();
    const a = validateMcpSurface(input);
    const b = validateMcpSurface(input);
    assert.deepEqual(a, b);
    assert.notEqual(a, b);
    assert.notEqual(a.surface, b.surface);
  });
});

describe('TECP-017 Titan MCP — canonicalizeMcpSurface', () => {
  it('exact field order', () => {
    const canonical = canonicalizeMcpSurface(validSurface());
    assert.deepEqual(Object.keys(canonical), [...CANONICAL_KEY_ORDER]);
  });

  it('no extra fields copied', () => {
    const input = { ...validSurface(), tools: [{ name: 'x' }], extra: 'x' };
    const canonical = canonicalizeMcpSurface(input);
    assert.deepEqual(Object.keys(canonical), [...CANONICAL_KEY_ORDER]);
    assert.equal('extra' in canonical, false);
    assert.equal('tools' in canonical, false);
  });

  it('strings preserved exactly (whitespace + case)', () => {
    const input = validSurface({
      surfaceId: ' Surf-Aa ',
      surfaceName: ' Name ',
    });
    const canonical = canonicalizeMcpSurface(input);
    assert.equal(canonical.surfaceId, ' Surf-Aa ');
    assert.equal(canonical.surfaceName, ' Name ');
  });

  it('no normalization', () => {
    const input = validSurface({ surfaceId: '  id  ' });
    assert.equal(canonicalizeMcpSurface(input).surfaceId, '  id  ');
  });

  it('canonical result frozen', () => {
    assertFrozen(canonicalizeMcpSurface(validSurface()));
  });

  it('input not mutated', () => {
    const input = validSurface();
    const snapshot = JSON.stringify(input);
    canonicalizeMcpSurface(input);
    assert.equal(JSON.stringify(input), snapshot);
  });

  it('same input => deep-equal canonical output', () => {
    const input = validSurface();
    const a = canonicalizeMcpSurface(input);
    const b = canonicalizeMcpSurface(input);
    assert.deepEqual(a, b);
    assert.notEqual(a, b);
  });
});

describe('TECP-017 Titan MCP — boundary exclusions', () => {
  it('forbidden APIs not exported', async () => {
    const mod = await import('../src/titanMcp.js');
    for (const name of [
      'startMcpServer',
      'stopMcpServer',
      'bindTransport',
      'registerTool',
      'callTool',
      'listTools',
      'listResources',
      'readResource',
      'writeResource',
      'connectGithub',
      'connectLinear',
      'spawnProcess',
    ]) {
      assert.equal(mod[name], undefined, name);
    }
  });

  it('forbidden payload / transport fields rejected as extra keys', () => {
    for (const field of [
      'tools',
      'resources',
      'prompts',
      'arguments',
      'inputSchema',
      'outputSchema',
      'uri',
      'mimeType',
      'blob',
      'text',
      'bytes',
      'headers',
      'token',
      'credential',
      'secret',
      'password',
      'createdAt',
      'timestamp',
      'listenPort',
      'host',
      'socket',
    ]) {
      assert.equal(
        validateMcpSurface({ ...validSurface(), [field]: 'x' }).decision,
        'INVALID_SURFACE',
        field,
      );
    }
  });

  it('source boundary — forbidden tokens absent', () => {
    for (const token of FORBIDDEN_SOURCE_TOKENS) {
      assert.equal(SOURCE_TEXT.includes(token), false, `forbidden token present: ${token}`);
    }
  });

  it('authorized source path only', () => {
    assert.equal(SOURCE_PATH.endsWith('tecp/src/titanMcp.js'), true);
  });
});
