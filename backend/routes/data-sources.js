import express from 'express';
import { authenticate, authorize } from '../middleware/auth.js';
import { query } from '../database/db.js';
import { validateBody, validateQuery, validateParams, validateResponse } from '../middleware/validation.js';
import { writeRateLimiter, readRateLimiter } from '../middleware/rateLimiter.js';
import {
  createDataSourceSchema,
  updateDataSourceSchema,
  collectedDataQuerySchema,
  uuidParamSchema,
  dataSourceResponseSchema,
  dataSourcesListResponseSchema,
  collectedDataResponseSchema,
  collectedDataListResponseSchema,
  dataHubStatsSchema,
  dataHubStateSchema,
  dataPipelineViewResponseSchema,
  pipelineQuerySchema,
  dataPipelineBacklogResponseSchema,
  accessLogsQuerySchema,
  accessLogsListResponseSchema,
  checkDuplicateUrlQuerySchema,
} from '../schemas/dataHubSchemas.js';
import {
  buildDuplicateEnrichmentBySourceId,
  buildDuplicateEnrichmentBySourceIdLightweight,
  enrichSourceWithDuplicateFields,
  evaluateDuplicateUrlGuard,
  findDuplicateUrlSources,
  listDuplicateUrlGroups,
  getDuplicateUrlDashboard,
  setSourceDuplicateUrlIgnore,
} from '../services/dataSourceUrlDuplicateService.js';
import { buildDataPipelineView } from '../services/dataPipelineSnapshot.js';
import { buildPipelineBacklogEnrichment } from '../services/pipelineBacklogEnrichment.js';
import { getOrLoadCached } from '../services/pipelineSnapshotCache.js';
import { listDataHubAccessLogs } from '../services/dataHubAccessLogs.js';
import { tryInsertDataHubAccessLog } from '../services/dataHubAccessLogWriter.js';

import { telegramService } from '../services/telegram.js';
import { syncTelegramChannelsToDataSources, syncChannelCategoryToDataSource } from '../services/telegramSync.js';
import { transferTelegramMessagesToPipeline } from '../services/telegramPipeline.js';
import { dataFetcherService } from '../services/dataFetcher.js';
import { logger } from '../services/logger.js';
import { encryptSecret, decryptSecret, isEncrypted } from '../utils/crypto.js';
import { calculatePagination, formatPaginatedResponse } from '../utils/pagination.js';
import {
    applyTelegramListEnrichment,
    batchTelegramCollectorEnrichment,
} from '../services/telegramCollectorSourceStatus.js';
import {
    enrichSourceCategoryFields,
    loadApprovedCategoryLookup,
    resolveCategoryForWrite,
} from '../utils/categoryTaxonomy.js';
import {
  assertAccessControlGateway,
  enforceSourceAccess,
  RUNTIME_AGENT_KEYS,
  sourceAccessAllowedSql,
} from '../middleware/accessControlGateway.js';
import { resolveAgentKeyFromRequest } from '../utils/sourceAccessRequest.js';
import { enforcePublishingPolicy } from '../services/filterRulesGateway.js';

const router = express.Router();
const writeAuth = [authenticate, authorize('admin', 'trader'), writeRateLimiter];

router.post('/publish-telegram', ...writeAuth, async (req, res) => {
  try {
    const { message, photoUrl, source_id: sourceId, data_type: dataType } = req.body;

    if (!sourceId) {
      return res.status(400).json({
        error: 'source_id is required',
        code: 'BAD_REQUEST',
      });
    }

    assertAccessControlGateway({
      accessControl: req.accessControl,
      sourceId,
      agentKey: RUNTIME_AGENT_KEYS.PUBLISHER,
      message: 'Publisher access denied by source ACL',
    });

    await enforcePublishingPolicy({
      sourceId,
      message,
      dataType,
      metadata: { photoUrl },
      userId: req.user?.id,
      enforcementPath: 'legacy_publish_telegram',
    });

    if (photoUrl) {
      await telegramService.sendPhoto(photoUrl, message);
    } else {
      await telegramService.sendMessage(message);
    }

    res.json({ success: true, message: 'Published to Telegram' });
  } catch (error) {
    res.status(error.status || 500).json({
      error: error.message || 'Failed to publish to Telegram',
      code: error.code || undefined,
      reason: error.reason || undefined,
      rule: error.rule || undefined,
    });
  }
});

// ---------------------------------------------------------------------------
// Telegram Collector ↔ Data Sources Sync (TASK-DHT-010)
// ---------------------------------------------------------------------------

router.post('/telegram-sync', ...writeAuth, async (req, res) => {
  try {
    const summary = await syncTelegramChannelsToDataSources();
    res.json({
      success: true,
      ...summary,
    });
  } catch (error) {
    logger.error('Failed to sync telegram channels with data sources:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to sync Telegram channels with data sources',
    });
  }
});

// Sync category for a specific telegram channel → data source (TASK-DHT-020)
router.post('/telegram-sync-category', ...writeAuth, async (req, res) => {
  try {
    const { channelId, category } = req.body;
    
    if (!channelId || !category) {
      return res.status(400).json({
        success: false,
        error: 'channelId and category are required',
      });
    }

    const normalizedCategory = await resolveCategoryForWrite(category, query, { log: logger });
    const result = await syncChannelCategoryToDataSource(channelId, normalizedCategory);
    res.json(result);
  } catch (error) {
    logger.error('Failed to sync channel category to data source:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to sync channel category',
    });
  }
});

// Transfer telegram messages to pipeline (TASK-DHT-030)
router.post('/telegram-transfer-messages', ...writeAuth, async (req, res) => {
  try {
    const { batchSize } = req.body;
    const size = batchSize && batchSize > 0 && batchSize <= 500 ? batchSize : 50;
    
    const summary = await transferTelegramMessagesToPipeline(size);
    res.json({
      success: true,
      ...summary,
    });
  } catch (error) {
    logger.error('Failed to transfer telegram messages to pipeline:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to transfer telegram messages',
    });
  }
});

// Per-account telegram metrics for Account Summary (TASK-TC-009)
router.get('/telegram-account-metrics', authenticate, readRateLimiter, async (req, res) => {
  try {
    const result = await query(
      `SELECT tc.account_id, COUNT(*)::int AS messages_24h
       FROM telegram_messages tm
       JOIN telegram_channels tc ON tm.channel_id = tc.id
       WHERE tm.created_at >= NOW() - INTERVAL '24 hours'
         AND tc.account_id IS NOT NULL
       GROUP BY tc.account_id`
    );
    const metrics = {};
    for (const row of result.rows) {
      if (row.account_id) {
        metrics[row.account_id] = { messages24h: row.messages_24h };
      }
    }
    res.json({ success: true, metrics });
  } catch (error) {
    logger.error('Failed to fetch telegram account metrics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch telegram account metrics',
    });
  }
});

// Test data source connection (TASK-BE-007) — draft config from create/edit modal
router.post('/test-connection', ...writeAuth, validateBody(createDataSourceSchema), async (req, res) => {
  try {
    const sourceConfig = req.validatedBody;
    const result = await dataFetcherService.testConnection(sourceConfig);

    if (result.success) {
      res.json(result);
    } else {
      // Return 422 Unprocessable Entity for connection failures
      res.status(422).json(result);
    }
  } catch (error) {
    logger.error('Failed to test connection:', error);
    res.status(500).json({ error: 'Failed to test connection' });
  }
});

// Test persisted source by ID — credentials never sent or returned to client
router.post(
  '/:id/test-connection',
  ...writeAuth,
  validateParams(uuidParamSchema),
  async (req, res) => {
    try {
      const { id } = req.validatedParams;
      const result = await dataFetcherService.testConnectionById(id);

      if (result.success) {
        res.json(result);
      } else {
        res.status(422).json(result);
      }
    } catch (error) {
      logger.error('Failed to test connection by id:', error);
      res.status(500).json({ error: 'Failed to test connection' });
    }
  },
);

router.get(
  '/duplicate-urls',
  authenticate,
  readRateLimiter,
  async (req, res) => {
    try {
      const dashboard = await getDuplicateUrlDashboard();
      res.json(dashboard);
    } catch (error) {
      logger.error('Failed to list duplicate URL groups:', error);
      res.status(500).json({ error: 'Failed to list duplicate URL groups' });
    }
  },
);

router.post(
  '/:id/duplicate-url/ignore',
  ...writeAuth,
  validateParams(uuidParamSchema),
  async (req, res) => {
    try {
      const { id } = req.validatedParams;
      const ignore = req.body?.ignore !== false;
      await setSourceDuplicateUrlIgnore(id, ignore, req.user?.id);
      const dashboard = await getDuplicateUrlDashboard();
      res.json({
        success: true,
        ignore,
        summary: dashboard.summary,
      });
    } catch (error) {
      const status = error.status || 500;
      res.status(status).json({ error: error.message || 'Failed to update duplicate ignore' });
    }
  },
);

router.get(
  '/check-duplicate-url',
  authenticate,
  readRateLimiter,
  validateQuery(checkDuplicateUrlQuerySchema),
  async (req, res) => {
    try {
      const { type, url, exclude_source_id: excludeSourceId } = req.validatedQuery || req.query;
      const result = await findDuplicateUrlSources({
        type,
        url,
        excludeSourceId: excludeSourceId || null,
        includeInactive: true,
      });
      const activeDuplicates = result.duplicates.filter(d => d.isActive);
      res.json({
        normalizedUrl: result.normalizedUrl,
        duplicates: result.duplicates,
        hasActiveDuplicate: activeDuplicates.length > 0,
        hasInactiveDuplicate: result.duplicates.some(d => !d.isActive),
      });
    } catch (error) {
      logger.error('Failed to check duplicate URL:', error);
      res.status(500).json({ error: 'Failed to check duplicate URL' });
    }
  },
);

router.get('/', authenticate, readRateLimiter, validateResponse(dataSourcesListResponseSchema), async (req, res) => {
  try {
    const { page, limit } = req.query;
    const currentPage = Math.max(1, parseInt(page, 10) || 1);
    const itemsPerPage = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const offset = (currentPage - 1) * itemsPerPage;

    const [countResult, result, categoryLookup, duplicateEnrichmentById] = await Promise.all([
      query('SELECT COUNT(*) as total FROM data_sources'),
      query(
        'SELECT * FROM data_sources ORDER BY name LIMIT $1 OFFSET $2',
        [itemsPerPage, offset],
      ),
      loadApprovedCategoryLookup(query),
      buildDuplicateEnrichmentBySourceIdLightweight(),
    ]);
    const totalCount = parseInt(countResult.rows[0].total);
    const pagination = calculatePagination(currentPage, itemsPerPage, totalCount);
    const enrichmentById = await batchTelegramCollectorEnrichment(result.rows, {
      includeMessageStats: false,
      includeCollectedStats: false,
    });

    // Mask sensitive data; enrich category + collector-linked Telegram status
    const sources = result.rows.map(source => {
      const { credentials, ...safeSource } = source;
      const base = enrichSourceCategoryFields(
        {
          ...safeSource,
          hasCredentials: !!credentials && Object.keys(credentials).length > 0,
        },
        categoryLookup,
      );
      const withTelegram = applyTelegramListEnrichment(base, enrichmentById.get(source.id));
      return enrichSourceWithDuplicateFields(withTelegram, duplicateEnrichmentById);
    });

    res.json(formatPaginatedResponse(sources, pagination));
  } catch (error) {
    logger.error('Failed to fetch data sources:', error);
    res.status(500).json({ error: 'Failed to fetch data sources' });
  }
});

router.post('/', ...writeAuth, validateBody(createDataSourceSchema), validateResponse(dataSourceResponseSchema), async (req, res) => {
  try {
    const {
      name,
      type,
      url,
      category_id,
      category,
      method,
      refresh_interval,
      config,
      credentials,
      is_active: isActive = true,
      allow_duplicate_url: allowDuplicateUrl = false,
    } = req.validatedBody;

    const duplicateGuard = await evaluateDuplicateUrlGuard({
      type,
      url,
      isActive: isActive !== false,
      allowDuplicateUrl,
    });
    if (duplicateGuard.blocked) {
      return res.status(409).json({
        error: duplicateGuard.message,
        code: duplicateGuard.code,
        duplicates: duplicateGuard.duplicates,
        normalizedUrl: duplicateGuard.normalizedUrl,
      });
    }

    // Encrypt credentials if provided
    let encryptedCredentials = '{}';
    if (credentials && typeof credentials === 'object') {
      try {
        const encryptedValue = encryptSecret(JSON.stringify(credentials));
        encryptedCredentials = JSON.stringify({ encrypted: encryptedValue });
      } catch (encryptError) {
        logger.error('Credential encryption failed:', encryptError);
        return res.status(500).json({ error: 'Security error: Failed to encrypt credentials' });
      }
    }

    const normalizedCategory = await resolveCategoryForWrite(category, query, { log: logger });

    const result = await query(
      'INSERT INTO data_sources (name, type, url, category, refresh_interval, next_fetch_at, config, credentials, is_active) VALUES ($1, $2, $3, $4, $5, NOW(), $6, $7, $8) RETURNING *',
      [name, type, url, normalizedCategory, refresh_interval, JSON.stringify(config || {}), encryptedCredentials, isActive !== false]
    );

    const source = result.rows[0];
    delete source.credentials;

    if (allowDuplicateUrl && duplicateGuard.warnings?.some(w => w.code === 'DUPLICATE_ACTIVE_URL_OVERRIDE')) {
      await tryInsertDataHubAccessLog({
        sourceId: source.id,
        action: 'source_create_duplicate_override',
        legacyLevel: 'warn',
        message: 'Source created with duplicate active URL override',
        metadata: {
          normalized_url: duplicateGuard.normalizedUrl,
          duplicates: duplicateGuard.duplicates,
          created_by: req.user?.id,
        },
      });
    }

    const duplicateEnrichmentById = await buildDuplicateEnrichmentBySourceId();
    const enriched = enrichSourceWithDuplicateFields(source, duplicateEnrichmentById);
    if (duplicateGuard.warnings?.length) {
      enriched.duplicate_url_warnings = duplicateGuard.warnings;
    }

    res.status(201).json(enriched);
  } catch (error) {
    if (error.code === '23505') {
      return res.status(409).json({ error: 'Data source with this name and type already exists' });
    }
    logger.error('Failed to create data source:', error);
    res.status(500).json({ error: 'Failed to create data source' });
  }
});

router.put('/:id', ...writeAuth, validateParams(uuidParamSchema), validateBody(updateDataSourceSchema), validateResponse(dataSourceResponseSchema), async (req, res) => {
  try {
    const { id } = req.validatedParams;
    const {
      name,
      type,
      url,
      category,
      refresh_interval,
      config,
      credentials,
      is_active,
      allow_duplicate_url: allowDuplicateUrl = false,
    } = req.validatedBody;

    // Fetch existing source
    const existingResult = await query('SELECT * FROM data_sources WHERE id = $1', [id]);
    if (existingResult.rows.length === 0) {
      return res.status(404).json({ error: 'Data source not found' });
    }
    const existingSource = existingResult.rows[0];

    // Handle credentials encryption
    let finalCredentials = existingSource.credentials;
    if (credentials && typeof credentials === 'object' && Object.keys(credentials).length > 0) {
      try {
        const encryptedValue = encryptSecret(JSON.stringify(credentials));
        finalCredentials = JSON.stringify({ encrypted: encryptedValue });
      } catch (encryptError) {
        logger.error('Credential encryption failed during update:', encryptError);
        return res.status(500).json({ error: 'Security error: Failed to encrypt credentials' });
      }
    }

    const categoryToStore =
      category !== undefined
        ? await resolveCategoryForWrite(category, query, { log: logger })
        : existingSource.category;

    const effectiveType = type || existingSource.type;
    const effectiveUrl = url !== undefined ? url : existingSource.url;
    const effectiveIsActive =
      is_active !== undefined ? is_active : existingSource.is_active === true;

    const duplicateGuard = await evaluateDuplicateUrlGuard({
      type: effectiveType,
      url: effectiveUrl,
      isActive: effectiveIsActive,
      excludeSourceId: id,
      allowDuplicateUrl,
    });
    if (duplicateGuard.blocked) {
      return res.status(409).json({
        error: duplicateGuard.message,
        code: duplicateGuard.code,
        duplicates: duplicateGuard.duplicates,
        normalizedUrl: duplicateGuard.normalizedUrl,
      });
    }

    const result = await query(
      `UPDATE data_sources 
       SET name = $1, type = $2, url = $3, category = $4, refresh_interval = $5, config = $6, credentials = $7, is_active = $8, updated_at = NOW(), updated_by = $9
       WHERE id = $10 RETURNING *`,
      [
        name || existingSource.name,
        type || existingSource.type,
        url || existingSource.url,
        categoryToStore,
        refresh_interval !== undefined ? refresh_interval : existingSource.refresh_interval,
        JSON.stringify(config || existingSource.config || {}),
        finalCredentials,
        is_active !== undefined ? is_active : existingSource.is_active,
        req.user.id,
        id
      ]
    );

    await tryInsertDataHubAccessLog({
      sourceId: id,
      action: 'source_update',
      legacyLevel: 'info',
      message: 'Source updated',
      metadata: { updated_by: req.user.id, changes: req.body, timestamp: new Date().toISOString() },
    });

    const source = result.rows[0];
    delete source.credentials;

    if (allowDuplicateUrl && duplicateGuard.warnings?.some(w => w.code === 'DUPLICATE_ACTIVE_URL_OVERRIDE')) {
      await tryInsertDataHubAccessLog({
        sourceId: id,
        action: 'source_create_duplicate_override',
        legacyLevel: 'warn',
        message: 'Source updated with duplicate active URL override',
        metadata: {
          normalized_url: duplicateGuard.normalizedUrl,
          duplicates: duplicateGuard.duplicates,
          updated_by: req.user?.id,
        },
      });
    }

    const duplicateEnrichmentById = await buildDuplicateEnrichmentBySourceId();
    const enriched = enrichSourceWithDuplicateFields(source, duplicateEnrichmentById);
    if (duplicateGuard.warnings?.length) {
      enriched.duplicate_url_warnings = duplicateGuard.warnings;
    }

    res.json(enriched);
  } catch (error) {
    if (error.code === '23505') {
      return res.status(409).json({ error: 'Data source with this name and type already exists' });
    }
    logger.error('Failed to update data source:', error);
    res.status(500).json({ error: 'Failed to update data source' });
  }
});

router.delete('/:id', ...writeAuth, validateParams(uuidParamSchema), async (req, res) => {
  try {
    const { id } = req.validatedParams;
    const { hard } = req.query; // Optional query param for hard delete

    // Check if source exists
    const existingResult = await query('SELECT * FROM data_sources WHERE id = $1', [id]);
    if (existingResult.rows.length === 0) {
      return res.status(404).json({ error: 'Data source not found' });
    }

    if (hard === 'true') {
      // Hard delete: Remove from database (cascades handled by DB constraints)
      await query('DELETE FROM data_sources WHERE id = $1', [id]);

      await tryInsertDataHubAccessLog({
        sourceId: id,
        action: 'source_delete',
        legacyLevel: 'warn',
        message: 'Source permanently deleted',
        metadata: { deleted_by: req.user.id, type: 'hard_delete', timestamp: new Date().toISOString() },
      });
    } else {
      // Soft delete: Set is_active to false
      await query(
        'UPDATE data_sources SET is_active = false, updated_at = NOW(), updated_by = $1 WHERE id = $2',
        [req.user.id, id]
      );

      await tryInsertDataHubAccessLog({
        sourceId: id,
        action: 'source_delete',
        legacyLevel: 'info',
        message: 'Source disabled (soft delete)',
        metadata: { deleted_by: req.user.id, type: 'soft_delete', timestamp: new Date().toISOString() },
      });
    }

    res.status(204).send();
  } catch (error) {
    logger.error('Failed to delete data source:', error);

    // Handle foreign key constraint violations
    if (error.code === '23503') {
      return res.status(409).json({
        error: 'Cannot delete data source: related data exists',
        detail: 'Use soft delete or remove related data first'
      });
    }

    res.status(500).json({ error: 'Failed to delete data source' });
  }
});

// Restore soft-deleted data source (TASK-BE-017)
router.patch('/:id/restore', ...writeAuth, validateResponse(dataSourceResponseSchema), async (req, res) => {
  try {
    const { id } = req.params;

    // Check if source exists and is inactive
    const existingResult = await query('SELECT * FROM data_sources WHERE id = $1', [id]);
    if (existingResult.rows.length === 0) {
      return res.status(404).json({ error: 'Data source not found' });
    }

    const source = existingResult.rows[0];
    if (source.is_active) {
      return res.status(400).json({ error: 'Data source is already active' });
    }

    // Restore the source
    const result = await query(
      'UPDATE data_sources SET is_active = true, updated_at = NOW(), updated_by = $1 WHERE id = $2 RETURNING *',
      [req.user.id, id]
    );

    await tryInsertDataHubAccessLog({
      sourceId: id,
      action: 'source_restore',
      legacyLevel: 'info',
      message: 'Source restored',
      metadata: { restored_by: req.user.id, timestamp: new Date().toISOString() },
    });

    const restoredSource = result.rows[0];
    delete restoredSource.credentials;

    res.json(restoredSource);
  } catch (error) {
    logger.error('Failed to restore data source:', error);
    res.status(500).json({ error: 'Failed to restore data source' });
  }
});

// Get DataHub state (aggregate stats from all sources)
router.get('/state', authenticate, readRateLimiter, validateResponse(dataHubStateSchema), async (req, res) => {
  try {
    // Get data sources stats
    const sourcesResult = await query(
      `SELECT 
        COUNT(*) as total_sources,
        COUNT(*) FILTER (WHERE is_active = true) as active_sources,
        COUNT(*) FILTER (WHERE type = 'telegram') as telegram_sources,
        COUNT(*) FILTER (WHERE type = 'rss') as rss_sources,
        COUNT(*) FILTER (WHERE type = 'api') as api_sources
       FROM data_sources`
    );

    // Get recent logs
    const logsResult = await query(
      `SELECT COUNT(*) as total_logs,
        COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '24 hours') as recent_logs
       FROM data_hub_logs`
    );

    // Get data sources details
    const sourcesDetailResult = await query(
      `SELECT id, name, type, is_active, last_fetch_at, config 
       FROM data_sources 
       ORDER BY last_fetch_at DESC NULLS LAST 
       LIMIT 10`
    );

    const stats = sourcesResult.rows[0] || {};
    const logs = logsResult.rows[0] || {};

    res.json({
      status: 'active',
      totalSources: parseInt(stats.total_sources) || 0,
      activeSources: parseInt(stats.active_sources) || 0,
      sourcesByType: {
        telegram: parseInt(stats.telegram_sources) || 0,
        rss: parseInt(stats.rss_sources) || 0,
        api: parseInt(stats.api_sources) || 0,
      },
      recentLogs: parseInt(logs.recent_logs) || 0,
      totalLogs: parseInt(logs.total_logs) || 0,
      recentSources: sourcesDetailResult.rows || [],
    });
  } catch (error) {
    logger.error('Failed to fetch DataHub state:', error);
    res.status(500).json({ error: 'Failed to fetch DataHub state' });
  }
});

// DataHub health check
router.get('/health', authenticate, async (req, res) => {
  try {
    await query('SELECT 1');

    const [sourceCounts, collectorHealth, publisherHealth, queueHealth] = await Promise.all([
      query(
        `SELECT
          COUNT(*)::int AS total_sources,
          COUNT(*) FILTER (WHERE is_active = true)::int AS active_sources,
          COUNT(*) FILTER (WHERE type = 'telegram' AND is_active = true)::int AS active_telegram_sources,
          COUNT(*) FILTER (WHERE type = 'rss' AND is_active = true)::int AS active_rss_sources,
          COUNT(*) FILTER (WHERE type = 'api' AND is_active = true)::int AS active_api_sources
         FROM data_sources`,
      ),
      query(
        `SELECT
          COUNT(*)::int AS total_collectors,
          COUNT(*) FILTER (WHERE is_active = true)::int AS active_collectors
         FROM telegram_channels`,
      ),
      query(
        `SELECT
          COUNT(*)::int AS total_publishers,
          COUNT(*) FILTER (WHERE is_active = true)::int AS active_publishers
         FROM telegram_publishers`,
      ),
      query(
        `SELECT
          COUNT(*) FILTER (WHERE status IN ('pending', 'processing'))::int AS pending_queue,
          COUNT(*) FILTER (WHERE status = 'failed')::int AS failed_queue
         FROM datahub_automation_queue`,
      ),
    ]);

    const sourceRow = sourceCounts.rows[0] || {};
    const collectorRow = collectorHealth.rows[0] || {};
    const publisherRow = publisherHealth.rows[0] || {};
    const queueRow = queueHealth.rows[0] || {};
    const activeCount = parseInt(sourceRow.active_sources, 10) || 0;
    const healthLastCheckedAt = new Date().toISOString();

    const isHealthy = activeCount > 0;

    res.json({
      status: isHealthy ? 'healthy' : 'degraded',
      database: 'connected',
      activeSources: activeCount,
      totalSources: parseInt(sourceRow.total_sources, 10) || 0,
      sourceCounts: {
        active: activeCount,
        telegram: parseInt(sourceRow.active_telegram_sources, 10) || 0,
        rss: parseInt(sourceRow.active_rss_sources, 10) || 0,
        api: parseInt(sourceRow.active_api_sources, 10) || 0,
      },
      collectorHealth: {
        total: parseInt(collectorRow.total_collectors, 10) || 0,
        active: parseInt(collectorRow.active_collectors, 10) || 0,
      },
      publisherHealth: {
        total: parseInt(publisherRow.total_publishers, 10) || 0,
        active: parseInt(publisherRow.active_publishers, 10) || 0,
      },
      queueHealth: {
        pending: parseInt(queueRow.pending_queue, 10) || 0,
        failed: parseInt(queueRow.failed_queue, 10) || 0,
      },
      accessLogEvents1h: 0,
      pipelineIngested1h: 0,
      pipelineNormalized1h: 0,
      telegramCreated1h: 0,
      healthLastCheckedAt,
      dataQuality: {
        duplicateUrlGroups: 0,
        highRiskDuplicateGroups: 0,
        ignoredDuplicateGroups: 0,
        skipped: true,
      },
      /** @deprecated use pipelineIngested1h — kept for backward compatibility */
      recentActivity: 0,
      timestamp: healthLastCheckedAt,
    });
  } catch (error) {
    logger.error('DataHub health check failed:', error);
    res.status(503).json({
      status: 'unhealthy',
      database: 'disconnected',
      error: error.message,
    });
  }
});

// Access logs for DataHub Logs tab (GAP-013)
router.get('/access-logs', authenticate, readRateLimiter, validateQuery(accessLogsQuerySchema), validateResponse(accessLogsListResponseSchema), async (req, res) => {
  try {
    const { limit, offset, source_id, status } = req.validatedQuery;
    const result = await listDataHubAccessLogs({ limit, offset, source_id, status });
    res.json(result);
  } catch (error) {
    logger.error('Failed to fetch DataHub access logs:', error);
    res.status(500).json({ error: 'Failed to fetch access logs' });
  }
});

// Pipeline backlog enrichment (heavy — lazy-loaded by UI, DH-PIPELINE-P2)
router.get('/pipeline/backlog', authenticate, readRateLimiter, validateResponse(dataPipelineBacklogResponseSchema), async (req, res) => {
  try {
    const enrichment = await getOrLoadCached('pipeline:backlog:enrichment', async () => {
      const sourcesRows = await query(
        `SELECT id AS source_id, type FROM data_sources WHERE type = 'telegram'`,
      );
      return buildPipelineBacklogEnrichment(sourcesRows.rows);
    });
    res.json(enrichment);
  } catch (error) {
    logger.error('Failed to fetch DataHub pipeline backlog enrichment:', error);
    res.status(500).json({ error: 'Failed to fetch pipeline backlog enrichment' });
  }
});

// Pipeline view for DataHub Pipeline tab (GAP-012)
router.get('/pipeline', authenticate, readRateLimiter, validateQuery(pipelineQuerySchema), validateResponse(dataPipelineViewResponseSchema), async (req, res) => {
  try {
    const flags = req.validatedQuery || {};
    const includeBacklog = flags.includeBacklog === true;
    const view = await buildDataPipelineView({
      includeBacklog,
      includeCategoryScreening: flags.includeCategoryScreening === true,
      includeNormalizationSummary: flags.includeNormalizationSummary === true,
      includeDuplicateAnalysis: flags.includeDuplicateAnalysis === true,
      includeTelegramBacklog: flags.includeTelegramBacklog === true || includeBacklog,
      includeRecentPreview: flags.includeRecentPreview === true,
    });
    res.json(view);
  } catch (error) {
    logger.error('Failed to fetch DataHub pipeline view:', error);
    res.status(500).json({ error: 'Failed to fetch pipeline snapshot' });
  }
});

// Get DataHub statistics
router.get('/stats', authenticate, readRateLimiter, validateResponse(dataHubStatsSchema), async (req, res) => {
  try {
    const stats = await query(`
      SELECT 
        (SELECT COUNT(*) FROM data_sources) as total_sources,
        (SELECT COUNT(*) FROM data_sources WHERE is_active = true) as active_sources,
        (SELECT GREATEST(reltuples::bigint, 0)::bigint FROM pg_class WHERE oid = 'data_hub_logs'::regclass) as total_logs,
        0::bigint as logs_24h,
        0::bigint as logs_7d
    `);

    res.json(stats.rows[0] || {});
  } catch (error) {
    logger.error('Failed to fetch DataHub stats:', error);
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
});

// Get collected data with pagination and filters
router.get('/collected', authenticate, readRateLimiter, validateQuery(collectedDataQuerySchema), validateResponse(collectedDataListResponseSchema), async (req, res) => {
  try {
    const {
      status,
      start_date,
      end_date,
      source_id,
      limit,
      offset,
      agentKey: queryAgentKey,
      agent_key: queryAgentKeySnake,
    } = req.validatedQuery;

    const agentKey =
      queryAgentKey ||
      queryAgentKeySnake ||
      resolveAgentKeyFromRequest(req);

    // Build WHERE clause dynamically
    const conditions = [];
    const params = [];
    let paramCount = 1;

    if (status) {
      conditions.push(`cd.status = $${paramCount++}`);
      params.push(status);
    }

    if (source_id) {
      conditions.push(`cd.source_id = $${paramCount++}`);
      params.push(source_id);
    }

    if (start_date) {
      conditions.push(`cd.collected_at >= $${paramCount++}`);
      params.push(start_date);
    }

    if (end_date) {
      conditions.push(`cd.collected_at <= $${paramCount++}`);
      params.push(end_date);
    }

    if (agentKey) {
      params.push(agentKey);
      conditions.push(sourceAccessAllowedSql('cd.source_id', paramCount++));
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Get total count for pagination metadata
    const countQuery = `SELECT COUNT(*) as total FROM collected_data cd ${whereClause}`;
    const countResult = await query(countQuery, params);
    const total = parseInt(countResult.rows[0].total);

    // Get paginated data
    params.push(parseInt(limit));
    params.push(parseInt(offset));

    const dataQuery = `
      SELECT 
        cd.id,
        cd.source_id,
        cd.raw_data,
        cd.normalized_data,
        cd.collected_at,
        cd.processed_at,
        cd.status,
        cd.error_message,
        cd.metadata,
        cd.created_at,
        ds.name as source_name,
        ds.type as source_type
      FROM collected_data cd
      LEFT JOIN data_sources ds ON cd.source_id = ds.id
      ${whereClause}
      ORDER BY cd.collected_at DESC
      LIMIT $${paramCount++} OFFSET $${paramCount++}
    `;

    const dataResult = await query(dataQuery, params);

    res.json({
      data: dataResult.rows,
      pagination: {
        total,
        limit: parseInt(limit),
        offset: parseInt(offset),
        hasMore: (parseInt(offset) + parseInt(limit)) < total
      }
    });
  } catch (error) {
    logger.error('Failed to fetch collected data:', error);
    res.status(500).json({ error: 'Failed to fetch collected data' });
  }
});

// Get single collected data record by ID (TASK-BE-020)
router.get('/collected/:id', authenticate, readRateLimiter, validateParams(uuidParamSchema), validateResponse(collectedDataResponseSchema), async (req, res) => {
  try {
    const { id } = req.validatedParams;
    const agentKey = resolveAgentKeyFromRequest(req);

    const result = await query(`
      SELECT 
        cd.*,
        ds.name as source_name,
        ds.type as source_type
      FROM collected_data cd
      LEFT JOIN data_sources ds ON cd.source_id = ds.id
      WHERE cd.id = $1
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Collected data record not found' });
    }

    if (agentKey) {
      const row = result.rows[0];
      const dataType = row.metadata?.data_type || row.normalized_data?.data_type || null;
      const access = await enforceSourceAccess(req, {
        sourceId: row.source_id,
        agentKey,
        action: 'collected_data_read',
        dataType,
      });
      if (!access.allowed) {
        return res.status(403).json({
          error: 'Source access denied',
          code: 'SOURCE_ACCESS_DENIED',
          agent_key: agentKey,
        });
      }
    }

    res.json(result.rows[0]);
  } catch (error) {
    logger.error('Failed to fetch single collected data record:', error);
    res.status(500).json({ error: 'Failed to fetch record' });
  }
});

export default router;
