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
    });

    it('formatCacheHitRateDisplay shows Not tracked when untracked', () => {
        expect(
            formatCacheHitRateDisplay(null, false, {
                notTracked: 'Not tracked',
                unavailable: 'Unavailable',
            }),
        ).toMatchObject({ display: 'Not tracked', tracked: false });
    });

    it('formatCacheHitRateDisplay formats percentage when tracked', () => {
        expect(
            formatCacheHitRateDisplay(0.256, true, {
                notTracked: 'Not tracked',
                unavailable: 'Unavailable',
            }),
        ).toMatchObject({ display: '25.6%', tracked: true });
    });

    it('unavailable duplicate metric is not coerced to zero display', () => {
        const dup = formatHealthMetricValue(null, 'Unavailable');
        expect(dup.display).not.toBe('0');
        expect(dup.available).toBe(false);
    });
});
