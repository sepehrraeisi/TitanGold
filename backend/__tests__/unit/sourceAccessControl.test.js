/**
 * DH-ACCESSCONTROL-P2 — unit tests for evaluateSourceAccess policy.
 * @jest-environment node
 */

import { jest } from '@jest/globals';

const mockQuery = jest.fn();
const mockTryInsert = jest.fn().mockResolvedValue(undefined);

jest.unstable_mockModule('../../database/db.js', () => ({
    query: mockQuery,
}));

jest.unstable_mockModule('../../services/dataHubAccessLogWriter.js', () => ({
    tryInsertDataHubAccessLog: mockTryInsert,
}));

const {
    evaluateSourceAccess,
    RUNTIME_AGENT_KEYS,
} = await import('../../services/sourceAccessControlService.js');
const SOURCE_ID = '11111111-1111-4111-8111-111111111111';

describe('evaluateSourceAccess', () => {
    beforeEach(() => {
        mockQuery.mockReset();
        mockTryInsert.mockClear();
    });

    test('default allow when no ACL row', async () => {
        mockQuery.mockResolvedValueOnce({ rows: [] });

        const result = await evaluateSourceAccess(
            { sourceId: SOURCE_ID, agentKey: 'technical', action: 'read' },
            { audit: false },
        );

        expect(result.allowed).toBe(true);
        expect(result.policy).toBe('default_allow');
        expect(result.aclPresent).toBe(false);
    });

    test('blocked agent denied', async () => {
        mockQuery.mockResolvedValueOnce({
            rows: [{
                allowed_agents: [],
                blocked_agents: ['publisher'],
                allowed_data_types: [],
                blocked_data_types: [],
            }],
        });

        const result = await evaluateSourceAccess(
            { sourceId: SOURCE_ID, agentKey: 'publisher', action: 'publish' },
            { audit: false },
        );

        expect(result.allowed).toBe(false);
        expect(result.reason).toBe('agent_blocked');
    });

    test('allow-list restricts unlisted agent', async () => {
        const aclRow = {
            rows: [{
                allowed_agents: ['technical'],
                blocked_agents: [],
                allowed_data_types: [],
                blocked_data_types: [],
            }],
        };

        mockQuery.mockResolvedValueOnce(aclRow);
        const denied = await evaluateSourceAccess(
            { sourceId: SOURCE_ID, agentKey: 'sentiment', action: 'read' },
            { audit: false },
        );

        mockQuery.mockResolvedValueOnce(aclRow);
        const allowed = await evaluateSourceAccess(
            { sourceId: SOURCE_ID, agentKey: 'technical', action: 'read' },
            { audit: false },
        );

        expect(denied.allowed).toBe(false);
        expect(denied.reason).toBe('agent_not_in_allow_list');
        expect(allowed.allowed).toBe(true);
    });

    test('blocked overrides allowed', async () => {
        mockQuery.mockResolvedValueOnce({
            rows: [{
                allowed_agents: ['technical', 'publisher'],
                blocked_agents: ['publisher'],
                allowed_data_types: [],
                blocked_data_types: [],
            }],
        });

        const result = await evaluateSourceAccess(
            { sourceId: SOURCE_ID, agentKey: 'publisher', action: 'publish' },
            { audit: false },
        );

        expect(result.allowed).toBe(false);
        expect(result.reason).toBe('agent_blocked');
    });

    test('DB error fails closed for runtime', async () => {
        mockQuery.mockRejectedValueOnce(new Error('connection refused'));

        const result = await evaluateSourceAccess(
            { sourceId: SOURCE_ID, agentKey: 'technical', action: 'read' },
            { audit: false, failOpen: false },
        );

        expect(result.allowed).toBe(false);
        expect(result.policy).toBe('db_error');
    });

    test('DB error fails open when requested (admin listing)', async () => {
        mockQuery.mockRejectedValueOnce(new Error('connection refused'));

        const result = await evaluateSourceAccess(
            { sourceId: SOURCE_ID, agentKey: 'technical', action: 'admin_list' },
            { audit: false, failOpen: true },
        );

        expect(result.allowed).toBe(true);
        expect(result.policy).toBe('db_error');
    });

    test('denied access writes audit log', async () => {
        mockQuery.mockResolvedValueOnce({
            rows: [{
                allowed_agents: ['technical'],
                blocked_agents: [],
                allowed_data_types: [],
                blocked_data_types: [],
            }],
        });

        await evaluateSourceAccess({
            sourceId: SOURCE_ID,
            agentKey: 'sentiment',
            userId: 'user-1',
            action: 'read',
        });

        expect(mockTryInsert).toHaveBeenCalledWith(
            expect.objectContaining({
                action: 'source_access_denied',
                sourceId: SOURCE_ID,
            }),
        );
    });

    test('publisher runtime key constant', () => {
        expect(RUNTIME_AGENT_KEYS.PUBLISHER).toBe('publisher');
    });
});
