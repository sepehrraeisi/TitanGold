/**
 * Deterministic C1 review-blocker tests for GramJS connect/reconnect semantics.
 * No live Telegram provider. No live DB. No Docker.
 */
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
    LAST_MESSAGE_ID_SQL,
    SAVE_MESSAGES_CONFLICT,
    getLastMessageIdForChannel,
    saveMessages,
} = require('../pollQueries');

const {
    sessionIdentityKey,
    groupChannelsBySessionIdentity,
    PollCycleEngine,
    SHARED_PRIMARY_IDENTITY,
} = require('../pollCycleEngine');

const {
    GRAMJS_EPHEMERAL_CLIENT_OPTIONS,
    gramJsInitialConnectAttemptCount,
    gramJsWouldAttemptAutomaticReconnect,
    resolvePollingSession,
    connectAndProve,
    connectProvenSessionClient,
    disconnectClientSafe,
} = require('../telegramConnectLifecycle');

const SERVICE_PATH = path.join(__dirname, '../../dist/services/channelPollingService.js');

function channel(id, accountId) {
    return { id, account_id: accountId, title: String(id) };
}

function timeoutError(message) {
    const err = new Error(message || 'TIMEOUT');
    err.errorMessage = 'TIMEOUT';
    err.code = 'TIMEOUT';
    return err;
}

function createFakeClient(options = {}) {
    const {
        connectResult = true,
        connected,
        connectThrows,
        destroyThrows,
        includeDestroy = true,
        includeDisconnect = true,
        label = 'client',
    } = options;
    const calls = { connect: 0, disconnect: 0, destroy: 0 };
    const client = { label };
    if (connected !== undefined) {
        Object.defineProperty(client, 'connected', {
            get() {
                return connected;
            },
        });
    }
    client.connect = async () => {
        calls.connect += 1;
        if (connectThrows) {
            throw connectThrows;
        }
        return connectResult;
    };
    if (includeDisconnect) {
        client.disconnect = async () => {
            calls.disconnect += 1;
        };
    }
    if (includeDestroy) {
        client.destroy = async () => {
            calls.destroy += 1;
            if (destroyThrows) {
                throw destroyThrows;
            }
        };
    }
    return { client, calls };
}

describe('A/B: verified GramJS 2.26.22 client options', () => {
    it('A: connectionRetries=1 is exactly one initial attempt; 0 is zero attempts', () => {
        assert.equal(gramJsInitialConnectAttemptCount(0), 0);
        assert.equal(gramJsInitialConnectAttemptCount(1), 1);
        assert.equal(GRAMJS_EPHEMERAL_CLIENT_OPTIONS.connectionRetries, 1);
        assert.equal(
            gramJsInitialConnectAttemptCount(GRAMJS_EPHEMERAL_CLIENT_OPTIONS.connectionRetries),
            1
        );
    });

    it('B: reconnectRetries=-1 disables automatic reconnect; autoReconnect is false', () => {
        assert.equal(GRAMJS_EPHEMERAL_CLIENT_OPTIONS.reconnectRetries, -1);
        assert.equal(GRAMJS_EPHEMERAL_CLIENT_OPTIONS.autoReconnect, false);
        assert.equal(gramJsWouldAttemptAutomaticReconnect(0, undefined), true);
        assert.equal(gramJsWouldAttemptAutomaticReconnect(0, 0), true);
        assert.equal(gramJsWouldAttemptAutomaticReconnect(0, -1), false);
        assert.equal(
            gramJsWouldAttemptAutomaticReconnect(
                0,
                GRAMJS_EPHEMERAL_CLIENT_OPTIONS.reconnectRetries
            ),
            false
        );
    });

    it('service constructs clients with the verified ephemeral options, not connectionRetries=0', () => {
        const src = fs.readFileSync(SERVICE_PATH, 'utf8');
        assert.equal(src.includes('GRAMJS_EPHEMERAL_CLIENT_OPTIONS'), true);
        assert.equal(src.includes('connectAndProve'), true);
        assert.equal(src.includes('connectProvenSessionClient'), true);
        assert.equal(src.includes('resolvePollingSession'), true);
        assert.equal(/connectionRetries:\s*0/.test(src), false);
    });
});

describe('C-J: connect proof + PollCycleEngine fail-closed seam', () => {
    it('C: successful connect returns the proven client', async () => {
        const { client, calls } = createFakeClient({ connectResult: true, connected: true });
        const returned = await connectAndProve(client);
        assert.equal(returned, client);
        assert.equal(calls.connect, 1);
    });

    it('D: connect returns false / unsuccessful → group fails closed', async () => {
        const { client } = createFakeClient({ connectResult: false, connected: false });
        const polled = [];
        const tracker = { cleaned: [] };
        const engine = new PollCycleEngine({
            pollConcurrency: 3,
            getActiveChannels: async () => [channel('a', 'acc-1'), channel('b', 'acc-1')],
            connectSession: (identityKey, channels) => connectProvenSessionClient(
                identityKey,
                channels,
                async () => client
            ),
            pollChannel: async (_c, ch) => {
                polled.push(ch.id);
                return { success: true, messagesCount: 1 };
            },
            disconnectClient: async (c) => {
                tracker.cleaned.push(c);
                return disconnectClientSafe(c);
            },
        });
        const outcome = await engine.runPollingCycle();
        assert.equal(outcome.summary.channelsFailed, 2);
        assert.equal(outcome.summary.channelsSucceeded, 0);
        assert.equal(polled.length, 0);
        assert.equal(tracker.cleaned.length, 1);
        assert.equal(tracker.cleaned[0], client);
    });

    it('E: connect throws TIMEOUT → group fails closed', async () => {
        const { client } = createFakeClient({ connectThrows: timeoutError('TIMEOUT') });
        const polled = [];
        const engine = new PollCycleEngine({
            pollConcurrency: 3,
            getActiveChannels: async () => [channel('a', 'acc-1')],
            connectSession: (identityKey, channels) => connectProvenSessionClient(
                identityKey,
                channels,
                async () => client
            ),
            pollChannel: async (_c, ch) => {
                polled.push(ch.id);
                return { success: true };
            },
        });
        const outcome = await engine.runPollingCycle();
        assert.equal(outcome.summary.timeoutCount, 1);
        assert.equal(outcome.summary.channelsFailed, 1);
        assert.equal(polled.length, 0);
    });

    it('F: pollChannel is NOT called when group connect fails', async () => {
        let pollCalls = 0;
        const { client } = createFakeClient({ connectResult: false, connected: false });
        const engine = new PollCycleEngine({
            pollConcurrency: 3,
            getActiveChannels: async () => [channel('a', 'acc-1')],
            connectSession: (identityKey, channels) => connectProvenSessionClient(
                identityKey,
                channels,
                async () => client
            ),
            pollChannel: async () => {
                pollCalls += 1;
                return { success: true };
            },
        });
        await engine.runPollingCycle();
        assert.equal(pollCalls, 0);
    });

    it('G: cleanup runs on failed connect where a client object exists', async () => {
        const { client, calls } = createFakeClient({ connectResult: false, connected: false });
        const engine = new PollCycleEngine({
            pollConcurrency: 3,
            getActiveChannels: async () => [channel('a', 'acc-1')],
            connectSession: (identityKey, channels) => connectProvenSessionClient(
                identityKey,
                channels,
                async () => client
            ),
            pollChannel: async () => ({ success: true }),
        });
        await engine.runPollingCycle();
        assert.equal(calls.destroy, 1);
        assert.equal(calls.disconnect, 0);
    });

    it('H: cleanup runs on successful group completion', async () => {
        const { client, calls } = createFakeClient({ connectResult: true, connected: true });
        const engine = new PollCycleEngine({
            pollConcurrency: 3,
            getActiveChannels: async () => [channel('a', 'acc-1')],
            connectSession: (identityKey, channels) => connectProvenSessionClient(
                identityKey,
                channels,
                async () => client
            ),
            pollChannel: async () => ({ success: true, messagesCount: 0 }),
        });
        const outcome = await engine.runPollingCycle();
        assert.equal(outcome.summary.channelsSucceeded, 1);
        assert.equal(calls.destroy, 1);
        assert.equal(calls.disconnect, 0);
    });

    it('I: next polling cycle may try again normally after a failed connect', async () => {
        let connectCalls = 0;
        const engine = new PollCycleEngine({
            pollConcurrency: 3,
            getActiveChannels: async () => [channel('a', 'acc-1')],
            connectSession: async () => {
                connectCalls += 1;
                if (connectCalls === 1) {
                    throw timeoutError('TIMEOUT');
                }
                return { label: 'second-cycle' };
            },
            pollChannel: async () => ({ success: true, messagesCount: 1 }),
        });
        const first = await engine.runPollingCycle();
        const second = await engine.runPollingCycle();
        assert.equal(first.summary.channelsFailed, 1);
        assert.equal(second.summary.channelsSucceeded, 1);
        assert.equal(connectCalls, 2);
    });

    it('J: no application-level immediate retry occurs on connect failure', async () => {
        let connectCalls = 0;
        const { client } = createFakeClient({ connectThrows: timeoutError('TIMEOUT') });
        const engine = new PollCycleEngine({
            pollConcurrency: 3,
            getActiveChannels: async () => [channel('a', 'acc-1'), channel('b', 'acc-1')],
            connectSession: (identityKey, channels) => {
                connectCalls += 1;
                return connectProvenSessionClient(identityKey, channels, async () => client);
            },
            pollChannel: async () => ({ success: true }),
        });
        const outcome = await engine.runPollingCycle();
        assert.equal(connectCalls, 1);
        assert.equal(outcome.summary.connectAttempts, 1);
        assert.equal(outcome.summary.channelsFailed, 2);
    });
});

describe('K/L/M/N: C1 invariants remain unchanged', () => {
    it('K: existing concurrency=3 behavior remains unchanged', async () => {
        const { client } = createFakeClient({ connectResult: true, connected: true });
        const channels = Array.from({ length: 10 }, (_, i) => channel(`c${i}`, 'acc-1'));
        let inFlight = 0;
        let peak = 0;
        const engine = new PollCycleEngine({
            pollConcurrency: 3,
            getActiveChannels: async () => channels,
            connectSession: (identityKey, grouped) => connectProvenSessionClient(
                identityKey,
                grouped,
                async () => client
            ),
            pollChannel: async () => {
                inFlight += 1;
                peak = Math.max(peak, inFlight);
                await new Promise((resolve) => setTimeout(resolve, 15));
                inFlight -= 1;
                return { success: true, messagesCount: 1 };
            },
        });
        const outcome = await engine.runPollingCycle();
        assert.equal(outcome.summary.channelsSucceeded, 10);
        assert.ok(peak <= 3, `peak ${peak} > 3`);
    });

    it('L: existing session identity isolation remains unchanged', () => {
        const channels = [
            channel('a', 'acc-1'),
            channel('b', 'acc-2'),
            channel('c', null),
        ];
        const groups = groupChannelsBySessionIdentity(channels);
        assert.equal(groups.length, 3);
        assert.equal(sessionIdentityKey(channels[0]), 'account:acc-1');
        assert.equal(sessionIdentityKey(channels[1]), 'account:acc-2');
        assert.equal(sessionIdentityKey(channels[2]), SHARED_PRIMARY_IDENTITY);
    });

    it('M: existing MAX(message_id) query semantics remain unchanged', async () => {
        assert.equal(
            LAST_MESSAGE_ID_SQL,
            'SELECT MAX(message_id) AS max_id FROM telegram_messages WHERE channel_id = $1'
        );
        const calls = [];
        const query = async (text, params) => {
            calls.push({ text, params });
            return { rows: [{ max_id: '7' }] };
        };
        assert.equal(await getLastMessageIdForChannel(query, 'chan-uuid'), 7);
        assert.equal(calls[0].text, LAST_MESSAGE_ID_SQL);
    });

    it('N: existing saveMessages semantics remain unchanged', async () => {
        assert.equal(SAVE_MESSAGES_CONFLICT.includes('ON CONFLICT (message_id, channel_id) DO NOTHING'), true);
        assert.equal(await saveMessages(async () => ({ rowCount: 0 }), 'chan', []), 0);
        const query = async () => ({ rowCount: 1 });
        const saved = await saveMessages(query, 'chan', [{
            message_id: 1n,
            message_text: 'x',
            message_type: 'text',
            has_media: false,
            telegram_created_at: new Date('2024-01-01T00:00:00Z'),
            sender_id: null,
            sender_username: null,
            normalized: {},
        }]);
        assert.equal(saved, 1);
    });
});

describe('cleanup: destroy is canonical terminal teardown', () => {
    it('prefers destroy() and does not also call disconnect()', async () => {
        const { client, calls } = createFakeClient({});
        const result = await disconnectClientSafe(client);
        assert.equal(result.disconnected, true);
        assert.equal(result.method, 'destroy');
        assert.equal(calls.destroy, 1);
        assert.equal(calls.disconnect, 0);
    });

    it('falls back to disconnect() when destroy is absent', async () => {
        const { client, calls } = createFakeClient({ includeDestroy: false });
        const result = await disconnectClientSafe(client);
        assert.equal(result.method, 'disconnect');
        assert.equal(calls.disconnect, 1);
        assert.equal(calls.destroy, 0);
    });

    it('swallows destroy errors and remains bounded', async () => {
        const { client } = createFakeClient({ destroyThrows: new Error('already closed') });
        const result = await disconnectClientSafe(client);
        assert.equal(result.disconnected, true);
        assert.equal(result.method, 'destroy');
    });
});

describe('session identity: assigned account_id fails closed', () => {
    it('does not fall back to primary when an assigned account session is missing', async () => {
        let primaryLoads = 0;
        await assert.rejects(
            () => resolvePollingSession({
                requestedAccountId: 'acc-1',
                loadAccountSession: async () => {
                    throw new Error('missing');
                },
                loadPrimarySession: async () => {
                    primaryLoads += 1;
                    return { sessionString: 'PRIMARY_SESSION' };
                },
                loadLegacySession: async () => ({ sessionString: 'LEGACY_SESSION' }),
            }),
            (err) => err && err.code === 'TELEGRAM_ACCOUNT_SESSION_UNAVAILABLE'
        );
        assert.equal(primaryLoads, 0);
    });

    it('two failed account groups do not share the primary credential', async () => {
        const sessions = [];
        const loadAccountSession = async () => {
            throw new Error('unavailable');
        };
        const loadPrimarySession = async () => ({ sessionString: 'SHARED_PRIMARY' });
        for (const accountId of ['acc-1', 'acc-2']) {
            try {
                const resolved = await resolvePollingSession({
                    requestedAccountId: accountId,
                    loadAccountSession,
                    loadPrimarySession,
                    loadLegacySession: async () => null,
                });
                sessions.push(resolved.identityKey);
            } catch (error) {
                sessions.push(error.code);
            }
        }
        assert.deepEqual(sessions, [
            'TELEGRAM_ACCOUNT_SESSION_UNAVAILABLE',
            'TELEGRAM_ACCOUNT_SESSION_UNAVAILABLE',
        ]);
    });

    it('shared-primary still uses primary then legacy fallback', async () => {
        const primary = await resolvePollingSession({
            requestedAccountId: null,
            loadAccountSession: async () => {
                throw new Error('should not load account session');
            },
            loadPrimarySession: async () => ({ sessionString: 'PRIMARY' }),
            loadLegacySession: async () => ({ sessionString: 'LEGACY' }),
        });
        assert.equal(primary.identityKey, SHARED_PRIMARY_IDENTITY);
        assert.equal(primary.source, 'primary');
        const legacy = await resolvePollingSession({
            requestedAccountId: null,
            loadAccountSession: async () => null,
            loadPrimarySession: async () => null,
            loadLegacySession: async () => ({ sessionString: 'LEGACY' }),
        });
        assert.equal(legacy.source, 'legacy');
        assert.equal(legacy.identityKey, SHARED_PRIMARY_IDENTITY);
    });
});
