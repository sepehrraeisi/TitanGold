/**
 * Capture Automation P3 i18n browser screenshots.
 * Run: node scripts/automation-p3-i18n-screenshots.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');
dotenv.config({ path: path.join(__dirname, '../.env') });

const SHOT_DIR = path.join(ROOT, 'docs/ssot_v3/screenshots');
const ADMIN_ID = 'e134c7b1-b183-4e21-9acf-e3d53b9806d6';

async function main() {
  fs.mkdirSync(SHOT_DIR, { recursive: true });
  const token = jwt.sign({ userId: ADMIN_ID }, process.env.JWT_SECRET, { expiresIn: '1h' });

  const { chromium } = await import('playwright');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  await page.goto('http://localhost:3000/?view=ai', { waitUntil: 'networkidle', timeout: 90000 });
  await page.evaluate(t => localStorage.setItem('titan_token', t), token);
  await page.reload({ waitUntil: 'networkidle', timeout: 90000 });
  await page.waitForTimeout(3000);

  const clickByText = async (text, role = 'button') => {
    const loc = page.getByRole(role, { name: text, exact: false }).first();
    await loc.waitFor({ state: 'visible', timeout: 20000 });
    await loc.click();
    await page.waitForTimeout(1500);
  };

  await clickByText('AI');
  await clickByText('Manager');
  await clickByText('Data Hub');
  await clickByText('Advanced Features', 'tab');
  await clickByText('Automation Routing', 'tab');
  await page.waitForTimeout(8000);

  const bodyText = await page.locator('body').innerText();
  const rawKeys = (bodyText.match(/automation_[a-z0-9_]+/g) || []).filter(Boolean);
  if (rawKeys.length > 0) {
    throw new Error(`Raw i18n keys visible: ${[...new Set(rawKeys)].join(', ')}`);
  }

  await page.screenshot({
    path: path.join(SHOT_DIR, 'automation-p3-i18n-overview.png'),
    fullPage: true,
  });

  await page.evaluate(() => {
    const cards = document.querySelectorAll('[class*="rounded-xl"][class*="border"]');
    for (const card of cards) {
      if (card.textContent?.includes('Active routing rules') || card.textContent?.includes('قوانین مسیر فعال')) {
        card.scrollIntoView({ block: 'center' });
        break;
      }
    }
  });
  await page.waitForTimeout(500);
  await page.screenshot({
    path: path.join(SHOT_DIR, 'automation-p3-i18n-topic-cards.png'),
    fullPage: false,
  });

  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(800);
  await page.screenshot({
    path: path.join(SHOT_DIR, 'automation-p3-i18n-queue-history.png'),
    fullPage: false,
  });

  const consoleErrors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });

  await browser.close();
  console.log('PASS: No raw automation_* keys in UI');
  console.log('Screenshots saved to', SHOT_DIR);
  if (consoleErrors.length) {
    console.warn('Console errors:', consoleErrors.slice(0, 5));
  }
}

main().catch(err => {
  console.error('FAIL:', err.message);
  process.exit(1);
});
