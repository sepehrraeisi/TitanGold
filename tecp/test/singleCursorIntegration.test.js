/**
 * TECP-018 — single local Cursor client integration contract.
 *
 * Test-only verification of project-scoped configuration and read-only
 * references to the frozen TECP-017 MCP surface. No process is launched here.
 * Human QA separately proves the actual Cursor UI connection.
 */
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { createManifestResult, createPingResult } from '../src/mcpServer.js';

const testDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(testDir, '../..');
const configPath = join(repoRoot, '.cursor/mcp.json');
const serverEntryPath = join(repoRoot, 'tecp/src/mcpStdio.js');
const serverSourcePath = join(repoRoot, 'tecp/src/mcpServer.js');
const serverName = 'titangold-tecp';
const entryArg = '${workspaceFolder}/tecp/src/mcpStdio.js';

function loadConfig() {
  return JSON.parse(readFileSync(configPath, 'utf8'));
}

function serverConfig() {
  return loadConfig().mcpServers[serverName];
}

test('project-local MCP configuration is valid JSON with the exact root shape', () => {
  const config = loadConfig();
  assert.deepEqual(Object.keys(config), ['mcpServers']);
  assert.equal(Object.getPrototypeOf(config), Object.prototype);
});

test('exactly one MCP server is registered: TitanGold TECP', () => {
  const servers = loadConfig().mcpServers;
  assert.equal(servers !== null && typeof servers === 'object' && !Array.isArray(servers), true);
  assert.deepEqual(Object.keys(servers), [serverName]);
});

test('server entry has only type, command and args (no expanded authority)', () => {
  assert.deepEqual(serverConfig(), {
    type: 'stdio',
    command: 'node',
    args: [entryArg],
  });
});

test('local stdio transport is mandatory; no remote transport or listening port', () => {
  const server = serverConfig();
  assert.equal(server.type, 'stdio');
  assert.equal(server.command, 'node');
  assert.deepEqual(server.args, [entryArg]);
  assert.equal(server.args.length, 1);
  assert.equal(server.args[0].startsWith('${workspaceFolder}/'), true);
});

test('no credentials, environment files, headers, custom endpoints or other keys', () => {
  const server = serverConfig();
  for (const field of [
    'env', 'envFile', 'url', 'headers', 'auth', 'port', 'host',
    'endpoint', 'transport', 'token', 'apiKey', 'cwd', 'shell',
  ]) {
    assert.equal(Object.hasOwn(server, field), false, field);
  }
  assert.equal(Object.keys(loadConfig()).length, 1);
});

test('workspaceFolder resolves to the frozen TECP-017 stdio entrypoint', () => {
  const arg = serverConfig().args[0];
  assert.equal(arg, entryArg);
  const expanded = arg.replace('${workspaceFolder}', repoRoot);
  assert.equal(resolve(expanded), serverEntryPath);
  assert.equal(existsSync(serverEntryPath), true);
});

test('entrypoint still uses the frozen local MCP stdio server adapter', () => {
  const entry = readFileSync(serverEntryPath, 'utf8');
  assert.match(entry, /@modelcontextprotocol\/server\/stdio/);
  assert.match(entry, /serveStdio/);
  assert.match(entry, /createTitanMcpServer/);
  assert.equal(entry.includes('process.env'), false);
});

test('server remains the read-only two-tool TECP-017 gateway', () => {
  assert.equal(existsSync(serverSourcePath), true);
  const manifest = createManifestResult();
  assert.deepEqual(manifest.toolNames, ['titan_tecp_ping', 'titan_tecp_manifest']);
  assert.equal(manifest.name, serverName);
  assert.equal(manifest.transport, 'stdio');
  assert.equal(manifest.networkEnabled, false);
  assert.equal(manifest.mutationToolsEnabled, false);
  assert.equal(manifest.productionMutationEnabled, false);
  assert.equal(manifest.workerExecutionEnabled, false);
  assert.deepEqual(createPingResult(), {
    ok: true,
    service: 'TitanGold TECP MCP',
    surfaceVersion: 'tecp-mcp-v1',
  });
});

test('configuration and reference inspection are repeatable and side-effect-free', () => {
  const initial = readFileSync(configPath);
  const first = loadConfig();
  const second = loadConfig();
  assert.deepEqual(first, second);
  assert.deepEqual(readFileSync(configPath), initial);
  assert.equal(Object.keys(first.mcpServers).length, 1);
});
