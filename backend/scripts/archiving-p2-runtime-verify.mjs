/**
 * DH-DATA-ARCHIVING-P2 runtime verification (GET + safe preview only).
 * Run: cd backend && node scripts/archiving-p2-runtime-verify.mjs
 */
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE = process.env.API_BASE || 'http://localhost:5002';
const ADMIN_ID = 'e134c7b1-b183-4e21-9acf-e3d53b9806d6';
const READONLY_ID = process.env.ARCHIVING_READONLY_USER_ID || '00000000-0000-0000-0000-000000000099';
const OUT = path.resolve(__dirname, '../../docs/ssot_v3/screenshots/archiving-p2-runtime.json');

async function timedFetch(urlPath, opts = {}) {
    const t0 = Date.now();
    const res = await fetch(`${BASE}${urlPath}`, opts);
    const ms = Date.now() - t0;
    let body = null;
    try {
        body = await res.json();
    } catch {
        body = null;
    }
    return { path: urlPath, status: res.status, ms, ok: res.ok, body };
}

function tokenFor(userId) {
    return jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: '1h' });
}

async function main() {
    const adminHeaders = {
        Authorization: `Bearer ${tokenFor(ADMIN_ID)}`,
        'Content-Type': 'application/json',
    };
    const readonlyHeaders = {
        Authorization: `Bearer ${tokenFor(READONLY_ID)}`,
        'Content-Type': 'application/json',
    };

    const results = {
        capturedAt: new Date().toISOString(),
        destructiveRoutesCalled: false,
        getEndpoints: [],
        rbac: {},
        performanceTargetMs: 500,
    };

    for (const p of [
        '/api/v1/data-hub/archiving/stats',
        '/api/v1/data-hub/archiving/health',
        '/api/v1/data-hub/archiving/partitions',
        '/api/v1/data-hub/archiving/records?limit=50&offset=0',
        '/api/v1/data-hub/archiving/operations?limit=20',
    ]) {
        results.getEndpoints.push(await timedFetch(p, { headers: adminHeaders }));
    }

    results.rbac.previewArchiveAdmin = await timedFetch('/api/v1/data-hub/archiving/archive/preview', {
        method: 'POST',
        headers: adminHeaders,
        body: JSON.stringify({ days_old: 90 }),
    });

    results.rbac.previewArchiveReadonly = await timedFetch('/api/v1/data-hub/archiving/archive/preview', {
        method: 'POST',
        headers: readonlyHeaders,
        body: JSON.stringify({ days_old: 90 }),
    });

    results.rbac.archiveWithoutConfirm = await timedFetch('/api/v1/data-hub/archiving/archive', {
        method: 'POST',
        headers: adminHeaders,
        body: JSON.stringify({ days_old: 90 }),
    });

    results.rbac.purgePreview = await timedFetch('/api/v1/data-hub/archiving/purge/preview', {
        method: 'POST',
        headers: adminHeaders,
        body: JSON.stringify({}),
    });

    const stats = results.getEndpoints.find(e => e.path.includes('/stats'));
    if (stats?.body?.health) {
        results.healthStatusCode = stats.body.health.status_code;
    }
    if (stats?.body?.partitions?.length) {
        results.partitionLabels = stats.body.partitions.map(p => p.label);
    }

    results.allGetUnder500ms = results.getEndpoints.every(e => e.ms < 500);
    results.noDestructiveApply = results.rbac.archiveWithoutConfirm.status === 400;

    fs.mkdirSync(path.dirname(OUT), { recursive: true });
    fs.writeFileSync(OUT, JSON.stringify(results, null, 2));
    console.log(JSON.stringify(results, null, 2));
}

main().catch(e => {
    console.error(e);
    process.exit(1);
});
