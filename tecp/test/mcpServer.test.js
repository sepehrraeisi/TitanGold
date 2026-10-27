import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';
import {
  FORBIDDEN_TRANSPORTS,
  MCP_DISPLAY_NAME,
  MCP_SERVER_NAME,
  MCP_SURFACE_VERSION,
  MCP_TOOL_NAMES,
  MCP_TRANSPORT,
  createManifestResult,
  createPingResult,
  createTitanMcpServer,
  rejectForbiddenGatewayShape,
} from '../src/mcpServer.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const MCP_SERVER_SOURCE = readFileSync(join(ROOT, 'src/mcpServer.js'), 'utf8');
const MCP_STDIO_SOURCE = readFileSync(join(ROOT, 'src/mcpStdio.js'), 'utf8');
const PACKAGE_JSON = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));

const FORBIDDEN_DOMAIN_IMPORT_TOKENS = Object.freeze([
  'actorCapabilityEngine',
  'taskGraph',
  'resourceClaims',
  'conflictEngine',
  'leaseEngine',
  'scopeExpansion',
  'auditEvent',
  'idempotencyOps',
  'recovery',
  'evidenceLedger',
  'rule02Parser',
  'governanceValidator',
  'githubPort',
  'linearPort',
]);

const FORBIDDEN_RUNTIME_TOKENS = Object.freeze([
  'process.env',
  'child_process',
  'worker_threads',
  'createServer',
  'listen(',
  'WebSocket',
  'EventSource',
  'fetch(',
  'http://',
  'https://',
  'console.log',
  'Date.now',
  'Math.random',
  'randomUUID',
  'crypto.random',
]);

function registeredToolNames(server) {
  return Object.keys(server._registeredTools || {}).sort();
}

function registeredResourceNames(server) {
  return Object.keys(server._registeredResources || {}).sort();
}

function registeredPromptNames(server) {
  return Object.keys(server._registeredPrompts || {}).sort();
}

describe('TECP-017 Titan MCP server', () => {
  it('exports frozen server identity constants', () => {
    assert.equal(MCP_SERVER_NAME, 'titangold-tecp');
    assert.equal(MCP_DISPLAY_NAME, 'TitanGold TECP MCP');
    assert.equal(MCP_SURFACE_VERSION, 'tecp-mcp-v1');
    assert.equal(MCP_TRANSPORT, 'stdio');
    assert.deepEqual([...MCP_TOOL_NAMES], [
      'titan_tecp_ping',
      'titan_tecp_manifest',
    ]);
    assert.ok(Object.isFrozen(MCP_TOOL_NAMES));
    assert.ok(Object.isFrozen(FORBIDDEN_TRANSPORTS));
  });

  it('createPingResult returns the exact frozen ping payload', () => {
    const first = createPingResult();
    const second = createPingResult();
    assert.deepEqual(first, {
      ok: true,
      service: 'TitanGold TECP MCP',
      surfaceVersion: 'tecp-mcp-v1',
    });
    assert.deepEqual(first, second);
    assert.ok(Object.isFrozen(first));
    assert.notEqual(first, second);
  });

  it('createManifestResult returns the exact frozen stdio gateway manifest', () => {
    const first = createManifestResult();
    const second = createManifestResult();
    assert.deepEqual(first, {
      name: 'titangold-tecp',
      displayName: 'TitanGold TECP MCP',
      surfaceVersion: 'tecp-mcp-v1',
      transport: 'stdio',
      networkEnabled: false,
      mutationToolsEnabled: false,
      productionMutationEnabled: false,
      workerExecutionEnabled: false,
      toolNames: ['titan_tecp_ping', 'titan_tecp_manifest'],
    });
    assert.deepEqual(first, second);
    assert.ok(Object.isFrozen(first));
    assert.ok(Object.isFrozen(first.toolNames));
    assert.notEqual(first, second);
  });

  it('createTitanMcpServer registers exactly the two authorized tools', () => {
    const server = createTitanMcpServer();
    assert.equal(server.server._serverInfo.name, 'titangold-tecp');
    assert.equal(server.server._serverInfo.version, 'tecp-mcp-v1');
    assert.deepEqual(registeredToolNames(server), [
      'titan_tecp_manifest',
      'titan_tecp_ping',
    ]);
    assert.deepEqual(registeredResourceNames(server), []);
    assert.deepEqual(registeredPromptNames(server), []);
  });

  it('titan_tecp_ping handler returns deterministic structured content', async () => {
    const server = createTitanMcpServer();
    const tool = server._registeredTools.titan_tecp_ping;
    assert.ok(tool);
    assert.equal(typeof tool.handler, 'function');
    const result = await tool.handler({});
    assert.deepEqual(result.structuredContent, createPingResult());
    assert.equal(result.content.length, 1);
    assert.equal(result.content[0].type, 'text');
    assert.equal(result.content[0].text, JSON.stringify(createPingResult()));
  });

  it('titan_tecp_manifest handler returns deterministic structured content', async () => {
    const server = createTitanMcpServer();
    const tool = server._registeredTools.titan_tecp_manifest;
    assert.ok(tool);
    assert.equal(typeof tool.handler, 'function');
    const result = await tool.handler({});
    assert.deepEqual(result.structuredContent, createManifestResult());
    assert.equal(result.content.length, 1);
    assert.equal(result.content[0].type, 'text');
    assert.equal(result.content[0].text, JSON.stringify(createManifestResult()));
  });

  it('rejectForbiddenGatewayShape accepts the canonical stdio surface', () => {
    const decision = rejectForbiddenGatewayShape(createManifestResult());
    assert.deepEqual(decision, {
      valid: true,
      decision: 'VALID',
      reasons: [],
    });
    assert.ok(Object.isFrozen(decision));
  });

  it('rejectForbiddenGatewayShape fails closed on HTTP/SSE/WebSocket/listening-port shapes', () => {
    for (const transport of ['http', 'https', 'sse', 'websocket', 'ws']) {
      const decision = rejectForbiddenGatewayShape({
        ...createManifestResult(),
        transport,
      });
      assert.equal(decision.valid, false);
      assert.equal(decision.decision, 'FORBIDDEN_GATEWAY_SHAPE');
      assert.ok(decision.reasons.includes('FORBIDDEN_TRANSPORT'));
    }

    const listening = rejectForbiddenGatewayShape({
      ...createManifestResult(),
      listeningPort: 3000,
    });
    assert.equal(listening.valid, false);
    assert.ok(listening.reasons.includes('LISTENING_PORT'));
  });

  it('rejectForbiddenGatewayShape fails closed on resource/prompt/mutation/domain shapes', () => {
    const resources = rejectForbiddenGatewayShape({
      ...createManifestResult(),
      resourcesEnabled: true,
    });
    assert.equal(resources.valid, false);
    assert.ok(resources.reasons.includes('RESOURCES_ENABLED'));

    const prompts = rejectForbiddenGatewayShape({
      ...createManifestResult(),
      promptsEnabled: true,
    });
    assert.equal(prompts.valid, false);
    assert.ok(prompts.reasons.includes('PROMPTS_ENABLED'));

    const mutation = rejectForbiddenGatewayShape({
      ...createManifestResult(),
      mutationToolsEnabled: true,
      toolNames: ['titan_tecp_ping', 'titan_tecp_manifest', 'mutate_anything'],
    });
    assert.equal(mutation.valid, false);
    assert.ok(mutation.reasons.includes('MUTATION_TOOLS_ENABLED'));
    assert.ok(mutation.reasons.includes('MUTATION_OR_UNKNOWN_TOOL'));

    const domain = rejectForbiddenGatewayShape({
      ...createManifestResult(),
      domainImports: ['leaseEngine'],
    });
    assert.equal(domain.valid, false);
    assert.ok(domain.reasons.includes('DOMAIN_IMPORT'));
  });

  it('mcp sources do not import TECP domain modules or use forbidden runtime tokens', () => {
    for (const token of FORBIDDEN_DOMAIN_IMPORT_TOKENS) {
      assert.equal(
        MCP_SERVER_SOURCE.includes(token),
        false,
        `mcpServer.js must not reference ${token}`,
      );
      assert.equal(
        MCP_STDIO_SOURCE.includes(token),
        false,
        `mcpStdio.js must not reference ${token}`,
      );
    }

    for (const token of FORBIDDEN_RUNTIME_TOKENS) {
      assert.equal(
        MCP_SERVER_SOURCE.includes(token),
        false,
        `mcpServer.js must not contain ${token}`,
      );
      assert.equal(
        MCP_STDIO_SOURCE.includes(token),
        false,
        `mcpStdio.js must not contain ${token}`,
      );
    }
  });

  it('mcpStdio entry uses official stdio transport factory only', () => {
    assert.match(MCP_STDIO_SOURCE, /from '@modelcontextprotocol\/server\/stdio'/);
    assert.match(MCP_STDIO_SOURCE, /serveStdio/);
    assert.match(MCP_STDIO_SOURCE, /createTitanMcpServer/);
    assert.equal(MCP_STDIO_SOURCE.includes('http'), false);
    assert.equal(MCP_STDIO_SOURCE.includes('sse'), false);
    assert.equal(MCP_STDIO_SOURCE.includes('WebSocket'), false);
    assert.equal(MCP_STDIO_SOURCE.includes('listen('), false);
  });

  it('package.json pins only authorized MCP runtime dependencies', () => {
    assert.equal(
      PACKAGE_JSON.dependencies['@modelcontextprotocol/server'],
      '2.4.0',
    );
    assert.equal(PACKAGE_JSON.dependencies.zod, '4.6.7');
    assert.equal(
      PACKAGE_JSON.dependencies['@modelcontextprotocol/sdk'],
      undefined,
    );
    assert.deepEqual(Object.keys(PACKAGE_JSON.dependencies).sort(), [
      '@modelcontextprotocol/server',
      'zod',
    ]);
  });
});
