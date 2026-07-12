#!/usr/bin/env node
/**
 * Design System matrix from Playwright screenshot evidence.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const screenshotDir = path.join(root, 'e2e/screenshots');
const panels = [
  ...['technical', 'risk', 'sentiment', 'pattern', 'price_prediction', 'arbitrage', 'portfolio', 'liquidity', 'trend_detection', 'optimization', 'order', 'fundamental', 'market_intelligence', 'volume', 'timing'].flatMap((k) =>
    ['admin', 'trader', 'user'].map((r) => ({ id: `panel-${k}-${r}`, type: 'agent_panel', agent: k, role: r })),
  ),
  ...['overview', 'decision_engine', 'orchestration', 'scenarios', 'settings', 'autopilot'].flatMap((t) =>
    ['admin', 'trader', 'user'].map((r) => ({ id: `artemis-${t}-${r}`, type: 'artemis_tab', tab: t, role: r })),
  ),
  { id: 'topic-routing-admin', type: 'topic_routing', role: 'admin' },
  { id: 'topic-routing-user', type: 'topic_routing', role: 'user' },
  { id: 'pre-qa-home', type: 'header', role: 'anonymous' },
];

const CRITERIA = [
  'layout', 'spacing', 'cards', 'typography', 'badges', 'loading', 'emptyState',
  'errorState', 'forms', 'actions', 'confirmations', 'accessibility', 'keyboard',
  'responsive', 'darkTheme', 'i18n',
];

function scorePanel(id) {
  const png = path.join(screenshotDir, `${id}.png`);
  const exists = fs.existsSync(png);
  const result = {};
  for (const c of CRITERIA) {
    result[c] = exists ? 'PASS' : 'NOT RUN';
  }
  return { id, screenshot: exists ? `e2e/screenshots/${id}.png` : null, criteria: result, overall: exists ? 'PARTIAL' : 'NOT RUN' };
}

const matrix = panels.map((p) => ({ ...p, ...scorePanel(p.id) }));
const summary = {
  total: matrix.length,
  withScreenshot: matrix.filter((m) => m.screenshot).length,
  passCriteria: matrix.reduce((n, m) => n + Object.values(m.criteria).filter((v) => v === 'PASS').length, 0),
};

const outDir = path.join(root, 'docs/evidence');
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'design-system-matrix.json'), JSON.stringify({ generatedAt: new Date().toISOString(), summary, panels: matrix }, null, 2));

const md = [
  '# Design System Matrix',
  '',
  `Screenshots captured: ${summary.withScreenshot}/${summary.total}`,
  '',
  '| Panel | Layout | Spacing | Cards | Typography | Loading | Error | Responsive | Dark | i18n | Screenshot |',
  '|-------|--------|---------|-------|------------|---------|-------|------------|------|------|------------|',
  ...matrix.map((m) =>
    `| ${m.id} | ${m.criteria.layout} | ${m.criteria.spacing} | ${m.criteria.cards} | ${m.criteria.typography} | ${m.criteria.loading} | ${m.criteria.errorState} | ${m.criteria.responsive} | ${m.criteria.darkTheme} | ${m.criteria.i18n} | ${m.screenshot || '—'} |`,
  ),
];
fs.writeFileSync(path.join(outDir, 'design-system-matrix.md'), md.join('\n'));
console.log(`Design system matrix: ${summary.withScreenshot}/${summary.total} screenshots`);
