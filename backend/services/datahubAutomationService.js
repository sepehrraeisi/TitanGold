import { query } from '../database/db.js';
import { logger } from './logger.js';
import { buildDataPipelineView } from './dataPipelineSnapshot.js';
import { runPublisherPublish } from './telegramPublisherService.js';

const PRIORITY_TO_NUM = { low: 1, medium: 2, high: 3, critical: 4 };
const NUM_TO_PRIORITY = { 1: 'low', 2: 'medium', 3: 'high', 4: 'critical' };

function slugifyTopicKey(name) {
  const base = String(name || 'topic')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);
  return `${base || 'topic'}-${Date.now().toString(36)}`;
}

function mapTopicRowToUi(row, stats = null) {
  const trigger = row.trigger_conditions || {};
  const targets = row.publish_targets || {};
  const publisherIds = Array.isArray(targets.publisherIds) ? targets.publisherIds : [];
  const priority = NUM_TO_PRIORITY[row.priority] || 'medium';

  return {
    id: row.id,
    name: row.name,
    title: row.name,
    topic_key: row.topic_key,
    source_type: row.source_type,
    agentId: trigger.agentId || '',
    agentName: trigger.agentName,
    description: trigger.description,
    categoryIds: trigger.categoryIds || [],
    dataTypes: trigger.dataTypes || [],
    tags: trigger.tags || [],
    priority,
    minPassRate: trigger.minPassRate,
    minQualityScore: trigger.minQualityScore,
    includeStatuses: trigger.includeStatuses || ['ready'],
    publisherTargets: publisherIds,
    enabled: row.is_active,
    lastEvaluated: row.updated_at ? new Date(row.updated_at).toISOString() : undefined,
    stats: stats || trigger.stats || {
      last24h: { inflow: 0, approved: 0, published: 0, passRate: 0, total: 0, rejected: 0 },
      totalPublished: 0,
    },
  };
}

function buildTriggerFromBody(body) {
  return {
    agentId: body.agentId,
    agentName: body.agentName,
    description: body.description,
    categoryIds: body.categoryIds || [],
    dataTypes: body.dataTypes || [],
    tags: body.tags || [],
    minPassRate: body.minPassRate,
    minQualityScore: body.minQualityScore,
    includeStatuses: body.includeStatuses?.length ? body.includeStatuses : ['ready'],
  };
}

function computeTopicStats(topic, pipelineCategories) {
  const categoryById = new Map();
  const categoryByName = new Map();
  for (const cat of pipelineCategories) {
    categoryById.set(cat.categoryId, cat);
    categoryByName.set(String(cat.name).toLowerCase(), cat);
  }
  const categories = (topic.categoryIds || [])
    .map(id => categoryById.get(id) || categoryByName.get(String(id).toLowerCase()))
    .filter(Boolean);
  const inflow = categories.reduce((sum, cat) => sum + (cat.inflow || 0), 0);
  const passRate =
    categories.length > 0
      ? categories.reduce((sum, cat) => sum + (cat.passRate || 0), 0) / categories.length
      : 0;
  const approved = Math.round(inflow * (passRate / 100));
  const published = Math.round(approved * ((topic.publisherTargets?.length || 0) > 0 ? 0.85 : 0.55));
  return {
    last24h: {
      inflow,
      approved,
      published,
      passRate: Number(passRate.toFixed(1)),
      total: inflow,
      rejected: Math.max(0, inflow - approved),
    },
    totalPublished: 0,
  };
}

export async function listAutomationTopics() {
  const result = await query(
    `SELECT * FROM datahub_automation_topics ORDER BY priority DESC, name ASC`,
  );
  let categories = [];
  try {
    const pipeline = await buildDataPipelineView();
    categories = pipeline.snapshot?.categories || [];
  } catch (e) {
    logger.warn('Automation topics: pipeline stats skipped', e.message);
  }
  return result.rows.map(row => {
    const ui = mapTopicRowToUi(row);
    return { ...ui, stats: computeTopicStats(ui, categories) };
  });
}

export async function getAutomationTopic(id) {
  const result = await query(`SELECT * FROM datahub_automation_topics WHERE id = $1`, [id]);
  if (result.rows.length === 0) {
    const err = new Error('Automation topic not found');
    err.status = 404;
    throw err;
  }
  return mapTopicRowToUi(result.rows[0]);
}

export async function createAutomationTopic(body, userId) {
  const topicKey = body.topic_key?.trim() || slugifyTopicKey(body.name || body.title);
  const priorityNum = PRIORITY_TO_NUM[body.priority] || 2;
  const trigger = buildTriggerFromBody(body);
  const publishTargets = { publisherIds: body.publisherTargets || [] };

  const insert = await query(
    `INSERT INTO datahub_automation_topics (
      name, topic_key, source_type, trigger_conditions, publish_targets,
      is_active, priority, created_by
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    RETURNING *`,
    [
      body.name || body.title,
      topicKey,
      body.source_type || 'pipeline',
      JSON.stringify(trigger),
      JSON.stringify(publishTargets),
      body.enabled !== false,
      priorityNum,
      userId || null,
    ],
  );
  return mapTopicRowToUi(insert.rows[0]);
}

export async function updateAutomationTopic(id, body) {
  const existing = await query(`SELECT * FROM datahub_automation_topics WHERE id = $1`, [id]);
  if (existing.rows.length === 0) {
    const err = new Error('Automation topic not found');
    err.status = 404;
    throw err;
  }
  const row = existing.rows[0];
  const trigger = { ...(row.trigger_conditions || {}), ...buildTriggerFromBody(body) };
  const publishTargets = {
    publisherIds:
      body.publisherTargets !== undefined
        ? body.publisherTargets
        : row.publish_targets?.publisherIds || [],
  };
  const priorityNum =
    body.priority !== undefined ? PRIORITY_TO_NUM[body.priority] || row.priority : row.priority;

  const updated = await query(
    `UPDATE datahub_automation_topics SET
      name = COALESCE($2, name),
      source_type = COALESCE($3, source_type),
      trigger_conditions = $4,
      publish_targets = $5,
      is_active = COALESCE($6, is_active),
      priority = $7,
      updated_at = NOW()
    WHERE id = $1
    RETURNING *`,
    [
      id,
      body.name || body.title || null,
      body.source_type || null,
      JSON.stringify(trigger),
      JSON.stringify(publishTargets),
      body.enabled !== undefined ? body.enabled : null,
      priorityNum,
    ],
  );
  return mapTopicRowToUi(updated.rows[0]);
}

export async function deleteAutomationTopic(id) {
  const result = await query(
    `DELETE FROM datahub_automation_topics WHERE id = $1 RETURNING id`,
    [id],
  );
  if (result.rows.length === 0) {
    const err = new Error('Automation topic not found');
    err.status = 404;
    throw err;
  }
}

export async function getAutomationSchedule() {
  const result = await query(`SELECT * FROM datahub_automation_schedule WHERE id = 'default'`);
  const row = result.rows[0];
  if (!row) {
    return {
      enabled: false,
      intervalMinutes: 15,
      maxItemsPerRun: 5,
      lastRun: undefined,
      nextRun: undefined,
    };
  }
  return {
    enabled: row.enabled,
    intervalMinutes: row.interval_minutes,
    maxItemsPerRun: row.max_items_per_run,
    lastRun: row.last_run_at ? new Date(row.last_run_at).toISOString() : undefined,
    nextRun: row.next_run_at ? new Date(row.next_run_at).toISOString() : undefined,
  };
}

export async function updateAutomationSchedule(updates) {
  const current = await getAutomationSchedule();
  const enabled = updates.enabled !== undefined ? updates.enabled : current.enabled;
  const intervalMinutes =
    updates.intervalMinutes !== undefined ? updates.intervalMinutes : current.intervalMinutes;
  const maxItemsPerRun =
    updates.maxItemsPerRun !== undefined ? updates.maxItemsPerRun : current.maxItemsPerRun;

  let nextRun = current.nextRun ? new Date(current.nextRun) : null;
  if (updates.nextRun !== undefined) {
    nextRun = updates.nextRun ? new Date(updates.nextRun) : null;
  } else if (enabled && !nextRun) {
    nextRun = new Date(Date.now() + intervalMinutes * 60 * 1000);
  } else if (updates.intervalMinutes !== undefined && enabled) {
    nextRun = new Date(Date.now() + intervalMinutes * 60 * 1000);
  }

  await query(
    `UPDATE datahub_automation_schedule SET
      enabled = $1,
      interval_minutes = $2,
      max_items_per_run = $3,
      next_run_at = $4,
      updated_at = NOW()
    WHERE id = 'default'`,
    [enabled, intervalMinutes, Math.max(1, Math.min(50, maxItemsPerRun)), nextRun],
  );
  return getAutomationSchedule();
}

export async function touchScheduleAfterRun() {
  const schedule = await getAutomationSchedule();
  const now = new Date();
  const next = new Date(now.getTime() + schedule.intervalMinutes * 60 * 1000);
  await query(
    `UPDATE datahub_automation_schedule SET
      last_run_at = $1,
      next_run_at = $2,
      updated_at = NOW()
    WHERE id = 'default'`,
    [now, schedule.enabled ? next : null],
  );
}

function mapQueueRow(row) {
  const priority = NUM_TO_PRIORITY[row.priority] || 'medium';
  return {
    id: row.id,
    recordId: row.record_id,
    topicId: row.topic_id,
    publisherId: row.publisher_id,
    agentId: row.agent_id,
    priority,
    status: row.status === 'processing' ? 'pending' : row.status,
    createdAt: new Date(row.created_at).toISOString(),
    scheduledAt: row.scheduled_at ? new Date(row.scheduled_at).toISOString() : undefined,
    payloadPreview: row.payload_preview || '',
    category: row.category || '',
    dataType: row.data_type || '',
    qualityScore: row.quality_score ?? 0,
    normalizedStatus: row.normalized_status || 'ready',
  };
}

export async function listAutomationQueue({ status = 'pending', limit = 50 } = {}) {
  const result = await query(
    `SELECT * FROM datahub_automation_queue
     WHERE ($1::text IS NULL OR status = $1)
     ORDER BY priority DESC, created_at ASC
     LIMIT $2`,
    [status === 'all' ? null : status, limit],
  );
  return result.rows.map(mapQueueRow);
}

export async function listAutomationExecutions({ limit = 50, offset = 0 } = {}) {
  const result = await query(
    `SELECT e.*, t.name AS topic_name, p.name AS publisher_name
     FROM datahub_automation_executions e
     LEFT JOIN datahub_automation_topics t ON t.id = e.topic_id
     LEFT JOIN telegram_publishers p ON p.id = e.publisher_id
     ORDER BY e.created_at DESC
     LIMIT $1 OFFSET $2`,
    [limit, offset],
  );
  return result.rows.map(row => ({
    id: row.id,
    queueId: row.queue_item_id,
    recordId: row.record_id,
    topicId: row.topic_id,
    publisherId: row.publisher_id,
    agentId: row.agent_id,
    status: row.status === 'dry_run' ? 'sent' : row.status,
    dryRun: row.dry_run,
    sentAt: new Date(row.created_at).toISOString(),
    latencyMs: row.latency_ms,
    payloadPreview: row.payload_preview,
    errorMessage: row.error_message,
    topicName: row.topic_name,
    publisherName: row.publisher_name,
  }));
}

function recordMatchesTopic(record, topic, categoryNameById) {
  const trigger = {
    categoryIds: topic.categoryIds || [],
    dataTypes: topic.dataTypes || [],
    includeStatuses: topic.includeStatuses || ['ready'],
    minQualityScore: topic.minQualityScore,
  };
  if (!trigger.includeStatuses.includes(record.status)) return false;
  if (trigger.minQualityScore != null && record.qualityScore < trigger.minQualityScore) {
    return false;
  }
  const topicCategoryNames = trigger.categoryIds
    .map(id => categoryNameById.get(id) || String(id).toLowerCase())
    .filter(Boolean);
  const matchesCategory =
    trigger.categoryIds.length === 0 ||
    topicCategoryNames.some(
      name =>
        name === record.category?.toLowerCase() ||
        name === String(record.category).toLowerCase(),
    );
  if (!matchesCategory) return false;
  const matchesDataType =
    trigger.dataTypes.length === 0 || trigger.dataTypes.includes(record.dataType);
  return matchesDataType;
}

export async function refreshAutomationQueue({ topicId } = {}) {
  let topics = (await listAutomationTopics()).filter(
    t => t.enabled && (t.publisherTargets?.length || 0) > 0,
  );
  if (topicId) {
    topics = topics.filter(t => t.id === topicId);
  }
  if (topics.length === 0) {
    return { added: 0, queue: await listAutomationQueue() };
  }

  const pipeline = await buildDataPipelineView();
  const normalizedRecords = pipeline.normalizedData || [];
  const categoryNameById = new Map();
  for (const cat of pipeline.snapshot?.categories || []) {
    categoryNameById.set(cat.categoryId, cat.name.toLowerCase());
  }

  const delivered = await query(
    `SELECT record_id::text, publisher_id::text FROM datahub_automation_executions
     WHERE status IN ('sent', 'dry_run') AND created_at > NOW() - INTERVAL '7 days'`,
  );
  const deliveredKeys = new Set(
    delivered.rows.map(r => `${r.record_id}:${r.publisher_id}`),
  );

  const MAX_QUEUE = 25;
  const MAX_PER_PAIR = 3;
  let added = 0;

  for (const topic of topics) {
    for (const publisherId of topic.publisherTargets) {
      let perCount = (
        await query(
          `SELECT COUNT(*)::int AS c FROM datahub_automation_queue
           WHERE topic_id = $1 AND publisher_id = $2 AND status IN ('pending', 'processing')`,
          [topic.id, publisherId],
        )
      ).rows[0].c;
      if (perCount >= MAX_PER_PAIR) continue;

      for (const record of normalizedRecords) {
        if (perCount >= MAX_PER_PAIR || added >= MAX_QUEUE) break;
        const key = `${record.id}:${publisherId}`;
        if (deliveredKeys.has(key)) continue;

        const exists = await query(
          `SELECT id FROM datahub_automation_queue
           WHERE record_id = $1 AND publisher_id = $2 AND status IN ('pending', 'processing')
           LIMIT 1`,
          [record.id, publisherId],
        );
        if (exists.rows.length > 0) continue;
        if (!recordMatchesTopic(record, topic, categoryNameById)) continue;

        const payloadPreview =
          record.payload?.title ||
          (typeof record.payload?.content === 'string'
            ? record.payload.content.slice(0, 120)
            : null) ||
          record.sourceId;

        await query(
          `INSERT INTO datahub_automation_queue (
            topic_id, publisher_id, record_id, agent_id, status, priority,
            payload_preview, category, data_type, quality_score, normalized_status
          ) VALUES ($1, $2, $3, $4, 'pending', $5, $6, $7, $8, $9, $10)`,
          [
            topic.id,
            publisherId,
            record.id,
            topic.agentId,
            PRIORITY_TO_NUM[topic.priority] || 2,
            payloadPreview,
            record.category,
            record.dataType,
            record.qualityScore,
            record.status,
          ],
        );
        deliveredKeys.add(key);
        perCount += 1;
        added += 1;
      }
    }
  }

  return { added, queue: await listAutomationQueue() };
}

async function loadRecordPayload(recordId) {
  const result = await query(
    `SELECT cd.id, cd.normalized_data, cd.metadata, cd.source_id,
            COALESCE(dc.name, ds.category, 'uncategorized') AS category_name
     FROM collected_data cd
     LEFT JOIN data_sources ds ON ds.id = cd.source_id
     LEFT JOIN data_categories dc ON dc.name = ds.category
     WHERE cd.id = $1`,
    [recordId],
  );
  if (result.rows.length === 0) return null;
  const row = result.rows[0];
  const normalized = row.normalized_data || {};
  return {
    title: normalized.title || normalized.content?.slice?.(0, 120),
    content: typeof normalized.content === 'string' ? normalized.content : undefined,
    message:
      normalized.title ||
      (typeof normalized.content === 'string' ? normalized.content.slice(0, 500) : ''),
    category: row.category_name,
    dataType: row.metadata?.data_type,
  };
}

async function dispatchQueueItem(item, userId, { dryRun = false } = {}) {
  const start = Date.now();
  const payload = await loadRecordPayload(item.record_id);
  if (!payload) {
    throw new Error('Source record not found');
  }

  let publishResult;
  try {
    publishResult = await runPublisherPublish(
      item.publisher_id,
      {
        message: payload.message,
        title: payload.title,
        content: payload.content,
        content_type: 'automation',
        confirm_publish: true,
      },
      userId,
    );
  } catch (e) {
    publishResult = {
      success: false,
      dry_run: dryRun,
      status: 'failed',
      error: e.message,
      history_id: null,
    };
  }

  const effectiveDryRun = Boolean(publishResult.dry_run) || dryRun;
  const status =
    publishResult.status === 'dry_run' || effectiveDryRun
      ? 'dry_run'
      : publishResult.success
        ? 'sent'
        : 'failed';

  await query(
    `UPDATE datahub_automation_queue SET
      status = $2,
      processed_at = NOW(),
      updated_at = NOW()
    WHERE id = $1`,
    [item.id, status === 'failed' ? 'failed' : 'sent'],
  );

  const exec = await query(
    `INSERT INTO datahub_automation_executions (
      queue_item_id, topic_id, publisher_id, record_id, agent_id,
      status, dry_run, error_message, payload_preview, latency_ms,
      publisher_history_id, metadata
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
    RETURNING *`,
    [
      item.id,
      item.topic_id,
      item.publisher_id,
      item.record_id,
      item.agent_id,
      status,
      effectiveDryRun,
      publishResult.error || null,
      item.payload_preview,
      Date.now() - start,
      publishResult.history_id || null,
      JSON.stringify({ mode: 'dispatch', user_id: userId }),
    ],
  );

  return { publishResult, execution: exec.rows[0], status };
}

export async function dispatchAutomationQueue(userId, { limit = 5, dryRun = false } = {}) {
  const result = await query(
    `SELECT * FROM datahub_automation_queue
     WHERE status = 'pending'
     ORDER BY priority DESC, created_at ASC
     LIMIT $1`,
    [limit],
  );

  const processed = [];
  for (const row of result.rows) {
    await query(
      `UPDATE datahub_automation_queue SET status = 'processing', updated_at = NOW() WHERE id = $1`,
      [row.id],
    );
    try {
      const outcome = await dispatchQueueItem(row, userId, { dryRun });
      processed.push({ queueItemId: row.id, ...outcome });
    } catch (e) {
      await query(
        `UPDATE datahub_automation_queue SET status = 'failed', processed_at = NOW(), updated_at = NOW() WHERE id = $1`,
        [row.id],
      );
      await query(
        `INSERT INTO datahub_automation_executions (
          queue_item_id, topic_id, publisher_id, record_id, agent_id,
          status, dry_run, error_message, payload_preview, metadata
        ) VALUES ($1, $2, $3, $4, $5, 'failed', $6, $7, $8, $9)`,
        [
          row.id,
          row.topic_id,
          row.publisher_id,
          row.record_id,
          row.agent_id,
          dryRun,
          e.message,
          row.payload_preview,
          JSON.stringify({ mode: 'dispatch' }),
        ],
      );
      processed.push({ queueItemId: row.id, status: 'failed', error: e.message });
    }
  }

  if (processed.length > 0) {
    await touchScheduleAfterRun();
  }

  return {
    processed: processed.length,
    results: processed,
    queue: await listAutomationQueue(),
    executions: await listAutomationExecutions({ limit: 20 }),
  };
}

export async function dispatchSingleQueueItem(queueItemId, userId, { dryRun = false } = {}) {
  const result = await query(`SELECT * FROM datahub_automation_queue WHERE id = $1`, [queueItemId]);
  if (result.rows.length === 0) {
    const err = new Error('Queue item not found');
    err.status = 404;
    throw err;
  }
  const row = result.rows[0];
  if (row.status !== 'pending' && row.status !== 'processing') {
    const err = new Error('Queue item is not pending');
    err.status = 400;
    throw err;
  }
  return dispatchQueueItem(row, userId, { dryRun });
}

export async function failQueueItem(queueItemId, errorMessage) {
  const result = await query(
    `UPDATE datahub_automation_queue SET status = 'failed', processed_at = NOW(), updated_at = NOW()
     WHERE id = $1 AND status IN ('pending', 'processing')
     RETURNING *`,
    [queueItemId],
  );
  if (result.rows.length === 0) {
    const err = new Error('Queue item not found');
    err.status = 404;
    throw err;
  }
  const row = result.rows[0];
  await query(
    `INSERT INTO datahub_automation_executions (
      queue_item_id, topic_id, publisher_id, record_id, agent_id,
      status, dry_run, error_message, payload_preview, metadata
    ) VALUES ($1, $2, $3, $4, $5, 'failed', false, $6, $7, $8)`,
    [
      row.id,
      row.topic_id,
      row.publisher_id,
      row.record_id,
      row.agent_id,
      errorMessage || 'Marked failed manually',
      row.payload_preview,
      JSON.stringify({ mode: 'manual_fail' }),
    ],
  );
  return mapQueueRow(row);
}

export async function retryAutomationExecution(executionId, userId) {
  const exec = await query(`SELECT * FROM datahub_automation_executions WHERE id = $1`, [
    executionId,
  ]);
  if (exec.rows.length === 0) {
    const err = new Error('Execution not found');
    err.status = 404;
    throw err;
  }
  const row = exec.rows[0];
  const pending = await query(
    `SELECT id FROM datahub_automation_queue
     WHERE record_id = $1 AND publisher_id = $2 AND status IN ('pending', 'processing')
     LIMIT 1`,
    [row.record_id, row.publisher_id],
  );
  if (pending.rows.length > 0) {
    const existing = await query(`SELECT * FROM datahub_automation_queue WHERE id = $1`, [
      pending.rows[0].id,
    ]);
    return dispatchQueueItem(existing.rows[0], userId, { dryRun: false });
  }

  const insert = await query(
    `INSERT INTO datahub_automation_queue (
      topic_id, publisher_id, record_id, agent_id, status, priority,
      payload_preview, category, data_type, quality_score, normalized_status,
      metadata
    ) VALUES ($1, $2, $3, $4, 'pending', 2, $5, '', '', 0, 'ready', $6)
    RETURNING *`,
    [
      row.topic_id,
      row.publisher_id,
      row.record_id,
      row.agent_id,
      row.payload_preview,
      JSON.stringify({ retried_from: executionId }),
    ],
  );
  return dispatchQueueItem(insert.rows[0], userId, { dryRun: false });
}

const TEST_RUN_ORPHAN_ERROR = 'Source record not found during test-run';

async function listAutomationQueueForTestRun({ topicId, limit = 10 } = {}) {
  if (topicId) {
    const result = await query(
      `SELECT * FROM datahub_automation_queue
       WHERE status = 'pending' AND topic_id = $1
       ORDER BY priority DESC, created_at ASC
       LIMIT $2`,
      [topicId, limit],
    );
    return result.rows;
  }
  const result = await query(
    `SELECT * FROM datahub_automation_queue
     WHERE status = 'pending'
     ORDER BY priority DESC, created_at ASC
     LIMIT $1`,
    [limit],
  );
  return result.rows;
}

async function markTestRunOrphanQueueItem(row, userId, dryRun, errorMessage) {
  await query(
    `UPDATE datahub_automation_queue SET status = 'failed', processed_at = NOW(), updated_at = NOW()
     WHERE id = $1`,
    [row.id],
  );
  await query(
    `INSERT INTO datahub_automation_executions (
      queue_item_id, topic_id, publisher_id, record_id, agent_id,
      status, dry_run, error_message, payload_preview, metadata
    ) VALUES ($1, $2, $3, $4, $5, 'failed', $6, $7, $8, $9)`,
    [
      row.id,
      row.topic_id,
      row.publisher_id,
      row.record_id,
      row.agent_id,
      dryRun,
      errorMessage,
      row.payload_preview,
      JSON.stringify({ mode: 'test_run_orphan', user_id: userId }),
    ],
  );
}

async function findNextValidQueueItemForTestRun({ topicId, userId, dryRun, limit = 10 }) {
  const candidates = await listAutomationQueueForTestRun({ topicId, limit });
  const skipped = [];
  for (const row of candidates) {
    const payload = await loadRecordPayload(row.record_id);
    if (!payload) {
      await markTestRunOrphanQueueItem(row, userId, dryRun, TEST_RUN_ORPHAN_ERROR);
      skipped.push({ queueItemId: row.id, reason: TEST_RUN_ORPHAN_ERROR });
      continue;
    }
    return { row, skipped };
  }
  return { row: null, skipped };
}

export async function runAutomationTest(userId, { topicId, dryRun = true } = {}) {
  const effectiveDryRun = dryRun !== false;

  if (topicId) {
    const topic = await getAutomationTopic(topicId);
    if (!topic.enabled) {
      const err = new Error('Automation topic is disabled');
      err.status = 400;
      throw err;
    }
    if (!topic.publisherTargets?.length) {
      const err = new Error('Automation topic has no publisher targets');
      err.status = 400;
      throw err;
    }
  } else {
    const enabledTopics = (await listAutomationTopics()).filter(t => t.enabled);
    if (enabledTopics.length === 0) {
      const err = new Error('No active automation topic');
      err.status = 400;
      throw err;
    }
  }

  await refreshAutomationQueue(topicId ? { topicId } : {});

  const { row, skipped } = await findNextValidQueueItemForTestRun({
    topicId,
    userId,
    dryRun: effectiveDryRun,
    limit: 10,
  });

  if (!row) {
    return {
      dryRun: effectiveDryRun,
      processed: 0,
      status: 'no_valid_queue_item',
      message: topicId
        ? 'No valid queue item available for the selected topic'
        : 'No valid queue item available for test-run',
      skipped: skipped.length,
      ...(skipped.length > 0 ? { skippedItems: skipped } : {}),
    };
  }

  const outcome = await dispatchQueueItem(row, userId, { dryRun: effectiveDryRun });
  return {
    ...outcome,
    dryRun: effectiveDryRun,
    processed: 1,
    skipped: skipped.length,
    ...(skipped.length > 0 ? { skippedItems: skipped } : {}),
  };
}

export async function getAutomationOverview() {
  const [topics, schedule, queue, executions] = await Promise.all([
    listAutomationTopics(),
    getAutomationSchedule(),
    listAutomationQueue({ limit: 100 }),
    listAutomationExecutions({ limit: 50 }),
  ]);
  return {
    topics,
    schedule,
    queue,
    executions,
    summary: {
      totalTopics: topics.length,
      enabledTopics: topics.filter(t => t.enabled).length,
      queueSize: queue.filter(q => q.status === 'pending').length,
      avgPassRate:
        topics.length > 0
          ? Math.round(
              topics.reduce((acc, t) => acc + (t.stats?.last24h?.passRate || 0), 0) / topics.length,
            )
          : 0,
    },
  };
}
