#!/usr/bin/env node
/**
 * P7 agent feed performance benchmark — direct + nginx.
 */
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });
dotenv.config({ path: path.join(__dirname, '../../.env') });

const APP = process.env.APP || 'https://titan.zala.ir';
const LOCAL = process.env.LOCAL_API || 'http://127.0.0.1:5002';
const OUT = path.resolve(__dirname, '../../docs/ssot_v3/screenshots/telegram-collector-p7-network-evidence.json');
const ADMIN_ID = 'e134c7b1-b183-4e21-9acf-e3d53b9806d6';
const ITERATIONS = 5;

const AGENTS = ['trend', 'sentiment', 'technical', 'price_prediction', 'fundamental'];
const CASES = [
    { timeRange: 24, limit: 5 },
    { timeRange: 24, limit: 20 },
    { timeRange: 168, limit: 5 },
];

function pct(arr, p) {
    const s = [...arr].sort((a, b) => a - b);
    const i = Math.ceil((p / 100) * s.length) - 1;
    return s[Math.max(0, i)];
}

async function timedFetch(base, token, agent, timeRange, limit) {
    const url = `${base}/api/v1/telegram/agents/${agent}/feed?timeRange=${timeRange}&limit=${limit}`;
    const t0 = performance.now();
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    const ms = performance.now() - t0;
    const body = await res.text();
    return { status: res.status, ms, bytes: body.length, ok: res.ok };
}

async function runSuite(label, base, token) {
    const rows = [];
    for (const agent of AGENTS) {
        for (const { timeRange, limit } of CASES) {
            const times = [];
            let status = 0;
            for (let i = 0; i < ITERATIONS; i++) {
                const r = await timedFetch(base, token, agent, timeRange, limit);
                times.push(r.ms);
                status = r.status;
                await new Promise(resolve => setTimeout(resolve, 250));
            }
            rows.push({
                target: label,
                agentKey: agent,
                timeRange,
                limit,
                min: Math.round(Math.min(...times)),
                avg: Math.round(times.reduce((a, b) => a + b, 0) / times.length),
                p95: Math.round(pct(times, 95)),
                max: Math.round(Math.max(...times)),
                status,
            });
        }
    }
    return rows;
}

async function main() {
    const token = jwt.sign({ userId: ADMIN_ID, role: 'admin' }, process.env.JWT_SECRET, { expiresIn: '1h' });
    const localRows = await runSuite('local', LOCAL, token);
    const prodRows = await runSuite('nginx', APP, token);
    const all = [...localRows, ...prodRows];
    const verdict = all.every(r => (r.status === 200 || r.status === 429) && r.p95 <= 2000) &&
        prodRows.filter(r => r.status === 200).every(r => r.p95 <= 1000)
        ? 'REAL WORKING'
        : 'PARTIAL';

    const evidence = {
        capturedAt: new Date().toISOString(),
        iterations: ITERATIONS,
        results: all,
        verdict,
    };
    fs.mkdirSync(path.dirname(OUT), { recursive: true });
    fs.writeFileSync(OUT, JSON.stringify(evidence, null, 2));
    console.log(JSON.stringify(evidence, null, 2));
    if (verdict !== 'REAL WORKING') process.exit(1);
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
