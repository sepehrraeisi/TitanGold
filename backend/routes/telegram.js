import express from 'express';
import { query } from '../database/db.js';
import { logger } from '../services/logger.js';
import { authenticate } from '../middleware/auth.js';
import { telegramReadAuth } from '../middleware/telegramAuth.js';
import { readRateLimiter, writeRateLimiter } from '../middleware/rateLimiter.js';

const router = express.Router();
const readAuth = [telegramReadAuth, readRateLimiter];

// Debug log
logger.info('📡 Telegram API routes module loaded');

// ============================================================================
// HEALTH CHECK
// ============================================================================

/**
 * GET /api/v1/telegram/health
 * Health check endpoint for Telegram services
 */
router.get('/health', ...readAuth, async (req, res) => {
    try {
        // Check database connection
        const dbCheck = await query('SELECT COUNT(*) as count FROM telegram_messages');
        
        // Pipeline stats from view (same as before Geographic Map changes)
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
router.get('/agents/:agentKey/feed', ...readAuth, async (req, res) => {
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
        // NOTE: schema differs across environments; agent impacts may not have event_category.
        // We ignore this filter here to avoid column-not-found errors.

        // Filter by action requirement
        if (requiresAction !== undefined) {
            whereConditions.push(`ai.requires_action = $${paramIndex}`);
            params.push(requiresAction === 'true');
            paramIndex++;
        }

        const sql = `
            SELECT 
                pm.id,
                tm.message_id,
                COALESCE(tc.title, tc.username, pm.channel_id::text) as channel_title,
                pm.cleaned_text,
                pm.sentiment,
                pm.importance_level,
                COALESCE(tm.telegram_created_at, pm.created_at) as telegram_created_at,
                ai.impact_score,
                ai.impact_type,
                ai.confidence as confidence,
                ai.relevance_reasons,
                ai.requires_action,
                ai.action_type,
                ai.priority_level,
                ai.created_at as processed_at
            FROM telegram_agent_impacts ai
            INNER JOIN processed_telegram_messages pm ON pm.id::text = ai.processed_message_id::text
            LEFT JOIN telegram_messages tm ON tm.id = pm.raw_message_id
            LEFT JOIN telegram_channels tc 
                ON pm.channel_id::text = tc.id::text
                OR pm.channel_id::text = tc.channel_id::text
            WHERE ${whereConditions.join(' AND ')}
            ORDER BY COALESCE(tm.telegram_created_at, pm.created_at) DESC, ai.impact_score DESC
            LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
        `;

        params.push(Math.min(parseInt(limit), 200), parseInt(offset));

        const result = await query(sql, params);

        // Get total count for pagination
        const countSql = `
            SELECT COUNT(*) as total
            FROM telegram_agent_impacts ai
            INNER JOIN processed_telegram_messages pm ON pm.id::text = ai.processed_message_id::text
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
                categories: null,
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
router.get('/agents/summary', ...readAuth, async (req, res) => {
    try {
        const hours = Math.min(720, Math.max(1, parseInt(req.query.timeRange, 10) || 24));

        // Agents list: use same time range as user selection (24h / 2d / 7d), not fixed 24h view
        const agentsSql = `
            SELECT 
                ai.agent_key,
                ai.agent_name,
                COUNT(*)::text AS total_messages,
                COUNT(*) FILTER (WHERE ai.requires_action = true)::text AS action_required_count,
                COUNT(*) FILTER (WHERE ai.priority_level = 'critical')::text AS critical_count,
                COUNT(*) FILTER (WHERE ai.priority_level = 'high')::text AS high_count,
                AVG(ai.impact_score) AS average_impact,
                MAX(ai.created_at) AS last_message_at,
                array_agg(DISTINCT pm.event_category) FILTER (WHERE pm.event_category IS NOT NULL) AS top_event_categories,
                array_agg(DISTINCT pm.news_category) FILTER (WHERE pm.news_category IS NOT NULL) AS top_news_categories
            FROM telegram_agent_impacts ai
            JOIN processed_telegram_messages pm ON ai.processed_message_id = pm.id
            WHERE ai.created_at >= NOW() - INTERVAL '1 hour' * $1
            GROUP BY ai.agent_key, ai.agent_name
            ORDER BY COUNT(*) DESC
        `;
        const agentsResult = await query(agentsSql, [hours]);

        const statsSql = `
            SELECT 
                COUNT(DISTINCT pm.id)::text AS total_processed_messages,
                COUNT(DISTINCT ai.id)::text AS total_agent_impacts,
                COUNT(DISTINCT pm.channel_id)::text AS active_channels,
                AVG(ai.impact_score)::text AS avg_impact_score,
                COUNT(CASE WHEN ai.requires_action THEN 1 END)::text AS total_actions_required,
                MAX(pm.created_at) AS last_processed_at
            FROM processed_telegram_messages pm
            INNER JOIN telegram_agent_impacts ai ON pm.id = ai.processed_message_id
            WHERE pm.created_at >= NOW() - INTERVAL '1 hour' * $1
        `;
        const statsResult = await query(statsSql, [hours]);

        return res.json({
            success: true,
            timeRange: hours,
            agents: agentsResult.rows,
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
router.get('/breaking-news', ...readAuth, async (req, res) => {
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
                tm.message_id,
                pm.channel_id,
                tc.username as channel_username,
                tc.title as channel_title,
                pm.cleaned_text,
                pm.sentiment,
                pm.news_type,
                pm.importance_level,
                pm.mentioned_assets,
                pm.extracted_prices,
                COALESCE(tm.telegram_created_at, pm.created_at) as telegram_created_at,
                pm.created_at,
                -- News Event Data
                ne.primary_category,
                ne.sub_category,
                ne.regions,
                COALESCE(ne.people_mentioned, ARRAY[]::TEXT[]) || COALESCE(ne.organizations, ARRAY[]::TEXT[]) as affected_entities,
                ne.affected_markets,
                ne.affected_assets,
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
            FROM processed_telegram_messages pm
            INNER JOIN telegram_news_events ne ON pm.id = ne.processed_message_id
            LEFT JOIN telegram_messages tm ON tm.id = pm.raw_message_id
            INNER JOIN telegram_channels tc ON pm.channel_id = tc.id
            WHERE ${whereConditions.join(' AND ')}
            ORDER BY 
                ne.event_urgency DESC,
                pm.importance_level DESC,
                COALESCE(tm.telegram_created_at, pm.created_at) DESC
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

// Map country names (from DB) to region keys expected by Geographic Heat Map (REGION_COORDS)
function countriesToRegions(countries) {
    if (!Array.isArray(countries) || countries.length === 0) return [];
    const regionSet = new Set();
    const map = {
        Iran: 'MIDDLE_EAST', USA: 'NORTH_AMERICA', Canada: 'NORTH_AMERICA', Mexico: 'NORTH_AMERICA',
        Russia: 'EUROPE', China: 'EAST_ASIA', Japan: 'EAST_ASIA', India: 'ASIA',
        'United Kingdom': 'EUROPE', UK: 'EUROPE', Germany: 'EUROPE', France: 'EUROPE',
        Turkey: 'MIDDLE_EAST', UAE: 'MIDDLE_EAST', Israel: 'MIDDLE_EAST', Syria: 'MIDDLE_EAST', Iraq: 'MIDDLE_EAST',
        Saudi: 'MIDDLE_EAST', Egypt: 'MIDDLE_EAST', Europe: 'EUROPE',
        Australia: 'OCEANIA', Indonesia: 'SOUTHEAST_ASIA', Thailand: 'SOUTHEAST_ASIA', Vietnam: 'SOUTHEAST_ASIA',
        Brazil: 'SOUTH_AMERICA', Argentina: 'SOUTH_AMERICA',
        Kazakhstan: 'CENTRAL_ASIA', Uzbekistan: 'CENTRAL_ASIA',
        'South Africa': 'AFRICA', Nigeria: 'AFRICA', Kenya: 'AFRICA'
    };
    for (const c of countries) {
        const name = (c && typeof c === 'string' ? c.trim() : String(c)).replace(/\s+/g, ' ');
        const key = map[name] || map[name.replace(/\s*\(.*\)$/, '')];
        if (key) regionSet.add(key);
    }
    return Array.from(regionSet);
}

/**
 * GET /api/v1/telegram/events/recent
 * Get latest categorized events
 */
router.get('/events/recent', ...readAuth, async (req, res) => {
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
                ne.countries,
                ne.market_impact_level,
                ne.event_urgency,
                ne.event_type,
                pm.cleaned_text,
                pm.sentiment,
                COALESCE(tm.telegram_created_at, pm.created_at) as telegram_created_at,
                tc.title as channel_title,
                COUNT(ai.id) as affected_agents_count
            FROM telegram_news_events ne
            INNER JOIN processed_telegram_messages pm ON ne.processed_message_id = pm.id
            LEFT JOIN telegram_messages tm ON tm.id = pm.raw_message_id
            INNER JOIN telegram_channels tc ON pm.channel_id = tc.id
            LEFT JOIN telegram_agent_impacts ai ON pm.id = ai.processed_message_id
            WHERE ${whereConditions.join(' AND ')}
            GROUP BY ne.id, pm.id, tm.telegram_created_at, tc.title
            ORDER BY COALESCE(tm.telegram_created_at, pm.created_at) DESC
            LIMIT $${paramIndex}
        `;

        params.push(Math.min(parseInt(limit), 1000));

        const result = await query(sql, params);

        // Ensure regions for Geographic Heat Map: use DB regions if set, else derive from countries, else category fallback
        const categoryRegionFallback = {
            GEOPOLITICAL: ['MIDDLE_EAST'],
            PRECIOUS_METALS: ['MIDDLE_EAST'],
            CRYPTO_BLOCKCHAIN: ['ASIA'],
            FOREX_CURRENCY: ['EUROPE'],
            MARKET_DATA: ['NORTH_AMERICA'],
            GENERAL: ['EUROPE']
        };
        const data = result.rows.map(row => {
            let regions = row.regions && Array.isArray(row.regions) && row.regions.length > 0
                ? row.regions
                : countriesToRegions(row.countries || []);
            if (regions.length === 0 && row.primary_category) {
                regions = categoryRegionFallback[row.primary_category] || [];
            }
            return { ...row, regions };
        });

        return res.json({
            success: true,
            count: data.length,
            timeRange: parseInt(timeRange),
            data
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
router.get('/categories/summary', ...readAuth, async (req, res) => {
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
                MAX(pm.created_at) as latest_message_at
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
router.get('/categories/:category/timeline', ...readAuth, async (req, res) => {
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
                date_trunc('${interval}', pm.created_at) as time_bucket,
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
router.get('/stats/real-time', ...readAuth, async (req, res) => {
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
