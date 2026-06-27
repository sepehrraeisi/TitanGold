#!/usr/bin/env node
/**
 * DH-AUTOMATION-ROUTING-P4 browser verification + screenshots.
 */
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const API = 'http://localhost:5002/api/v1';
const APP = 'http://localhost:3000';
const OUT = path.resolve('docs/ssot_v3/screenshots');
const EVIDENCE = path.join(OUT, 'automation-p4-browser-evidence.json');

async function loginAdmin() {
  const body = { username: 'p4verify2@test.local', password: 'TestP4Verify!' };
  let res = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  let data = await res.json();
  if (!data.token) {
    const suffix = Date.now();
    res = await fetch(`${API}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: `p4verify${suffix}@test.local`,
        username: `p4verify${suffix}`,
        password: 'TestP4Verify!',
        full_name: 'P4 Verify',
      }),
    });
    data = await res.json();
  }
  if (!data.token) throw new Error(`auth failed: ${JSON.stringify(data)}`);
  return { token: data.token, user: data.user };
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const { token, user } = await loginAdmin();
  const network = [];

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1200 } });
  const page = await context.newPage();

  page.on('response', res => {
    const url = res.url();
    if (url.includes('/data-hub/automation')) {
      network.push({ url: url.replace(/^https?:\/\/[^/]+/, ''), status: res.status() });
    }
  });

  await page.goto(`${APP}/`);
  await page.evaluate(({ user, token }) => {
    localStorage.setItem('titan_token', token);
    localStorage.setItem('titan_user', JSON.stringify(user));
    sessionStorage.setItem('titan_token', token);
    sessionStorage.setItem('titan_user', JSON.stringify(user));
  }, { user, token });
  await page.reload();
  await page.getByRole('button', { name: 'Skip' }).click({ timeout: 5000 }).catch(() => {});
  await page.getByRole('button', { name: 'AI' }).click();
  await page.getByRole('button', { name: 'Data Hub' }).click();
  await page.getByRole('tab', { name: 'Advanced Features' }).click();
  await page.getByRole('tab', { name: 'Automation Routing' }).click();
  await page.getByText('Valid topics').waitFor({ timeout: 20000 });

  const rawKeys = await page.evaluate(() => {
    const keys = [];
    document.querySelectorAll('*').forEach(el => {
      if (el.childNodes.length === 1 && el.childNodes[0].nodeType === 3) {
        const t = el.textContent.trim();
        if (/^automation_[a-z0-9_]+$/.test(t)) keys.push(t);
      }
    });
    return [...new Set(keys)];
  });

  const metrics = await page.evaluate(() => {
    const text = document.body.innerText;
    const pick = label => {
      const re = new RegExp(`${label}\\s*\\n\\s*(\\d+|[^\\n]+)`, 'i');
      const m = text.match(re);
      return m ? m[1].trim() : null;
    };
    return {
      validTopics: pick('Valid topics'),
      invalidTopics: pick('Invalid topics'),
      queueSize: pick('Queue size'),
      agentTopics: pick('Agent topics'),
      dryRunBanner: text.includes('Dry run') && text.includes('pending'),
      hasDeliveryHistory: text.includes('Delivery History'),
      hasAutomationEvent: text.includes('Automation event recorded'),
      notFound: text.includes('Not Found'),
    };
  });

  const consoleErrors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });

  await page.screenshot({ path: path.join(OUT, 'automation-p4-post-repair-overview.png'), fullPage: true });
  await page.getByText('Automation queue').scrollIntoViewIfNeeded();
  await page.screenshot({ path: path.join(OUT, 'automation-p4-post-repair-queue.png'), fullPage: true });
  await page.getByText('Delivery History').scrollIntoViewIfNeeded();
  await page.screenshot({ path: path.join(OUT, 'automation-p4-post-repair-history.png'), fullPage: true });

  const evidence = {
    capturedAt: new Date().toISOString(),
    user: user.email,
    metrics,
    rawKeys,
    consoleErrors,
    network,
    networkAll200: network.length > 0 && network.every(n => n.status >= 200 && n.status < 400),
    screenshots: [
      'automation-p4-post-repair-overview.png',
      'automation-p4-post-repair-queue.png',
      'automation-p4-post-repair-history.png',
    ],
  };

  fs.writeFileSync(EVIDENCE, JSON.stringify(evidence, null, 2));
  console.log(JSON.stringify(evidence, null, 2));
  await browser.close();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
