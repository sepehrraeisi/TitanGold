/**
 * Optimized agent feed loader (P7).
 * Limits on telegram_agent_impacts first, then joins minimal message fields.
 */
import { query } from '../database/db.js';

export const VALID_AGENT_KEYS = [
    'technical',
    'risk',
    'sentiment',
    'pattern',
    'price_prediction',
    'arbitrage',
    'portfolio',
    'liquidity',
    'trend',
    'optimization',
    'order',
    'fundamental',
    'market_intelligence',
    'volume',
    'timing',
];

const FEED_SELECT = `
    pm.id,
    tm.message_id,
    COALESCE(tc.title, tc.username, pm.channel_id::text) AS channel_title,
    LEFT(pm.cleaned_text, 500) AS cleaned_text,
    pm.sentiment,
    pm.importance_level,
    COALESCE(tm.telegram_created_at, pm.created_at) AS telegram_created_at,
    ai.impact_score,
    ai.impact_type,
    ai.confidence,
    ai.relevance_reasons,
    ai.requires_action,
    ai.action_type,
    ai.priority_level,
    ai.created_at AS processed_at
`;

/**
 * @param {object} opts
 * @param {string} opts.agentKey
 * @param {number} opts.hours
 * @param {number} opts.limit
 * @param {number} opts.offset
 * @param {number} opts.minImpact
 * @param {boolean|null|undefined} opts.requiresAction
 * @param {string|null|undefined} opts.priority
 */
export function buildAgentFeedSql(opts) {
    const { agentKey, hours, limit, offset, minImpact, requiresAction, priority } = opts;

    const innerParams = [agentKey, hours, minImpact];
    let innerFilters = '';

    if (requiresAction === true || requiresAction === false) {
        innerParams.push(requiresAction);
        innerFilters += ` AND ai.requires_action = $${innerParams.length}`;
    }

    if (priority) {
        innerParams.push(priority);
        innerFilters += ` AND ai.priority_level = $${innerParams.length}`;
    }

    innerParams.push(limit, offset);
    const limitIdx = innerParams.length - 1;
    const offsetIdx = innerParams.length;

    const sql = `
        SELECT ${FEED_SELECT.trim()}
        FROM (
            SELECT
                ai.processed_message_id,
                ai.impact_score,
                ai.impact_type,
                ai.confidence,
                ai.relevance_reasons,
                ai.requires_action,
                ai.action_type,
                ai.priority_level,
                ai.created_at
            FROM telegram_agent_impacts ai
            WHERE ai.agent_key = $1
              AND ai.created_at >= NOW() - INTERVAL '1 hour' * $2
              AND ai.impact_score >= $3
              ${innerFilters}
            ORDER BY ai.created_at DESC, ai.impact_score DESC
            LIMIT $${limitIdx} OFFSET $${offsetIdx}
        ) ai
        INNER JOIN processed_telegram_messages pm ON pm.id = ai.processed_message_id
        LEFT JOIN telegram_messages tm ON tm.id = pm.raw_message_id
        LEFT JOIN telegram_channels tc ON pm.channel_id = tc.id
        ORDER BY ai.created_at DESC, ai.impact_score DESC
    `;

    return { sql, params: innerParams };
}

/**
 * @param {object} opts
 * @returns {Promise<{ data: object[], hasMore: boolean, nextCursor: number|null }>}
 */
export async function loadAgentFeed(opts) {
    const { sql, params } = buildAgentFeedSql(opts);
    const result = await query(sql, params);
    const limit = opts.limit;
    const offset = opts.offset;
    const hasMore = result.rows.length === limit;
    return {
        data: result.rows,
        hasMore,
        nextCursor: hasMore ? offset + limit : null,
    };
}
