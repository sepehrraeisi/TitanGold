/**
 * Human-readable labels for Telegram Collector backend enums.
 * Never render raw ALL_CAPS or snake_case values in UI.
 */

export type TelegramLabelTranslator = (key: string) => string;

const CATEGORY_EMOJI: Record<string, string> = {
    MARKET_DATA: '📊',
    ECONOMIC_INDICATORS: '📈',
    GEOPOLITICAL: '🌍',
    POLITICAL: '🏛️',
    SANCTIONS_EMBARGO: '⛔',
    ENERGY_COMMODITIES: '⚡',
    CRYPTO_BLOCKCHAIN: '₿',
    FOREX_CURRENCY: '💱',
    PRECIOUS_METALS: '🥇',
    SOCIAL_UNREST: '⚠️',
    NATURAL_DISASTERS: '🌪️',
    CORPORATE_BUSINESS: '🏢',
    TECHNOLOGY: '💻',
    FINANCIAL_CRISIS: '💥',
    TRADE_COMMERCE: '🚢',
};

const CATEGORY_FALLBACK: Record<string, string> = {
    MARKET_DATA: 'Market Data',
    ECONOMIC_INDICATORS: 'Economic Indicators',
    GEOPOLITICAL: 'Geopolitical',
    POLITICAL: 'Political',
    SANCTIONS_EMBARGO: 'Sanctions / Embargo',
    ENERGY_COMMODITIES: 'Energy & Commodities',
    CRYPTO_BLOCKCHAIN: 'Crypto & Blockchain',
    FOREX_CURRENCY: 'Forex / Currency',
    PRECIOUS_METALS: 'Precious Metals',
    SOCIAL_UNREST: 'Social Unrest',
    NATURAL_DISASTERS: 'Natural Disasters',
    CORPORATE_BUSINESS: 'Corporate & Business',
    TECHNOLOGY: 'Technology',
    FINANCIAL_CRISIS: 'Financial Crisis',
    TRADE_COMMERCE: 'Trade & Commerce',
};

const REGION_FALLBACK: Record<string, string> = {
    NORTH_AMERICA: 'North America',
    SOUTH_AMERICA: 'South America',
    EUROPE: 'Europe',
    MIDDLE_EAST: 'Middle East',
    ASIA: 'Asia',
    AFRICA: 'Africa',
    OCEANIA: 'Oceania',
    CENTRAL_ASIA: 'Central Asia',
    SOUTHEAST_ASIA: 'Southeast Asia',
    EAST_ASIA: 'East Asia',
};

const HORIZON_FALLBACK: Record<string, string> = {
    immediate: 'Immediate',
    short_term: 'Short term',
    medium_term: 'Medium term',
    long_term: 'Long term',
};

const SEVERITY_FALLBACK: Record<string, string> = {
    high: 'Critical',
    medium: 'Warning',
    low: 'Info',
    critical: 'Critical',
};

/** Convert UNKNOWN_ENUM or snake_case to Title Case */
export function humanizeEnum(value: string): string {
    if (!value) return '';
    const trimmed = value.trim();
    if (!trimmed) return '';
    if (CATEGORY_FALLBACK[trimmed]) return CATEGORY_FALLBACK[trimmed];
    if (REGION_FALLBACK[trimmed]) return REGION_FALLBACK[trimmed];
    if (HORIZON_FALLBACK[trimmed]) return HORIZON_FALLBACK[trimmed];
    return trimmed
        .toLowerCase()
        .split(/[_\s]+/)
        .filter(Boolean)
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
}

function translateOrFallback(
    t: TelegramLabelTranslator | undefined,
    i18nKey: string,
    fallback: string,
): string {
    if (!t) return fallback;
    const translated = t(i18nKey);
    return translated !== i18nKey ? translated : fallback;
}

export function formatNewsCategoryLabel(
    category: string | null | undefined,
    t?: TelegramLabelTranslator,
    withEmoji = false,
): string {
    if (!category) return '';
    const fallback = CATEGORY_FALLBACK[category] || humanizeEnum(category);
    const label = translateOrFallback(t, `telegram_category_${category}`, fallback);
    const emoji = CATEGORY_EMOJI[category];
    return withEmoji && emoji ? `${emoji} ${label}` : label;
}

export function formatRegionLabel(region: string | null | undefined, t?: TelegramLabelTranslator): string {
    if (!region) return '';
    const fallback = REGION_FALLBACK[region] || humanizeEnum(region);
    return translateOrFallback(t, `telegram_region_${region}`, fallback);
}

export function formatTopicLabel(topic: string | null | undefined, t?: TelegramLabelTranslator): string {
    if (!topic) return '';
    const fallback = humanizeEnum(topic);
    return translateOrFallback(t, `telegram_topic_${topic}`, fallback);
}

export function formatTimeHorizonLabel(horizon: string | null | undefined, t?: TelegramLabelTranslator): string {
    if (!horizon) return '';
    const fallback = HORIZON_FALLBACK[horizon] || humanizeEnum(horizon);
    return translateOrFallback(t, `telegram_horizon_${horizon}`, fallback);
}

export function formatSeverityLabel(level: string | null | undefined, t?: TelegramLabelTranslator): string {
    if (!level) return '';
    const fallback = SEVERITY_FALLBACK[level] || humanizeEnum(level);
    return translateOrFallback(t, `telegram_severity_${level}`, fallback);
}

export function formatMarketCategoryLabel(category: string | null | undefined, t?: TelegramLabelTranslator): string {
    return formatNewsCategoryLabel(category, t, false);
}

export function formatAgentKeyLabel(agentKey: string | null | undefined, t?: TelegramLabelTranslator): string {
    if (!agentKey) return '';
    const fallback = humanizeEnum(agentKey);
    return translateOrFallback(t, `telegram_agent_${agentKey}`, fallback);
}

/** Detect raw enum / i18n key patterns in visible text */
export function looksLikeRawEnum(text: string): boolean {
    if (!text || text.length > 80) return false;
    if (/^telegram_[a-z0-9_]+$/.test(text)) return true;
    if (/^[A-Z][A-Z0-9]*(_[A-Z0-9]+)+$/.test(text)) return true;
    if (/^[a-z]+_[a-z0-9_]+$/.test(text) && !text.includes(' ')) return true;
    return false;
}
