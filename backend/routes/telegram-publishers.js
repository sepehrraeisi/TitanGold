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
} from '../schemas/telegramPublisherSchemas.js';
import {
  mapPublisherRow,
  listPublisherMetrics,
  encryptBotTokenOptional,
  runPublisherTest,
  runPublisherPublish,
} from '../services/telegramPublisherService.js';

const router = express.Router();
const writeAuth = [authenticate, authorize('admin', 'trader'), writeRateLimiter];

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
      res.json({ publishers, metrics });
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
      const result = await runPublisherPublish(id, req.validatedBody, req.user?.id);
      res.json(result);
    } catch (error) {
      const status = error.status || 500;
      if (status >= 500) logger.error('Publisher publish failed:', error);
      res.status(status).json({ error: error.message || 'Publisher publish failed' });
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
        `SELECT * FROM publisher_delivery_history
         WHERE publisher_id = $1
         ORDER BY created_at DESC
         LIMIT $2 OFFSET $3`,
        [id, limit, offset],
      );

      res.json({
        data: rows.rows.map(r => ({
          id: r.id,
          publisher_id: r.publisher_id,
          content_type: r.content_type,
          content_summary: r.content_summary,
          status: r.status,
          telegram_message_id: r.telegram_message_id,
          error_message: r.error_message,
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
