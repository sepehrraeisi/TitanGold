import { describe, it, expect } from 'vitest';
import {
    computeCollectorHealthLevel,
    computeSyncRate,
    formatDiagnoseSummary,
} from '../../components/ai/AIManager/tabs/DataHub/telegram/telegramCollectorLabels';

describe('telegramCollectorLabels', () => {
    it('returns healthy when no channels and route ok', () => {
        expect(
            computeCollectorHealthLevel({
                routeBroken: false,
                totalChannels: 0,
                syncedChannels: 0,
                channelsWithErrors: 0,
                criticalErrorChannels: 0,
            }),
        ).toBe('healthy');
    });

    it('returns degraded when route broken', () => {
        expect(
            computeCollectorHealthLevel({
                routeBroken: true,
                totalChannels: 10,
                syncedChannels: 10,
                channelsWithErrors: 0,
                criticalErrorChannels: 0,
            }),
        ).toBe('degraded');
    });

    it('computes sync rate safely', () => {
        expect(computeSyncRate(0, 0)).toBe(100);
        expect(computeSyncRate(4, 3)).toBe(75);
    });

    it('formats diagnose summary without html', () => {
        const summary = formatDiagnoseSummary(
            [
                {
                    key: 'health',
                    ok: false,
                    status: 404,
                    responseKind: 'html',
                    errorKey: 'collector_proxy_unreachable',
                },
            ],
            k => k,
        );
        expect(summary).not.toMatch(/<html/i);
        expect(summary).toContain('collector_proxy_unreachable');
    });
});

describe('accountApiSanitizer P3', () => {
    it('strips session from login confirm payload', async () => {
        const {
            sanitizeLoginConfirmForApi,
            sanitizeLoginStartForApi,
            sanitizeSessionStatusForApi,
        } = await import('../../telegram-collector/utils/accountApiSanitizer.js');
        const confirm = sanitizeLoginConfirmForApi({
            success: true,
            session: 'secret-session-string',
            phoneNumber: '+989121234567',
        });
        expect(confirm).not.toHaveProperty('session');
        expect(confirm.phone_masked).toBe('+98***67');

        const start = sanitizeLoginStartForApi({
            success: true,
            authId: 'auth_1',
            phoneNumber: '+989121234567',
            phoneCodeHash: 'hash-secret',
        });
        expect(start).not.toHaveProperty('phoneCodeHash');
        expect(start.phone_masked).toBe('+98***67');

        const session = sanitizeSessionStatusForApi({
            stored_in_db: true,
            phone_number: '+989121234567',
        });
        expect(session).not.toHaveProperty('phone_number');
        expect(session.phone_masked).toBe('+98***67');
    });

    it('masks phone in account rows', async () => {
        const { sanitizeAccountForApi } = await import(
            '../../telegram-collector/utils/accountApiSanitizer.js'
        );
        const row = sanitizeAccountForApi({
            id: '1',
            phone: '+989121234567',
            session_string: 'x',
            status: 'active',
        });
        expect(row.phone).toBe('+98***67');
        expect(row.phone_masked).toBe('+98***67');
    });
});
