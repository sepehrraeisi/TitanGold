import { query } from '../database/db.js';

async function loadPipelineStatsRow() {
    const stats = await query('SELECT * FROM telegram_pipeline_stats LIMIT 1');
    return stats.rows[0] || {};
}

export async function loadSystemStatsForRange(hours) {
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
        const lastProcessed = await query(`
            SELECT MAX(created_at) AS last_processed_at
            FROM processed_telegram_messages
            WHERE created_at >= NOW() - INTERVAL '1 hour' * $1
        `, [hours]);
        const row = impactStats.rows[0] || {};
        const lastAt = lastProcessed.rows[0]?.last_processed_at;
        return {
            total_processed_messages: String(pipeline.processed_count ?? pipeline.total_messages ?? '0'),
            total_agent_impacts: row.total_agent_impacts ?? '0',
            active_channels: String(pipeline.channels_with_data ?? '0'),
            avg_impact_score: row.avg_impact_score ?? '0',
            total_actions_required: row.total_actions_required ?? '0',
            last_processed_at: lastAt ? new Date(lastAt).toISOString() : null,
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
    const row = statsResult.rows[0] || {};
    return {
        ...row,
        last_processed_at: row.last_processed_at ? new Date(row.last_processed_at).toISOString() : null,
    };
}
