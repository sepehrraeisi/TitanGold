/**
 * @jest-environment node
 */
import { describe, expect, test } from '@jest/globals';
import { ingestedAtSql } from '../../services/collectedDataTimestamps.js';

describe('dataPipelineSnapshot 24h ingestion metrics', () => {
    test('24h filter SQL uses ingestion time not raw collected_at alone', () => {
        const expr = ingestedAtSql();
        expect(expr).toContain("transferred_at");
        expect(expr).toContain('collected_at');
        expect(expr).not.toMatch(/collected_at\s*>/);
    });

    test('aliased expression supports per-source category inflow', () => {
        const expr = ingestedAtSql('cd');
        expect(expr).toContain('cd.metadata');
        expect(expr).toContain('cd.collected_at');
    });
});
