import express from 'express';
import { query } from '../database/db.js';
import { logger } from '../services/logger.js';
import { authenticate } from '../middleware/auth.js';
import { readRateLimiter, writeRateLimiter } from '../middleware/rateLimiter.js';

const router = express.Router();

// Debug log
logger.info('📡 Telegram API routes module loaded');

// ============================================================================
// HEALTH CHECK (NO AUTH)
// ============================================================================

/**
 * GET /api/v1/telegram/health
 * Health check endpoint for Telegram services (no authentication required)
 */
router.get('/health', async (req, res) => {
    try {
        // Check database connection
        const dbCheck = await query('SELECT COUNT(*) as count FROM telegram_messages');
        
        // Get pipeline stats
        const stats = await query('SELECT * FROM telegram_pipeline_stats');
        
        return res.json({
            success: true,
            status: 'healthy',
            timestamp: new Date().toISOString(),
            database: {
                connected: true,
                totalMessages: parseInt(dbCheck.rows[0].count)
            },
            pipeline: stats.rows[0] || {}
        });
    } catch (error) {
        logger.error('Telegram health check failed:', error);
        return res.status(503).json({
            success: false,
            status: 'unhealthy',
            error: error.message
        });
    }
});

// ============================================================================
// AGENT-SPECIFIC FEEDS
// ============================================================================

/**
 * GET /api/v1/telegram/agents/:agentKey/feed
 * Get filtered messages for a specific agent
 * 
 * Query parameters:
 * - limit: number of messages (default: 50, max: 200)
 * - offset: pagination offset (default: 0)
 * - minImpact: minimum impact score (0.0-1.0)
 * - categories: comma-separated event categories
 * - timeRange: time range in hours (default: 24)
 * - requiresAction: filter messages requiring action (true/false)
 */
router.get('/agents/:agentKey/feed', authenticate, readRateLimiter, async (req, res) => {
    try {
        const { agentKey } = req.params;
        const {
            limit = 50,
            offset = 0,
            minImpact = 0,
            categories,
            timeRange = 24,
            requiresAction
        } = req.query;

        // Validate agent key
        const validAgentKeys = [
            'technical', 'risk', 'sentiment', 'pattern', 'price_prediction',
            'arbitrage', 'portfolio', 'liquidity', 'trend', 'optimization',
            'order', 'fundamental', 'market_intelligence', 'volume', 'timing'
        ];

        if (!validAgentKeys.includes(agentKey)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid agent key',
                validKeys: validAgentKeys
            });
        }

        // Build query
        let whereConditions = [
            `ai.agent_key = $1`,
            `ai.impact_score >= $2`,
            `pm.created_at >= NOW() - INTERVAL '${parseInt(timeRange)} hours'`
        ];
        let params = [agentKey, parseFloat(minImpact)];
        let paramIndex = 3;

        // Filter by categories
        if (categories) {
            const categoryList = categories.split(',').map(c => c.trim());
            whereConditions.push(`ai.event_category = ANY($${paramIndex})`);
            params.push(categoryList);
            paramIndex++;
        }

        // Filter by action requirement
        if (requiresAction !== undefined) {
            whereConditions.push(`ai.requires_action = $${paramIndex}`);
            params.push(requiresAction === 'true');
            paramIndex++;
        }

        const sql = `
            SELECT 
                pm.id,
                pm.message_id,
                pm.channel_id,
                tc.username as channel_username,
                tc.title as channel_title,
                pm.cleaned_text,
                pm.original_text,
                pm.detected_language,
                pm.sentiment,
                pm.news_type,
                pm.importance_level,
                pm.mentioned_assets,
                pm.extracted_prices,
                pm.extracted_dates,
                pm.keywords,
                pm.hashtags,
                pm.telegram_created_at,
                pm.created_at,
                -- Agent Impact Data
                ai.impact_score,
                ai.event_category,
                ai.relevance_reasoning,
                ai.requires_action,
                ai.action_type,
                ai.confidence_score,
                ai.processing_notes,
                ai.created_at as impact_recorded_at
            FROM processed_telegram_messages pm
            INNER JOIN telegram_agent_impacts ai ON pm.id = ai.processed_message_id
            INNER JOIN telegram_channels tc ON pm.channel_id = tc.channel_id
            WHERE ${whereConditions.join(' AND ')}
            ORDER BY pm.telegram_created_at DESC, ai.impact_score DESC
            LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
        `;

        params.push(Math.min(parseInt(limit), 200), parseInt(offset));

        const result = await query(sql, params);

        // Get total count for pagination
        const countSql = `
            SELECT COUNT(*) as total
            FROM processed_telegram_messages pm
            INNER JOIN telegram_agent_impacts ai ON pm.id = ai.processed_message_id
            WHERE ${whereConditions.join(' AND ')}
        `;
        const countResult = await query(countSql, params.slice(0, -2));

        return res.json({
            success: true,
            agent: agentKey,
            data: result.rows,
            pagination: {
                total: parseInt(countResult.rows[0].total),
                limit: parseInt(limit),
                offset: parseInt(offset),
                hasMore: parseInt(offset) + result.rows.length < parseInt(countResult.rows[0].total)
            },
            filters: {
                minImpact: parseFloat(minImpact),
                categories: categories ? categories.split(',') : null,
                timeRange: parseInt(timeRange),
                requiresAction: requiresAction === 'true' ? true : requiresAction === 'false' ? false : null
            }
        });

    } catch (error) {
        logger.error('Error fetching agent feed:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to fetch agent feed',
            message: error.message
        });
    }
});

/**
 * GET /api/v1/telegram/agents/summary
 * Get overview of all 15 agents with message counts and stats
 */
router.get('/agents/summary', readRateLimiter, async (req, res) => {
    try {
        const { timeRange = 24 } = req.query;

        const sql = `
            SELECT 
                agent_key,
                agent_name,
                total_messages,
                action_required_count,
                critical_count,
                avg_impact_score as average_impact,
                last_message_at,
                event_categories as top_event_categories,
                news_categories as top_news_categories
            FROM telegram_agent_feed
            ORDER BY total_messages DESC
        `;

        const result = await query(sql);

        // Calculate system-wide stats
        const statsSql = `
            SELECT 
                COUNT(DISTINCT pm.id) as total_processed_messages,
                COUNT(DISTINCT ai.id) as total_agent_impacts,
                COUNT(DISTINCT pm.channel_id) as active_channels,
                AVG(ai.impact_score) as avg_impact_score,
                COUNT(CASE WHEN ai.requires_action THEN 1 END) as total_actions_required,
                MAX(pm.created_at) as last_processed_at
            FROM processed_telegram_messages pm
            INNER JOIN telegram_agent_impacts ai ON pm.id = ai.processed_message_id
            WHERE pm.created_at >= NOW() - INTERVAL '${parseInt(timeRange)} hours'
        `;

        const statsResult = await query(statsSql);

        return res.json({
            success: true,
            timeRange: parseInt(timeRange),
            agents: result.rows,
            systemStats: statsResult.rows[0]
        });

    } catch (error) {
        logger.error('Error fetching agents summary:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to fetch agents summary',
            message: error.message
        });
    }
});

// ============================================================================
// BREAKING NEWS & EVENTS
// ============================================================================

/**
 * GET /api/v1/telegram/breaking-news
 * Get high-impact, time-sensitive news
 * 
 * Query parameters:
 * - limit: number of news items (default: 20, max: 100)
 * - minImpact: minimum impact score (default: 0.7)
 * - categories: comma-separated event categories
 * - severity: filter by severity level (high/medium/low)
 */
router.get('/breaking-news', authenticate, readRateLimiter, async (req, res) => {
    try {
        const {
            limit = 20,
            minImpact = 0.7,
            categories,
            severity
        } = req.query;

        let whereConditions = [
            `ne.market_impact_level IS NOT NULL`,
            `pm.importance_level IN ('high', 'critical')`,
            `pm.created_at >= NOW() - INTERVAL '6 hours'` // Recent news only
        ];
        let params = [];
        let paramIndex = 1;

        // Filter by categories
        if (categories) {
            const categoryList = categories.split(',').map(c => c.trim());
            whereConditions.push(`ne.primary_category = ANY($${paramIndex})`);
            params.push(categoryList);
            paramIndex++;
        }

        // Filter by severity
        if (severity) {
            whereConditions.push(`ne.market_impact_level = $${paramIndex}`);
            params.push(severity);
            paramIndex++;
        }

        const sql = `
            SELECT 
                pm.id,
                pm.message_id,
                pm.channel_id,
                tc.username as channel_username,
                tc.title as channel_title,
                pm.cleaned_text,
                pm.sentiment,
                pm.news_type,
                pm.importance_level,
                pm.mentioned_assets,
                pm.extracted_prices,
                pm.telegram_created_at,
                pm.created_at,
                -- News Event Data
                ne.primary_category,
                ne.sub_category,
                ne.regions,
                ne.affected_entities,
                ne.market_impact_level,
                ne.event_urgency,
                ne.source_reliability,
                ne.event_type,
                -- Count affected agents
                (SELECT COUNT(DISTINCT agent_key) 
                 FROM telegram_agent_impacts ai 
                 WHERE ai.processed_message_id = pm.id AND ai.impact_score >= ${parseFloat(minImpact)}) as affected_agents_count,
                -- Get top affected agents
                (SELECT json_agg(json_build_object(
                    'agent_key', agent_key,
                    'impact_score', impact_score,
                    'requires_action', requires_action
                ) ORDER BY impact_score DESC)
                 FROM (
                     SELECT agent_key, impact_score, requires_action
                     FROM telegram_agent_impacts
                     WHERE processed_message_id = pm.id AND impact_score >= ${parseFloat(minImpact)}
                     LIMIT 5
                 ) sub) as top_affected_agents
                -- Get top affected agents
                (SELECT json_agg(json_build_object(
                    'agent_key', agent_key,
                    'impact_score', impact_score,
                    'requires_action', requires_action
                ) ORDER BY impact_score DESC)
                 FROM (
                     SELECT agent_key, impact_score, requires_action
                     FROM telegram_agent_impacts
                     WHERE message_id = pm.id AND impact_score >= ${parseFloat(minImpact)}
                     LIMIT 5
                 ) sub) as top_affected_agents
            FROM processed_telegram_messages pm
            INNER JOIN telegram_news_events ne ON pm.id = ne.message_id
            INNER JOIN telegram_channels tc ON pm.channel_id = tc.channel_id
            WHERE ${whereConditions.join(' AND ')}
            ORDER BY 
                ne.event_urgency DESC,
                pm.importance_level DESC,
                pm.telegram_created_at DESC
            LIMIT $${paramIndex}
        `;

        params.push(Math.min(parseInt(limit), 100));

        const result = await query(sql, params);

        return res.json({
            success: true,
            count: result.rows.length,
            minImpact: parseFloat(minImpact),
            data: result.rows,
            filters: {
                categories: categories ? categories.split(',') : null,
                severity
            }
        });

    } catch (error) {
        logger.error('Error fetching breaking news:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to fetch breaking news',
            message: error.message
        });
    }
});

/**
 * GET /api/v1/telegram/events/recent
 * Get latest categorized events
 */
router.get('/events/recent', authenticate, readRateLimiter, async (req, res) => {
    try {
        const { limit = 50, categories, timeRange = 24 } = req.query;

        let whereConditions = [
            `pm.created_at >= NOW() - INTERVAL '${parseInt(timeRange)} hours'`
        ];
        let params = [];
        let paramIndex = 1;

        if (categories) {
            const categoryList = categories.split(',').map(c => c.trim());
            whereConditions.push(`ne.primary_category = ANY($${paramIndex})`);
            params.push(categoryList);
            paramIndex++;
        }

        const sql = `
            SELECT 
                ne.primary_category,
                ne.sub_category,
                ne.regions,
                ne.market_impact_level,
                ne.event_urgency,
                ne.event_type,
                pm.cleaned_text,
                pm.sentiment,
                pm.telegram_created_at,
                tc.title as channel_title,
                COUNT(ai.id) as affected_agents_count
            FROM telegram_news_events ne
            INNER JOIN processed_telegram_messages pm ON ne.processed_message_id = pm.id
            INNER JOIN telegram_channels tc ON pm.channel_id = tc.channel_id
            LEFT JOIN telegram_agent_impacts ai ON pm.id = ai.processed_message_id
            WHERE ${whereConditions.join(' AND ')}
            GROUP BY ne.id, pm.id, tc.title
            ORDER BY pm.telegram_created_at DESC
            LIMIT $${paramIndex}
        `;

        params.push(Math.min(parseInt(limit), 100));

        const result = await query(sql, params);

        return res.json({
            success: true,
            count: result.rows.length,
            timeRange: parseInt(timeRange),
            data: result.rows
        });

    } catch (error) {
        logger.error('Error fetching recent events:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to fetch recent events',
            message: error.message
        });
    }
});

// ============================================================================
// CATEGORY ANALYTICS
// ============================================================================

/**
 * GET /api/v1/telegram/categories/summary
 * Get message distribution across 15 categories
 */
router.get('/categories/summary', readRateLimiter, async (req, res) => {
    try {
        const { timeRange = 24 } = req.query;

        const sql = `
            SELECT 
                ne.primary_category,
                COUNT(*) as message_count,
                COUNT(CASE WHEN ne.market_impact_level = 'high' THEN 1 END) as high_impact_count,
                COUNT(CASE WHEN ne.market_impact_level = 'medium' THEN 1 END) as medium_impact_count,
                COUNT(CASE WHEN ne.market_impact_level = 'low' THEN 1 END) as low_impact_count,
                COUNT(CASE WHEN ne.is_breaking = true THEN 1 END) as breaking_count,
                AVG(ne.source_reliability) as avg_reliability,
                COUNT(DISTINCT pm.channel_id) as channel_count,
                COUNT(DISTINCT ai.agent_key) as affected_agents_count,
                MAX(pm.telegram_created_at) as latest_message_at
            FROM telegram_news_events ne
            INNER JOIN processed_telegram_messages pm ON ne.processed_message_id = pm.id
            LEFT JOIN telegram_agent_impacts ai ON pm.id = ai.processed_message_id
            WHERE pm.created_at >= NOW() - INTERVAL '${parseInt(timeRange)} hours'
            GROUP BY ne.primary_category
            ORDER BY message_count DESC
        `;

        const result = await query(sql);

        // Get total stats
        const totalSql = `
            SELECT 
                COUNT(DISTINCT pm.id) as total_messages,
                COUNT(DISTINCT pm.channel_id) as total_channels,
                COUNT(DISTINCT ai.agent_key) as total_agents_affected
            FROM processed_telegram_messages pm
            LEFT JOIN telegram_agent_impacts ai ON pm.id = ai.processed_message_id
            WHERE pm.created_at >= NOW() - INTERVAL '${parseInt(timeRange)} hours'
        `;

        const totalResult = await query(totalSql);

        return res.json({
            success: true,
            timeRange: parseInt(timeRange),
            categories: result.rows,
            totals: totalResult.rows[0]
        });

    } catch (error) {
        logger.error('Error fetching categories summary:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to fetch categories summary',
            message: error.message
        });
    }
});

/**
 * GET /api/v1/telegram/categories/:category/timeline
 * Get historical timeline for a specific category
 */
router.get('/categories/:category/timeline', authenticate, readRateLimiter, async (req, res) => {
    try {
        const { category } = req.params;
        const { timeRange = 168, interval = 'hour' } = req.query; // Default 7 days

        const validIntervals = ['hour', 'day'];
        if (!validIntervals.includes(interval)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid interval. Use: hour, day'
            });
        }

        const sql = `
            SELECT 
                date_trunc('${interval}', pm.telegram_created_at) as time_bucket,
                COUNT(*) as message_count,
                AVG(ne.event_urgency) as avg_urgency,
                COUNT(CASE WHEN ne.market_impact_level = 'high' THEN 1 END) as high_impact_count,
                json_agg(DISTINCT pm.sentiment) as sentiments,
                COUNT(DISTINCT ai.agent_key) as affected_agents
            FROM telegram_news_events ne
            INNER JOIN processed_telegram_messages pm ON ne.processed_message_id = pm.id
            LEFT JOIN telegram_agent_impacts ai ON pm.id = ai.processed_message_id
            WHERE ne.primary_category = $1
              AND pm.created_at >= NOW() - INTERVAL '${parseInt(timeRange)} hours'
            GROUP BY time_bucket
            ORDER BY time_bucket DESC
        `;

        const result = await query(sql, [category]);

        return res.json({
            success: true,
            category,
            timeRange: parseInt(timeRange),
            interval,
            data: result.rows
        });

    } catch (error) {
        logger.error('Error fetching category timeline:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to fetch category timeline',
            message: error.message
        });
    }
});

// ============================================================================
// REAL-TIME STATS
// ============================================================================

/**
 * GET /api/v1/telegram/stats/real-time
 * Get live processing stats and collector health
 */
router.get('/stats/real-time', authenticate, readRateLimiter, async (req, res) => {
    try {
        // Pipeline stats from view
        const pipelineStats = await query('SELECT * FROM telegram_pipeline_stats');

        // Collector health (last hour)
        const collectorStats = await query(`
            SELECT 
                COUNT(DISTINCT channel_id) as active_channels,
                COUNT(*) as messages_collected,
                MAX(telegram_created_at) as last_message_at
            FROM telegram_messages
            WHERE created_at >= NOW() - INTERVAL '1 hour'
        `);

        // Processor stats (last hour)
        const processorStats = await query(`
            SELECT 
                COUNT(*) as messages_processed,
                AVG(EXTRACT(EPOCH FROM (created_at - telegram_created_at))) * 1000 as avg_processing_delay_ms,
                COUNT(DISTINCT channel_id) as channels_processed
            FROM processed_telegram_messages
            WHERE created_at >= NOW() - INTERVAL '1 hour'
        `);

        // Agent activity (last hour)
        const agentActivity = await query(`
            SELECT 
                ai.agent_key,
                COUNT(*) as new_impacts,
                AVG(ai.impact_score) as avg_impact,
                COUNT(CASE WHEN ai.requires_action THEN 1 END) as actions_required
            FROM telegram_agent_impacts ai
            INNER JOIN processed_telegram_messages pm ON ai.processed_message_id = pm.id
            WHERE pm.created_at >= NOW() - INTERVAL '1 hour'
            GROUP BY ai.agent_key
            ORDER BY new_impacts DESC
        `);

        return res.json({
            success: true,
            timestamp: new Date().toISOString(),
            pipeline: pipelineStats.rows[0] || {},
            collector: collectorStats.rows[0] || {},
            processor: processorStats.rows[0] || {},
            agentActivity: agentActivity.rows
        });

    } catch (error) {
        logger.error('Error fetching real-time stats:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to fetch real-time stats',
            message: error.message
        });
    }
});

// ============================================================================
// MANAGEMENT ENDPOINTS
// ============================================================================

/**
 * POST /api/v1/telegram/agents/:agentKey/mark-processed
 * Mark messages as processed by a specific agent
 */
router.post('/agents/:agentKey/mark-processed', authenticate, writeRateLimiter, async (req, res) => {
    try {
        const { agentKey } = req.params;
        const { message_ids } = req.body;

        if (!Array.isArray(message_ids) || message_ids.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'message_ids must be a non-empty array'
            });
        }

        const sql = `
            UPDATE telegram_agent_impacts
            SET 
                processed_by_agent_at = NOW(),
                extracted_signals = COALESCE(extracted_signals, '{}'::jsonb) || '{"marked_as_processed": true}'::jsonb
            WHERE agent_key = $1
              AND processed_message_id = ANY($2)
              AND processed_by_agent_at IS NULL
            RETURNING id, processed_message_id
        `;

        const result = await query(sql, [agentKey, message_ids]);

        return res.json({
            success: true,
            agent: agentKey,
            marked_count: result.rowCount,
            processed_ids: result.rows.map(r => r.processed_message_id)
        });

    } catch (error) {
        logger.error('Error marking messages as processed:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to mark messages as processed',
            message: error.message
        });
    }
});

export default router;
