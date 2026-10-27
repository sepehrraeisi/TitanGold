import { McpServer } from '@modelcontextprotocol/server';
import { z } from 'zod';

export const MCP_SERVER_NAME = 'titangold-tecp';
export const MCP_DISPLAY_NAME = 'TitanGold TECP MCP';
export const MCP_SURFACE_VERSION = 'tecp-mcp-v1';
export const MCP_TRANSPORT = 'stdio';

export const MCP_TOOL_NAMES = Object.freeze([
  'titan_tecp_ping',
  'titan_tecp_manifest',
]);

export const FORBIDDEN_TRANSPORTS = Object.freeze([
  'http',
  'https',
  'sse',
  'websocket',
  'ws',
  'listening-port',
  'listening_port',
]);

const EMPTY_INPUT_SCHEMA = z.object({});

export function createPingResult() {
  return Object.freeze({
    ok: true,
    service: MCP_DISPLAY_NAME,
    surfaceVersion: MCP_SURFACE_VERSION,
  });
}

export function createManifestResult() {
  return Object.freeze({
    name: MCP_SERVER_NAME,
    displayName: MCP_DISPLAY_NAME,
    surfaceVersion: MCP_SURFACE_VERSION,
    transport: MCP_TRANSPORT,
    networkEnabled: false,
    mutationToolsEnabled: false,
    productionMutationEnabled: false,
    workerExecutionEnabled: false,
    toolNames: Object.freeze([...MCP_TOOL_NAMES]),
  });
}

function toolResponse(result) {
  return {
    content: Object.freeze([
      Object.freeze({
        type: 'text',
        text: JSON.stringify(result),
      }),
    ]),
    structuredContent: result,
  };
}

export function rejectForbiddenGatewayShape(shape) {
  if (shape === null || typeof shape !== 'object' || Array.isArray(shape)) {
    return Object.freeze({
      valid: false,
      decision: 'INVALID_GATEWAY_SHAPE',
      reasons: Object.freeze(['INVALID_GATEWAY_SHAPE']),
    });
  }

  const reasons = [];
  const transport = shape.transport;
  if (typeof transport === 'string') {
    const normalized = transport.trim().toLowerCase();
    if (normalized !== MCP_TRANSPORT) {
      reasons.push('FORBIDDEN_TRANSPORT');
    }
    if (FORBIDDEN_TRANSPORTS.includes(normalized)) {
      reasons.push('FORBIDDEN_TRANSPORT');
    }
  }

  if (shape.networkEnabled === true) {
    reasons.push('NETWORK_ENABLED');
  }
  if (shape.mutationToolsEnabled === true) {
    reasons.push('MUTATION_TOOLS_ENABLED');
  }
  if (shape.productionMutationEnabled === true) {
    reasons.push('PRODUCTION_MUTATION_ENABLED');
  }
  if (shape.workerExecutionEnabled === true) {
    reasons.push('WORKER_EXECUTION_ENABLED');
  }
  if (shape.listeningPort !== undefined && shape.listeningPort !== null) {
    reasons.push('LISTENING_PORT');
  }
  if (shape.resourcesEnabled === true || shape.resourceCount > 0) {
    reasons.push('RESOURCES_ENABLED');
  }
  if (shape.promptsEnabled === true || shape.promptCount > 0) {
    reasons.push('PROMPTS_ENABLED');
  }
  if (Array.isArray(shape.toolNames)) {
    const unknown = shape.toolNames.filter((name) => !MCP_TOOL_NAMES.includes(name));
    if (unknown.length > 0) {
      reasons.push('MUTATION_OR_UNKNOWN_TOOL');
    }
  }
  if (Array.isArray(shape.domainImports) && shape.domainImports.length > 0) {
    reasons.push('DOMAIN_IMPORT');
  }

  if (reasons.length > 0) {
    return Object.freeze({
      valid: false,
      decision: 'FORBIDDEN_GATEWAY_SHAPE',
      reasons: Object.freeze([...new Set(reasons)]),
    });
  }

  return Object.freeze({
    valid: true,
    decision: 'VALID',
    reasons: Object.freeze([]),
  });
}

export function createTitanMcpServer() {
  const server = new McpServer(
    {
      name: MCP_SERVER_NAME,
      version: MCP_SURFACE_VERSION,
    },
    {
      capabilities: {
        tools: {},
      },
    },
  );

  server.registerTool(
    'titan_tecp_ping',
    {
      title: 'TECP Ping',
      description:
        'Bounded frozen ping proving the local MCP server is reachable over stdio.',
      inputSchema: EMPTY_INPUT_SCHEMA,
    },
    async () => toolResponse(createPingResult()),
  );

  server.registerTool(
    'titan_tecp_manifest',
    {
      title: 'TECP Manifest',
      description:
        'Bounded frozen manifest describing the local MCP control-plane gateway surface.',
      inputSchema: EMPTY_INPUT_SCHEMA,
    },
    async () => toolResponse(createManifestResult()),
  );

  return server;
}
