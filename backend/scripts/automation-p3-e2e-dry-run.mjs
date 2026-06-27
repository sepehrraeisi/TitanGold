/**
 * DH-AUTOMATION-ROUTING-P3 — safe end-to-end dry-run fixture (direct service calls).
 * Run: cd backend && node scripts/automation-p3-e2e-dry-run.mjs
 */
import dotenv from 'dotenv';
import { query } from '../database/db.js';
import {
  createAutomationTopic,
  refreshAutomationQueue,
  dispatchAutomationQueue,
  listAutomationExecutions,
  deleteAutomationTopic,
  validateAutomationTopic,
} from '../services/datahubAutomationService.js';

dotenv.config();

const TAG = 'P3-E2E-AUTOMATION';
const DEMO_USER = '00000000-0000-0000-0000-000000000099';

const cleanup = {
  topicId: null,
  sourceId: null,
  recordId: null,
  mappingId: null,
};

async function getActivePublisherId() {
  const result = await query(
    `SELECT id, name FROM telegram_publishers WHERE is_active = true ORDER BY updated_at DESC LIMIT 1`,
  );
  if (result.rows.length === 0) throw new Error('No active telegram publisher found');
  return result.rows[0].id;
}

async function createFixture(publisherId) {
  const source = await query(
    `INSERT INTO data_sources (name, type, url, is_active, status, health_status, created_at, updated_at)
     VALUES ($1, 'api', 'https://p3-e2e.test/automation', true, 'active', 'healthy', NOW(), NOW())
     RETURNING id`,
    [`${TAG}-SOURCE`],
  );
  cleanup.sourceId = source.rows[0].id;

  const record = await query(
    `INSERT INTO collected_data (source_id, raw_data, status, normalized_data, metadata, collected_at, processed_at)
     VALUES ($1, $2, 'processed', $3, $4, NOW(), NOW())
     RETURNING id`,
    [
      cleanup.sourceId,
      JSON.stringify({ title: `${TAG} raw`, content: 'raw payload' }),
      JSON.stringify({
        title: `${TAG} dry-run signal`,
        content: 'P3 automation end-to-end dry-run payload',
        metadata: { quality_score: 95, data_type: 'api' },
      }),
      JSON.stringify({ data_type: 'api', quality_score: 95, tags: ['p3', 'e2e'] }),
    ],
  );
  cleanup.recordId = record.rows[0].id;

  const mapping = await query(
    `INSERT INTO datahub_publisher_source_mappings (source_id, publisher_id, is_enabled, created_by)
     VALUES ($1, $2, true, $3)
     RETURNING id`,
    [cleanup.sourceId, publisherId, DEMO_USER],
  );
  cleanup.mappingId = mapping.rows[0].id;

  const topic = await createAutomationTopic(
    {
      title: `${TAG}-TOPIC`,
      agentId: '',
      dataTypes: ['api'],
      includeStatuses: ['ready', 'warning', 'rejected'],
      publisherTargets: [publisherId],
      enabled: true,
      priority: 'high',
    },
    DEMO_USER,
  );
  cleanup.topicId = topic.id;
  return topic;
}

async function runCleanup() {
  if (cleanup.topicId) {
    await deleteAutomationTopic(cleanup.topicId).catch(() => {});
  }
  if (cleanup.mappingId) {
    await query(`DELETE FROM datahub_publisher_source_mappings WHERE id = $1`, [cleanup.mappingId]).catch(
      () => {},
    );
  }
  if (cleanup.recordId) {
    await query(`DELETE FROM collected_data WHERE id = $1`, [cleanup.recordId]).catch(() => {});
  }
  if (cleanup.sourceId) {
    await query(`DELETE FROM data_sources WHERE id = $1`, [cleanup.sourceId]).catch(() => {});
  }
}

async function main() {
  console.log('=== P3 Automation E2E dry-run ===\n');
  let exitCode = 0;

  try {
    const publisherId = await getActivePublisherId();
    console.log('Active publisher:', publisherId);

    const topic = await createFixture(publisherId);
    console.log('Created topic:', topic.id);

    const validation = await validateAutomationTopic(topic.id);
    console.log('Validation:', validation.validity.status, validation.validity.reasons);

    const refresh = await refreshAutomationQueue({ topicId: topic.id });
    console.log('Refresh summary:', refresh.summary);
    if ((refresh.summary?.queued || refresh.added) < 1) {
      throw new Error(`Expected queued >= 1, got ${refresh.summary?.queued ?? refresh.added}`);
    }

    const dispatch = await dispatchAutomationQueue(DEMO_USER, {
      limit: 1,
      dryRun: true,
      confirmLive: false,
    });
    console.log('Dispatch processed:', dispatch.processed);

    const executions = await listAutomationExecutions({ limit: 5 });
    const dryRun = executions.find(
      e => e.topicId === topic.id && (e.status === 'dry_run' || e.dryRun),
    );
    if (!dryRun) throw new Error('No dry_run execution found for P3 topic');

    const history = await query(
      `SELECT status, telegram_message_id FROM publisher_delivery_history
       WHERE publisher_id = $1 ORDER BY created_at DESC LIMIT 3`,
      [publisherId],
    );
    const pubDryRun = history.rows.find(r => r.status === 'dry_run');
    console.log('Publisher history dry_run:', Boolean(pubDryRun));
    if (!pubDryRun) throw new Error('No publisher dry_run history row');

    console.log('\nPASS: E2E dry-run chain verified (no live Telegram send).');
  } catch (error) {
    console.error('\nFAIL:', error.message);
    exitCode = 1;
  } finally {
    await runCleanup();
    console.log('Cleanup complete.');
  }

  process.exit(exitCode);
}

main();
