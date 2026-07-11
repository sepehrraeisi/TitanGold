import { describe, expect, it, jest, beforeEach } from '@jest/globals';

const queryMock = jest.fn();

jest.unstable_mockModule('../../database/db.js', () => ({
    query: queryMock,
}));

describe('telegram system stats (P7.4)', () => {
    beforeEach(() => {
        queryMock.mockReset();
    });

    it('includes last_processed_at for 24h range instead of null', async () => {
        const { loadSystemStatsForRange } = await import('../../services/telegramSystemStats.js');

        queryMock
            .mockResolvedValueOnce({
                rows: [{
                    processed_count: '100',
                    total_messages: '100',
                    channels_with_data: '5',
                }],
            })
            .mockResolvedValueOnce({
                rows: [{
                    total_agent_impacts: '2',
                    avg_impact_score: '0.5',
                    total_actions_required: '1',
                }],
            })
            .mockResolvedValueOnce({
                rows: [{ last_processed_at: new Date('2026-06-30T10:22:44.749Z') }],
            });

        const stats = await loadSystemStatsForRange(24);
        expect(stats.last_processed_at).toBe('2026-06-30T10:22:44.749Z');
        expect(stats.last_processed_at).not.toBeNull();
    });
});
