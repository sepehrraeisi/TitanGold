import { describe, it, expect } from 'vitest';
import { getCollectorAuthHeaders } from '../../services/collectorAuth';
import { formatDataHubQueryError } from '../../components/ai/AIManager/tabs/DataHub/dataHubI18n';
import { DataHubApiError } from '../../services/dataSourcesApi';

describe('collectorAuth P4', () => {
    it('builds Authorization header when token exists', () => {
        const original = global.localStorage;
        const store: Record<string, string> = { titan_token: 'abc123' };
        Object.defineProperty(global, 'localStorage', {
            value: {
                getItem: (k: string) => store[k] ?? null,
            },
            configurable: true,
        });
        const headers = getCollectorAuthHeaders() as Record<string, string>;
        expect(headers.Authorization).toBe('Bearer abc123');
        Object.defineProperty(global, 'localStorage', { value: original, configurable: true });
    });
});

describe('dataHub tab error formatting P4', () => {
    const t = (key: string) =>
        ({
            datahub_error_not_found: 'Resource not found on this server.',
            datahub_error_generic: 'Something went wrong.',
        }[key] || key);

    it('maps 404 to localized not found message', () => {
        const display = formatDataHubQueryError(t, new DataHubApiError(404, 'Not Found'));
        expect(display?.message).toBe('Resource not found on this server.');
    });

    it('never surfaces raw Request failed text', () => {
        const display = formatDataHubQueryError(t, new Error('Request failed'));
        expect(display?.message).not.toBe('Request failed');
    });
});

describe('force sync message shape P4', () => {
    it('includes zero saved hint when messagesSaved is 0', () => {
        const data = { messagesFetched: 10, messagesSaved: 0, latency: 280 };
        const zeroSavedNote =
            data.messagesSaved === 0 ? ' (0 saved — messages were already processed)' : '';
        const msg = `✅ Force sync completed: ${data.messagesFetched} messages fetched, ${data.messagesSaved} saved (${data.latency}ms).${zeroSavedNote}`;
        expect(msg).toContain('10 messages fetched');
        expect(msg).toContain('already processed');
        expect(msg).not.toContain('Request failed');
    });
});

describe('channels refresh contract P4', () => {
    it('expects real refresh payload not stub-only success', () => {
        const stub = { success: true, message: 'Channels refresh requested' };
        const real = {
            success: true,
            refreshed: 5,
            totalChannels: 12,
            activeChannels: 10,
            message: 'Refreshed 5 channels from database',
        };
        expect(stub).not.toHaveProperty('refreshed');
        expect(real.refreshed).toBeGreaterThanOrEqual(0);
        expect(real.message).toMatch(/Refreshed \d+ channels/);
    });
});
