import { normalizeTitleKey } from './discoverySafety.js';
import {
    normalizeTelegramChannelIdentity,
    normalizeUrlForDuplicateCheck,
} from './urlDuplicateNormalization.js';

const DUPLICATE_CONFIDENCE_THRESHOLD = 75;
const HOSTNAME_HINT_CONFIDENCE = 40;

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

function hostnameFromNormalizedUrl(normalizedUrl) {
    if (!normalizedUrl) return null;
    try {
        return new URL(normalizedUrl).hostname.toLowerCase();
    } catch {
        return null;
    }
}

function buildExactDuplicateResult(base) {
    return {
        isDuplicate: true,
        matchType: 'exact',
        weakHints: [],
        ...base,
    };
}

/**
 * Discovery duplicate detection — exact identity/URL only; hostname is weak hint never blocking.
 * @returns {{
 *   isDuplicate: boolean,
 *   confidence: number,
 *   matchType?: 'exact' | 'weak',
 *   reason?: string,
 *   duplicateOfSourceId?: string,
 *   duplicateOfSuggestionId?: string,
 *   matchedSourceName?: string,
 *   matchedSourceUrl?: string,
 *   weakHints: Array<Record<string, unknown>>,
 * }}
 */
export function checkDuplicateLayers(candidate, { sources = [], suggestions = [] }) {
    const { suggestedType, suggestedUrl, titleKey } = candidate;
    const weakHints = [];

    if (suggestedType === 'telegram') {
        const candidateIdentity = normalizeTelegramChannelIdentity(suggestedUrl);
        if (!candidateIdentity) {
            return { isDuplicate: false, confidence: 0, weakHints };
        }

        for (const src of sources) {
            if (src.type !== 'telegram') continue;
            const srcIdentity =
                src.telegram_identity || normalizeTelegramChannelIdentity(src.url);
            if (srcIdentity && srcIdentity === candidateIdentity) {
                return buildExactDuplicateResult({
                    confidence: 98,
                    reason: 'telegram_identity_match_existing_source',
                    duplicateOfSourceId: src.id,
                    matchedSourceName: src.name,
                    matchedSourceUrl: src.url,
                });
            }
        }

        for (const sug of suggestions) {
            if (sug.status !== 'pending' && sug.status !== 'approved') continue;
            if (sug.suggested_type !== 'telegram') continue;
            const sugIdentity = normalizeTelegramChannelIdentity(sug.suggested_url);
            if (sugIdentity && sugIdentity === candidateIdentity) {
                return buildExactDuplicateResult({
                    confidence: 98,
                    reason: 'telegram_identity_match_existing_suggestion',
                    duplicateOfSuggestionId: sug.id,
                });
            }
        }

        return { isDuplicate: false, confidence: 0, weakHints };
    }

    if (['rss', 'web', 'api'].includes(suggestedType)) {
        const candidateNorm = normalizeUrlForDuplicateCheck(suggestedUrl);
        const candidateHost = hostnameFromNormalizedUrl(candidateNorm);

        for (const src of sources) {
            if (src.type !== suggestedType) continue;
            const srcNorm = src.normalized_url || normalizeUrlForDuplicateCheck(src.url);
            if (candidateNorm && srcNorm && candidateNorm === srcNorm) {
                return buildExactDuplicateResult({
                    confidence: 98,
                    reason: 'normalized_url_match_existing_source',
                    duplicateOfSourceId: src.id,
                    matchedSourceName: src.name,
                    matchedSourceUrl: src.url,
                });
            }

            if (candidateHost && srcNorm) {
                const srcHost = hostnameFromNormalizedUrl(srcNorm);
                if (srcHost && candidateHost === srcHost) {
                    weakHints.push({
                        reason: 'same_hostname_hint',
                        confidence: HOSTNAME_HINT_CONFIDENCE,
                        matchType: 'weak',
                        duplicateOfSourceId: src.id,
                        matchedSourceName: src.name,
                        matchedSourceUrl: src.url,
                    });
                }
            }
        }

        for (const sug of suggestions) {
            if (sug.status !== 'pending' && sug.status !== 'approved') continue;
            if (sug.suggested_type !== suggestedType) continue;
            const sugNorm = normalizeUrlForDuplicateCheck(sug.suggested_url);
            if (candidateNorm && sugNorm && candidateNorm === sugNorm) {
                return buildExactDuplicateResult({
                    confidence: 98,
                    reason: 'normalized_url_match_existing_suggestion',
                    duplicateOfSuggestionId: sug.id,
                });
            }
        }

        return { isDuplicate: false, confidence: 0, weakHints };
    }

    if (titleKey) {
        for (const src of sources) {
            const srcTitle = normalizeTitleKey(src.name);
            const sim = titleSimilarity(titleKey, srcTitle);
            if (sim >= 85) {
                return buildExactDuplicateResult({
                    confidence: sim,
                    reason: 'title_similarity_existing_source',
                    duplicateOfSourceId: src.id,
                    matchedSourceName: src.name,
                    matchedSourceUrl: src.url,
                });
            }
        }
        for (const sug of suggestions) {
            if (!sug.title_key) continue;
            const sim = titleSimilarity(titleKey, sug.title_key);
            if (sim >= 85) {
                return buildExactDuplicateResult({
                    confidence: sim,
                    reason: 'title_similarity_existing_suggestion',
                    duplicateOfSuggestionId: sug.id,
                });
            }
        }
    }

    return { isDuplicate: false, confidence: 0, weakHints };
}

export function shouldSkipAsDuplicate(dupResult) {
    return dupResult.isDuplicate && dupResult.confidence >= DUPLICATE_CONFIDENCE_THRESHOLD;
}

export { DUPLICATE_CONFIDENCE_THRESHOLD, HOSTNAME_HINT_CONFIDENCE };
