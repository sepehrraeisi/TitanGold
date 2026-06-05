/**
 * Phase 1 category taxonomy — normalize source.category against data_categories registry.
 * Never auto-creates categories.
 */

export const UNCATEGORIZED = 'uncategorized';

/** Normalize for comparison: trim, lowercase, collapse whitespace. */
export function normalizeCategoryKey(raw) {
    if (raw == null) return '';
    return String(raw).trim().toLowerCase().replace(/\s+/g, ' ');
}

/** Build map: normalized key → canonical registry name. */
export function buildApprovedCategoryLookup(categoryNames) {
    const lookup = new Map();
    for (const name of categoryNames) {
        if (!name) continue;
        lookup.set(normalizeCategoryKey(name), String(name));
    }
    return lookup;
}

/**
 * Resolve raw category to a canonical registry name or uncategorized.
 * @param {unknown} raw
 * @param {Map<string, string>} approvedLookup from buildApprovedCategoryLookup
 */
export function normalizeCategoryName(raw, approvedLookup) {
    const key = normalizeCategoryKey(raw);
    if (!key) return UNCATEGORIZED;
    if (approvedLookup.has(key)) return approvedLookup.get(key);
    return UNCATEGORIZED;
}

/** True when stored value is a non-empty string not in the approved registry. */
export function categoryNeedsReview(raw, approvedLookup) {
    const key = normalizeCategoryKey(raw);
    if (!key) return false;
    return !approvedLookup.has(key);
}

/** Load approved category names from DB. */
export async function loadApprovedCategoryNames(queryFn) {
    const result = await queryFn('SELECT name FROM data_categories ORDER BY name');
    return result.rows.map((row) => row.name);
}

/** Load lookup map from DB. */
export async function loadApprovedCategoryLookup(queryFn) {
    const names = await loadApprovedCategoryNames(queryFn);
    return buildApprovedCategoryLookup(names);
}

/**
 * Resolve category for persistence (writes). Logs when raw is coerced to uncategorized.
 * @param {unknown} raw
 * @param {Function} queryFn
 * @param {{ log?: { warn: Function } }} [options]
 */
export async function resolveCategoryForWrite(raw, queryFn, options = {}) {
    const lookup = await loadApprovedCategoryLookup(queryFn);
    const canonical = normalizeCategoryName(raw, lookup);
    const rawKey = normalizeCategoryKey(raw);
    if (rawKey && canonical === UNCATEGORIZED && !lookup.has(rawKey)) {
        options.log?.warn?.(
            `Category "${String(raw).trim()}" not in registry; stored as ${UNCATEGORIZED}`,
        );
    }
    return canonical;
}

/** Enrich a source row for list API (read-time effective category). */
export function enrichSourceCategoryFields(source, approvedLookup) {
    const effective_category = normalizeCategoryName(source.category, approvedLookup);
    const needs_review = categoryNeedsReview(source.category, approvedLookup);
    return {
        ...source,
        effective_category,
        category_needs_review: needs_review,
    };
}
