/**
 * Telegram agent feed query tests (P7).
 */
import { describe, it, expect } from '@jest/globals';
import {
    buildAgentFeedSql,
    VALID_AGENT_KEYS,
} from '../../services/telegramAgentFeed.js';

describe('telegramAgentFeed P7', () => {
    it('exports all 15 agent keys', () => {
        expect(VALID_AGENT_KEYS).toHaveLength(15);
        expect(VALID_AGENT_KEYS).toContain('trend');
        expect(VALID_AGENT_KEYS).toContain('sentiment');
    });

    it('applies LIMIT in inner subquery before joins', () => {
        const { sql } = buildAgentFeedSql({
            agentKey: 'trend',
            hours: 24,
            limit: 20,
            offset: 0,
            minImpact: 0,
        });
        const innerLimitPos = sql.indexOf('LIMIT');
        const joinPos = sql.indexOf('INNER JOIN processed_telegram_messages');
        expect(innerLimitPos).toBeGreaterThan(-1);
        expect(joinPos).toBeGreaterThan(innerLimitPos);
        expect(sql).not.toContain('::text = ai.processed_message_id::text');
        expect(sql).toContain('pm.id = ai.processed_message_id');
        expect(sql).toContain("INTERVAL '1 hour' * $2");
        expect(sql).not.toContain('OR pm.channel_id');
    });

    it('supports priority and requiresAction filters in inner query', () => {
        const { sql, params } = buildAgentFeedSql({
            agentKey: 'technical',
            hours: 48,
            limit: 5,
            offset: 10,
            minImpact: 0.5,
            requiresAction: true,
            priority: 'high',
        });
        expect(sql).toContain('ai.requires_action');
        expect(sql).toContain('ai.priority_level');
        expect(params).toEqual(['technical', 48, 0.5, true, 'high', 5, 10]);
    });

    it('returns preview-only cleaned_text', () => {
        const { sql } = buildAgentFeedSql({
            agentKey: 'sentiment',
            hours: 24,
            limit: 5,
            offset: 0,
            minImpact: 0,
        });
        expect(sql).toContain('LEFT(pm.cleaned_text, 500)');
    });
});
