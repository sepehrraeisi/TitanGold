/**
 * Quality scoring for normalized_data v1 records (DH-NORMALIZATION-P0-WORKER-1).
 * Score 0–100 from content, title, source reputation, entities, tags, completeness.
 */

import { NORMALIZED_DATA_VERSION } from './normalizers/normalizedDataContract.js';

/** @typedef {'excellent'|'good'|'acceptable'|'weak'|'poor'} QualityBand */

/**
 * @param {number} score
 * @returns {QualityBand}
 */
export function qualityBandFromScore(score) {
    if (score >= 90) return 'excellent';
    if (score >= 75) return 'good';
    if (score >= 50) return 'acceptable';
    if (score >= 25) return 'weak';
    return 'poor';
}

/**
 * @param {object} normalized - v1 normalized_data
 * @param {object} [sourceContext] - data_sources row fields
 * @returns {{ score: number, band: QualityBand, factors: Record<string, number> }}
 */
export function scoreNormalizedRecord(normalized, sourceContext = {}) {
    const factors = {};

    const content = String(normalized?.content || '').trim();
    const title = String(normalized?.title || '').trim();

    factors.contentLength = Math.min(20, Math.floor(content.length / 50));

    if (title.length >= 20) factors.titleQuality = 15;
    else if (title.length >= 10) factors.titleQuality = 12;
    else if (title.length >= 3) factors.titleQuality = 8;
    else factors.titleQuality = 2;

    let reputation = 40;
    if (sourceContext.is_active) reputation += 20;
    const lastStatus = String(sourceContext.last_status || '').toLowerCase();
    if (lastStatus === 'success' || lastStatus === 'active') reputation += 15;
    else if (lastStatus === 'error') reputation -= 15;
    const priority = Number(sourceContext.priority);
    if (Number.isFinite(priority)) reputation += Math.min(15, priority * 1.5);
    factors.sourceReputation = Math.max(0, Math.min(25, reputation - 40));

    const entities = normalized?.entities && typeof normalized.entities === 'object'
        ? normalized.entities
        : {};
    const entityGroups = Object.keys(entities).filter(
        (k) => entities[k] != null && (typeof entities[k] !== 'object' || Object.keys(entities[k]).length > 0),
    );
    factors.entityExtraction = Math.min(15, entityGroups.length * 5);

    const tags = Array.isArray(normalized?.tags) ? normalized.tags : [];
    factors.tagRichness = Math.min(15, tags.length * 3);

    let completeness = 0;
    if (normalized?.version === NORMALIZED_DATA_VERSION) completeness += 4;
    if (normalized?.summary) completeness += 3;
    if (normalized?.language) completeness += 3;
    if (normalized?.publishedAt) completeness += 2;
    if (normalized?.metadata?.normalizerVersion) completeness += 3;
    factors.normalizationCompleteness = Math.min(15, completeness);

    const score = Math.round(
        Object.values(factors).reduce((sum, v) => sum + v, 0),
    );

    const band = qualityBandFromScore(score);

    return { score: Math.min(100, Math.max(0, score)), band, factors };
}

/**
 * Merge quality fields into normalized_data.metadata (mutates copy).
 * @param {object} normalized
 * @param {{ score: number, band: QualityBand, factors: object }} quality
 * @param {string} workerVersion
 */
export function applyQualityToNormalized(normalized, quality, workerVersion) {
    const metadata = { ...(normalized.metadata || {}) };
    metadata.quality_score = quality.score;
    metadata.quality_band = quality.band;
    metadata.quality_warning = quality.band === 'weak' || quality.band === 'poor';
    metadata.quality_factors = quality.factors;
    metadata.quality_scored_at = new Date().toISOString();
    metadata.quality_worker_version = workerVersion;
    return { ...normalized, metadata };
}
