import { chromium } from 'playwright';
import fs from 'fs';

const BASE = process.env.PLAYWRIGHT_BASE_URL || 'https://titan.zala.ir';
const TOKEN = process.env.PLAYWRIGHT_ADMIN_TOKEN;

const categories = [
  { id: 'shared_shell', name: 'Agents parent / navigation shell', path: '/?view=ai&dev-login', wait: '[data-ai-tab="agents"], body', agent: null },
  { id: 'readonly_analytical', name: 'Technical (read-only analytical)', path: '/?view=ai&dev-login', wait: '[data-agent-key="technical"]', agent: 'technical' },
  { id: 'provider_llm', name: 'Sentiment (provider/LLM-style)', path: '/?view=ai&dev-login', wait: '[data-agent-key="sentiment"]', agent: 'sentiment' },
  { id: 'market_data', name: 'Market Intelligence (market-data)', path: '/?view=ai&dev-login', wait: '[data-agent-key="market_intelligence"]', agent: 'market_intelligence' },
  { id: 'order_live_capable', name: 'Order Management (order/live-capable)', path: '/?view=ai&dev-login', wait: '[data-agent-key="order"]', agent: 'order' },
];

async function measure(page, cat) {
  const requests = [];
  const failed = [];
  const consoleErrors = [];
  page.removeAllListeners('request');
  page.removeAllListeners('requestfailed');
  page.removeAllListeners('console');
  page.on('request', (r) => requests.push(r.url()));
  page.on('requestfailed', (r) => failed.push(`${r.method()} ${r.url()}`));
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });

  const t0 = Date.now();
  await page.goto(`${BASE}${cat.path}`, { waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.waitForTimeout(800);
  if (cat.agent) {
    const open = page.locator(`[data-testid="agent-open-${cat.agent}"]`).first();
    const card = page.locator(`[data-agent-key="${cat.agent}"]`).first();
    if (await open.count()) await open.click({ timeout: 3000, force: true }).catch(()=>{});
    else if (await card.count()) await card.click({ timeout: 3000, force: true }).catch(()=>{});
    await page.waitForTimeout(700);
  }
  const coldMs = Date.now() - t0;
  const coldCount = requests.length;

  // warm: re-open / reload shell action
  const t1 = Date.now();
  const beforeWarm = requests.length;
  if (cat.agent) {
    await page.keyboard.press('Escape').catch(()=>{});
    await page.waitForTimeout(200);
    const open = page.locator(`[data-testid="agent-open-${cat.agent}"]`).first();
    const card = page.locator(`[data-agent-key="${cat.agent}"]`).first();
    if (await open.count()) await open.click({ timeout: 3000, force: true }).catch(()=>{});
    else if (await card.count()) await card.click({ timeout: 3000, force: true }).catch(()=>{});
    await page.waitForTimeout(500);
  } else {
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(600);
  }
  const warmMs = Date.now() - t1;
  const warmReqs = requests.length - beforeWarm;
  const urls = requests.map((u) => u.split('?')[0]);
  const dup = urls.filter((u, i) => urls.indexOf(u) !== i);
  const uniqueDup = [...new Set(dup)];

  return {
    category: cat.id,
    label: cat.name,
    coldMs,
    warmMs,
    browserRequestCount: requests.length,
    warmRequestCount: warmReqs,
    duplicateUrlCount: uniqueDup.length,
    sampleDuplicates: uniqueDup.slice(0, 5),
    consoleErrors: consoleErrors.slice(0, 10),
    failedRequests: failed.slice(0, 10),
  };
}

const browser = await chromium.launch();
const context = await browser.newContext({ ignoreHTTPSErrors: true });
const page = await context.newPage();
await page.addInitScript(({ t }) => {
  const mockUser = { id: 'pw-admin', name: 'Playwright Admin', email: 'pw-admin@test.local', username: 'pw_admin', role: 'Admin' };
  localStorage.setItem('titan_user', JSON.stringify(mockUser));
  sessionStorage.setItem('titan_user', JSON.stringify(mockUser));
  localStorage.setItem('titan_token', t);
  sessionStorage.setItem('titan_token', t);
  localStorage.setItem('titan_migration_dismissed', 'true');
}, { t: TOKEN });

const out = { measuredAt: new Date().toISOString(), baseURL: BASE, samples: [], equivalenceNotes: [] };
for (const cat of categories) {
  out.samples.push(await measure(page, cat));
}
out.equivalenceNotes = [
  '15 AgentControl* lazy chunks share the same open/close shell and API list pattern; only representatives measured.',
  'Read-only analytical ~ Technical/Pattern/Trend/Volume/Timing (same control panel architecture).',
  'Provider/LLM ~ Sentiment/Fundamental (LLM/provider settings surfaces).',
  'Market-data ~ Market Intelligence/Liquidity/Arbitrage.',
  'Order/live-capable ~ Order Management only for order routes; policy fail-closed under Kill Switch.',
  'BASELINE NOT AVAILABLE vs d705bd2 for runtime-safety-gated surfaces.',
];
// bundle
import { execSync } from 'child_process';
const assets = 'dist/assets';
const chunks = fs.readdirSync(assets).filter(f => f.endsWith('.js')).map(f => ({
  file: f, kb: Math.round(fs.statSync(`${assets}/${f}`).size/1024)
})).sort((a,b)=>b.kb-a.kb);
out.bundle = {
  totalJsCssKb: Math.round(chunks.reduce((s,c)=>s+c.kb,0)),
  topChunks: chunks.slice(0, 8),
  agentControlChunks: chunks.filter(c => c.file.includes('AgentControl')).slice(0, 20),
};
fs.writeFileSync('docs/evidence/performance/representative-frontend-20260714.json', JSON.stringify(out, null, 2));
console.log(JSON.stringify(out.samples, null, 2));
await browser.close();
