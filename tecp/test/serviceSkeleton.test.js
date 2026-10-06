import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { test } from 'node:test';

import {
  CANONICAL_CONFIG_KEYS,
  GITHUB_PORT_CONTRACT,
  LINEAR_PORT_CONTRACT,
  TECP_SLICE_ID,
  createCanonicalConfig,
  createGithubPort,
  createLinearPort,
  createService,
  evaluateHealth,
  validateConfig,
} from '../src/index.js';

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
  'undici',
  'octokit',
  '@linear',
  'ioredis',
  "from 'pg'",
  'process.env',
  'setInterval(',
  'setTimeout(',
  'createServer(',
  'request(',
];

function listSourceFiles(dir, acc = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = `${dir}/${entry.name}`;
    if (entry.isDirectory()) {
      listSourceFiles(path, acc);
    } else if (entry.name.endsWith('.js')) {
      acc.push(path);
    }
  }
  return acc;
}

test('canonical config is the only valid local skeleton', () => {
  const config = validateConfig(createCanonicalConfig());
  assert.deepEqual(Object.keys(config), [...CANONICAL_CONFIG_KEYS]);
  assert.equal(config.sliceId, TECP_SLICE_ID);
  assert.equal(config.environment, 'local');
  assert.equal(config.persistence, 'none');
  assert.equal(config.outboundNetwork, false);
  assert.equal(Object.isFrozen(config), true);
});

test('config rejects unknown, secret, network, and non-local values', () => {
  const base = createCanonicalConfig();
  assert.throws(() => validateConfig({ ...base, extra: true }), { code: 'CONFIG_UNKNOWN_FIELD' });
  assert.throws(() => validateConfig({ ...base, githubToken: 'x' }), { code: 'CONFIG_SECRET_FORBIDDEN' });
  assert.throws(() => validateConfig({ ...base, linearApiKey: 'x' }), { code: 'CONFIG_SECRET_FORBIDDEN' });
  assert.throws(() => validateConfig({ ...base, webhookUrl: 'https://example.invalid' }), { code: 'CONFIG_NETWORK_FORBIDDEN' });
  assert.throws(() => validateConfig({ ...base, environment: 'production' }), { code: 'CONFIG_ENVIRONMENT' });
  assert.throws(() => validateConfig({ ...base, persistence: 'redis' }), { code: 'CONFIG_PERSISTENCE' });
  assert.throws(() => validateConfig({ ...base, outboundNetwork: true }), { code: 'CONFIG_OUTBOUND_NETWORK' });
  assert.throws(() => validateConfig(null), { code: 'CONFIG_NOT_OBJECT' });
});

test('bootstrap lifecycle is deterministic and non-restartable', () => {
  const service = createService();
  assert.equal(service.getLifecycle(), 'CREATED');
  assert.equal(service.getHealth().status, 'unavailable');
  assert.equal(service.getHealth().reason, 'NOT_STARTED');

  const started = service.start();
  assert.equal(service.getLifecycle(), 'STARTED');
  assert.equal(started.status, 'ok');
  assert.equal(started.reason, 'LOCAL_SKELETON_READY');
  assert.throws(() => service.start(), { code: 'INVALID_START' });

  const stopped = service.stop();
  assert.equal(service.getLifecycle(), 'STOPPED');
  assert.equal(stopped.status, 'unavailable');
  assert.equal(stopped.reason, 'STOPPED');
  assert.throws(() => service.stop(), { code: 'INVALID_STOP' });
  assert.throws(() => service.start(), { code: 'INVALID_START' });
});

test('two bootstraps produce the same health document', () => {
  const first = createService().start();
  const second = createService().start();
  assert.deepEqual(first, second);
  assert.equal(JSON.stringify(first).includes('Date'), false);
});

test('github stub has zero live authority', () => {
  const port = createGithubPort();
  assert.equal(port.contract, GITHUB_PORT_CONTRACT);
  assert.equal(port.contract.liveAuthority, false);
  assert.equal(port.contract.networkEnabled, false);
  assert.equal(port.contract.mutationEnabled, false);
  assert.equal(port.contract.credentialAccess, false);
  assert.equal(port.sideEffects.networkRequests, 0);
  assert.equal(port.sideEffects.mutations, 0);
  for (const operation of ['clone', 'push', 'createPullRequest', 'mergePullRequest', 'request', '']) {
    assert.throws(() => port.invoke(operation), { code: 'GITHUB_PORT_FAIL_CLOSED' });
  }
  assert.equal(port.sideEffects.networkRequests, 0);
  assert.equal(port.sideEffects.mutations, 0);
  assert.equal(port.sideEffects.credentialReads, 0);
});

test('linear stub has zero live authority', () => {
  const port = createLinearPort();
  assert.equal(port.contract, LINEAR_PORT_CONTRACT);
  assert.equal(port.contract.liveAuthority, false);
  assert.equal(port.contract.networkEnabled, false);
  assert.equal(port.contract.mutationEnabled, false);
  assert.equal(port.contract.credentialAccess, false);
  assert.equal(port.sideEffects.networkRequests, 0);
  assert.equal(port.sideEffects.mutations, 0);
  for (const operation of ['createIssue', 'updateIssue', 'deleteIssue', 'comment', 'request', '']) {
    assert.throws(() => port.invoke(operation), { code: 'LINEAR_PORT_FAIL_CLOSED' });
  }
  assert.equal(port.sideEffects.networkRequests, 0);
  assert.equal(port.sideEffects.mutations, 0);
  assert.equal(port.sideEffects.credentialReads, 0);
});

test('service side-effect ledger stays zero through start and denied port calls', () => {
  const service = createService();
  service.start();
  const ports = service.getPorts();
  assert.throws(() => ports.github.invoke('push'));
  assert.throws(() => ports.linear.invoke('createIssue'));
  const effects = service.getSideEffects();
  assert.deepEqual(effects, {
    networkRequests: 0,
    githubMutations: 0,
    linearMutations: 0,
    dbWrites: 0,
    redisWrites: 0,
    filesystemRuntimePersistence: 0,
    schedulerStarts: 0,
    workerStarts: 0,
    productionRuntime: 0,
  });
  const health = service.getHealth();
  assert.equal(health.githubLiveAuthority, false);
  assert.equal(health.linearLiveAuthority, false);
  assert.equal(health.sideEffects.networkRequests, 0);
});

test('health fails closed when a port claims live authority', () => {
  const service = createService();
  service.start();
  const health = evaluateHealth({
    lifecycle: 'STARTED',
    config: service.getConfig(),
    github: { contract: { liveAuthority: true, networkEnabled: false }, sideEffects: { networkRequests: 0, mutations: 0 } },
    linear: service.getPorts().linear,
    sideEffects: service.getSideEffects(),
  });
  assert.equal(health.status, 'unavailable');
  assert.equal(health.reason, 'GITHUB_LIVE_AUTHORITY');
});

test('package manifest has no external dependencies', () => {
  const manifest = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  assert.equal(manifest.name, 'tecp');
  assert.equal(manifest.private, true);
  assert.equal(manifest.type, 'module');
  assert.equal(manifest.dependencies, undefined);
  assert.equal(manifest.devDependencies, undefined);
  assert.equal(manifest.scripts.test, 'node --test test/serviceSkeleton.test.js');
});

test('service source does not import network, filesystem, or provider SDKs', () => {
  const files = listSourceFiles(new URL('../src/', import.meta.url).pathname);
  assert.ok(files.length >= 6);
  for (const file of files) {
    const source = readFileSync(file, 'utf8');
    for (const token of FORBIDDEN_SOURCE) {
      assert.equal(source.includes(token), false, `${file} contains ${token}`);
    }
  }
});
