import express from 'express';
import { authenticate, authorize } from '../middleware/auth.js';
import { readRateLimiter, writeRateLimiter } from '../middleware/rateLimiter.js';
import { validateBody, validateParams, validateQuery } from '../middleware/validation.js';
import { logger } from '../services/logger.js';
import {
    createCrawlerSchema,
    updateCrawlerSchema,
    runCrawlerSchema,
    listRunsQuerySchema,
    uuidParamSchema,
} from '../schemas/datahubCrawlersSchemas.js';
import {
    listCrawlers,
    getCrawler,
    createCrawler,
    updateCrawler,
    softDeleteCrawler,
    listCrawlerRuns,
    listCrawlerRecentOutputs,
    runCrawler,
    syncCrawlersFromDataSources,
} from '../services/datahubCrawlersService.js';

const router = express.Router();
const writeAuth = [authenticate, authorize('admin', 'trader'), writeRateLimiter];

router.get('/', authenticate, readRateLimiter, async (req, res) => {
    try {
        res.json(await listCrawlers({
            includeDuplicateAnalysis: req.query?.includeDuplicateAnalysis === 'true',
        }));
    } catch (error) {
        logger.error('List crawlers failed:', error);
        res.status(500).json({ error: 'Failed to list crawlers' });
    }
});

router.post('/sync', ...writeAuth, async (req, res) => {
    try {
        const sync = await syncCrawlersFromDataSources();
        res.json({ sync });
    } catch (error) {
        logger.error('Sync crawlers from data sources failed:', error);
        res.status(500).json({ error: 'Failed to sync crawlers from data sources' });
    }
});

router.get(
    '/:id/runs',
    authenticate,
    readRateLimiter,
    validateParams(uuidParamSchema),
    validateQuery(listRunsQuerySchema),
    async (req, res) => {
        try {
            const runs = await listCrawlerRuns(req.params.id, req.validatedQuery || {});
            res.json({ runs });
        } catch (error) {
            const status = error.status || 500;
            res.status(status).json({ error: error.message || 'Failed to list runs' });
        }
    },
);

router.get(
    '/:id/recent-outputs',
    authenticate,
    readRateLimiter,
    validateParams(uuidParamSchema),
    async (req, res) => {
        try {
            const outputs = await listCrawlerRecentOutputs(req.params.id, { limit: 5 });
            res.json({ outputs });
        } catch (error) {
            const status = error.status || 500;
            res.status(status).json({ error: error.message || 'Failed to list recent outputs' });
        }
    },
);

router.post(
    '/:id/run',
    ...writeAuth,
    validateParams(uuidParamSchema),
    validateBody(runCrawlerSchema),
    async (req, res) => {
        try {
            const result = await runCrawler(req.params.id, {
                dryRun: req.validatedBody?.dry_run,
                forceOverride: req.validatedBody?.force_override,
                triggerType: 'manual',
            });
            res.json(result);
        } catch (error) {
            logger.error('Run crawler failed:', error);
            const status = error.status || 500;
            res.status(status).json({
                error: error.message || 'Failed to run crawler',
                code: error.code || undefined,
                details: error.details,
            });
        }
    },
);

router.get(
    '/:id',
    authenticate,
    readRateLimiter,
    validateParams(uuidParamSchema),
    async (req, res) => {
        try {
            res.json({ crawler: await getCrawler(req.params.id) });
        } catch (error) {
            const status = error.status || 500;
            res.status(status).json({ error: error.message || 'Failed to get crawler' });
        }
    },
);

router.post('/', ...writeAuth, validateBody(createCrawlerSchema), async (req, res) => {
    try {
        const crawler = await createCrawler(req.validatedBody, req.user?.id);
        res.status(201).json({ crawler });
    } catch (error) {
        logger.error('Create crawler failed:', error);
        const status = error.status || 500;
        res.status(status).json({
            error: error.message || 'Failed to create crawler',
            code: error.code,
        });
    }
});

router.put(
    '/:id',
    ...writeAuth,
    validateParams(uuidParamSchema),
    validateBody(updateCrawlerSchema),
    async (req, res) => {
        try {
            const crawler = await updateCrawler(req.params.id, req.validatedBody);
            res.json({ crawler });
        } catch (error) {
            logger.error('Update crawler failed:', error);
            const status = error.status || 500;
            res.status(status).json({
                error: error.message || 'Failed to update crawler',
                code: error.code,
            });
        }
    },
);

router.delete(
    '/:id',
    ...writeAuth,
    validateParams(uuidParamSchema),
    async (req, res) => {
        try {
            const crawler = await softDeleteCrawler(req.params.id);
            res.json({ crawler });
        } catch (error) {
            const status = error.status || 500;
            res.status(status).json({ error: error.message || 'Failed to delete crawler' });
        }
    },
);

export default router;
