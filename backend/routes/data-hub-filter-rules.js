import express from 'express';
import { authenticate, authorize } from '../middleware/auth.js';
import { readRateLimiter, writeRateLimiter } from '../middleware/rateLimiter.js';
import { validateBody, validateParams, validateQuery } from '../middleware/validation.js';
import { logger } from '../services/logger.js';
import {
    createFilterRuleSchema,
    updateFilterRuleSchema,
    evaluateFilterSchema,
    listFilterRulesQuerySchema,
    uuidParamSchema,
} from '../schemas/datahubFilterRulesSchemas.js';
import {
    listFilterRules,
    getFilterRule,
    createFilterRule,
    updateFilterRule,
    softDeleteFilterRule,
} from '../services/datahubFilterRulesService.js';
import { evaluateFilterPolicy } from '../services/filterRulesGateway.js';

const router = express.Router();
const writeAuth = [authenticate, authorize('admin', 'trader'), writeRateLimiter];

router.get(
    '/',
    authenticate,
    readRateLimiter,
    validateQuery(listFilterRulesQuerySchema),
    async (req, res) => {
        try {
            const rules = await listFilterRules(req.validatedQuery || {});
            res.json({ rules });
        } catch (error) {
            logger.error('List filter rules failed:', error);
            res.status(500).json({ error: 'Failed to list filter rules' });
        }
    },
);

router.post(
    '/evaluate',
    authenticate,
    readRateLimiter,
    validateBody(evaluateFilterSchema),
    async (req, res) => {
        try {
            const result = await evaluateFilterPolicy(req.validatedBody);
            res.json(result);
        } catch (error) {
            logger.error('Evaluate filter rules failed:', error);
            res.status(500).json({ error: 'Failed to evaluate filter rules' });
        }
    },
);

router.post(
    '/',
    ...writeAuth,
    validateBody(createFilterRuleSchema),
    async (req, res) => {
        try {
            const rule = await createFilterRule(req.validatedBody, req.user?.id);
            res.status(201).json({ rule });
        } catch (error) {
            logger.error('Create filter rule failed:', error);
            const status = error.status || 500;
            res.status(status).json({ error: error.message || 'Failed to create filter rule' });
        }
    },
);

router.put(
    '/:id',
    ...writeAuth,
    validateParams(uuidParamSchema),
    validateBody(updateFilterRuleSchema),
    async (req, res) => {
        try {
            const rule = await updateFilterRule(req.params.id, req.validatedBody);
            res.json({ rule });
        } catch (error) {
            logger.error('Update filter rule failed:', error);
            const status = error.status || 500;
            res.status(status).json({ error: error.message || 'Failed to update filter rule' });
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
            res.json({ rule: await getFilterRule(req.params.id) });
        } catch (error) {
            const status = error.status || 500;
            res.status(status).json({ error: error.message || 'Failed to get filter rule' });
        }
    },
);

router.delete(
    '/:id',
    ...writeAuth,
    validateParams(uuidParamSchema),
    async (req, res) => {
        try {
            const rule = await softDeleteFilterRule(req.params.id);
            res.json({ rule });
        } catch (error) {
            logger.error('Delete filter rule failed:', error);
            const status = error.status || 500;
            res.status(status).json({ error: error.message || 'Failed to delete filter rule' });
        }
    },
);

export default router;
