#!/usr/bin/env node
/**
 * Read-only Scan History performance verification against Staging PostgreSQL.
 * Does not print credentials or mutate data.
 */
import dotenv from 'dotenv';
import pg from 'pg';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: process.env.TITAN_BACKEND_ENV_FILE || '/home/ubuntu/webapp/TitanGold/backend/.env' });

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false' } : false,
});

async function explain(name, sql, params) {
  const res = await pool.query(`EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${sql}`, params);
  const plan = res.rows[0]['QUERY PLAN'][0];
  const blob = JSON.stringify(plan);
  return {
    name,
    planningTimeMs: plan['Planning Time'],
    executionTimeMs: plan['Execution Time'],
    rowsReturned: plan.Plan?.['Actual Rows'],
    indexScan: /Index Scan|Index Only Scan|Bitmap Index Scan/.test(blob),
    seqScan: /Seq Scan/.test(blob),
  };
}

const agentId = (await pool.query("SELECT id FROM ai_agents WHERE agent_key='arbitrage' LIMIT 1")).rows[0]?.id;
const total = (await pool.query("SELECT COUNT(*)::int AS c FROM ai_decisions WHERE agent_id=$1 AND decision_type='arbitrage_scan'", [agentId])).rows[0].c;
const runId = (await pool.query("SELECT id FROM ai_decisions WHERE agent_id=$1 AND decision_type='arbitrage_scan' ORDER BY created_at DESC LIMIT 1", [agentId])).rows[0].id;
const offset = Math.max(0, total - 20);

const queries = await Promise.all([
  explain('newest_page', `SELECT id FROM ai_decisions WHERE agent_id=$1 AND decision_type=$2 ORDER BY created_at DESC, id DESC LIMIT 20`, [agentId, 'arbitrage_scan']),
  explain('older_page', `SELECT id FROM ai_decisions WHERE agent_id=$1 AND decision_type=$2 ORDER BY created_at DESC, id DESC LIMIT 20 OFFSET $3`, [agentId, 'arbitrage_scan', offset]),
  explain('summary_combined', `SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE was_successful=true)::int AS ok FROM ai_decisions WHERE agent_id=$1 AND decision_type=$2`, [agentId, 'arbitrage_scan']),
  explain('run_detail', `SELECT id FROM ai_decisions WHERE id=$1 AND agent_id=$2 AND decision_type=$3 LIMIT 1`, [runId, agentId, 'arbitrage_scan']),
]);

const report = {
  environment: 'staging_postgresql_readonly',
  totalRows: total,
  runId,
  queries,
  archiveNote: 'Active partitioned ai_decisions only; ai_decisions_archive has 0 arbitrage_scan rows at verification time.',
  indexRecommendation: 'Optional composite index may improve summary/filter queries at 10k+ scale; not applied.',
};

const out = path.join(__dirname, '../docs/ARBITRAGE_SCAN_HISTORY_PERF_EVIDENCE.json');
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
await pool.end();
