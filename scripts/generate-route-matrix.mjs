#!/usr/bin/env node
/**
 * Generate runtime-safety route matrix from mounted route files.
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

const routeRe = /router\.(get|post|put|patch|delete)\(\s*['"`]([^'"`]+)['"`]/g;
const authRe = /(authenticateStrict|authenticate|optionalAuth|authorize\([^)]+\)|requireCapability\([^)]+\))/g;

const matrix = [];

for (const [varName, prefix] of Object.entries(mounts)) {
  const rel = imports[varName];
  if (!rel || !SCOPE_FILES.some((f) => rel.endsWith(f))) continue;
  const filePath = path.join(root, 'backend/routes', rel.replace(/^\.\.\//, ''));
  if (!fs.existsSync(filePath)) continue;
  const src = fs.readFileSync(filePath, 'utf8');
  const lines = src.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const rm = line.match(/router\.(get|post|put|patch|delete)\(\s*['"`]([^'"`]+)['"`]/);
    if (!rm) continue;
    const window = lines.slice(i, Math.min(i + 3, lines.length)).join(' ');
    const auth = [...window.matchAll(/(authenticateStrict|authenticate|optionalAuth|authorize\([^)]+\)|requireCapability\([A-Z_.,\s]+\))/g)].map((x) => x[1]);
    matrix.push({
      method: rm[1].toUpperCase(),
      path: `${prefix}${rm[2] === '/' ? '' : rm[2]}`,
      file: rel,
      auth: auth.length ? auth : ['NONE'],
      sideEffect: inferSideEffect(rm[1], rm[2], rel),
    });
  }
}

function inferSideEffect(method, route, file) {
  if (file.includes('ai-agents') && /run|command|chat/.test(route)) return 'execution';
  if (file.includes('topic-routing') && method !== 'get') return 'mutation';
  if (file.includes('artemis') && /decision|state|config|orchestration/.test(route)) return 'execution_or_mutation';
  if (file.includes('settings') && /kill-switch|execution-runtime|trading-mode/.test(route)) return 'runtime_control';
  if (file.includes('trading-engine')) return 'runtime_control';
  if (file.includes('scheduler') || file.includes('autopilot')) return 'system_control';
  return method === 'get' ? 'read' : 'mutation';
}

const outDir = path.join(root, 'docs/evidence');
fs.mkdirSync(outDir, { recursive: true });
const out = path.join(outDir, 'route-matrix.json');
fs.writeFileSync(out, JSON.stringify({ generatedAt: new Date().toISOString(), routes: matrix }, null, 2));
console.log(`Wrote ${matrix.length} routes to ${out}`);
