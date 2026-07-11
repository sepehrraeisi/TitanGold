/**
 * DH-AUTOMATION-ROUTING-P4 — production config repair (safe, auditable).
 * Run: cd backend && node scripts/automation-p4-production-repair.mjs
 *
 * Actions:
 * 1. Point all active topics at the canonical active publisher
 * 2. Copy enabled mappings from disabled duplicate publisher to active publisher
 * 3. Ensure primary signal source mapping exists
 * Does NOT delete history or disable old publishers.
 */
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { query } from '../database/db.js';
import {
  validateAutomationTopic,
  refreshAutomationQueue,
  dispatchAutomationQueue,
  listAutomationExecutions,
} from '../services/datahubAutomationService.js';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const EVIDENCE_PATH = path.resolve(
  __dirname,
  '../../docs/ssot_v3/screenshots/automation-p4-repair-evidence.json',
);

const ACTIVE_PUBLISHER_ID = '887495e6-0b47-4450-88ef-35dd43477f9a';
const DISABLED_DEMO_PUBLISHER_ID = 'bc5ce007-71f3-4a0d-89fe-a717d79641f9';
const DISABLED_LEGACY_PUBLISHER_ID = '5ab9a6bc-5f17-4aae-bb06-4a34e827af24';
const ADMIN_USER = 'e134c7b1-b183-4e21-9acf-e3d53b9806d6';
const SIGNAL_SOURCE_ID = 'c787a64f-2666-43ef-aef6-dae94449bc4b'; // JUST IN TIME

async function snapshotState(label) {
  const topics = await query(
    `SELECT id, name, is_active, publish_targets FROM datahub_automation_topics ORDER BY name`,
  );
  const mappings = await query(
    `SELECT m.id, m.source_id, ds.name AS source_name, m.publisher_id, p.name AS publisher_name, m.is_enabled
     FROM datahub_publisher_source_mappings m
     JOIN data_sources ds ON ds.id = m.source_id
     JOIN telegram_publishers p ON p.id = m.publisher_id
     WHERE m.is_enabled = true
     ORDER BY p.is_active DESC, ds.name`,
  );
  return { label, at: new Date().toISOString(), topics: topics.rows, mappings: mappings.rows };
}

async function repairTopics() {
  const topics = await query(
    `SELECT id, name, publish_targets FROM datahub_automation_topics WHERE is_active = true`,
  );
  const updated = [];
  for (const topic of topics.rows) {
    const currentIds = topic.publish_targets?.publisherIds || [];
    if (currentIds.length === 1 && String(currentIds[0]) === ACTIVE_PUBLISHER_ID) {
      continue;
    }
    const publishTargets = { publisherIds: [ACTIVE_PUBLISHER_ID] };
    await query(
      `UPDATE datahub_automation_topics
       SET publish_targets = $2, updated_at = NOW()
       WHERE id = $1`,
      [topic.id, JSON.stringify(publishTargets)],
    );
    updated.push({ id: topic.id, name: topic.name, from: currentIds, to: [ACTIVE_PUBLISHER_ID] });
  }
  return updated;
}

async function repairMappings() {
  const created = [];
  const legacy = await query(
    `SELECT source_id FROM datahub_publisher_source_mappings
     WHERE publisher_id = $1 AND is_enabled = true`,
    [DISABLED_LEGACY_PUBLISHER_ID],
  );
  for (const row of legacy.rows) {
    const insert = await query(
      `INSERT INTO datahub_publisher_source_mappings (source_id, publisher_id, is_enabled, created_by)
       VALUES ($1, $2, true, $3)
       ON CONFLICT (source_id, publisher_id) DO UPDATE SET is_enabled = true
       RETURNING id, source_id`,
      [row.source_id, ACTIVE_PUBLISHER_ID, ADMIN_USER],
    );
    if (insert.rows[0]) created.push({ source_id: row.source_id, mapping_id: insert.rows[0].id, via: 'legacy_copy' });
  }

  const signalInsert = await query(
    `INSERT INTO datahub_publisher_source_mappings (source_id, publisher_id, is_enabled, created_by)
     VALUES ($1, $2, true, $3)
     ON CONFLICT (source_id, publisher_id) DO UPDATE SET is_enabled = true
     RETURNING id, source_id`,
    [SIGNAL_SOURCE_ID, ACTIVE_PUBLISHER_ID, ADMIN_USER],
  );
  if (signalInsert.rows[0]) {
    created.push({ source_id: SIGNAL_SOURCE_ID, mapping_id: signalInsert.rows[0].id, via: 'signal_source' });
  }

  return created;
}

async function main() {
  const evidence = { before: await snapshotState('before') };

  console.log('=== P4 Production repair ===');
  evidence.topicUpdates = await repairTopics();
  console.log('Topics updated:', evidence.topicUpdates.length);

  evidence.mappingCreates = await repairMappings();
  console.log('Mappings ensured:', evidence.mappingCreates.length);

  evidence.after = await snapshotState('after');

  evidence.validations = [];
  for (const topic of evidence.after.topics.filter(t => t.is_active)) {
    const result = await validateAutomationTopic(topic.id);
    evidence.validations.push({
      topicId: topic.id,
      name: topic.name,
      validity: result.validity,
    });
    console.log('Validate', topic.name, '→', result.validity.status, result.validity.valid);
  }

  const t0 = Date.now();
  const refresh = await refreshAutomationQueue({});
  evidence.refresh = { durationMs: Date.now() - t0, summary: refresh.summary, added: refresh.added };
  console.log('Refresh', evidence.refresh.durationMs, 'ms', refresh.summary);

  if ((refresh.summary?.queued || refresh.added) < 1) {
    throw new Error(`Expected queued >= 1 after repair, got ${refresh.summary?.queued ?? refresh.added}`);
  }

  const dispatch = await dispatchAutomationQueue(ADMIN_USER, {
    limit: 1,
    dryRun: true,
    confirmLive: false,
  });
  evidence.dispatch = { processed: dispatch.processed };

  const executions = await listAutomationExecutions({ limit: 5 });
  evidence.executions = executions.slice(0, 3).map(e => ({
    id: e.id,
    status: e.status,
    topicId: e.topicId,
    publisherId: e.publisherId,
    errorLabel: e.errorLabel,
    dryRun: e.dryRun,
  }));

  const history = await query(
    `SELECT id, status, telegram_message_id, created_at
     FROM publisher_delivery_history
     WHERE publisher_id = $1
     ORDER BY created_at DESC LIMIT 3`,
    [ACTIVE_PUBLISHER_ID],
  );
  evidence.publisherHistory = history.rows;
  const liveSent = history.rows.some(r => r.status === 'sent' && r.telegram_message_id);
  if (liveSent) throw new Error('Live Telegram send detected in publisher history');

  fs.mkdirSync(path.dirname(EVIDENCE_PATH), { recursive: true });
  fs.writeFileSync(EVIDENCE_PATH, JSON.stringify(evidence, null, 2));
  console.log('Evidence written:', EVIDENCE_PATH);
  console.log('PASS: production repair + dry-run verified');
}

main().catch(err => {
  console.error('FAIL:', err.message);
  process.exit(1);
});
