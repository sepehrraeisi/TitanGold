import { describe, expect, it } from 'vitest';
import {
    presentComparisonDelta,
    presentPrimaryOutcome,
    presentScanStatus,
    presentScanTrigger,
    isRawScanKey,
} from '../../../utils/scanRunPresentation.ts';

const t = (key: string) => {
    const map: Record<string, string> = {
        unavailable: 'Unavailable',
        arb_scan_status_completed: 'Completed',
        arb_scan_status_failed: 'Failed',
        manual: 'Manual',
        scheduled: 'Scheduled',
        arb_scan_outcome_failed: 'Scan failed',
        arb_scan_outcome_qualified: 'Qualified candidates found',
        arb_scan_outcome_analytical_only: 'Analytical observations only',
        arb_reason_non_positive_net: 'Net spread not positive',
        arb_comparison_unavailable: 'Unavailable',
        arb_comparison_no_change: 'No change',
    };
    return map[key] ?? key;
};

describe('scanRunPresentation', () => {
    it('maps scan status codes to localized labels', () => {
        expect(presentScanStatus('completed', t)).toBe('Completed');
        expect(presentScanStatus('failed', t)).toBe('Failed');
        expect(presentScanStatus('unknown_code', t)).toBe('Unavailable');
    });

    it('maps trigger codes to localized labels', () => {
        expect(presentScanTrigger('manual', t)).toBe('Manual');
        expect(presentScanTrigger('scheduled', t)).toBe('Scheduled');
    });

    it('presents primary outcome from qualified count', () => {
        expect(
            presentPrimaryOutcome({ status: 'completed', qualifiedCount: 2, funnel: { qualified: 2 } }, t),
        ).toBe('Qualified candidates found');
    });

    it('presents failure outcome for failed runs', () => {
        expect(presentPrimaryOutcome({ status: 'failed' }, t)).toBe('Scan failed');
    });

    it('presents comparison delta safely', () => {
        expect(presentComparisonDelta(null, t)).toBe('Unavailable');
        expect(presentComparisonDelta(0, t)).toBe('No change');
        expect(presentComparisonDelta(3, t)).toBe('+3');
        expect(presentComparisonDelta(-2, t)).toBe('-2');
    });

    it('detects raw scan keys', () => {
        expect(isRawScanKey('arb_history_total_runs')).toBe(true);
        expect(isRawScanKey('Completed')).toBe(false);
    });
});
