/**
 * DataHub ingestion vs source-published timestamp semantics (DH-PIPELINE-P0-INGESTED-AT-1).
 *
 * collected_at = DataHub ingestion time (transfer/fetch/crawl insert time).
 * publishedAt / metadata.telegram_created_at / metadata.source_published_at = source item time.
 */

/** SQL expression for effective ingestion time (legacy rows used message date as collected_at). */
export const INGESTED_AT_SQL = `COALESCE((metadata->>'transferred_at')::timestamptz, collected_at)`;

/** Same as INGESTED_AT_SQL with table alias prefix, e.g. `cd`. */
export function ingestedAtSql(alias = '') {
    const prefix = alias ? `${alias}.` : '';
    return `COALESCE((${prefix}metadata->>'transferred_at')::timestamptz, ${prefix}collected_at)`;
}

/** Timestamp to persist on new collected_data rows at insert time. */
export function getIngestionTimestampForInsert() {
    return new Date();
}

function parseJsonField(value) {
    if (value == null) return null;
    if (typeof value === 'string') {
        try {
            return JSON.parse(value);
        } catch {
            return null;
        }
    }
    return typeof value === 'object' ? value : null;
}

function toDate(value) {
    if (value == null) return null;
    const d = value instanceof Date ? value : new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Resolve DataHub ingestion time for a collected_data row (read model / metrics).
 * Prefers metadata.transferred_at when collected_at predates transfer (legacy Telegram rows).
 */
export function resolveIngestedAt(row) {
    const metadata = parseJsonField(row?.metadata) || row?.metadata || {};
    const collectedAt = toDate(row?.collected_at);
    const transferredAt = toDate(metadata.transferred_at);

    if (transferredAt && collectedAt && collectedAt.getTime() < transferredAt.getTime()) {
        return transferredAt;
    }
    if (collectedAt) return collectedAt;
    if (transferredAt) return transferredAt;
    return null;
}

/**
 * Resolve original source publication time (Telegram message, RSS item, API item).
 */
export function resolvePublishedAt(row) {
    const normalized = parseJsonField(row?.normalized_data) || row?.normalized_data || {};
    const raw = parseJsonField(row?.raw_data) || row?.raw_data || {};
    const metadata = parseJsonField(row?.metadata) || row?.metadata || {};

    return (
        toDate(normalized.publishedAt) ||
        toDate(raw.telegram_created_at) ||
        toDate(metadata.telegram_created_at) ||
        toDate(metadata.source_published_at) ||
        toDate(normalized.metadata?.published_at) ||
        toDate(raw.published_at) ||
        null
    );
}

/** ISO strings for API read models. */
export function resolveIngestedAtIso(row) {
    const d = resolveIngestedAt(row);
    return d ? d.toISOString() : undefined;
}

export function resolvePublishedAtIso(row) {
    const d = resolvePublishedAt(row);
    return d ? d.toISOString() : undefined;
}
