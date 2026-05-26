import express from 'express';
import { authenticate, authorize } from '../middleware/auth.js';
import { readRateLimiter, writeRateLimiter } from '../middleware/rateLimiter.js';
import { validateBody, validateQuery } from '../middleware/validation.js';
import { logger } from '../services/logger.js';
import {
    archivePreviewSchema,
    archiveExecuteSchema,
    restorePreviewSchema,
    restoreExecuteSchema,
    purgePreviewSchema,
    createPartitionSchema,
    listRecordsQuerySchema,
    listOperationsQuerySchema,
    listStatsQuerySchema,
} from '../schemas/datahubArchivingSchemas.js';
import {
    getArchiveHealth,
    listArchivePartitions,
    getArchivingDashboard,
    listArchivedRecords,
    listArchivingOperations,
    previewArchive,
    executeArchive,
    previewRestore,
    executeRestore,
    previewPurge,
    createArchivePartition,
} from '../services/datahubArchivingService.js';

const router = express.Router();
const writeAuth = [authenticate, authorize('admin', 'trader'), writeRateLimiter];

function sendError(res, error, fallback) {
    const status = error.status || 500;
    res.status(status).json({
        error: error.message || fallback,
        code: error.code,
        details: error.details,
    });
}

router.get('/health', authenticate, readRateLimiter, async (req, res) => {
    try {
        res.json(await getArchiveHealth());
    } catch (error) {
        logger.error('Archive health failed:', error);
        sendError(res, error, 'Failed to load archive health');
    }
});

router.get('/partitions', authenticate, readRateLimiter, async (req, res) => {
    try {
        res.json({ partitions: await listArchivePartitions() });
    } catch (error) {
        sendError(res, error, 'Failed to list partitions');
    }
});

router.get('/stats', authenticate, readRateLimiter, validateQuery(listStatsQuerySchema), async (req, res) => {
    try {
        res.json(await getArchivingDashboard({ statsLimit: req.validatedQuery.limit, opsLimit: 10 }));
    } catch (error) {
        sendError(res, error, 'Failed to load archive stats');
    }
});

router.get('/operations', authenticate, readRateLimiter, validateQuery(listOperationsQuerySchema), async (req, res) => {
    try {
        const q = req.validatedQuery;
        res.json({ operations: await listArchivingOperations(q) });
    } catch (error) {
        sendError(res, error, 'Failed to list operations');
    }
});

router.get('/records', authenticate, readRateLimiter, validateQuery(listRecordsQuerySchema), async (req, res) => {
    try {
        const q = req.validatedQuery;
        res.json(await listArchivedRecords({ limit: q.limit, offset: q.offset, agentId: q.agent_id }));
    } catch (error) {
        sendError(res, error, 'Failed to list archived records');
    }
});

router.post('/archive/preview', ...writeAuth, validateBody(archivePreviewSchema), async (req, res) => {
    try {
        res.json(await previewArchive({ daysOld: req.validatedBody.days_old, userId: req.user?.id }));
    } catch (error) {
        sendError(res, error, 'Archive preview failed');
    }
});

router.post('/archive', ...writeAuth, validateBody(archiveExecuteSchema), async (req, res) => {
    try {
        const b = req.validatedBody;
        res.json(
            await executeArchive({
                daysOld: b.days_old,
                dryRun: b.dry_run,
                confirmArchive: b.confirm_archive,
                userId: req.user?.id,
            }),
        );
    } catch (error) {
        sendError(res, error, 'Archive failed');
    }
});

router.post('/restore/preview', ...writeAuth, validateBody(restorePreviewSchema), async (req, res) => {
    try {
        const b = req.validatedBody;
        res.json(await previewRestore({ startDate: b.start_date, endDate: b.end_date, userId: req.user?.id }));
    } catch (error) {
        sendError(res, error, 'Restore preview failed');
    }
});

router.post('/restore', ...writeAuth, validateBody(restoreExecuteSchema), async (req, res) => {
    try {
        const b = req.validatedBody;
        res.json(
            await executeRestore({
                startDate: b.start_date,
                endDate: b.end_date,
                dryRun: b.dry_run,
                confirmRestore: b.confirm_restore,
                userId: req.user?.id,
            }),
        );
    } catch (error) {
        sendError(res, error, 'Restore failed');
    }
});

router.post('/purge/preview', ...writeAuth, validateBody(purgePreviewSchema), async (req, res) => {
    try {
        const b = req.validatedBody;
        res.json(await previewPurge({ startDate: b.start_date, endDate: b.end_date, userId: req.user?.id }));
    } catch (error) {
        sendError(res, error, 'Purge preview failed');
    }
});

router.post('/partitions', ...writeAuth, validateBody(createPartitionSchema), async (req, res) => {
    try {
        const b = req.validatedBody;
        res.json(await createArchivePartition({ year: b.year, confirmCreate: b.confirm_create, userId: req.user?.id }));
    } catch (error) {
        sendError(res, error, 'Create partition failed');
    }
});

export default router;
