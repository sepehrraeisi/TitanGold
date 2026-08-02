#!/usr/bin/env node
/**
 * Controlled Settings persistence QA — capture, change, verify, restore.
 * Safe analytical values only; no execution side effects.
 */
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const dotenv = require('/home/ubuntu/webapp/TitanGold/backend/node_modules/dotenv');
const jwt = require('/home/ubuntu/webapp/TitanGold/backend/node_modules/jsonwebtoken');

const AGENT_ID = process.env.ARB_QA_AGENT_ID || '04b6ca95-5fd3-471d-a568-bd7f1c391d83';
const API_BASE = process.env.ARB_QA_API_BASE || 'http://127.0.0.1:5002';

dotenv.config({
  path: process.env.TITAN_BACKEND_ENV_FILE || '/home/ubuntu/webapp/TitanGold/backend/.env',
});

const secret = process.env.JWT_SECRET;
const adminId = process.env.DEPLOY_SMOKE_ADMIN_ID || 'e134c7b1-b183-4e21-9acf-e3d53b9806d6';

if (!secret) {
  console.error('JWT_SECRET missing');
  process.exit(1);
}

const token = jwt.sign({ userId: adminId, role: 'admin' }, secret, { expiresIn: '15m' });
const headers = {
  Authorization: `Bearer ${token}`,
  'Content-Type': 'application/json',
};

async function api(path, opts = {}) {
  const res = await fetch(`${API_BASE}${path}`, { ...opts, headers: { ...headers, ...(opts.headers || {}) } });
  const body = await res.json().catch(() => ({}));
  return { res, body };
}

function pickSnapshot(settings) {
  return {
    version: settings.version,
    monitoredSymbols: settings.monitoredSymbols,
    minimumNetSpreadBps: settings.minimumNetSpreadBps,
    assumedFeesBps: settings.assumedFeesBps,
    assumedSlippageBps: settings.assumedSlippageBps,
    maximumDataAgeMs: settings.maximumDataAgeMs,
    notificationPreference: settings.notificationPreference,
  };
}

async function main() {
  const originalGet = await api(`/api/v1/ai-agents/${AGENT_ID}/arbitrage/settings`);
  if (!originalGet.res.ok) {
    console.error('GET settings failed', originalGet.res.status, originalGet.body);
    process.exit(1);
  }
  const original = originalGet.body.settings;
  const originalSnapshot = pickSnapshot(original);

  const tempNet = Number(original.minimumNetSpreadBps ?? 20) + 1;
  const tempPayload = {
    monitoredSymbols: original.monitoredSymbols,
    minimumNetSpreadBps: tempNet,
    assumedFeesBps: original.assumedFeesBps,
    assumedSlippageBps: original.assumedSlippageBps,
    maximumDataAgeMs: original.maximumDataAgeMs,
    notificationPreference: original.notificationPreference,
  };

  const update = await api(`/api/v1/ai-agents/${AGENT_ID}/arbitrage/settings`, {
    method: 'PUT',
    body: JSON.stringify({ settings: tempPayload, expectedVersion: original.version }),
  });
  if (!update.res.ok) {
    console.error('PUT settings failed', update.res.status, update.body);
    process.exit(1);
  }
  const afterChange = update.body.settings;
  const afterSnapshot = pickSnapshot(afterChange);

  const verifyGet = await api(`/api/v1/ai-agents/${AGENT_ID}/arbitrage/settings`);
  const verified = verifyGet.body.settings;

  const restorePayload = {
    monitoredSymbols: original.monitoredSymbols,
    minimumNetSpreadBps: original.minimumNetSpreadBps,
    assumedFeesBps: original.assumedFeesBps,
    assumedSlippageBps: original.assumedSlippageBps,
    maximumDataAgeMs: original.maximumDataAgeMs,
    notificationPreference: original.notificationPreference,
  };
  const restore = await api(`/api/v1/ai-agents/${AGENT_ID}/arbitrage/settings`, {
    method: 'PUT',
    body: JSON.stringify({ settings: restorePayload, expectedVersion: afterChange.version }),
  });
  if (!restore.res.ok) {
    console.error('RESTORE settings failed', restore.res.status, restore.body);
    process.exit(1);
  }
  const restored = restore.body.settings;
  const restoredSnapshot = pickSnapshot(restored);

  const ok =
    afterChange.minimumNetSpreadBps === tempNet
    && verified.minimumNetSpreadBps === tempNet
    && restoredSnapshot.minimumNetSpreadBps === originalSnapshot.minimumNetSpreadBps
    && JSON.stringify(restoredSnapshot.monitoredSymbols) === JSON.stringify(originalSnapshot.monitoredSymbols);

  console.log(JSON.stringify({
    ok,
    original: originalSnapshot,
    temporaryChange: { minimumNetSpreadBps: tempNet },
    resultingRevision: afterChange.version,
    afterChange: afterSnapshot,
    restored: restoredSnapshot,
    finalRevision: restored.version,
  }, null, 2));

  process.exit(ok ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
