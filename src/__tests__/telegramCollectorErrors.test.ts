import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
    buildCollectorSafeError,
    containsRawHtmlError,
    diagnoseCollectorEndpoint,
    fetchCollectorJson,
    formatCollectorSafeError,
    isHtmlLikeResponse,
    maskPhoneForDisplay,
} from '../../services/telegramCollectorErrors.ts';

const t = (key: string) =>
    ({
        collector_proxy_unreachable: 'Telegram Collector proxy is unreachable.',
        collector_route_unavailable:
            'Collector service route is unavailable. Check nginx upstream and collector process.',
        collector_connect_failed: 'Failed to connect to Telegram Collector',
    })[key] || key;

describe('telegramCollectorErrors', () => {
    describe('isHtmlLikeResponse', () => {
        it('detects text/html content type', () => {
            expect(isHtmlLikeResponse('text/html', '')).toBe(true);
        });

        it('detects HTML body markers', () => {
            expect(isHtmlLikeResponse(null, '<html><body>404 Not Found</body></html>')).toBe(true);
        });

        it('returns false for JSON', () => {
            expect(isHtmlLikeResponse('application/json', '{"ok":true}')).toBe(false);
        });
    });

    describe('buildCollectorSafeError', () => {
        it('maps HTML to collector_proxy_unreachable', () => {
            const err = buildCollectorSafeError({
                status: 404,
                contentType: 'text/html',
                bodySnippet: '<html>404 Not Found</html>',
            });
            expect(err.messageKey).toBe('collector_proxy_unreachable');
            expect(err.kind).toBe('html_response');
        });

        it('maps 502/503 to collector_route_unavailable', () => {
            const err = buildCollectorSafeError({ status: 502, contentType: 'application/json' });
            expect(err.messageKey).toBe('collector_route_unavailable');
        });
    });

    describe('formatCollectorSafeError', () => {
        it('never includes raw HTML in user message', () => {
            const msg = formatCollectorSafeError(
                {
                    kind: 'html_response',
                    status: 404,
                    messageKey: 'collector_proxy_unreachable',
                },
                t,
            );
            expect(msg).not.toMatch(/<html/i);
            expect(msg).toContain('Telegram Collector proxy is unreachable.');
        });
    });

    describe('containsRawHtmlError', () => {
        it('flags HTML and 404 Not Found banners', () => {
            expect(containsRawHtmlError('<html><center>404 Not Found</center></html>')).toBe(true);
            expect(containsRawHtmlError('Collector service route is unavailable.')).toBe(false);
        });
    });

    describe('maskPhoneForDisplay', () => {
        it('masks phone numbers', () => {
            expect(maskPhoneForDisplay('+989121234567')).toBe('+98***67');
        });
    });

    describe('fetchCollectorJson', () => {
        beforeEach(() => {
            vi.stubGlobal('fetch', vi.fn());
        });

        afterEach(() => {
            vi.unstubAllGlobals();
        });

        it('throws safe error key on HTML 404', async () => {
            vi.mocked(fetch).mockResolvedValue({
                ok: false,
                status: 404,
                headers: { get: () => 'text/html' },
                text: async () => '<html><center>404 Not Found</center></html>',
            } as Response);

            await expect(fetchCollectorJson('/api/telegram-collector/health')).rejects.toMatchObject({
                message: 'collector_proxy_unreachable',
            });
        });

        it('parses JSON on success', async () => {
            vi.mocked(fetch).mockResolvedValue({
                ok: true,
                status: 200,
                headers: { get: () => 'application/json' },
                text: async () => '{"status":"ok"}',
            } as Response);

            await expect(fetchCollectorJson('/api/telegram-collector/health')).resolves.toEqual({
                status: 'ok',
            });
        });
    });

    describe('diagnoseCollectorEndpoint', () => {
        beforeEach(() => {
            vi.stubGlobal('fetch', vi.fn());
        });

        afterEach(() => {
            vi.unstubAllGlobals();
        });

        it('returns safe error text without HTML for broken routes', async () => {
            vi.mocked(fetch).mockResolvedValue({
                ok: false,
                status: 404,
                headers: { get: () => 'text/html' },
                text: async () => '<html>404 Not Found</html>',
            } as Response);

            const check = await diagnoseCollectorEndpoint('health', '/api/telegram-collector/health');
            expect(check.ok).toBe(false);
            expect(check.responseKind).toBe('html');
            expect(check.safeError).not.toMatch(/<html/i);
            expect(check.errorKey).toBe('collector_proxy_unreachable');
        });

        it('reports latency and json kind on success', async () => {
            vi.mocked(fetch).mockResolvedValue({
                ok: true,
                status: 200,
                headers: { get: () => 'application/json' },
                text: async () => '{"status":"ok"}',
            } as Response);

            const check = await diagnoseCollectorEndpoint('accounts', '/api/telegram-collector/accounts');
            expect(check.ok).toBe(true);
            expect(check.responseKind).toBe('json');
            expect(check.latencyMs).toBeGreaterThanOrEqual(0);
        });
    });
});

describe('accountApiSanitizer', () => {
    it('removes session_string from account rows', async () => {
        const { sanitizeAccountForApi } = await import(
            '../../telegram-collector/utils/accountApiSanitizer.js'
        );
        const row = sanitizeAccountForApi({
            id: '1',
            phone: '+989121234567',
            session_string: '1AgAOMTQ5LjE1NC4xNjcuOTEAU...secret',
            api_hash: 'abc123',
            api_id: 12345,
            status: 'active',
        });
        expect(row).not.toHaveProperty('session_string');
        expect(row).not.toHaveProperty('api_hash');
        expect(row).not.toHaveProperty('api_id');
        expect(row.phone_masked).toBe('+98***67');
        expect(row.has_session).toBe(true);
    });
});
