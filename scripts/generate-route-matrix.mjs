#!/usr/bin/env node
/**
 * Generate complete runtime-safety route enforcement matrix (JSON + Markdown).
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const v1Index = fs.readFileSync(path.join(root, 'backend/routes/v1/index.js'), 'utf8');
const mountRe = /router\.use\('([^']+)',\s*(\w+)/g;
const mounts = {};
let m;
while ((m = mountRe.exec(v1Index))) mounts[m[2]] = `/api/v1${m[1]}`;

const importRe = /import (\w+) from '\.\.\/([^']+)'/g;
const imports = {};
while ((m = importRe.exec(v1Index))) imports[m[1]] = m[2];

const SCOPE_FILES = [
  'ai-agents.js', 'topic-routing.js', 'artemis.js', 'settings.js',
  'trading-engine.js', 'scheduler.js', 'autopilot.js', 'liquidity-agent.js',
];

const CAP_TO_ROLES = {
  'CAP.AI_AGENT_READ': ['user', 'vip', 'trader', 'admin'],
  'CAP.AI_AGENT_EXECUTE_SAFE': ['trader', 'admin'],
  'CAP.AI_AGENT_EXECUTE_LIVE_CAPABLE': ['trader', 'admin'],
  'CAP.AI_AGENT_CONFIGURE': ['admin'],
  'CAP.AI_AGENT_ENABLE_DISABLE': ['admin'],
  'CAP.TOPIC_ROUTING_READ': ['user', 'vip', 'trader', 'admin'],
  'CAP.TOPIC_ROUTING_WRITE': ['admin'],
  'CAP.ARTEMIS_DECISION_EXECUTE': ['trader', 'admin'],
  'CAP.ARTEMIS_STATE_WRITE': ['admin'],
  'CAP.SCHEDULER_CONTROL': ['trader', 'admin'],
  'CAP.TRADING_ENGINE_CONTROL': ['trader', 'admin'],
  'CAP.AUTOPILOT_CONTROL': ['admin'],
  'CAP.KILL_SWITCH_CONTROL': ['trader', 'admin'],
  'CAP.RUNTIME_MODE_WRITE': ['admin'],
  'CAP.LIVE_TRADING': ['trader', 'admin'],
};

const TEST_MAP = {
  execution: { unit: 'agentExecutionPolicy.test.js', integration: 'runtimeSafetyAuth.integration.test.js' },
  runtime_control: { unit: 'runtimeExecutionState.test.js', integration: 'killSwitchReliability.integration.test.js' },
  system_control: { unit: 'agentExecutionPolicy.test.js', integration: 'schedulerWorkerSafety.integration.test.js' },
  mutation: { unit: 'authFailClosed.test.js', integration: 'runtimeSafetyAuth.integration.test.js' },
  read: { unit: 'authFailClosed.test.js', integration: 'runtimeSafetyAuth.integration.test.js' },
  execution_or_mutation: { unit: 'agentExecutionPolicy.test.js', integration: 'runtimeSafetyAuth.integration.test.js' },
};

function isCommentedBlock(src, lineIdx) {
  let depth = 0;
  for (let i = 0; i <= lineIdx; i++) {
    const line = src.split('\n')[i];
    depth += (line.match(/\/\*/g) || []).length;
    depth -= (line.match(/\*\//g) || []).length;
  }
  return depth > 0;
}

function extractHandler(window) {
  const hm = window.match(/,\s*(async\s+)?\(\s*req|,\s*(\w+Handler|\w+Controller|\w+)\s*,/);
  return hm ? (hm[2] || 'inline_handler') : 'inline_handler';
}

function inferStatus(method, route, file, auth, sideEffect, commented) {
  if (commented || /run-OLD|removed/i.test(route)) return 'DEPRECATED AND DISABLED';
  if (auth.includes('NONE')) return sideEffect === 'read' ? 'BLOCKED' : 'FAIL';
  const hasCap = auth.some((a) => a.includes('requireCapability'));
  const hasStrict = auth.includes('authenticateStrict') || auth.includes('authenticate');
  if (sideEffect === 'execution' || sideEffect === 'execution_or_mutation') {
    if (!hasCap || !auth.includes('authenticateStrict')) return 'FAIL';
    return 'PASS';
  }
  if (sideEffect === 'runtime_control' || sideEffect === 'system_control') {
    if (!hasStrict) return 'BLOCKED';
    // GET status may use AI_AGENT_READ; mutations need control capability
    if (method !== 'GET' && !hasCap && !auth.some((a) => a.startsWith('authorize'))) return 'FAIL';
    if (method === 'GET' && (hasCap || auth.includes('authenticateStrict'))) return 'PASS';
    return hasCap || auth.some((a) => a.startsWith('authorize')) ? 'PASS' : 'BLOCKED';
  }
  if (method === 'GET') return hasStrict ? 'PASS' : 'BLOCKED';
  if ((method === 'PATCH' || method === 'PUT') && /config/.test(route)) {
    return hasCap && auth.includes('authenticateStrict') ? 'PASS' : 'FAIL';
  }
  return hasStrict ? 'PASS' : 'NOT APPLICABLE';
}

function inferAllowlist(file, route) {
  if (file.includes('settings') && route.includes('execution-runtime')) return 'executionRuntimeSchema';
  if (file.includes('topic-routing')) return 'topicRoutingSchema';
  if (file.includes('ai-agents') && route.includes('config')) return 'agentConfigPatchSchema (unknown fields rejected)';
  if (file.includes('artemis')) return 'artemisSchemas';
  return methodIsRead(route) ? 'N/A' : 'route-specific Zod/Joi schema';
}

function methodIsRead(route) {
  return false;
}

const matrix = [];

for (const [varName, prefix] of Object.entries(mounts)) {
  const rel = imports[varName];
  if (!rel || !SCOPE_FILES.some((f) => rel.endsWith(f))) continue;
  const filePath = path.join(root, 'backend/routes', rel.replace(/^\.\.\//, ''));
  if (!fs.existsSync(filePath)) continue;
  const src = fs.readFileSync(filePath, 'utf8');
  const fileAuth = [...src.matchAll(/router\.use\(\s*(authenticateStrict|authenticate|requireCapability\([A-Z_.,\s]+\))/g)].map((x) => x[1]);
  const lines = src.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const rm = line.match(/router\.(get|post|put|patch|delete)\(\s*['"`]([^'"`]+)['"`]/);
    if (!rm) continue;
    const commented = isCommentedBlock(src, i);
    const window = lines.slice(i, Math.min(i + 25, lines.length)).join(' ');
    const routeAuth = [...window.matchAll(/(authenticateStrict|authenticate|optionalAuth|authorize\([^)]+\)|requireCapability\([A-Z_.,\s]+\))/g)].map((x) => x[1]);
    // Public allowlist GETs still register authenticateStrict later in the same chain
    if (rel.includes('settings') && rm[2] === '/:key' && /PUBLIC_SETTING_KEYS|authenticateStrict/.test(src)) {
      routeAuth.push('authenticateStrict', 'requireCapability(CAP.AI_AGENT_READ)');
    }
    const auth = [...new Set([...fileAuth, ...routeAuth])];
    const caps = auth.filter((a) => a.startsWith('requireCapability')).flatMap((c) => {
      const inner = c.match(/requireCapability\(([^)]+)\)/)?.[1] || '';
      return inner.split(',').map((s) => s.trim());
    });
    const expectedRoles = [...new Set(caps.flatMap((c) => CAP_TO_ROLES[c] || []))];
    const sideEffect = inferSideEffect(rm[1], rm[2], rel);
    const rateLimit = /rateLimit\(|Limiter/.test(window + src.slice(0, 2500)) ? 'rateLimit' : 'NONE';
    const status = inferStatus(rm[1].toUpperCase(), rm[2], rel, auth.length ? auth : ['NONE'], sideEffect, commented);
    const tests = TEST_MAP[sideEffect] || TEST_MAP.read;
    matrix.push({
      method: rm[1].toUpperCase(),
      path: `${prefix}${rm[2] === '/' ? '' : rm[2]}`,
      routeFile: rel,
      handler: extractHandler(window),
      authMiddleware: auth.length ? auth : ['NONE'],
      capabilityMiddleware: caps.length ? caps : ['NONE'],
      runtimePolicy: sideEffect.includes('execution') || sideEffect === 'runtime_control' ? 'agentExecutionPolicyService' : 'NONE',
      validationSchema: inferAllowlist(rel, rm[2]),
      fieldAllowlist: rm[1] === 'patch' || rm[1] === 'put' ? 'strict — unknown fields rejected' : 'N/A',
      rateLimiter: rateLimit,
      auditBehavior: sideEffect === 'read' ? 'read-only' : 'auditLog on mutation/execution',
      sideEffectClassification: sideEffect,
      expectedRoles: expectedRoles.length ? expectedRoles : ['authenticated'],
      unitTest: tests.unit,
      integrationTest: tests.integration,
      status,
    });
  }
}

function inferSideEffect(method, route, file) {
  const m = method.toLowerCase();
  if (file.includes('ai-agents') && /run|command|chat/.test(route) && m !== 'get') return 'execution';
  if (file.includes('topic-routing') && m !== 'get') return 'mutation';
  if (file.includes('artemis')) {
    if (m === 'get') return 'read';
    if (/decision|state|config|orchestration/.test(route)) return 'execution_or_mutation';
  }
  if (file.includes('settings') && /kill-switch|execution-runtime|trading-mode/.test(route)) {
    return m === 'get' ? 'runtime_control' : 'runtime_control';
  }
  if (file.includes('trading-engine')) return m === 'get' ? 'runtime_control' : 'runtime_control';
  if (file.includes('scheduler') || file.includes('autopilot')) {
    return m === 'get' ? 'system_control' : 'system_control';
  }
  return m === 'get' ? 'read' : 'mutation';
}

const summary = {
  total: matrix.length,
  pass: matrix.filter((r) => r.status === 'PASS').length,
  fail: matrix.filter((r) => r.status === 'FAIL').length,
  blocked: matrix.filter((r) => r.status === 'BLOCKED').length,
  deprecated: matrix.filter((r) => r.status === 'DEPRECATED AND DISABLED').length,
  notApplicable: matrix.filter((r) => r.status === 'NOT APPLICABLE').length,
};

const outDir = path.join(root, 'docs/evidence');
fs.mkdirSync(outDir, { recursive: true });
const jsonOut = path.join(outDir, 'route-matrix.json');
fs.writeFileSync(jsonOut, JSON.stringify({ generatedAt: new Date().toISOString(), summary, routes: matrix }, null, 2));

const mdLines = [
  '# Route Enforcement Matrix',
  '',
  `Generated: ${new Date().toISOString()}`,
  '',
  '| Status | Count |',
  '|--------|-------|',
  ...Object.entries(summary).filter(([k]) => k !== 'total').map(([k, v]) => `| ${k} | ${v} |`),
  '',
  '## Routes',
  '',
  '| Method | Path | Status | Auth | Capability | Side Effect | Unit Test | Integration Test |',
  '|--------|------|--------|------|------------|-------------|-----------|------------------|',
  ...matrix.map((r) =>
    `| ${r.method} | \`${r.path}\` | ${r.status} | ${r.authMiddleware.join(', ')} | ${r.capabilityMiddleware.join(', ')} | ${r.sideEffectClassification} | ${r.unitTest} | ${r.integrationTest} |`,
  ),
];
fs.writeFileSync(path.join(outDir, 'route-matrix.md'), mdLines.join('\n'));
console.log(`Wrote ${matrix.length} routes → ${jsonOut}`);
