#!/usr/bin/env node
/**
 * Post-migration automation demo (GAP-018/019 verification).
 * Run: cd backend && node scripts/verify_automation_demo.js
 */
import dotenv from 'dotenv';
import { query } from '../database/db.js';
import {
  listAutomationTopics,
  createAutomationTopic,
  refreshAutomationQueue,
  dispatchAutomationQueue,
  listAutomationExecutions,
  failQueueItem,
  retryAutomationExecution,
} from '../services/datahubAutomationService.js';

dotenv.config();

const DEMO_USER = '00000000-0000-0000-0000-000000000099';

async function ensureCollectedData() {
  const count = await query(`SELECT COUNT(*)::int AS c FROM collected_data WHERE normalized_data IS NOT NULL`);
  if (count.rows[0].c > 0) return;

  const source = await query(`SELECT id, category FROM data_sources WHERE is_active = true LIMIT 1`);
  if (source.rows.length === 0) return;

  await query(
    `INSERT INTO collected_data (source_id, status, normalized_data, metadata, collected_at, processed_at)
     VALUES ($1, 'processed', $2, $3, NOW(), NOW())`,
    [
      source.rows[0].id,
      JSON.stringify({
        title: 'Automation demo signal',
        content: 'Demo payload for queue refresh',
        metadata: { quality_score: 92, data_type: 'article' },
      }),
      JSON.stringify({ data_type: 'article', tags: ['demo'], quality_score: 92 }),
    ],
  );
  console.log('   (seeded 1 collected_data row for queue demo)');
}

async function ensurePublisher() {
  const existing = await query(
    `SELECT id FROM telegram_publishers WHERE is_active = true LIMIT 1`,
  );
  if (existing.rows.length > 0) return existing.rows[0].id;

  const ins = await query(
    `INSERT INTO telegram_publishers (name, channel_id, is_active, template)
     VALUES ('Automation Demo Publisher', '@demo_channel', true, '{message}')
     RETURNING id`,
  );
  return ins.rows[0].id;
}

async function main() {
  console.log('=== Automation migration demo (real DB) ===\n');
  console.log('DATABASE:', (process.env.DATABASE_URL || '').replace(/:[^:@]*@/, ':***@'));

  const tables = await query(`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public'
      AND tablename LIKE 'datahub_automation%'
    ORDER BY tablename`);
  console.log('\n1) Tables:', tables.rows.map(r => r.tablename).join(', ') || 'MISSING');
  if (tables.rows.length < 4) {
    console.error('FAIL: run migrations 026 and 027 first');
    process.exit(1);
  }

  const publisherId = await ensurePublisher();
  console.log('\n2) Publisher for targets:', publisherId);

  await ensureCollectedData();

  const topic = await createAutomationTopic(
    {
      title: `Demo Topic ${Date.now()}`,
      agentId: 'demo-agent',
      categoryIds: [],
      dataTypes: [],
      publisherTargets: [publisherId],
      includeStatuses: ['ready', 'warning'],
      enabled: true,
      priority: 'medium',
    },
    DEMO_USER,
  );
  console.log('\n3) Created topic:', topic.id, topic.title);

  const topics = await listAutomationTopics();
  console.log('   Topics count:', topics.length);

  const refresh = await refreshAutomationQueue();
  console.log('\n4) Queue refresh — added:', refresh.added, 'pending:', refresh.queue.length);

  if (refresh.queue.length > 0) {
    const failId = refresh.queue[0].id;
    await failQueueItem(failId, 'Demo forced failure');
    console.log('\n5) Marked queue item failed:', failId);
    const failedExec = (await listAutomationExecutions({ limit: 5 })).find(e => e.status === 'failed');
    if (failedExec) {
      try {
        await retryAutomationExecution(failedExec.id, DEMO_USER);
        console.log('6) Retry execution:', failedExec.id, 'OK');
      } catch (e) {
        console.log('6) Retry:', e.message);
      }
    }
  }

  const dispatch = await dispatchAutomationQueue(DEMO_USER, { limit: 1, dryRun: true });
  console.log('\n7) Manual dispatch (dry-run) — processed:', dispatch.processed);

  const executions = await listAutomationExecutions({ limit: 10 });
  console.log('\n8) Execution history rows:', executions.length);
  if (executions[0]) {
    console.log('   Latest:', executions[0].status, executions[0].dryRun ? '(dry-run)' : '');
  }

  await query(`DELETE FROM datahub_automation_topics WHERE id = $1`, [topic.id]);
  console.log('\n✅ Demo complete (demo topic cleaned up)');
  process.exit(0);
}

main().catch(err => {
  console.error('Demo failed:', err);
  process.exit(1);
});
