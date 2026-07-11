import { describe, expect, it } from 'vitest';
import {
    formatCollectorAvgLatency,
    formatCollectorLastProcessed,
    isBareDash,
} from '../../components/ai/AIManager/tabs/DataHub/telegram/telegramCollectorLabels';

const t = (key: string) => {
    const map: Record<string, string> = {
        collector_no_recent_sync_latency: 'No recent sync latency',
        collector_no_recent_sync_latency_hint: 'No sync latency recorded yet.',
        collector_avg_latency_hint: 'Average latency hint',
        collector_no_recent_processed_message: 'No recent processed message',
        collector_no_recent_processed_hint: 'Waiting for next event.',
        collector_last_processed_hint: 'Last processed hint',
    };
    return map[key] || key;
};

describe('collector metric polish (P7.4)', () => {
    it('detects bare dash placeholders', () => {
        expect(isBareDash('-')).toBe(true);
        expect(isBareDash('—')).toBe(true);
        expect(isBareDash('1310 ms')).toBe(false);
    });

    it('formats average latency without bare dash', () => {
        const empty = formatCollectorAvgLatency(null, t);
        expect(empty.display).toBe('No recent sync latency');
        expect(empty.display).not.toMatch(/^[\s—\-–]+$/);
        expect(empty.available).toBe(false);

        const filled = formatCollectorAvgLatency(1310, t);
        expect(filled.display).toBe('1310 ms');
        expect(filled.available).toBe(true);
    });

    it('formats last processed without bare dash', () => {
        const empty = formatCollectorLastProcessed(null, t);
        expect(empty.display).toBe('No recent processed message');
        expect(empty.display).not.toBe('-');
        expect(empty.available).toBe(false);

        const filled = formatCollectorLastProcessed('2026-06-30T10:22:44.749Z', t, () => '2m ago');
        expect(filled.display).toBe('2m ago');
        expect(filled.available).toBe(true);
    });
});
