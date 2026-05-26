import express from 'express';
import { authenticate, authorize } from '../middleware/auth.js';
import { readRateLimiter, writeRateLimiter } from '../middleware/rateLimiter.js';
import { validateBody, validateParams, validateQuery } from '../middleware/validation.js';
import { logger } from '../services/logger.js';
import {
    updatePrioritizationSettingsSchema,
    applyPrioritizationSchema,
    overrideSourceSchema,
    uuidSourceParamSchema,
    listRunsQuerySchema,
} from '../schemas/datahubPrioritizationSchemas.js';
import {
    getPrioritizationSettings,
    updatePrioritizationSettings,
    previewPrioritization,
    applyPrioritization,
    listPrioritizationRuns,
    listPrioritizationSources,
    setSourceOverride,
} from '../services/datahubPrioritizationService.js';

const router = express.Router();
const writeAuth = [authenticate, authorize('admin', 'trader'), writeRateLimiter];

router.get('/settings', authenticate, readRateLimiter, async (req, res) => {
    try {
        res.json(await getPrioritizationSettings());
    } catch (error) {
        logger.error('Get prioritization settings failed:', error);
        res.status(500).json({ error: 'Failed to load prioritization settings' });
    }
});

router.put('/settings', ...writeAuth, validateBody(updatePrioritizationSettingsSchema), async (req, res) => {
    try {
        res.json(await updatePrioritizationSettings(req.validatedBody, req.user?.id));
    } catch (error) {
        const status = error.status || 500;
        res.status(status).json({ error: error.message || 'Failed to update settings', code: error.code, details: error.details });
    }
});

router.get('/sources', authenticate, readRateLimiter, async (req, res) => {
    try {
        res.json({ sources: await listPrioritizationSources() });
    } catch (error) {
        logger.error('List prioritization sources failed:', error);
        res.status(500).json({ error: 'Failed to list sources' });
    }
});

router.get('/runs', authenticate, readRateLimiter, validateQuery(listRunsQuerySchema), async (req, res) => {
    try {
        res.json({ runs: await listPrioritizationRuns(req.validatedQuery) });
    } catch (error) {
        logger.error('List prioritization runs failed:', error);
        res.status(500).json({ error: 'Failed to list runs' });
    }
});

router.post('/preview', ...writeAuth, async (req, res) => {
    try {
        res.json(await previewPrioritization(req.user?.id));
    } catch (error) {
        const status = error.status || 500;
        res.status(status).json({ error: error.message || 'Preview failed', code: error.code, details: error.details });
    }
});

router.post('/apply', ...writeAuth, validateBody(applyPrioritizationSchema), async (req, res) => {
    try {
        res.json(
            await applyPrioritization({
                userId: req.user?.id,
                confirmApply: req.validatedBody.confirm_apply,
                sourceIds: req.validatedBody.source_ids,
            }),
        );
    } catch (error) {
        const status = error.status || 500;
        res.status(status).json({ error: error.message || 'Apply failed', code: error.code, details: error.details });
    }
});

router.put(
    '/sources/:sourceId/override',
    ...writeAuth,
    validateParams(uuidSourceParamSchema),
    validateBody(overrideSourceSchema),
    async (req, res) => {
        try {
            res.json(await setSourceOverride(req.params.sourceId, req.validatedBody, req.user?.id));
        } catch (error) {
            const status = error.status || 500;
            res.status(status).json({ error: error.message || 'Override failed', code: error.code, details: error.details });
        }
    },
);

export default router;

