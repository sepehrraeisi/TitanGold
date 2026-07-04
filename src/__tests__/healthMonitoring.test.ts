import { describe, expect, it } from 'vitest';
import {
    formatCacheHitRateDisplay,
    formatHealthMetricValue,
} from '../../components/ai/AIManager/tabs/DataHub/pipelineHealthFormat';

describe('health monitoring formatters', () => {
    it('formatHealthMetricValue shows Unavailable for null, not zero', () => {
        expect(formatHealthMetricValue(null, 'Unavailable')).toEqual({
            display: 'Unavailable',
            available: false,
        });
        expect(formatHealthMetricValue(0, 'Unavailable')).toEqual({
            display: '0',
            available: true,
        });
        expect(formatHealthMetricValue(42, 'Unavailable')).toEqual({
            display: '42',
            available: true,
        });
    });

    it('formatCacheHitRateDisplay shows Not tracked when untracked', () => {
        expect(
            formatCacheHitRateDisplay(null, false, {
                notTracked: 'Not tracked',
                unavailable: 'Unavailable',
            }),
        ).toEqual({
            display: 'Not tracked',
            available: false,
            tracked: false,
        });
    });

    it('formatCacheHitRateDisplay formats percentage when tracked', () => {
        expect(
            formatCacheHitRateDisplay(0.256, true, {
                notTracked: 'Not tracked',
                unavailable: 'Unavailable',
            }),
        ).toEqual({
            display: '25.6%',
            available: true,
            tracked: true,
        });
    });
});
