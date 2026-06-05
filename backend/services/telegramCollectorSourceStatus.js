import { query } from '../database/db.js';

/** Parse config JSON from a data_sources row. */
export function parseSourceConfig(source) {
    let config = source?.config;
    if (typeof config === 'string') {
        try {
            config = JSON.parse(config);
        } catch {
            config = {};
        }
    }
    return config || {};
}

/** True when decrypted/parsed credentials or config include a bot token. */
export function hasTelegramBotToken(source, config = null) {
    const cfg = config || parseSourceConfig(source);
    const creds = source?.credentials;
    if (creds && typeof creds === 'object' && creds.botToken) return true;
    if (cfg.botToken) return true;
    return false;
}

/** Channel identifiers from source config (collector-linked shape). */
export function telegramChannelKeys(source, config = null) {
    const cfg = config || parseSourceConfig(source);
    const channelId = cfg.channelId != null ? String(cfg.channelId) : null;
    const channelUsername = cfg.channelUsername
        ? String(cfg.channelUsername).replace(/^@/, '')
        : null;
    return { channelId, channelUsername };
}

/**
 * Batch-resolve collector ingestion context for telegram sources on the current list page.
 * @param {Array<Record<string, unknown>>} sources
 * @returns {Promise<Map<string, object>>} source id → enrichment
 */
export async function batchTelegramCollectorEnrichment(sources) {
    const telegramRows = sources.filter((s) => s.type === 'telegram');
    const map = new Map();
    if (telegramRows.length === 0) return map;

    const ids = telegramRows.map((s) => s.id);

    const [collectorRows, collectedRows, messageRows] = await Promise.all([
        query(
            `SELECT ds.id AS source_id,
                    tc.id AS collector_id,
                    tc.is_active AS collector_active,
                    tc.channel_id::text AS channel_id
             FROM data_sources ds
             LEFT JOIN telegram_channels tc ON (
                 (ds.config->>'channelId' IS NOT NULL AND tc.channel_id::text = ds.config->>'channelId')
                 OR (
                     ds.config->>'channelUsername' IS NOT NULL
                     AND LOWER(REPLACE(COALESCE(tc.username, ''), '@', ''))
                         = LOWER(REPLACE(ds.config->>'channelUsername', '@', ''))
                 )
             )
             WHERE ds.id = ANY($1::uuid[])
             ORDER BY ds.id, tc.is_active DESC NULLS LAST, tc.updated_at DESC NULLS LAST`,
            [ids],
        ),
        query(
            `SELECT source_id, COUNT(*)::int AS collected_count,
                    MAX(collected_at) AS latest_collected_at
             FROM collected_data
             WHERE source_id = ANY($1::uuid[])
             GROUP BY source_id`,
            [ids],
        ),
        query(
            `SELECT ds.id AS source_id,
                    COUNT(tm.id)::int AS message_count,
                    MAX(tm.created_at) AS latest_message_at
             FROM data_sources ds
             JOIN telegram_channels tc ON (
                 (ds.config->>'channelId' IS NOT NULL AND tc.channel_id::text = ds.config->>'channelId')
                 OR (
                     ds.config->>'channelUsername' IS NOT NULL
                     AND LOWER(REPLACE(COALESCE(tc.username, ''), '@', ''))
                         = LOWER(REPLACE(ds.config->>'channelUsername', '@', ''))
                 )
             )
             LEFT JOIN telegram_messages tm ON tm.channel_id = tc.id
             WHERE ds.id = ANY($1::uuid[])
             GROUP BY ds.id`,
            [ids],
        ),
    ]);

    const collectorBySource = new Map();
    for (const row of collectorRows.rows) {
        if (!collectorBySource.has(row.source_id)) {
            collectorBySource.set(row.source_id, row);
        }
    }

    const collectedBySource = new Map(collectedRows.rows.map((r) => [r.source_id, r]));
    const messagesBySource = new Map(messageRows.rows.map((r) => [r.source_id, r]));

    for (const source of telegramRows) {
        const config = parseSourceConfig(source);
        const { channelId, channelUsername } = telegramChannelKeys(source, config);
        const botMode = hasTelegramBotToken(source, config);
        const collector = collectorBySource.get(source.id);
        const collected = collectedBySource.get(source.id);
        const messages = messagesBySource.get(source.id);

        const collectedCount = Number(collected?.collected_count || 0);
        const messageCount = Number(messages?.message_count || 0);
        const collectorActive = Boolean(collector?.collector_active);
        const hasChannelConfig = Boolean(channelId || channelUsername);

        map.set(source.id, {
            ingestion_mode: botMode ? 'bot' : hasChannelConfig && collector ? 'collector' : null,
            collector_registered: Boolean(collector?.collector_id),
            collector_active: collectorActive,
            collected_count: collectedCount,
            message_count: messageCount,
            latest_collected_at: collected?.latest_collected_at || null,
            latest_message_at: messages?.latest_message_at || null,
        });
    }

    return map;
}

/**
 * UI operational status for collector-mode telegram (no bot token).
 * Returns null when bot-pull semantics should apply (use last_status).
 */
export function resolveCollectorOperationalStatus(source, enrichment) {
    if (source.type !== 'telegram') return null;
    const config = parseSourceConfig(source);
    if (hasTelegramBotToken(source, config)) return null;

    const { channelId, channelUsername } = telegramChannelKeys(source, config);
    if (!channelId && !channelUsername) return 'error';

    if (!enrichment?.collector_registered || !enrichment.collector_active) {
        return 'error';
    }

    if (enrichment.collected_count > 0) {
        return 'active';
    }

    if (enrichment.message_count > 0) {
        return 'pending';
    }

    return 'linked';
}

/**
 * Map collector operational_status to pipeline Source Quality Board lastStatus.
 * Keeps RSS/API/bot-pull on fetch-scheduler semantics when this returns null.
 */
export function mapCollectorOperationalToPipelineStatus(operationalStatus) {
    switch (operationalStatus) {
        case 'active':
            return 'success';
        case 'pending':
            return 'cached';
        case 'linked':
            return 'cached';
        case 'error':
            return 'failed';
        default:
            return null;
    }
}

/**
 * Attach list-safe enrichment fields for the Data Sources API.
 */
export function applyTelegramListEnrichment(source, enrichment) {
    if (source.type !== 'telegram' || !enrichment) {
        return source;
    }

    const config = parseSourceConfig(source);
    const botMode = hasTelegramBotToken(source, config);
    const operationalStatus = resolveCollectorOperationalStatus(source, enrichment);
    const collectorMode = !botMode && enrichment.ingestion_mode === 'collector';

    const out = {
        ...source,
        telegram_ingestion_mode: botMode ? 'bot' : collectorMode ? 'collector' : null,
    };

    if (operationalStatus) {
        out.operational_status = operationalStatus;
        if (collectorMode && String(source.last_status || '').toLowerCase() === 'error') {
            out.suppress_last_error = true;
        }
        if (collectorMode) {
            out.success_rate_display = 'na';
        }
        if (enrichment.latest_message_at) {
            out.collector_last_activity_at = new Date(enrichment.latest_message_at).toISOString();
        } else if (enrichment.latest_collected_at) {
            out.collector_last_activity_at = new Date(enrichment.latest_collected_at).toISOString();
        }
    }

    return out;
}
