import express from 'express';
import { authenticate } from '../middleware/auth.js';
import { query } from '../database/db.js';
import { logger } from '../services/logger.js';
import { validateBody, validateParams, validateResponse } from '../middleware/validation.js';
import {
    categorySchema,
    uuidParamSchema,
    categoryResponseSchema,
    categoryListResponseSchema
} from '../schemas/dataHubSchemas.js';

const router = express.Router();

// Get all categories
router.get('/', authenticate, validateResponse(categoryListResponseSchema), async (req, res) => {
    try {
        const result = await query('SELECT * FROM data_categories ORDER BY name ASC');
        res.json(result.rows);
    } catch (error) {
        logger.error('Failed to fetch data categories:', error);
        res.status(500).json({ error: 'Failed to fetch categories' });
    }
});

// Get a single category
router.get('/:id', authenticate, validateParams(uuidParamSchema), validateResponse(categoryResponseSchema), async (req, res) => {
    try {
        const { id } = req.validatedParams;
        const result = await query('SELECT * FROM data_categories WHERE id = $1', [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Category not found' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        logger.error(`Failed to fetch category ${req.params.id}:`, error);
        res.status(500).json({ error: 'Failed to fetch category' });
    }
});

// Create a new category
router.post('/', authenticate, validateBody(categorySchema), validateResponse(categoryResponseSchema), async (req, res) => {
    try {
        const { name, description, color, icon } = req.validatedBody;

        const result = await query(
            'INSERT INTO data_categories (name, description, color, icon, created_by) VALUES ($1, $2, $3, $4, $5) RETURNING *',
            [name, description || '', color || '#9333ea', icon || 'Tag', req.user?.id]
        );

        res.status(201).json(result.rows[0]);
    } catch (error) {
        if (error.code === '23505') { // Unique violation
            return res.status(409).json({ error: 'Category with this name already exists' });
        }
        logger.error('Failed to create data category:', error);
        res.status(500).json({ error: 'Failed to create category' });
    }
});

// Update a category
router.put('/:id', authenticate, validateParams(uuidParamSchema), validateBody(categorySchema), validateResponse(categoryResponseSchema), async (req, res) => {
    try {
        const { id } = req.validatedParams;
        const { name, description, color, icon } = req.validatedBody;

        const result = await query(
            'UPDATE data_categories SET name = $1, description = $2, color = $3, icon = $4, updated_at = NOW() WHERE id = $5 RETURNING *',
            [name, description, color, icon, id]
        );

        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Category not found' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        if (error.code === '23505') {
            return res.status(409).json({ error: 'Category with this name already exists' });
        }
        logger.error('Failed to update data category:', error);
        res.status(500).json({ error: 'Failed to update category' });
    }
});

// Delete a category
router.delete('/:id', authenticate, validateParams(uuidParamSchema), async (req, res) => {
    try {
        const { id } = req.validatedParams;

        // Fetch the category name first to check against data_sources.category (which is a string)
        const catResult = await query('SELECT name FROM data_categories WHERE id = $1', [id]);
        if (catResult.rows.length === 0) {
            return res.status(404).json({ error: 'Category not found' });
        }
        const categoryName = catResult.rows[0].name;

        // Check if any data sources are using this category
        const usageCheck = await query('SELECT count(*) FROM data_sources WHERE category = $1', [categoryName]);
        const usageCount = parseInt(usageCheck.rows[0].count);

        if (usageCount > 0) {
            return res.status(400).json({
                error: 'Cannot delete category',
                message: `This category is currently used by ${usageCount} data source(s). Please reassign them before deleting.`
            });
        }

        const result = await query('DELETE FROM data_categories WHERE id = $1 RETURNING *', [id]);

        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Category not found' });
        }

        res.json({ message: 'Category deleted successfully' });
    } catch (error) {
        logger.error('Failed to delete data category:', error);
        res.status(500).json({ error: 'Failed to delete category' });
    }
});

export default router;
