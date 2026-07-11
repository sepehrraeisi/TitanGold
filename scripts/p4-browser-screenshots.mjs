#!/usr/bin/env node
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const API = 'http://localhost:5002/api/v1';
const APP = 'http://localhost:3000';
const OUT = path.resolve('docs/ssot_v3/screenshots');

async function registerUser() {
  const suffix = Date.now();
  const body = {
    email: `p4shot${suffix}@test.local`,
    username: `p4shot${suffix}`,
    password: 'TestP4Browser!',
    full_name: 'P4 Screenshot',
  };
  const res = await fetch(`${API}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!data.token) throw new Error(`register failed: ${JSON.stringify(data)}`);
  return { token: data.token, user: data.user };
}

async function putPreference(token, browserEnabled) {
  const res = await fetch(`${API}/notifications/preferences`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ browser_enabled: browserEnabled }),
  });
  return res.json();
}

async function openNotifications(page, user, token) {
  await page.goto(`${APP}/`);
  await page.evaluate(({ user, token }) => {
    localStorage.setItem('titan_token', token);
    localStorage.setItem('titan_user', JSON.stringify(user));
    sessionStorage.setItem('titan_token', token);
    sessionStorage.setItem('titan_user', JSON.stringify(user));
  }, { user, token });
  await page.reload();
  await page.getByRole('button', { name: 'Skip' }).click({ timeout: 5000 }).catch(() => {});
  await page.getByRole('button', { name: 'Settings' }).click();
  await page.locator('button[data-tab-id="notifications"]').click();
  await page.getByText('Browser', { exact: true }).waitFor({ timeout: 15000 });
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const { token, user } = await registerUser();
  await putPreference(token, false);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    permissions: ['notifications'],
  });
  const page = await context.newPage();

  await openNotifications(page, user, token);
  await page.screenshot({ path: path.join(OUT, 'notifications-p4-browser-before.png'), fullPage: true });

  await page.getByRole('button', { name: 'Enable Browser Notifications' }).click();
  await page.getByText('Browser notifications enabled on this device.').waitFor({ timeout: 10000 });
  await page.screenshot({ path: path.join(OUT, 'notifications-p4-browser-after-enable.png'), fullPage: true });

  await page.getByRole('button', { name: 'Preferences' }).click();
  await page.getByRole('button', { name: 'Channels' }).click();
  await page.getByText('enabled').first().waitFor({ timeout: 5000 });
  await page.screenshot({ path: path.join(OUT, 'notifications-p4-browser-after-tab-switch.png'), fullPage: true });

  await page.reload();
  await page.getByRole('button', { name: 'Settings' }).click();
  await page.locator('button[data-tab-id="notifications"]').click();
  await page.getByText('enabled').first().waitFor({ timeout: 15000 });
  await page.screenshot({ path: path.join(OUT, 'notifications-p4-browser-after-refresh.png'), fullPage: true });

  await browser.close();
  console.log('Screenshots saved to', OUT);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
