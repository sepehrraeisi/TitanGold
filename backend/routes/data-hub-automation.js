import express from 'express';
import { authenticate, authorize } from '../middleware/auth.js';
import { readRateLimiter, writeRateLimiter } from '../middleware/rateLimiter.js';
import { validateBody, validateParams } from '../middleware/validation.js';
import { logger } from '../services/logger.js';
import {
  uuidParamSchema,
  createAutomationTopicSchema,
  updateAutomationTopicSchema,
  updateScheduleSchema,
  dispatchQueueSchema,
  dispatchItemSchema,
  testRunSchema,
  failQueueItemSchema,
} from '../schemas/datahubAutomationSchemas.js';
import {
  listAutomationTopics,
  createAutomationTopic,
  updateAutomationTopic,
  deleteAutomationTopic,
  getAutomationSchedule,
  updateAutomationSchedule,
  listAutomationQueue,
  refreshAutomationQueue,
  dispatchAutomationQueue,
  dispatchSingleQueueItem,
  failQueueItem,
  retryAutomationExecution,
  runAutomationTest,
  listAutomationExecutions,
  getAutomationOverview,
} from '../services/datahubAutomationService.js';

const router = express.Router();
const writeAuth = [authenticate, authorize('admin', 'trader'), writeRateLimiter];

router.get('/overview', authenticate, readRateLimiter, async (req, res) => {
  try {
    res.json(await getAutomationOverview());
  } catch (error) {
    logger.error('Automation overview failed:', error);
    res.status(500).json({ error: 'Failed to load automation overview' });
  }
});

router.get('/topics', authenticate, readRateLimiter, async (req, res) => {
  try {
    res.json({ topics: await listAutomationTopics() });
  } catch (error) {
    logger.error('List automation topics failed:', error);
    res.status(500).json({ error: 'Failed to list automation topics' });
  }
});

router.post(
  '/topics',
  ...writeAuth,
  validateBody(createAutomationTopicSchema),
  async (req, res) => {
    try {
      const topic = await createAutomationTopic(req.validatedBody, req.user?.id);
      res.status(201).json({ topic });
    } catch (error) {
      logger.error('Create automation topic failed:', error);
      const status = error.status || 500;
      res.status(status).json({ error: error.message || 'Failed to create topic' });
    }
  },
);

router.put(
  '/topics/:id',
  ...writeAuth,
  validateParams(uuidParamSchema),
  validateBody(updateAutomationTopicSchema),
  async (req, res) => {
    try {
      const topic = await updateAutomationTopic(req.params.id, req.validatedBody);
      res.json({ topic });
    } catch (error) {
      logger.error('Update automation topic failed:', error);
      const status = error.status || 500;
      res.status(status).json({ error: error.message || 'Failed to update topic' });
    }
  },
);

router.delete(
  '/topics/:id',
  ...writeAuth,
  validateParams(uuidParamSchema),
  async (req, res) => {
    try {
      await deleteAutomationTopic(req.params.id);
      res.json({ message: 'Topic deleted' });
    } catch (error) {
      logger.error('Delete automation topic failed:', error);
      const status = error.status || 500;
      res.status(status).json({ error: error.message || 'Failed to delete topic' });
    }
  },
);

router.get('/schedule', authenticate, readRateLimiter, async (req, res) => {
  try {
    res.json({ schedule: await getAutomationSchedule() });
  } catch (error) {
    logger.error('Get automation schedule failed:', error);
    res.status(500).json({ error: 'Failed to get schedule' });
  }
});

router.put(
  '/schedule',
  ...writeAuth,
  validateBody(updateScheduleSchema),
  async (req, res) => {
    try {
      const schedule = await updateAutomationSchedule(req.validatedBody);
      res.json({ schedule });
    } catch (error) {
      logger.error('Update automation schedule failed:', error);
      res.status(500).json({ error: 'Failed to update schedule' });
    }
  },
);

router.get('/queue', authenticate, readRateLimiter, async (req, res) => {
  try {
    const status = req.query.status || 'pending';
    const limit = Math.min(100, parseInt(req.query.limit, 10) || 50);
    res.json({ queue: await listAutomationQueue({ status, limit }) });
  } catch (error) {
    logger.error('List automation queue failed:', error);
    res.status(500).json({ error: 'Failed to list queue' });
  }
});

router.post('/queue/refresh', ...writeAuth, async (req, res) => {
  try {
    const result = await refreshAutomationQueue();
    res.json(result);
  } catch (error) {
    logger.error('Refresh automation queue failed:', error);
    res.status(500).json({ error: 'Failed to refresh queue' });
  }
});

router.post(
  '/queue/dispatch',
  ...writeAuth,
  validateBody(dispatchQueueSchema),
  async (req, res) => {
    try {
      const { limit, dry_run: dryRun } = req.validatedBody;
      const result = await dispatchAutomationQueue(req.user?.id, { limit, dryRun });
      res.json(result);
    } catch (error) {
      logger.error('Dispatch automation queue failed:', error);
      res.status(500).json({ error: 'Failed to dispatch queue' });
    }
  },
);

router.post(
  '/queue/:id/dispatch',
  ...writeAuth,
  validateParams(uuidParamSchema),
  validateBody(dispatchItemSchema),
  async (req, res) => {
    try {
      const result = await dispatchSingleQueueItem(req.params.id, req.user?.id, {
        dryRun: req.validatedBody.dry_run,
      });
      res.json(result);
    } catch (error) {
      logger.error('Dispatch queue item failed:', error);
      const status = error.status || 500;
      res.status(status).json({ error: error.message || 'Failed to dispatch item' });
    }
  },
);

router.patch(
  '/queue/:id',
  ...writeAuth,
  validateParams(uuidParamSchema),
  validateBody(failQueueItemSchema),
  async (req, res) => {
    try {
      await failQueueItem(req.params.id, req.validatedBody.error_message);
      res.json({ message: 'Queue item marked failed' });
    } catch (error) {
      logger.error('Fail queue item failed:', error);
      const status = error.status || 500;
      res.status(status).json({ error: error.message || 'Failed to update queue item' });
    }
  },
);

router.post(
  '/executions/:id/retry',
  ...writeAuth,
  validateParams(uuidParamSchema),
  async (req, res) => {
    try {
      const result = await retryAutomationExecution(req.params.id, req.user?.id);
      res.json(result);
    } catch (error) {
      logger.error('Retry execution failed:', error);
      const status = error.status || 500;
      res.status(status).json({ error: error.message || 'Failed to retry' });
    }
  },
);

router.post(
  '/test-run',
  ...writeAuth,
  validateBody(testRunSchema),
  async (req, res) => {
    try {
      const result = await runAutomationTest(req.user?.id, {
        topicId: req.validatedBody.topic_id,
        dryRun: req.validatedBody.dry_run,
      });
      res.json(result);
    } catch (error) {
      logger.error('Automation test run failed:', error);
      const status = error.status || 500;
      res.status(status).json({ error: error.message || 'Test run failed' });
    }
  },
);

router.get('/executions', authenticate, readRateLimiter, async (req, res) => {
  try {
    const limit = Math.min(100, parseInt(req.query.limit, 10) || 50);
    const offset = parseInt(req.query.offset, 10) || 0;
    res.json({
      executions: await listAutomationExecutions({ limit, offset }),
    });
  } catch (error) {
    logger.error('List automation executions failed:', error);
    res.status(500).json({ error: 'Failed to list executions' });
  }
});

export default router;
