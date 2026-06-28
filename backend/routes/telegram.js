import express from 'express';
import { query } from '../database/db.js';
import { logger } from '../services/logger.js';
import { authenticate } from '../middleware/auth.js';
import { telegramReadAuth } from '../middleware/telegramAuth.js';
import { readRateLimiter, writeRateLimiter } from '../middleware/rateLimiter.js';
import {
    getTelegramAnalyticsCached,
    TELEGRAM_CACHE_TTL,
} from '../services/telegramAnalyticsCache.js';

const router = express.Router();
const readAuth = [telegramReadAuth, readRateLimiter];

function parseHours(value, fallback = 24) {
    return Math.min(720, Math.max(1, parseInt(value, 10) || fallback));
}

function parseLimit(value, fallback, max) {
    return Math.min(max, Math.max(1, parseInt(value, 10) || fallback));
}

async function loadPipelineStatsRow() {
    const stats = await query('SELECT * FROM telegram_pipeline_stats LIMIT 1');
    return stats.rows[0] || {};
}

async function loadSystemStatsForRange(hours) {
    if (hours === 24) {
        const pipeline = await loadPipelineStatsRow();
        const impactStats = await query(`
            SELECT
                COUNT(*)::text AS total_agent_impacts,
                COALESCE(AVG(impact_score), 0)::text AS avg_impact_score,
                COUNT(*) FILTER (WHERE requires_action = true)::text AS total_actions_required
            FROM telegram_agent_impacts
            WHERE created_at >= NOW() - INTERVAL '1 hour' * $1
        `, [hours]);
        const row = impactStats.rows[0] || {};
        return {
            total_processed_messages: String(pipeline.processed_count ?? pipeline.total_messages ?? '0'),
            total_agent_impacts: row.total_agent_impacts ?? '0',
            active_channels: String(pipeline.channels_with_data ?? '0'),
            avg_impact_score: row.avg_impact_score ?? '0',
            total_actions_required: row.total_actions_required ?? '0',
            last_processed_at: null,
        };
    }

    const statsResult = await query(`
        SELECT
            (SELECT COUNT(*)::text FROM processed_telegram_messages WHERE created_at >= NOW() - INTERVAL '1 hour' * $1) AS total_processed_messages,
            (SELECT COUNT(*)::text FROM telegram_agent_impacts WHERE created_at >= NOW() - INTERVAL '1 hour' * $1) AS total_agent_impacts,
            (SELECT COUNT(DISTINCT channel_id)::text FROM processed_telegram_messages WHERE created_at >= NOW() - INTERVAL '1 hour' * $1) AS active_channels,
            (SELECT COALESCE(AVG(impact_score), 0)::text FROM telegram_agent_impacts WHERE created_at >= NOW() - INTERVAL '1 hour' * $1) AS avg_impact_score,
            (SELECT COUNT(*)::text FROM telegram_agent_impacts WHERE created_at >= NOW() - INTERVAL '1 hour' * $1 AND requires_action = true) AS total_actions_required,
            (SELECT MAX(created_at) FROM processed_telegram_messages WHERE created_at >= NOW() - INTERVAL '1 hour' * $1) AS last_processed_at
    `, [hours]);
    return statsResult.rows[0];
}

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
        const payload = await getTelegramAnalyticsCached(
            'health',
            {},
            async () => {
                const pipeline = await loadPipelineStatsRow();
                return {
                    success: true,
                    status: 'healthy',
                    timestamp: new Date().toISOString(),
                    database: {
                        connected: true,
                        totalMessages: parseInt(pipeline.total_messages ?? '0', 10),
                    },
                    pipeline,
                };
            },
            TELEGRAM_CACHE_TTL.health,
        );
        return res.json(payload);
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
        const hours = parseHours(req.query.timeRange, 24);
        const payload = await getTelegramAnalyticsCached(
            'agents/summary',
            { timeRange: hours },
            async () => {
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
                        ARRAY[]::text[] AS top_event_categories,
                        ARRAY[]::text[] AS top_news_categories
                    FROM telegram_agent_impacts ai
                    WHERE ai.created_at >= NOW() - INTERVAL '1 hour' * $1
                    GROUP BY ai.agent_key, ai.agent_name
                    ORDER BY COUNT(*) DESC
                    LIMIT 15
                `;
                const agentsResult = await query(agentsSql, [hours]);
                const systemStats = await loadSystemStatsForRange(hours);
                return {
                    success: true,
                    timeRange: hours,
                    agents: agentsResult.rows,
                    systemStats,
                };
            },
            TELEGRAM_CACHE_TTL.agentsSummary,
        );
        return res.json(payload);

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
        const parsedLimit = parseLimit(limit, 20, 100);
        const cacheParams = {
            limit: parsedLimit,
            minImpact,
            categories: categories || '',
            severity: severity || '',
        };

        const payload = await getTelegramAnalyticsCached(
            'breaking-news',
            cacheParams,
            async () => {
                let whereConditions = [
                    `ne.market_impact_level IS NOT NULL`,
                    `pm.importance_level IN ('high', 'critical')`,
                    `pm.created_at >= NOW() - INTERVAL '6 hours'`
                ];
                let params = [];
                let paramIndex = 1;

                if (categories) {
                    const categoryList = categories.split(',').map(c => c.trim());
                    whereConditions.push(`ne.primary_category = ANY($${paramIndex})`);
                    params.push(categoryList);
                    paramIndex++;
                }

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
                        (SELECT COUNT(DISTINCT agent_key) 
                         FROM telegram_agent_impacts ai 
                         WHERE ai.processed_message_id = pm.id AND ai.impact_score >= ${parseFloat(minImpact)}) as affected_agents_count,
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

                params.push(parsedLimit);
                const result = await query(sql, params);
                return {
                    success: true,
                    count: result.rows.length,
                    minImpact: parseFloat(minImpact),
                    data: result.rows,
                    filters: {
                        categories: categories ? categories.split(',') : null,
                        severity
                    }
                };
            },
            TELEGRAM_CACHE_TTL.breakingNews,
        );

        return res.json(payload);

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
 * GET /api/v1/telegram/events/geographic-summary
 * Lightweight region aggregates for Geographic Map (no message bodies).
 */
router.get('/events/geographic-summary', ...readAuth, async (req, res) => {
    try {
        const hours = parseHours(req.query.timeRange, 168);
        const parsedLimit = parseLimit(req.query.limit, 200, 300);
        const categories = req.query.categories || '';

        const payload = await getTelegramAnalyticsCached(
            'events/geographic-summary',
            { timeRange: hours, limit: parsedLimit, categories },
            async () => {
                let whereConditions = [`ne.created_at >= NOW() - INTERVAL '1 hour' * $1`];
                const params = [hours];
                let paramIndex = 2;

                if (categories) {
                    whereConditions.push(`ne.primary_category = ANY($${paramIndex})`);
                    params.push(categories.split(',').map(c => c.trim()));
                    paramIndex++;
                }

                const sql = `
                    SELECT
                        ne.primary_category,
                        ne.regions,
                        ne.countries,
                        ne.market_impact_level
                    FROM telegram_news_events ne
                    WHERE ${whereConditions.join(' AND ')}
                    ORDER BY ne.created_at DESC
                    LIMIT $${paramIndex}
                `;
                params.push(parsedLimit);
                const result = await query(sql, params);

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

                return {
                    success: true,
                    count: data.length,
                    timeRange: hours,
                    data,
                };
            },
            TELEGRAM_CACHE_TTL.geographicSummary,
        );

        return res.json(payload);
    } catch (error) {
        logger.error('Error fetching geographic summary:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to fetch geographic summary',
            message: error.message
        });
    }
});

/**
 * GET /api/v1/telegram/events/recent
 * Get latest categorized events
 */
router.get('/events/recent', ...readAuth, async (req, res) => {
    try {
        const hours = parseHours(req.query.timeRange, 24);
        const parsedLimit = parseLimit(req.query.limit, 50, 250);
        const categories = req.query.categories || '';

        const payload = await getTelegramAnalyticsCached(
            'events/recent',
            { timeRange: hours, limit: parsedLimit, categories },
            async () => {
                let whereConditions = [`pm.created_at >= NOW() - INTERVAL '1 hour' * $1`];
                const params = [hours];
                let paramIndex = 2;

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
                        0 as affected_agents_count
                    FROM processed_telegram_messages pm
                    INNER JOIN telegram_news_events ne ON ne.processed_message_id = pm.id
                    LEFT JOIN telegram_messages tm ON tm.id = pm.raw_message_id
                    INNER JOIN telegram_channels tc ON pm.channel_id = tc.id
                    WHERE ${whereConditions.join(' AND ')}
                    ORDER BY pm.created_at DESC
                    LIMIT $${paramIndex}
                `;

                params.push(parsedLimit);
                const result = await query(sql, params);

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

                return {
                    success: true,
                    count: data.length,
                    timeRange: hours,
                    data
                };
            },
            TELEGRAM_CACHE_TTL.eventsRecent,
        );

        return res.json(payload);

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
        const hours = parseHours(req.query.timeRange, 24);
        const payload = await getTelegramAnalyticsCached(
            'categories/summary',
            { timeRange: hours },
            async () => {
                const sql = `
                    SELECT 
                        ne.primary_category,
                        COUNT(*) as message_count,
                        COUNT(CASE WHEN ne.market_impact_level = 'high' THEN 1 END) as high_impact_count,
                        COUNT(CASE WHEN ne.market_impact_level = 'medium' THEN 1 END) as medium_impact_count,
                        COUNT(CASE WHEN ne.market_impact_level = 'low' THEN 1 END) as low_impact_count,
                        COUNT(CASE WHEN ne.is_breaking = true THEN 1 END) as breaking_count,
                        AVG(ne.source_reliability) as avg_reliability,
                        0 as channel_count,
                        MAX(ne.created_at) as latest_message_at
                    FROM telegram_news_events ne
                    WHERE ne.created_at >= NOW() - INTERVAL '1 hour' * $1
                    GROUP BY ne.primary_category
                    ORDER BY message_count DESC
                `;

                const result = await query(sql, [hours]);

                const totalSql = `
                    SELECT 
                        COUNT(*) as total_messages,
                        COUNT(DISTINCT ne.primary_category) as total_channels
                    FROM telegram_news_events ne
                    WHERE ne.created_at >= NOW() - INTERVAL '1 hour' * $1
                `;

                const totalResult = await query(totalSql, [hours]);

                return {
                    success: true,
                    timeRange: hours,
                    categories: result.rows,
                    totals: {
                        total_messages: String(totalResult.rows[0]?.total_messages ?? 0),
                        total_channels: String(totalResult.rows[0]?.total_channels ?? 0),
                        total_agents_affected: '0',
                    }
                };
            },
            TELEGRAM_CACHE_TTL.categoriesSummary,
        );
        return res.json(payload);

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
                AVG(EXTRACT(EPOCH FROM (pm.created_at - COALESCE(tm.telegram_created_at, tm.created_at)))) * 1000 as avg_processing_delay_ms,
                COUNT(DISTINCT pm.channel_id) as channels_processed
            FROM processed_telegram_messages pm
            INNER JOIN telegram_messages tm ON pm.raw_message_id = tm.id
            WHERE pm.created_at >= NOW() - INTERVAL '1 hour'
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
