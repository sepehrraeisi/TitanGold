import { normalizeTitleKey } from './discoverySafety.js';

const DUPLICATE_CONFIDENCE_THRESHOLD = 75;

function titleSimilarity(a, b) {
    if (!a || !b) return 0;
    if (a === b) return 100;
    const wa = new Set(a.split(/\s+/).filter(Boolean));
    const wb = new Set(b.split(/\s+/).filter(Boolean));
    if (!wa.size || !wb.size) return 0;
    let inter = 0;
    for (const w of wa) {
        if (wb.has(w)) inter += 1;
    }
    const union = wa.size + wb.size - inter;
    return union ? Math.round((inter / union) * 100) : 0;
}

/**
 * Three-layer duplicate detection.
 * @returns {{ isDuplicate: boolean, confidence: number, reason?: string, duplicateOfSourceId?, duplicateOfSuggestionId? }}
 */
export function checkDuplicateLayers(candidate, { sources = [], suggestions = [] }) {
    const { hostKey, pathKey, titleKey, suggestedType } = candidate;

    for (const src of sources) {
        if (!src.host_key && !src.url) continue;
        const srcHost = src.host_key || '';
        if (srcHost === hostKey) {
            if (src.path_key === pathKey || pathKey === '/' || src.path_key === '/') {
                return {
                    isDuplicate: true,
                    confidence: 95,
                    reason: 'hostname_and_path_match_existing_source',
                    duplicateOfSourceId: src.id,
                };
            }
            return {
                isDuplicate: true,
                confidence: 82,
                reason: 'hostname_match_existing_source',
                duplicateOfSourceId: src.id,
            };
        }
    }

    for (const sug of suggestions) {
        if (sug.status !== 'pending' && sug.status !== 'approved') continue;
        if (sug.host_key === hostKey && sug.path_key === pathKey && sug.suggested_type === suggestedType) {
            return {
                isDuplicate: true,
                confidence: 98,
                reason: 'hostname_path_match_existing_suggestion',
                duplicateOfSuggestionId: sug.id,
            };
        }
        if (sug.host_key === hostKey && sug.suggested_type === suggestedType) {
            return {
                isDuplicate: true,
                confidence: 80,
                reason: 'hostname_match_existing_suggestion',
                duplicateOfSuggestionId: sug.id,
            };
        }
    }

    if (titleKey) {
        for (const src of sources) {
            const srcTitle = normalizeTitleKey(src.name);
            const sim = titleSimilarity(titleKey, srcTitle);
            if (sim >= 85) {
                return {
                    isDuplicate: true,
                    confidence: sim,
                    reason: 'title_similarity_existing_source',
                    duplicateOfSourceId: src.id,
                };
            }
        }
        for (const sug of suggestions) {
            if (!sug.title_key) continue;
            const sim = titleSimilarity(titleKey, sug.title_key);
            if (sim >= 85) {
                return {
                    isDuplicate: true,
                    confidence: sim,
                    reason: 'title_similarity_existing_suggestion',
                    duplicateOfSuggestionId: sug.id,
                };
            }
        }
    }

    return { isDuplicate: false, confidence: 0 };
}

export function shouldSkipAsDuplicate(dupResult) {
    return dupResult.isDuplicate && dupResult.confidence >= DUPLICATE_CONFIDENCE_THRESHOLD;
}

export { DUPLICATE_CONFIDENCE_THRESHOLD };
