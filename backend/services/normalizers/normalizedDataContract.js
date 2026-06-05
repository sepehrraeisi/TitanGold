/**
 * Canonical NormalizedData contract (datahub.normalized.v1).
 * DH-NORMALIZATION-P0-CONTRACT-1 — shared by normalizer, validator, snapshot read model.
 */

export const NORMALIZED_DATA_VERSION = 'datahub.normalized.v1';
export const NORMALIZER_CONTRACT_VERSION = 'dh-norm-contract-1';

/** @typedef {'telegram'|'rss'|'api'|'webhook'|'crawler'|'unknown'} SourceType */

export const SOURCE_TYPES = Object.freeze([
    'telegram',
    'rss',
    'api',
    'webhook',
    'crawler',
    'unknown',
]);

/**
 * @param {unknown} value
 * @param {string|null} [fallback]
 * @returns {string|null}
 */
export function toIsoTimestamp(value, fallback = null) {
    if (value == null || value === '') return fallback;
    const d = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(d.getTime())) return fallback;
    return d.toISOString();
}

/**
 * @param {unknown} text
 * @param {number} maxLen
 * @returns {string}
 */
export function truncateText(text, maxLen) {
    if (text == null) return '';
    const s = String(text).replace(/\u0000/g, '');
    if (s.length <= maxLen) return s;
    return [...s].slice(0, maxLen).join('');
}

/**
 * @param {string} sourceType
 * @returns {SourceType}
 */
export function normalizeSourceType(sourceType) {
    const raw = String(sourceType || 'unknown').toLowerCase();
    if (SOURCE_TYPES.includes(raw)) return /** @type {SourceType} */ (raw);
    if (raw === 'web') return 'crawler';
    return 'unknown';
}

/**
 * Map stored normalized_data (v1 or legacy) → display/read shape without DB mutation.
 * @param {object|null|undefined} normalized
 * @returns {object|null}
 */
export function coerceReadModel(normalized) {
    if (normalized == null || typeof normalized !== 'object') return null;

    const meta =
        normalized.metadata && typeof normalized.metadata === 'object'
            ? normalized.metadata
            : {};

    const sourceType = normalizeSourceType(
        normalized.sourceType ||
            normalized.source_type ||
            meta.sourceType ||
            meta.source_type,
    );

    const timestamp =
        toIsoTimestamp(normalized.timestamp, null) ||
        toIsoTimestamp(normalized.publishedAt, null) ||
        toIsoTimestamp(meta.normalizedAt, null);

    const publishedAt =
        toIsoTimestamp(normalized.publishedAt, null) ||
        toIsoTimestamp(normalized.timestamp, null);

    const title =
        typeof normalized.title === 'string'
            ? normalized.title
            : typeof normalized.content === 'string'
              ? truncateText(normalized.content, 120)
              : '';

    const content =
        typeof normalized.content === 'string'
            ? normalized.content
            : typeof normalized.body === 'string'
              ? normalized.body
              : '';

    const tags = Array.isArray(normalized.tags)
        ? normalized.tags
        : Array.isArray(meta.tags)
          ? meta.tags
          : [];

    const entities =
        normalized.entities && typeof normalized.entities === 'object'
            ? normalized.entities
            : {};

    const signals = Array.isArray(normalized.signals)
        ? normalized.signals
        : meta.extracted_signals != null
          ? [meta.extracted_signals]
          : [];

    return {
        version: normalized.version || null,
        title,
        content,
        summary: normalized.summary ?? null,
        sourceType,
        sourceId: normalized.sourceId ?? normalized.source_id ?? null,
        sourceName: normalized.sourceName ?? normalized.source_name ?? null,
        category: normalized.category ?? meta.category ?? 'uncategorized',
        language: normalized.language ?? meta.language ?? null,
        timestamp,
        publishedAt,
        entities,
        signals,
        tags,
        url: normalized.url ?? null,
        sentiment: normalized.sentiment ?? meta.sentiment ?? null,
        metadata: meta,
        /** Legacy aliases for downstream routers */
        source_type: sourceType,
        publishedAtLegacy: publishedAt,
    };
}

/**
 * Build canonical v1 envelope with legacy compatibility fields.
 * @param {object} fields
 * @param {object} [legacyExtras]
 */
export function buildNormalizedV1(fields, legacyExtras = {}) {
    const now = new Date().toISOString();
    const sourceType = normalizeSourceType(fields.sourceType);
    const timestamp = toIsoTimestamp(fields.timestamp, now);
    const publishedAt =
        fields.publishedAt != null ? toIsoTimestamp(fields.publishedAt, timestamp) : timestamp;

    const metadata = {
        rawStatus: fields.rawStatus ?? null,
        ingestionMode: fields.ingestionMode ?? 'unknown',
        telegramMessageId: fields.telegramMessageId ?? null,
        telegramChannelId: fields.telegramChannelId ?? null,
        telegramChannelUsername: fields.telegramChannelUsername ?? null,
        normalizedAt: now,
        normalizerVersion: NORMALIZER_CONTRACT_VERSION,
        ...(fields.metadataExtra || {}),
    };

    return {
        version: NORMALIZED_DATA_VERSION,
        title: fields.title ?? '',
        content: fields.content ?? '',
        summary: fields.summary ?? null,
        sourceType,
        sourceId: fields.sourceId ?? null,
        sourceName: fields.sourceName ?? null,
        category: fields.category ?? 'uncategorized',
        language: fields.language ?? null,
        timestamp,
        publishedAt,
        entities: fields.entities ?? {},
        signals: fields.signals ?? [],
        tags: fields.tags ?? [],
        metadata,
        /** Legacy aliases — do not remove until routers/UI migrate */
        source_type: sourceType,
        url: fields.url,
        sentiment: fields.sentiment,
        channel: fields.channel,
        ...legacyExtras,
    };
}
