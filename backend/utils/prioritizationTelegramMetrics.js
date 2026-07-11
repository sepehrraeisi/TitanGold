/**
 * Batch Telegram operational metrics for Smart Prioritization (read-only).
 * DH-SMARTPRIORITY-P2 — uses collected_data + collector status; does not mutate pipeline.
 */
import { query } from '../database/db.js';
import {
    batchTelegramCollectorEnrichment,
    resolveCollectorOperationalStatus,
} from '../services/telegramCollectorSourceStatus.js';

/**
 * @param {Array<{ id: string, type?: string, config?: unknown }>} sources
 * @returns {Promise<Map<string, object>>}
 */
export async function batchTelegramPrioritizationMetrics(sources) {
    const telegramRows = sources.filter((s) => String(s.type || '').toLowerCase() === 'telegram');
    const map = new Map();
    if (telegramRows.length === 0) return map;

    const ids = telegramRows.map((s) => s.id);

    const [collectedRes, enrichmentMap] = await Promise.all([
        query(
            `SELECT source_id,
                    COUNT(*) FILTER (WHERE collected_at >= NOW() - INTERVAL '24 hours')::int AS total_24h,
                    COUNT(*) FILTER (
                        WHERE collected_at >= NOW() - INTERVAL '24 hours' AND status = 'processed'
                    )::int AS processed_24h,
                    COUNT(*) FILTER (
                        WHERE collected_at >= NOW() - INTERVAL '24 hours' AND status = 'error'
                    )::int AS error_24h,
                    COUNT(*) FILTER (
                        WHERE collected_at >= NOW() - INTERVAL '24 hours' AND status = 'pending'
                    )::int AS pending_24h,
                    MAX(COALESCE(processed_at, collected_at)) AS latest_at
             FROM collected_data
             WHERE source_id = ANY($1::uuid[])
             GROUP BY source_id`,
            [ids],
        ),
        batchTelegramCollectorEnrichment(telegramRows, { includeMessageStats: true }),
    ]);

    const collectedBySource = new Map(collectedRes.rows.map((r) => [String(r.source_id), r]));

    for (const source of telegramRows) {
        const sourceId = String(source.id);
        const collected = collectedBySource.get(sourceId);
        const enrichment = enrichmentMap.get(sourceId);
        const operationalStatus = resolveCollectorOperationalStatus(source, enrichment);

        map.set(sourceId, {
            total_24h: Number(collected?.total_24h || 0),
            processed_24h: Number(collected?.processed_24h || 0),
            error_24h: Number(collected?.error_24h || 0),
            pending_24h: Number(collected?.pending_24h || 0),
            latest_at: collected?.latest_at
                ? new Date(collected.latest_at).toISOString()
                : enrichment?.latest_collected_at
                  ? new Date(enrichment.latest_collected_at).toISOString()
                  : enrichment?.latest_message_at
                    ? new Date(enrichment.latest_message_at).toISOString()
                    : null,
            operational_status: operationalStatus,
            collector_active: Boolean(enrichment?.collector_active),
            collected_count: Number(enrichment?.collected_count || 0),
        });
    }

    return map;
}
/**
 * Batch Telegram operational metrics for Smart Prioritization (read-only).
 * DH-SMARTPRIORITY-P2 — uses collected_data + collector status; does not mutate pipeline.
 */
