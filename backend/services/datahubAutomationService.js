import { query } from '../database/db.js';
import { logger } from './logger.js';
import { runPublisherPublish } from './telegramPublisherService.js';
import {
  buildAllowedAccessControl,
  enforceSourceAccess,
  resolveAgentKey,
  RUNTIME_AGENT_KEYS,
} from '../middleware/accessControlGateway.js';
import { enforcePublishingPolicy, isFilterRuleBlockedError } from './filterRulesGateway.js';

const PRIORITY_TO_NUM = { low: 1, medium: 2, high: 3, critical: 4 };
const NUM_TO_PRIORITY = { 1: 'low', 2: 'medium', 3: 'high', 4: 'critical' };
const MAX_AUTOMATION_RETRIES = 3;
const BLOCKED_ERROR_CODES = new Set([
  'SOURCE_ACCESS_DENIED',
  'FILTER_RULE_BLOCKED',
  'PUBLISHER_MAPPING_REQUIRED',
  'PUBLISHER_DISABLED',
  'PUBLISHER_NOT_FOUND',
]);

function createAutomationError(message, { status = 400, code = 'AUTOMATION_ERROR' } = {}) {
  const err = new Error(message);
  err.status = status;
  err.code = code;
  return err;
}

function enforceAutomationLiveConfirmation({ dryRun = true, confirmLive = false } = {}) {
  if (dryRun === false && confirmLive !== true) {
    throw createAutomationError('Live automation publish requires confirm_live=true', {
      status: 400,
      code: 'LIVE_CONFIRMATION_REQUIRED',
    });
  }
  return dryRun !== false;
}

function getErrorCode(error, fallback = 'AUTOMATION_ERROR') {
  return error?.code || fallback;
}

async function recordAutomationAuditEvent({
  topicId,
  publisherId,
  recordId = null,
  agentId = null,
  status = 'skipped',
  dryRun = true,
  errorCode,
  errorMessage,
  payloadPreview = null,
  metadata = {},
}) {
  await query(
    `INSERT INTO datahub_automation_executions (
      queue_item_id, topic_id, publisher_id, record_id, agent_id,
      status, dry_run, error_message, payload_preview, metadata
    ) VALUES (NULL, $1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [
      topicId || null,
      publisherId || null,
      recordId || null,
      agentId || null,
      status,
      dryRun,
      errorMessage,
      payloadPreview,
      JSON.stringify({ ...metadata, error_code: errorCode }),
    ],
  );
}

async function loadActivePublishersById(publisherIds = []) {
  const uniqueIds = [...new Set((publisherIds || []).filter(Boolean))];
  if (uniqueIds.length === 0) return new Map();
  const result = await query(
    `SELECT id, name, is_active FROM telegram_publishers WHERE id = ANY($1::uuid[])`,
    [uniqueIds],
  );
  return new Map(result.rows.map(row => [String(row.id), row]));
}

async function assertPublisherTargetsActive(publisherIds = []) {
  const uniqueIds = [...new Set((publisherIds || []).filter(Boolean))];
  if (uniqueIds.length === 0) return;
  const publishers = await loadActivePublishersById(uniqueIds);
  const missing = uniqueIds.filter(id => !publishers.has(String(id)));
  if (missing.length > 0) {
    throw createAutomationError(`Publisher target not found: ${missing.join(', ')}`, {
      status: 400,
      code: 'PUBLISHER_NOT_FOUND',
    });
  }
  const disabled = uniqueIds.filter(id => publishers.get(String(id))?.is_active !== true);
  if (disabled.length > 0) {
    throw createAutomationError(`Publisher target is disabled: ${disabled.join(', ')}`, {
      status: 400,
      code: 'PUBLISHER_DISABLED',
    });
  }
}

async function hasEnabledPublisherMapping(sourceId, publisherId) {
  if (!sourceId || !publisherId) return false;
  const result = await query(
    `SELECT id FROM datahub_publisher_source_mappings
     WHERE source_id = $1
       AND publisher_id = $2
       AND is_enabled = true
     LIMIT 1`,
    [sourceId, publisherId],
  );
  return result.rows.length > 0;
}

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

async function loadAutomationTopicStats() {
  const [queueCounts, executionCounts] = await Promise.all([
    query(
      `SELECT
        topic_id,
        COUNT(*) FILTER (WHERE status IN ('pending', 'processing'))::int AS queued,
        COUNT(*) FILTER (WHERE status = 'failed')::int AS failed
       FROM datahub_automation_queue
       GROUP BY topic_id`,
    ),
    query(
      `SELECT
        topic_id,
        COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '24 hours')::int AS published_24h,
        COUNT(*)::int AS total_published
       FROM datahub_automation_executions
       WHERE status IN ('sent', 'dry_run')
       GROUP BY topic_id`,
    ),
  ]);
  const byTopicId = new Map();
  for (const row of queueCounts.rows) {
    byTopicId.set(row.topic_id, {
      queued: Number(row.queued || 0),
      failed: Number(row.failed || 0),
      published24h: 0,
      totalPublished: 0,
    });
  }
  for (const row of executionCounts.rows) {
    const existing = byTopicId.get(row.topic_id) || {
      queued: 0,
      failed: 0,
      published24h: 0,
      totalPublished: 0,
    };
    existing.published24h = Number(row.published_24h || 0);
    existing.totalPublished = Number(row.total_published || 0);
    byTopicId.set(row.topic_id, existing);
  }
  return byTopicId;
}

function computeTopicStats(topic, statsByTopicId) {
  const queueStats = statsByTopicId.get(topic.id) || {
    queued: 0,
    failed: 0,
    published24h: 0,
    totalPublished: 0,
  };
  const inflow = queueStats.queued + queueStats.published24h + queueStats.failed;
  const approved = queueStats.queued + queueStats.published24h;
  const published = queueStats.published24h;
  const passRate = inflow === 0 ? 0 : (approved / inflow) * 100;
  return {
    last24h: {
      inflow,
      approved,
      published,
      passRate: Number(passRate.toFixed(1)),
      total: inflow,
      rejected: queueStats.failed,
      queued: queueStats.queued,
    },
    totalPublished: queueStats.totalPublished,
    publisherCount: topic.publisherTargets?.length || 0,
  };
}

export async function listAutomationTopics() {
  const result = await query(
    `SELECT * FROM datahub_automation_topics ORDER BY priority DESC, name ASC`,
  );
  let statsByTopicId = new Map();
  try {
    statsByTopicId = await loadAutomationTopicStats();
  } catch (e) {
    logger.warn('Automation topics: lightweight stats skipped', e.message);
  }
  return result.rows.map(row => {
    const ui = mapTopicRowToUi(row);
    return { ...ui, stats: computeTopicStats(ui, statsByTopicId) };
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
  await assertPublisherTargetsActive(publishTargets.publisherIds);

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
  await assertPublisherTargetsActive(publishTargets.publisherIds);
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
    retryCount: row.retry_count ?? 0,
    maxRetryCount: row.max_retry_count ?? MAX_AUTOMATION_RETRIES,
    lastErrorCode: row.last_error_code || null,
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
    status: row.status,
    dryRun: row.dry_run,
    sentAt: new Date(row.created_at).toISOString(),
    latencyMs: row.latency_ms,
    payloadPreview: row.payload_preview,
    errorMessage: row.error_message,
    errorCode: row.metadata?.error_code || null,
    deliveryMode: row.metadata?.delivery_mode || (row.dry_run ? 'dry_run' : 'live'),
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

function mapAutomationCandidateRow(row) {
  const normalized = row.normalized_data || {};
  const metadata = normalized.metadata || row.metadata || {};
  const qualityScore = Number(metadata.quality_score_v2 ?? metadata.quality_score ?? 0) || 0;
  const hasQualityWarning =
    metadata.quality_warning === true ||
    metadata.validation_failed === true ||
    metadata.quality_band === 'weak' ||
    metadata.quality_band === 'poor';
  return {
    id: row.id,
    sourceId: row.source_id,
    category: row.category_name || 'uncategorized',
    dataType: metadata.data_type || row.source_type || 'unknown',
    qualityScore,
    status: hasQualityWarning ? 'warning' : 'ready',
    payload: {
      title: normalized.title || normalized.content?.slice?.(0, 120),
      content: typeof normalized.content === 'string' ? normalized.content : undefined,
      metadata,
    },
  };
}

async function loadAutomationCandidateRecords({ limit = 50 } = {}) {
  const result = await query(
    `SELECT
      cd.id,
      cd.source_id,
      cd.normalized_data,
      cd.metadata,
      ds.type AS source_type,
      COALESCE(dc.name, ds.category, 'uncategorized') AS category_name
     FROM collected_data cd
     LEFT JOIN data_sources ds ON ds.id = cd.source_id
     LEFT JOIN data_categories dc ON dc.name = ds.category
     WHERE cd.status = 'processed'
       AND cd.normalized_data IS NOT NULL
       AND (
         cd.processed_at > NOW() - INTERVAL '7 days'
         OR cd.collected_at > NOW() - INTERVAL '7 days'
       )
     ORDER BY cd.processed_at DESC NULLS LAST, cd.collected_at DESC
     LIMIT $1`,
    [limit],
  );
  return result.rows.map(mapAutomationCandidateRow);
}

async function loadCategoryNameLookup() {
  const result = await query(`SELECT id, name FROM data_categories`);
  return new Map(result.rows.map(row => [row.id, String(row.name).toLowerCase()]));
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

  const [normalizedRecords, categoryNameById] = await Promise.all([
    loadAutomationCandidateRecords({ limit: 75 }),
    loadCategoryNameLookup(),
  ]);
  const publisherIds = [...new Set(topics.flatMap(topic => topic.publisherTargets || []))];
  const publishersById = await loadActivePublishersById(publisherIds);

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
  let skipped = 0;

  for (const topic of topics) {
    for (const publisherId of topic.publisherTargets) {
      const publisher = publishersById.get(String(publisherId));
      if (!publisher || publisher.is_active !== true) {
        await recordAutomationAuditEvent({
          topicId: topic.id,
          publisherId,
          agentId: topic.agentId,
          status: 'skipped',
          errorCode: publisher ? 'PUBLISHER_DISABLED' : 'PUBLISHER_NOT_FOUND',
          errorMessage: publisher ? 'Publisher target is disabled' : 'Publisher target not found',
          metadata: { mode: 'enqueue', reason: 'publisher_unavailable' },
        });
        skipped += 1;
        continue;
      }

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

        const topicAgentKey = await resolveAgentKey(topic.agentId);
        if (topicAgentKey) {
          const agentAccess = await enforceSourceAccess(null, {
            sourceId: record.sourceId,
            agentKey: topicAgentKey,
            action: 'automation_enqueue',
            dataType: record.dataType,
          });
          if (!agentAccess.allowed) {
            await recordAutomationAuditEvent({
              topicId: topic.id,
              publisherId,
              recordId: record.id,
              agentId: topic.agentId,
              status: 'blocked',
              errorCode: 'SOURCE_ACCESS_DENIED',
              errorMessage: 'Agent access denied by source ACL',
              payloadPreview,
              metadata: { mode: 'enqueue', actor: 'topic_agent' },
            });
            skipped += 1;
            continue;
          }
        }

        const publisherAccess = await enforceSourceAccess(null, {
          sourceId: record.sourceId,
          agentKey: RUNTIME_AGENT_KEYS.PUBLISHER,
          action: 'automation_enqueue',
          dataType: record.dataType,
        });
        if (!publisherAccess.allowed) {
          await recordAutomationAuditEvent({
            topicId: topic.id,
            publisherId,
            recordId: record.id,
            agentId: topic.agentId,
            status: 'blocked',
            errorCode: 'SOURCE_ACCESS_DENIED',
            errorMessage: 'Publisher access denied by source ACL',
            payloadPreview,
            metadata: { mode: 'enqueue', actor: 'publisher' },
          });
          skipped += 1;
          continue;
        }

        try {
          await enforcePublishingPolicy({
            sourceId: record.sourceId,
            url: record.payload?.metadata?.url || record.payload?.url,
            text: [record.payload?.title, record.payload?.content, payloadPreview]
              .filter(Boolean)
              .join('\n'),
            dataType: record.dataType,
            metadata: record.payload?.metadata,
            enforcementPath: 'automation_enqueue',
          });
        } catch (error) {
          if (isFilterRuleBlockedError(error)) {
            await recordAutomationAuditEvent({
              topicId: topic.id,
              publisherId,
              recordId: record.id,
              agentId: topic.agentId,
              status: 'blocked',
              errorCode: 'FILTER_RULE_BLOCKED',
              errorMessage: error.message,
              payloadPreview,
              metadata: { mode: 'enqueue', reason: error.reason, rule: error.rule },
            });
            skipped += 1;
            continue;
          }
          throw error;
        }

        if (!(await hasEnabledPublisherMapping(record.sourceId, publisherId))) {
          await recordAutomationAuditEvent({
            topicId: topic.id,
            publisherId,
            recordId: record.id,
            agentId: topic.agentId,
            status: 'skipped',
            errorCode: 'PUBLISHER_MAPPING_REQUIRED',
            errorMessage: 'Source is not mapped to this publisher',
            payloadPreview,
            metadata: { mode: 'enqueue', source_id: record.sourceId },
          });
          skipped += 1;
          continue;
        }

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

  return { added, skipped, queue: await listAutomationQueue() };
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

  const recordSource = (
    await query('SELECT source_id FROM collected_data WHERE id = $1', [item.record_id])
  ).rows[0]?.source_id;

  if (recordSource) {
    const publisherAccess = await enforceSourceAccess(null, {
      sourceId: recordSource,
      agentKey: RUNTIME_AGENT_KEYS.PUBLISHER,
      userId,
      action: 'automation_publish',
      dataType: payload.dataType,
    });
    if (!publisherAccess.allowed) {
      const err = new Error('Publisher access denied by source ACL');
      err.status = 403;
      err.code = 'SOURCE_ACCESS_DENIED';
      throw err;
    }

    const routeAgentKey = await resolveAgentKey(item.agent_id);
    if (routeAgentKey) {
      const agentAccess = await enforceSourceAccess(null, {
        sourceId: recordSource,
        agentKey: routeAgentKey,
        userId,
        action: 'automation_publish',
        dataType: payload.dataType,
      });
      if (!agentAccess.allowed) {
        const err = new Error('Agent access denied by source ACL');
        err.status = 403;
        err.code = 'SOURCE_ACCESS_DENIED';
        throw err;
      }
    }
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
        dry_run: dryRun,
        source_id: recordSource,
        data_type: payload.dataType,
        accessControl: buildAllowedAccessControl({
          sourceId: recordSource,
          agentKey: RUNTIME_AGENT_KEYS.PUBLISHER,
          dataType: payload.dataType,
        }),
      },
      userId,
    );
  } catch (e) {
    publishResult = {
      success: false,
      dry_run: dryRun,
      status: BLOCKED_ERROR_CODES.has(getErrorCode(e)) ? 'blocked' : 'failed',
      error: e.message,
      error_code: getErrorCode(e),
      history_id: e.history_id || null,
    };
  }

  const effectiveDryRun = Boolean(publishResult.dry_run) || dryRun;
  const status =
    publishResult.success && (publishResult.status === 'dry_run' || effectiveDryRun)
      ? 'dry_run'
      : publishResult.status === 'blocked'
        ? 'blocked'
      : publishResult.success
        ? 'sent'
        : 'failed';

  await query(
    `UPDATE datahub_automation_queue SET
      status = $2,
      last_error_code = $3,
      processed_at = NOW(),
      updated_at = NOW()
    WHERE id = $1`,
    [item.id, status === 'sent' || status === 'dry_run' ? 'sent' : 'failed', publishResult.error_code || null],
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
      JSON.stringify({
        mode: 'dispatch',
        user_id: userId,
        error_code: publishResult.error_code || null,
        delivery_mode: effectiveDryRun ? 'dry_run' : 'live',
      }),
    ],
  );

  return { publishResult, execution: exec.rows[0], status };
}

export async function dispatchAutomationQueue(
  userId,
  { limit = 5, dryRun = true, confirmLive = false } = {},
) {
  const effectiveDryRun = enforceAutomationLiveConfirmation({ dryRun, confirmLive });
  const result = await query(
    `WITH picked AS (
       SELECT id
       FROM datahub_automation_queue
       WHERE status = 'pending'
         AND retry_count < max_retry_count
       ORDER BY priority DESC, created_at ASC
       LIMIT $1
       FOR UPDATE SKIP LOCKED
     )
     UPDATE datahub_automation_queue q
     SET status = 'processing',
         retry_count = retry_count + 1,
         updated_at = NOW()
     FROM picked
     WHERE q.id = picked.id
     RETURNING q.*`,
    [limit],
  );

  const processed = [];
  for (const row of result.rows) {
    try {
      const outcome = await dispatchQueueItem(row, userId, { dryRun: effectiveDryRun });
      processed.push({ queueItemId: row.id, ...outcome });
    } catch (e) {
      await query(
        `UPDATE datahub_automation_queue
         SET status = 'failed',
             last_error_code = $2,
             processed_at = NOW(),
             updated_at = NOW()
         WHERE id = $1`,
        [row.id, getErrorCode(e)],
      );
      await query(
        `INSERT INTO datahub_automation_executions (
          queue_item_id, topic_id, publisher_id, record_id, agent_id,
          status, dry_run, error_message, payload_preview, metadata
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          row.id,
          row.topic_id,
          row.publisher_id,
          row.record_id,
          row.agent_id,
          BLOCKED_ERROR_CODES.has(getErrorCode(e)) ? 'blocked' : 'failed',
          effectiveDryRun,
          e.message,
          row.payload_preview,
          JSON.stringify({ mode: 'dispatch', error_code: getErrorCode(e) }),
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

export async function dispatchSingleQueueItem(
  queueItemId,
  userId,
  { dryRun = true, confirmLive = false } = {},
) {
  const effectiveDryRun = enforceAutomationLiveConfirmation({ dryRun, confirmLive });
  const result = await query(
    `UPDATE datahub_automation_queue
     SET status = 'processing',
         retry_count = retry_count + 1,
         updated_at = NOW()
     WHERE id = $1
       AND status = 'pending'
       AND retry_count < max_retry_count
     RETURNING *`,
    [queueItemId],
  );
  if (result.rows.length === 0) {
    const existing = await query(`SELECT * FROM datahub_automation_queue WHERE id = $1`, [queueItemId]);
    if (existing.rows.length === 0) {
      const err = new Error('Queue item not found');
      err.status = 404;
      throw err;
    }
    const err = new Error(
      existing.rows[0].retry_count >= existing.rows[0].max_retry_count
        ? 'Queue item exceeded max retries'
        : 'Queue item is not pending',
    );
    err.status = 400;
    err.code = existing.rows[0].retry_count >= existing.rows[0].max_retry_count
      ? 'MAX_RETRIES_EXCEEDED'
      : 'QUEUE_ITEM_NOT_PENDING';
    throw err;
  }
  return dispatchQueueItem(result.rows[0], userId, { dryRun: effectiveDryRun });
}

export async function failQueueItem(queueItemId, errorMessage) {
  const result = await query(
    `UPDATE datahub_automation_queue
     SET status = 'failed',
         last_error_code = 'MANUAL_REJECTED',
         processed_at = NOW(),
         updated_at = NOW()
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
      JSON.stringify({ mode: 'manual_fail', error_code: 'MANUAL_REJECTED' }),
    ],
  );
  return mapQueueRow(row);
}

export async function retryAutomationExecution(
  executionId,
  userId,
  { dryRun = true, confirmLive = false } = {},
) {
  const effectiveDryRun = enforceAutomationLiveConfirmation({ dryRun, confirmLive });
  const exec = await query(`SELECT * FROM datahub_automation_executions WHERE id = $1`, [
    executionId,
  ]);
  if (exec.rows.length === 0) {
    const err = new Error('Execution not found');
    err.status = 404;
    throw err;
  }
  const row = exec.rows[0];
  const retryCount = await query(
    `SELECT COUNT(*)::int AS c
     FROM datahub_automation_executions
     WHERE record_id = $1
       AND publisher_id = $2
       AND status IN ('failed', 'blocked')`,
    [row.record_id, row.publisher_id],
  );
  if (Number(retryCount.rows[0]?.c || 0) >= MAX_AUTOMATION_RETRIES) {
    throw createAutomationError('Automation execution exceeded max retry count', {
      status: 429,
      code: 'MAX_RETRIES_EXCEEDED',
    });
  }
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
    if (existing.rows[0]?.status === 'pending') {
      return dispatchSingleQueueItem(existing.rows[0].id, userId, {
        dryRun: effectiveDryRun,
        confirmLive,
      });
    }
    throw createAutomationError('Matching queue item is already processing', {
      status: 409,
      code: 'QUEUE_ITEM_PROCESSING',
    });
  }

  const insert = await query(
    `INSERT INTO datahub_automation_queue (
      topic_id, publisher_id, record_id, agent_id, status, priority,
      payload_preview, category, data_type, quality_score, normalized_status,
      retry_count, max_retry_count, metadata
    ) VALUES ($1, $2, $3, $4, 'pending', 2, $5, '', '', 0, 'ready', 0, $6, $7)
    RETURNING *`,
    [
      row.topic_id,
      row.publisher_id,
      row.record_id,
      row.agent_id,
      row.payload_preview,
      MAX_AUTOMATION_RETRIES,
      JSON.stringify({ retried_from: executionId }),
    ],
  );
  return dispatchSingleQueueItem(insert.rows[0].id, userId, {
    dryRun: effectiveDryRun,
    confirmLive,
  });
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
    `UPDATE datahub_automation_queue
     SET status = 'failed',
         last_error_code = 'SOURCE_RECORD_NOT_FOUND',
         processed_at = NOW(),
         updated_at = NOW()
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
      JSON.stringify({ mode: 'test_run_orphan', user_id: userId, error_code: 'SOURCE_RECORD_NOT_FOUND' }),
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

export async function runAutomationTest(
  userId,
  { topicId, dryRun = true, confirmLive = false } = {},
) {
  const effectiveDryRun = enforceAutomationLiveConfirmation({ dryRun, confirmLive });

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

  const outcome = await dispatchSingleQueueItem(row.id, userId, {
    dryRun: effectiveDryRun,
    confirmLive,
  });
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
