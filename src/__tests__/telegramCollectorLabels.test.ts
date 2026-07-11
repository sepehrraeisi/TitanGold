import { describe, expect, it } from 'vitest';
import {
    formatNewsCategoryLabel,
    formatRegionLabel,
    formatTimeHorizonLabel,
    formatSeverityLabel,
    humanizeEnum,
    looksLikeRawEnum,
} from '../../components/ai/AIManager/tabs/DataHub/telegramCollectorLabels';

describe('telegramCollectorLabels', () => {
    it('maps known categories', () => {
        expect(formatNewsCategoryLabel('SANCTIONS_EMBARGO')).toBe('Sanctions / Embargo');
        expect(formatNewsCategoryLabel('FOREX_CURRENCY')).toBe('Forex / Currency');
        expect(formatNewsCategoryLabel('PRECIOUS_METALS')).toBe('Precious Metals');
        expect(formatNewsCategoryLabel('ECONOMIC_INDICATORS')).toBe('Economic Indicators');
    });

    it('maps known regions', () => {
        expect(formatRegionLabel('MIDDLE_EAST')).toBe('Middle East');
        expect(formatRegionLabel('NORTH_AMERICA')).toBe('North America');
    });

    it('maps time horizons', () => {
        expect(formatTimeHorizonLabel('medium_term')).toBe('Medium term');
    });

    it('humanizes unknown enums', () => {
        expect(humanizeEnum('CUSTOM_TOPIC')).toBe('Custom Topic');
    });

    it('detects raw enum patterns', () => {
        expect(looksLikeRawEnum('SANCTIONS_EMBARGO')).toBe(true);
        expect(looksLikeRawEnum('telegram_data_overview_desc')).toBe(true);
        expect(looksLikeRawEnum('Medium term')).toBe(false);
    });

    it('formats severity labels', () => {
        expect(formatSeverityLabel('high')).toBe('Critical');
        expect(formatSeverityLabel('medium')).toBe('Warning');
    });
});
