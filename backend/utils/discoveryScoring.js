/**
 * Discovery priority_score 0–100 (weighted, normalized).
 */

const PRIORITY_MAP = { low: 25, medium: 50, high: 75, critical: 100 };

export function computeDiscoveryScore(ctx) {
    const {
        rulePriority = 'medium',
        discoverySource = 'rule',
        categoryMatch = 0,
        freshnessHours = 168,
        uniquenessScore = 100,
        sourceReputation = 50,
        crawlFrequency = 0,
        telegramMentions = 0,
        blacklistPenalty = 0,
    } = ctx;

    const ruleScore = PRIORITY_MAP[rulePriority] ?? 50;

    const provenanceScore =
        {
            crawler: 90,
            telegram: 70,
            rule: 60,
            known_sources: 30,
        }[discoverySource] ?? 50;

    const freshnessScore = Math.max(0, 100 - Math.min(freshnessHours, 168) * (100 / 168));

    const crawlScore = Math.min(100, crawlFrequency * 10);
    const telegramScore = Math.min(100, telegramMentions * 15);

    const raw =
        sourceReputation * 0.18 +
        categoryMatch * 0.14 +
        freshnessScore * 0.14 +
        uniquenessScore * 0.14 +
        crawlScore * 0.1 +
        telegramScore * 0.1 +
        ruleScore * 0.12 +
        provenanceScore * 0.08 -
        blacklistPenalty;

    const score = Math.max(0, Math.min(100, Math.round(raw * 100) / 100));
    return score;
}
