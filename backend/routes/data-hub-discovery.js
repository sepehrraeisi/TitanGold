import express from 'express';
import { authenticate, authorize } from '../middleware/auth.js';
import { readRateLimiter, writeRateLimiter } from '../middleware/rateLimiter.js';
import { validateBody, validateParams, validateQuery } from '../middleware/validation.js';
import { logger } from '../services/logger.js';
import {
    updateDiscoverySettingsSchema,
    createDiscoveryRuleSchema,
    updateDiscoveryRuleSchema,
    listSuggestionsQuerySchema,
    approveSuggestionSchema,
    rejectSuggestionSchema,
    uuidParamSchema,
} from '../schemas/datahubDiscoverySchemas.js';
import {
    getDiscoverySettings,
    updateDiscoverySettings,
    listDiscoveryRules,
    createDiscoveryRule,
    updateDiscoveryRule,
    softDeleteDiscoveryRule,
    listSuggestions,
    getDiscoveryStats,
    listScanHistory,
    runDiscoveryScan,
    approveSuggestion,
    rejectSuggestion,
} from '../services/datahubDiscoveryService.js';

const router = express.Router();
const writeAuth = [authenticate, authorize('admin', 'trader'), writeRateLimiter];

router.get('/settings', authenticate, readRateLimiter, async (req, res) => {
    try {
        res.json(await getDiscoverySettings());
    } catch (error) {
        logger.error('Get discovery settings failed:', error);
        res.status(500).json({ error: 'Failed to load discovery settings' });
    }
});

router.patch(
    '/settings',
    ...writeAuth,
    validateBody(updateDiscoverySettingsSchema),
    async (req, res) => {
        try {
            res.json(await updateDiscoverySettings(req.validatedBody));
        } catch (error) {
            res.status(500).json({ error: 'Failed to update discovery settings' });
        }
    },
);

router.get('/stats', authenticate, readRateLimiter, async (req, res) => {
    try {
        res.json(await getDiscoveryStats());
    } catch (error) {
        res.status(500).json({ error: 'Failed to load discovery stats' });
    }
});

router.get('/history', authenticate, readRateLimiter, async (req, res) => {
    try {
        const limit = Math.min(parseInt(req.query.limit, 10) || 20, 100);
        res.json({ scans: await listScanHistory(limit) });
    } catch (error) {
        res.status(500).json({ error: 'Failed to load scan history' });
    }
});

router.get('/rules', authenticate, readRateLimiter, async (req, res) => {
    try {
        res.json({ rules: await listDiscoveryRules() });
    } catch (error) {
        res.status(500).json({ error: 'Failed to list discovery rules' });
    }
});

router.post(
    '/rules',
    ...writeAuth,
    validateBody(createDiscoveryRuleSchema),
    async (req, res) => {
        try {
            const rule = await createDiscoveryRule(req.validatedBody);
            res.status(201).json({ rule });
        } catch (error) {
            const status = error.status || 500;
            res.status(status).json({ error: error.message || 'Failed to create rule' });
        }
    },
);

router.put(
    '/rules/:id',
    ...writeAuth,
    validateParams(uuidParamSchema),
    validateBody(updateDiscoveryRuleSchema),
    async (req, res) => {
        try {
            const rule = await updateDiscoveryRule(req.params.id, req.validatedBody);
            res.json({ rule });
        } catch (error) {
            const status = error.status || 500;
            res.status(status).json({ error: error.message || 'Failed to update rule' });
        }
    },
);

router.delete(
    '/rules/:id',
    ...writeAuth,
    validateParams(uuidParamSchema),
    async (req, res) => {
        try {
            const rule = await softDeleteDiscoveryRule(req.params.id);
            res.json({ rule });
        } catch (error) {
            const status = error.status || 500;
            res.status(status).json({ error: error.message || 'Failed to delete rule' });
        }
    },
);

router.get(
    '/suggestions',
    authenticate,
    readRateLimiter,
    validateQuery(listSuggestionsQuerySchema),
    async (req, res) => {
        try {
            const suggestions = await listSuggestions(req.validatedQuery || {});
            res.json({ suggestions });
        } catch (error) {
            res.status(500).json({ error: 'Failed to list suggestions' });
        }
    },
);

router.post('/scan', ...writeAuth, async (req, res) => {
    try {
        const result = await runDiscoveryScan(req.user?.id);
        res.json(result);
    } catch (error) {
        logger.error('Discovery scan failed:', error);
        const status = error.status || 500;
        res.status(status).json({
            error: error.message || 'Discovery scan failed',
            code: error.code,
        });
    }
});

router.post(
    '/suggestions/:id/approve',
    ...writeAuth,
    validateParams(uuidParamSchema),
    validateBody(approveSuggestionSchema),
    async (req, res) => {
        try {
            const result = await approveSuggestion(
                req.params.id,
                req.validatedBody,
                req.user?.id,
            );
            res.json(result);
        } catch (error) {
            logger.error('Approve suggestion failed:', error);
            const status = error.status || 500;
            res.status(status).json({
                error: error.message || 'Failed to approve',
                code: error.code,
            });
        }
    },
);

router.post(
    '/suggestions/:id/reject',
    ...writeAuth,
    validateParams(uuidParamSchema),
    validateBody(rejectSuggestionSchema),
    async (req, res) => {
        try {
            const suggestion = await rejectSuggestion(
                req.params.id,
                req.validatedBody,
                req.user?.id,
            );
            res.json({ suggestion });
        } catch (error) {
            const status = error.status || 500;
            res.status(status).json({ error: error.message || 'Failed to reject' });
        }
    },
);

export default router;
