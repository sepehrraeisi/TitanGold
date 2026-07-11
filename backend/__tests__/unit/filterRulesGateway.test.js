/**
 * DH-BLACKLISTWHITELIST-P2 — central filter rules gateway.
 * @jest-environment node
 */

import { jest } from '@jest/globals';

const mockQuery = jest.fn();

jest.unstable_mockModule('../../database/db.js', () => ({
    query: mockQuery,
}));

const { enforceIngestionPolicy, evaluateFilterPolicy, FILTER_BLOCKED_CODE } = await import(
    '../../services/filterRulesGateway.js'
);

const SOURCE_ID = '11111111-1111-4111-8111-111111111111';

function rule(overrides = {}) {
    return {
        id: '22222222-2222-4222-8222-222222222222',
        rule_type: 'blacklist',
        scope: 'keyword',
        pattern: 'DH_FILTER_BLOCK_TEST',
        match_type: 'contains',
        apply_target: 'ingestion',
        action: 'block',
        is_active: true,
        priority: 100,
        metadata: {},
        reason: 'test block',
        created_by: null,
        deleted_at: null,
        last_matched_at: null,
        created_at: new Date('2026-06-18T00:00:00Z'),
        updated_at: new Date('2026-06-18T00:00:00Z'),
        ...overrides,
    };
}

describe('filterRulesGateway', () => {
    beforeEach(() => {
        mockQuery.mockReset();
        mockQuery.mockImplementation(async (sql) => {
            const text = String(sql);
            if (text.includes('SELECT * FROM datahub_filter_rules')) {
                return { rows: [rule()] };
            }
            if (text.includes('UPDATE datahub_filter_rules')) {
                return { rows: [] };
            }
            if (text.includes('INSERT INTO data_hub_logs')) {
                return { rows: [{ id: 'log-1' }] };
            }
            return { rows: [] };
        });
    });

    test('blocked ingestion throws and writes structured audit log', async () => {
        await expect(
            enforceIngestionPolicy({
                sourceId: SOURCE_ID,
                text: 'contains DH_FILTER_BLOCK_TEST',
                enforcementPath: 'unit_test',
                dataType: 'price',
            }),
        ).rejects.toMatchObject({
            status: 403,
            code: FILTER_BLOCKED_CODE,
            reason: 'blacklist_match',
        });

        expect(mockQuery).toHaveBeenCalledWith(
            expect.stringContaining('INSERT INTO data_hub_logs'),
            expect.arrayContaining([
                SOURCE_ID,
                'ingestion blocked by filter rule',
                expect.stringContaining('"enforcement_path":"unit_test"'),
            ]),
        );
    });

    test('evaluateFilterPolicy uses same decision path without throwing', async () => {
        const result = await evaluateFilterPolicy({
            sourceId: SOURCE_ID,
            text: 'contains DH_FILTER_BLOCK_TEST',
            apply_target: 'ingestion',
        });

        expect(result.allowed).toBe(false);
        expect(result.blocked).toBe(true);
        expect(result.rule.pattern).toBe('DH_FILTER_BLOCK_TEST');
    });
});
