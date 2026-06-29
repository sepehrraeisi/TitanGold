import { readFileSync, readdirSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { describe, expect, it } from 'vitest';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '../..');

const LOCALE_FILES = {
    blueEn: join(ROOT, 'deploy/blue/locales/en.json'),
    blueFa: join(ROOT, 'deploy/blue/locales/fa.json'),
    greenEn: join(ROOT, 'deploy/green/locales/en.json'),
    greenFa: join(ROOT, 'deploy/green/locales/fa.json'),
} as const;

const SCAN_FILES = [
    'TelegramDataPanel.tsx',
    'AgentDetailPanel.tsx',
    'CategoryBreakdown.tsx',
    'BreakingNewsMonitor.tsx',
    'GeographicHeatMap.tsx',
].map(f => join(ROOT, 'components/ai/AIManager/tabs/DataHub', f));

const REQUIRED_KEYS = [
    'telegram_data_overview_desc',
    'processed_messages',
    'agent_impacts',
    'avg_impact_score',
    'actions_required',
    'last_processed',
    'telegram_ai_inbox_desc',
    'telegram_agent_feed_not_configured',
    'breaking_news_desc',
    'telegram_horizon_medium_term',
    'telegram_category_SANCTIONS_EMBARGO',
    'telegram_region_MIDDLE_EAST',
];

function loadJson(path: string): Record<string, string> {
    return JSON.parse(readFileSync(path, 'utf8'));
}

function extractI18nKeys(source: string): string[] {
    const keys = new Set<string>();
    const pattern = /\bt\(\s*['"]([^'"]+)['"]/g;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(source)) !== null) {
        keys.add(match[1]);
    }
    return [...keys];
}

describe('Telegram Collector i18n', () => {
    const locales = Object.fromEntries(
        Object.entries(LOCALE_FILES).map(([name, path]) => [name, loadJson(path)]),
    ) as Record<keyof typeof LOCALE_FILES, Record<string, string>>;

    const componentKeys = [...new Set(SCAN_FILES.flatMap(f => extractI18nKeys(readFileSync(f, 'utf8'))))];

    for (const [localeName, locale] of Object.entries(locales)) {
        it(`${localeName} defines required Telegram Collector keys`, () => {
            for (const key of REQUIRED_KEYS) {
                expect(locale[key], `${localeName} missing ${key}`).toBeDefined();
                expect(locale[key], `${localeName} raw key ${key}`).not.toBe(key);
            }
        });
    }

    it('Telegram Collector components only use keys present in blue en locale', () => {
        const en = locales.blueEn;
        const missing = componentKeys.filter(k => en[k] === undefined);
        expect(missing, `Missing keys: ${missing.join(', ')}`).toEqual([]);
    });

    it('AgentDetailPanel does not contain raw API unavailable message', () => {
        const src = readFileSync(join(ROOT, 'components/ai/AIManager/tabs/DataHub/AgentDetailPanel.tsx'), 'utf8');
        expect(src).not.toContain('Agent feed API is not available yet');
    });
});
