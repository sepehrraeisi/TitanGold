import express from 'express';
import { authenticate, authorize } from '../middleware/auth.js';
import { query } from '../database/db.js';
import { logger } from '../services/logger.js';
import { readRateLimiter, writeRateLimiter } from '../middleware/rateLimiter.js';
import {
  validateBody,
  validateParams,
  validateQuery,
  validateResponse,
} from '../middleware/validation.js';
import {
  uuidParamSchema,
  createTelegramPublisherSchema,
  updateTelegramPublisherSchema,
  publisherListResponseSchema,
  publisherResponseSchema,
  publisherHistoryListSchema,
  publisherHistoryQuerySchema,
  testPublisherSchema,
  publishPublisherSchema,
  publishResultSchema,
  publisherMappingsListSchema,
  publisherMappingSchema,
  createPublisherMappingSchema,
  updatePublisherMappingSchema,
  runtimeModeViewSchema,
  setRuntimeModeSchema,
  runtimeModeAuditListSchema,
} from '../schemas/telegramPublisherSchemas.js';
import {
  mapPublisherRow,
  listPublisherMetrics,
  encryptBotTokenOptional,
  runPublisherTest,
  runPublisherPublish,
  listPublisherMappings,
  createPublisherMapping,
  updatePublisherMapping,
  disablePublisherMapping,
  isPublisherDryRunForced,
} from '../services/telegramPublisherService.js';
import {
  buildRuntimeModeView,
  setRuntimeMode,
  listRuntimeModeAudit,
} from '../services/telegramPublisherRuntimeModeService.js';

const router = express.Router();
const writeAuth = [authenticate, authorize('admin', 'trader'), writeRateLimiter];
const adminAuth = [authenticate, authorize('admin'), writeRateLimiter];

router.get(
  '/',
  authenticate,
  readRateLimiter,
  validateResponse(publisherListResponseSchema),
  async (req, res) => {
    try {
      const result = await query(
        `SELECT * FROM telegram_publishers
         WHERE is_active = true
         ORDER BY name ASC`,
      );
      const inactive = await query(
        `SELECT * FROM telegram_publishers
         WHERE is_active = false
         ORDER BY updated_at DESC
         LIMIT 50`,
      );
      const publishers = [...result.rows, ...inactive.rows].map(mapPublisherRow);
      const metrics = await listPublisherMetrics();
      const runtimeMode = await buildRuntimeModeView(req.user);
      res.json({
        publishers,
        metrics,
        system: {
          dry_run_forced: isPublisherDryRunForced(),
          server_safety_override: runtimeMode.serverSafetyOverride,
          configured_mode: runtimeMode.configuredMode,
          effective_mode: runtimeMode.effectiveMode,
        },
        runtimeMode,
      });
    } catch (error) {
      logger.error('Failed to list telegram publishers:', error);
      res.status(500).json({ error: 'Failed to list telegram publishers' });
    }
  },
);

router.post(
  '/',
  ...writeAuth,
  validateBody(createTelegramPublisherSchema),
  validateResponse(publisherResponseSchema),
  async (req, res) => {
    try {
      const body = req.validatedBody;
      const tokenEnc = encryptBotTokenOptional(body.bot_token);
      const insert = await query(
        `INSERT INTO telegram_publishers (
          name, channel_id, channel_username, channel_title, bot_token_encrypted,
          is_active, language, template, schedule_config, created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING *`,
        [
          body.name,
          body.channel_id,
          body.channel_username ?? null,
          body.channel_title ?? null,
          tokenEnc,
          body.is_active ?? true,
          body.language ?? 'en',
          body.template ?? '',
          JSON.stringify(body.schedule_config ?? {}),
          req.user?.id ?? null,
        ],
      );
      res.status(201).json(mapPublisherRow(insert.rows[0]));
    } catch (error) {
      logger.error('Failed to create telegram publisher:', error);
      res.status(500).json({ error: 'Failed to create telegram publisher' });
    }
  },
);

router.get(
  '/runtime-mode',
  authenticate,
  readRateLimiter,
  validateResponse(runtimeModeViewSchema),
  async (req, res) => {
    try {
      const view = await buildRuntimeModeView(req.user);
      res.json(view);
    } catch (error) {
      logger.error('Failed to fetch publisher runtime mode:', error);
      res.status(500).json({ error: 'Failed to fetch publisher runtime mode' });
    }
  },
);

router.put(
  '/runtime-mode',
  ...adminAuth,
  validateBody(setRuntimeModeSchema),
  validateResponse(runtimeModeViewSchema),
  async (req, res) => {
    try {
      const body = req.validatedBody;
      const view = await setRuntimeMode({
        mode: body.mode,
        reason: body.reason,
        user: req.user,
        acknowledgeLiveDeliveryRisk: body.acknowledge_live_delivery_risk,
        confirmRuntimeModeChange: body.confirm_runtime_mode_change,
      });
      res.json(view);
    } catch (error) {
      const status = error.status || 500;
      if (status >= 500) logger.error('Failed to set publisher runtime mode:', error);
      res.status(status).json({
        error: error.message || 'Failed to set publisher runtime mode',
        code: error.code || undefined,
      });
    }
  },
);

router.get(
  '/runtime-mode/audit',
  authenticate,
  authorize('admin'),
  readRateLimiter,
  validateResponse(runtimeModeAuditListSchema),
  async (req, res) => {
    try {
      const audit = await listRuntimeModeAudit({ limit: 20 });
      res.json({ audit });
    } catch (error) {
      logger.error('Failed to fetch publisher runtime mode audit:', error);
      res.status(500).json({ error: 'Failed to fetch publisher runtime mode audit' });
    }
  },
);

router.put(
  '/:id',
  ...writeAuth,
  validateParams(uuidParamSchema),
  validateBody(updateTelegramPublisherSchema),
  validateResponse(publisherResponseSchema),
  async (req, res) => {
    try {
      const { id } = req.validatedParams;
      const body = req.validatedBody;
      const existing = await query('SELECT * FROM telegram_publishers WHERE id = $1', [id]);
      if (existing.rows.length === 0) {
        return res.status(404).json({ error: 'Publisher not found' });
      }
      const row = existing.rows[0];
      const tokenEnc =
        body.bot_token !== undefined
          ? encryptBotTokenOptional(body.bot_token)
          : row.bot_token_encrypted;

      const updated = await query(
        `UPDATE telegram_publishers SET
          name = COALESCE($2, name),
          channel_id = COALESCE($3, channel_id),
          channel_username = COALESCE($4, channel_username),
          channel_title = COALESCE($5, channel_title),
          bot_token_encrypted = $6,
          is_active = COALESCE($7, is_active),
          language = COALESCE($8, language),
          template = COALESCE($9, template),
          schedule_config = COALESCE($10, schedule_config),
          updated_at = NOW()
        WHERE id = $1
        RETURNING *`,
        [
          id,
          body.name ?? null,
          body.channel_id ?? null,
          body.channel_username !== undefined ? body.channel_username : row.channel_username,
          body.channel_title !== undefined ? body.channel_title : row.channel_title,
          tokenEnc,
          body.is_active ?? null,
          body.language ?? null,
          body.template ?? null,
          body.schedule_config ? JSON.stringify(body.schedule_config) : null,
        ],
      );
      res.json(mapPublisherRow(updated.rows[0]));
    } catch (error) {
      logger.error('Failed to update telegram publisher:', error);
      res.status(500).json({ error: 'Failed to update telegram publisher' });
    }
  },
);

router.delete(
  '/:id',
  ...writeAuth,
  validateParams(uuidParamSchema),
  async (req, res) => {
    try {
      const { id } = req.validatedParams;
      const result = await query(
        `UPDATE telegram_publishers SET is_active = false, updated_at = NOW()
         WHERE id = $1 AND is_active = true
         RETURNING id`,
        [id],
      );
      if (result.rowCount === 0) {
        const exists = await query('SELECT id FROM telegram_publishers WHERE id = $1', [id]);
        if (exists.rows.length === 0) {
          return res.status(404).json({ error: 'Publisher not found' });
        }
        return res.json({ message: 'Publisher already disabled', id });
      }
      res.json({ message: 'Publisher disabled', id });
    } catch (error) {
      logger.error('Failed to disable telegram publisher:', error);
      res.status(500).json({ error: 'Failed to disable telegram publisher' });
    }
  },
);

router.get(
  '/mappings',
  authenticate,
  readRateLimiter,
  validateResponse(publisherMappingsListSchema),
  async (req, res) => {
    try {
      const mappings = await listPublisherMappings({ includeDisabled: true });
      res.json({ mappings });
    } catch (error) {
      logger.error('Failed to list publisher mappings:', error);
      res.status(500).json({ error: 'Failed to list publisher mappings' });
    }
  },
);

router.post(
  '/mappings',
  ...writeAuth,
  validateBody(createPublisherMappingSchema),
  validateResponse(publisherMappingSchema),
  async (req, res) => {
    try {
      const body = req.validatedBody;
      const mapping = await createPublisherMapping({
        sourceId: body.source_id,
        publisherId: body.publisher_id,
        isEnabled: body.is_enabled,
        templateId: body.template_id ?? null,
        userId: req.user?.id ?? null,
      });
      res.status(201).json(mapping);
    } catch (error) {
      logger.error('Failed to create publisher mapping:', error);
      res.status(error.status || 500).json({
        error: error.message || 'Failed to create publisher mapping',
        code: error.code || undefined,
      });
    }
  },
);

router.put(
  '/mappings/:id',
  ...writeAuth,
  validateParams(uuidParamSchema),
  validateBody(updatePublisherMappingSchema),
  validateResponse(publisherMappingSchema),
  async (req, res) => {
    try {
      const { id } = req.validatedParams;
      const body = req.validatedBody;
      const mapping = await updatePublisherMapping(id, {
        sourceId: body.source_id,
        publisherId: body.publisher_id,
        isEnabled: body.is_enabled,
        templateId: body.template_id,
      });
      res.json(mapping);
    } catch (error) {
      logger.error('Failed to update publisher mapping:', error);
      res.status(error.status || 500).json({
        error: error.message || 'Failed to update publisher mapping',
        code: error.code || undefined,
      });
    }
  },
);

router.delete(
  '/mappings/:id',
  ...writeAuth,
  validateParams(uuidParamSchema),
  validateResponse(publisherMappingSchema),
  async (req, res) => {
    try {
      const { id } = req.validatedParams;
      const mapping = await disablePublisherMapping(id);
      res.json(mapping);
    } catch (error) {
      logger.error('Failed to disable publisher mapping:', error);
      res.status(error.status || 500).json({
        error: error.message || 'Failed to disable publisher mapping',
        code: error.code || undefined,
      });
    }
  },
);

router.post(
  '/:id/test',
  ...writeAuth,
  validateParams(uuidParamSchema),
  validateBody(testPublisherSchema),
  validateResponse(publishResultSchema),
  async (req, res) => {
    try {
      const { id } = req.validatedParams;
      const { message } = req.validatedBody;
      const result = await runPublisherTest(id, message, req.user?.id);
      res.json(result);
    } catch (error) {
      const status = error.status || 500;
      if (status >= 500) logger.error('Publisher test failed:', error);
      res.status(status).json({ error: error.message || 'Publisher test failed' });
    }
  },
);

router.post(
  '/:id/publish',
  ...writeAuth,
  validateParams(uuidParamSchema),
  validateBody(publishPublisherSchema),
  validateResponse(publishResultSchema),
  async (req, res) => {
    try {
      const { id } = req.validatedParams;
      const {
        source_id,
        data_type,
        message,
        content_type,
        confirm_publish,
        title,
        content,
        allow_temporary_publish,
      } = req.validatedBody;
      const result = await runPublisherPublish(
        id,
        {
          source_id,
          data_type,
          message,
          content_type,
          confirm_publish,
          title,
          content,
          allow_temporary_publish,
          accessControl: req.accessControl,
        },
        req.user?.id,
      );
      res.json(result);
    } catch (error) {
      const status = error.status || 500;
      if (status >= 500) logger.error('Publisher publish failed:', error);
      res.status(status).json({
        error: error.message || 'Publisher publish failed',
        code: error.code || undefined,
        reason: error.reason || undefined,
        rule: error.rule || undefined,
        history_id: error.history_id || undefined,
      });
    }
  },
);

router.get(
  '/:id/history',
  authenticate,
  readRateLimiter,
  validateParams(uuidParamSchema),
  validateQuery(publisherHistoryQuerySchema),
  validateResponse(publisherHistoryListSchema),
  async (req, res) => {
    try {
      const { id } = req.validatedParams;
      const { limit, offset } = req.validatedQuery;

      const exists = await query('SELECT id FROM telegram_publishers WHERE id = $1', [id]);
      if (exists.rows.length === 0) {
        return res.status(404).json({ error: 'Publisher not found' });
      }

      const count = await query(
        'SELECT COUNT(*)::int AS total FROM publisher_delivery_history WHERE publisher_id = $1',
        [id],
      );
      const total = count.rows[0]?.total ?? 0;

      const rows = await query(
        `SELECT
           h.*,
           tp.name AS publisher_name,
           ds.name AS source_name,
           u.email AS created_by_email
         FROM publisher_delivery_history h
         JOIN telegram_publishers tp ON tp.id = h.publisher_id
         LEFT JOIN data_sources ds ON ds.id = h.source_id
         LEFT JOIN users u ON u.id = h.created_by
         WHERE h.publisher_id = $1
         ORDER BY h.created_at DESC
         LIMIT $2 OFFSET $3`,
        [id, limit, offset],
      );

      res.json({
        data: rows.rows.map(r => ({
          id: r.id,
          publisher_id: r.publisher_id,
          publisher_name: r.publisher_name,
          source_id: r.source_id,
          source_name: r.source_name,
          data_type: r.data_type,
          content_type: r.content_type,
          content_summary: r.content_summary,
          status: r.status,
          telegram_message_id: r.telegram_message_id,
          error_message: r.error_message,
          error_code: r.error_code,
          delivery_mode: r.metadata?.delivery_mode || r.metadata?.mode || null,
          created_by: r.created_by,
          created_by_email: r.created_by_email,
          metadata: r.metadata || {},
          created_at: new Date(r.created_at).toISOString(),
        })),
        pagination: {
          total,
          limit,
          offset,
          hasMore: offset + limit < total,
        },
      });
    } catch (error) {
      logger.error('Failed to fetch publisher history:', error);
      res.status(500).json({ error: 'Failed to fetch publisher history' });
    }
  },
);

export default router;
