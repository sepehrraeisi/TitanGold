#!/usr/bin/env node
/**
 * P7.2 write auth verification — collector mutations with admin JWT.
 */
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });
dotenv.config({ path: path.join(__dirname, '../../.env') });

const BASE = process.env.COLLECTOR_BASE || 'http://127.0.0.1:3002';
const OUT = path.resolve(__dirname, '../../docs/ssot_v3/screenshots/telegram-collector-p72-write-auth-evidence.json');
const ADMIN_ID = 'e134c7b1-b183-4e21-9acf-e3d53b9806d6';

async function req(method, urlPath, token, body) {
    const t0 = Date.now();
    const res = await fetch(`${BASE}${urlPath}`, {
        method,
        headers: {
            ...(body ? { 'Content-Type': 'application/json' } : {}),
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    let json = null;
    try { json = JSON.parse(text); } catch { /* */ }
    return { method, url: urlPath, status: res.status, ms: Date.now() - t0, json, body: text.slice(0, 200) };
}

async function main() {
    const adminToken = jwt.sign({ userId: ADMIN_ID, role: 'admin' }, process.env.JWT_SECRET, { expiresIn: '1h' });
    const viewerToken = jwt.sign({ userId: 'viewer-u', role: 'viewer' }, process.env.JWT_SECRET, { expiresIn: '1h' });

    const list = await req('GET', '/api/telegram-collector/collector-channels', null);
    const channelId = list.json?.channels?.[0]?.id;
    if (!channelId) throw new Error('No channel for write test');

    const results = [
        list,
        await req('PATCH', `/api/telegram-collector/collector-channels/${channelId}`, adminToken, { priority: 'normal' }),
        await req('PATCH', `/api/telegram-collector/collector-channels/${channelId}`, adminToken, { is_active: true }),
        await req('PATCH', `/api/telegram-collector/collector-channels/${channelId}`, viewerToken, { priority: 'low' }),
        await req('POST', '/api/telegram-collector/channels/refresh', adminToken),
        await req('POST', '/api/telegram-collector/channels/refresh', null),
    ];

    const evidence = {
        capturedAt: new Date().toISOString(),
        base: BASE,
        jwtSource: 'process.env.JWT_SECRET (PM2 issuer)',
        results,
        verdict:
            results[1].status === 200 &&
            results[2].status === 200 &&
            results[3].status === 403 &&
            results[4].status === 200 &&
            results[5].status === 401
                ? 'REAL WORKING'
                : 'PARTIAL',
    };

    fs.mkdirSync(path.dirname(OUT), { recursive: true });
    fs.writeFileSync(OUT, JSON.stringify(evidence, null, 2));
    console.log(JSON.stringify(evidence, null, 2));
    if (evidence.verdict !== 'REAL WORKING') process.exit(1);
}

main().catch(e => { console.error(e); process.exit(1); });
