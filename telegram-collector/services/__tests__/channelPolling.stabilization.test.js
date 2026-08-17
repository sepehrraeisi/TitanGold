/**
 * Deterministic C1 tests for telegram-collector polling concurrency + client lifecycle.
 * No provider/network calls. No live DB required.
 */
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const {
    DEFAULT_POLL_CONCURRENCY,
    MIN_POLL_CONCURRENCY,
    MAX_POLL_CONCURRENCY,
    parsePollConcurrency,
    mapWithConcurrency,
} = require('../pollConcurrency');

const {
    isTimeoutError,
    sessionIdentityKey,
    groupChannelsBySessionIdentity,
    disconnectClientSafe,
    PollCycleEngine,
    SHARED_PRIMARY_IDENTITY,
} = require('../pollCycleEngine');

const {
    LAST_MESSAGE_ID_SQL,
    SAVE_MESSAGES_CONFLICT,
    getLastMessageIdForChannel,
    saveMessages,
    buildSaveMessagesQuery,
} = require('../pollQueries');

function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function channel(id, accountId) {
    return { id, account_id: accountId || null, title: `ch-${id}` };
}

function createFakeClient(label, tracker) {
    return {
        label,
        disconnectCalls: 0,
        async disconnect() {
            this.disconnectCalls += 1;
            tracker.disconnects.push(label);
        },
        async getMessages() {
            return [];
        },
    };
}

describe('O: parsePollConcurrency', () => {
    it('uses conservative default for invalid values', () => {
        assert.equal(DEFAULT_POLL_CONCURRENCY, 3);
        assert.equal(MIN_POLL_CONCURRENCY, 1);
        assert.equal(MAX_POLL_CONCURRENCY, 10);
        assert.equal(parsePollConcurrency(undefined), 3);
        assert.equal(parsePollConcurrency(''), 3);
        assert.equal(parsePollConcurrency('0'), 3);
        assert.equal(parsePollConcurrency('-3'), 3);
        assert.equal(parsePollConcurrency('abc'), 3);
        assert.equal(parsePollConcurrency(Number.NaN), 3);
        assert.equal(parsePollConcurrency(null), 3);
    });

    it('accepts in-range integers and clamps above max', () => {
        assert.equal(parsePollConcurrency('1'), 1);
        assert.equal(parsePollConcurrency(3), 3);
        assert.equal(parsePollConcurrency('10'), 10);
        assert.equal(parsePollConcurrency(11), 10);
        assert.equal(parsePollConcurrency('99'), 10);
    });
});

describe('A/B/C: mapWithConcurrency bound', () => {
    it('A: never exceeds configured concurrency', async () => {
        const items = Array.from({ length: 20 }, (_, i) => i);
        let inFlight = 0;
        let peak = 0;
        await mapWithConcurrency(items, 3, async () => {
            inFlight += 1;
            peak = Math.max(peak, inFlight);
            await delay(15);
            inFlight -= 1;
        });
        assert.ok(peak <= 3, `peak ${peak} > 3`);
        assert.ok(peak >= 1);
    });

    it('B: batch of 10 with concurrency 3 never has >3 active operations', async () => {
        const items = Array.from({ length: 10 }, (_, i) => i);
        let inFlight = 0;
        let peak = 0;
        const seen = [];
        await mapWithConcurrency(items, 3, async (item) => {
            inFlight += 1;
            peak = Math.max(peak, inFlight);
            seen.push(item);
            await delay(20);
            inFlight -= 1;
        });
        assert.ok(peak <= 3, `peak ${peak} > 3`);
        assert.equal(seen.length, 10);
    });

    it('C: all channels are eventually processed despite bounded concurrency', async () => {
        const items = Array.from({ length: 10 }, (_, i) => i);
        const seen = [];
        const results = await mapWithConcurrency(items, 3, async (item) => {
            seen.push(item);
            return item;
        });
        assert.deepEqual([...seen].sort((a, b) => a - b), items);
        assert.equal(results.length, 10);
        assert.ok(results.every((r) => r.status === 'fulfilled'));
    });
});

describe('session identity grouping', () => {
    it('I: different session identities are never grouped together', () => {
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
        const keys = groups.map((g) => g.identityKey).sort();
        assert.deepEqual(keys, ['account:acc-1', 'account:acc-2', SHARED_PRIMARY_IDENTITY].sort());
    });

    it('same account_id shares one identity', () => {
        const channels = [channel('a', 'acc-1'), channel('b', 'acc-1'), channel('c', 'acc-1')];
        const groups = groupChannelsBySessionIdentity(channels);
        assert.equal(groups.length, 1);
        assert.equal(groups[0].channels.length, 3);
    });
});

describe('PollCycleEngine lifecycle', () => {
    it('B+C: batch 10 concurrency 3 processes all and never exceeds 3 in-flight', async () => {
        const channels = Array.from({ length: 10 }, (_, i) => channel(`c${i}`, 'acc-1'));
        let inFlight = 0;
        let peak = 0;
        const tracker = { disconnects: [] };
        const clients = [];

        const engine = new PollCycleEngine({
            pollConcurrency: 3,
            getActiveChannels: async () => channels,
            connectSession: async () => {
                const client = createFakeClient('shared', tracker);
                clients.push(client);
                return client;
            },
            pollChannel: async (client, ch) => {
                inFlight += 1;
                peak = Math.max(peak, inFlight);
                await delay(20);
                inFlight -= 1;
                return { success: true, messagesCount: 1, client: client.label, channelId: ch.id };
            },
        });

        const outcome = await engine.runPollingCycle();
        assert.equal(outcome.skipped, false);
        assert.equal(outcome.summary.channelsAttempted, 10);
        assert.equal(outcome.summary.channelsSucceeded, 10);
        assert.equal(outcome.results.length, 10);
        assert.ok(peak <= 3, `peak ${peak} > 3`);
        assert.equal(clients.length, 1);
        assert.equal(tracker.disconnects.length, 1);
    });

    it('D: one channel failure does not abort unrelated channels', async () => {
        const channels = [channel('ok1', 'acc-1'), channel('bad', 'acc-1'), channel('ok2', 'acc-1')];
        const seen = [];
        const engine = new PollCycleEngine({
            pollConcurrency: 2,
            getActiveChannels: async () => channels,
            connectSession: async () => createFakeClient('c', { disconnects: [] }),
            pollChannel: async (_client, ch) => {
                seen.push(ch.id);
                if (ch.id === 'bad') {
                    return { success: false, messagesCount: 0, error: 'boom' };
                }
                return { success: true, messagesCount: 0 };
            },
        });
        const outcome = await engine.runPollingCycle();
        assert.deepEqual([...seen].sort(), ['bad', 'ok1', 'ok2']);
        assert.equal(outcome.summary.channelsSucceeded, 2);
        assert.equal(outcome.summary.channelsFailed, 1);
    });

    it('E: isRunning prevents cycle overlap', async () => {
        let release;
        const gate = new Promise((resolve) => {
            release = resolve;
        });
        const engine = new PollCycleEngine({
            pollConcurrency: 1,
            getActiveChannels: async () => [channel('a', 'acc-1')],
            connectSession: async () => createFakeClient('c', { disconnects: [] }),
            pollChannel: async () => {
                await gate;
                return { success: true, messagesCount: 0 };
            },
        });

        const first = engine.runPollingCycle();
        await delay(10);
        assert.equal(engine.isRunning, true);
        const second = await engine.runPollingCycle();
        assert.equal(second.skipped, true);
        assert.equal(second.reason, 'cycle_in_flight');
        release();
        const firstResult = await first;
        assert.equal(firstResult.skipped, false);
        assert.equal(engine.isRunning, false);
    });

    it('F: isRunning clears after success', async () => {
        const engine = new PollCycleEngine({
            pollConcurrency: 1,
            getActiveChannels: async () => [channel('a')],
            connectSession: async () => createFakeClient('c', { disconnects: [] }),
            pollChannel: async () => ({ success: true, messagesCount: 0 }),
        });
        await engine.runPollingCycle();
        assert.equal(engine.isRunning, false);
    });

    it('G: isRunning clears after failure/timeout', async () => {
        const engine = new PollCycleEngine({
            pollConcurrency: 1,
            getActiveChannels: async () => [channel('a', 'acc-1')],
            connectSession: async () => {
                const err = new Error('TIMEOUT');
                err.errorMessage = 'TIMEOUT';
                throw err;
            },
            pollChannel: async () => ({ success: true, messagesCount: 0 }),
        });
        const outcome = await engine.runPollingCycle();
        assert.equal(engine.isRunning, false);
        assert.equal(outcome.summary.channelsFailed, 1);
        assert.ok(outcome.summary.timeoutCount >= 1);
    });

    it('H: same authenticated session identity does not reconnect once per channel', async () => {
        const channels = Array.from({ length: 10 }, (_, i) => channel(`c${i}`, 'acc-1'));
        let connects = 0;
        const clientsUsed = new Set();
        const engine = new PollCycleEngine({
            pollConcurrency: 3,
            getActiveChannels: async () => channels,
            connectSession: async (identityKey) => {
                connects += 1;
                return createFakeClient(identityKey, { disconnects: [] });
            },
            pollChannel: async (client, ch) => {
                clientsUsed.add(client.label);
                return { success: true, messagesCount: 0, channelId: ch.id };
            },
        });
        const outcome = await engine.runPollingCycle();
        assert.equal(connects, 1);
        assert.equal(outcome.summary.connectAttempts, 1);
        assert.equal(clientsUsed.size, 1);
        assert.equal(outcome.results.length, 10);
    });

    it('I: different session identities never share a client', async () => {
        const channels = [
            channel('a', 'acc-1'),
            channel('b', 'acc-2'),
            channel('c', null),
        ];
        const clientByChannel = {};
        const engine = new PollCycleEngine({
            pollConcurrency: 3,
            getActiveChannels: async () => channels,
            connectSession: async (identityKey) => createFakeClient(identityKey, { disconnects: [] }),
            pollChannel: async (client, ch) => {
                clientByChannel[ch.id] = client.label;
                return { success: true, messagesCount: 0 };
            },
        });
        await engine.runPollingCycle();
        assert.equal(clientByChannel.a, 'account:acc-1');
        assert.equal(clientByChannel.b, 'account:acc-2');
        assert.equal(clientByChannel.c, SHARED_PRIMARY_IDENTITY);
        assert.notEqual(clientByChannel.a, clientByChannel.b);
        assert.notEqual(clientByChannel.a, clientByChannel.c);
    });

    it('J: client disconnect/cleanup occurs once per connected identity including errors', async () => {
        const tracker = { disconnects: [] };
        const engine = new PollCycleEngine({
            pollConcurrency: 2,
            getActiveChannels: async () => [channel('a', 'acc-1'), channel('b', 'acc-1')],
            connectSession: async () => createFakeClient('shared', tracker),
            pollChannel: async (_client, ch) => {
                if (ch.id === 'b') {
                    throw new Error('TIMEOUT');
                }
                return { success: true, messagesCount: 0 };
            },
        });
        await engine.runPollingCycle();
        assert.equal(tracker.disconnects.length, 1);
    });

    it('K: TIMEOUT cannot create unbounded immediate retries', async () => {
        let connects = 0;
        let polls = 0;
        const engine = new PollCycleEngine({
            pollConcurrency: 3,
            getActiveChannels: async () => [channel('a', 'acc-1')],
            connectSession: async () => {
                connects += 1;
                const err = new Error('TIMEOUT');
                err.errorMessage = 'TIMEOUT';
                throw err;
            },
            pollChannel: async () => {
                polls += 1;
                return { success: true, messagesCount: 0 };
            },
        });
        const outcome = await engine.runPollingCycle();
        assert.equal(connects, 1);
        assert.equal(polls, 0);
        assert.equal(outcome.summary.connectAttempts, 1);
        assert.ok(outcome.summary.timeoutCount >= 1);
    });

    it('L: concurrency control does not duplicate channel work / persistence calls', async () => {
        const channels = Array.from({ length: 10 }, (_, i) => channel(`c${i}`, 'acc-1'));
        const persistCalls = [];
        const engine = new PollCycleEngine({
            pollConcurrency: 3,
            getActiveChannels: async () => channels,
            connectSession: async () => createFakeClient('c', { disconnects: [] }),
            pollChannel: async (_client, ch) => {
                persistCalls.push(ch.id);
                return { success: true, messagesCount: 1 };
            },
        });
        await engine.runPollingCycle();
        assert.equal(persistCalls.length, 10);
        assert.equal(new Set(persistCalls).size, 10);
    });
});

describe('J: disconnectClientSafe', () => {
    it('is a no-op for null and swallows disconnect errors', async () => {
        const none = await disconnectClientSafe(null);
        assert.equal(none.disconnected, false);
        const client = {
            async disconnect() {
                throw new Error('already closed');
            },
        };
        const result = await disconnectClientSafe(client);
        assert.equal(result.disconnected, true);
    });
});

describe('M: getLastMessageIdForChannel semantics unchanged', () => {
    it('uses MAX(message_id) WHERE channel_id = $1', async () => {
        assert.equal(
            LAST_MESSAGE_ID_SQL,
            'SELECT MAX(message_id) AS max_id FROM telegram_messages WHERE channel_id = $1'
        );
        const calls = [];
        const query = async (text, params) => {
            calls.push({ text, params });
            return { rows: [{ max_id: '42' }] };
        };
        const maxId = await getLastMessageIdForChannel(query, 'chan-uuid');
        assert.equal(maxId, 42);
        assert.equal(calls.length, 1);
        assert.equal(calls[0].text, LAST_MESSAGE_ID_SQL);
        assert.deepEqual(calls[0].params, ['chan-uuid']);
    });

    it('returns 0 when no rows / null max', async () => {
        const query = async () => ({ rows: [{ max_id: null }] });
        assert.equal(await getLastMessageIdForChannel(query, 'x'), 0);
    });
});

describe('N: saveMessages behavior unchanged', () => {
    it('no-ops empty batches and uses ON CONFLICT (message_id, channel_id) DO NOTHING', async () => {
        let called = 0;
        const query = async () => {
            called += 1;
            return { rowCount: 0 };
        };
        assert.equal(await saveMessages(query, 'chan', []), 0);
        assert.equal(called, 0);

        const built = buildSaveMessagesQuery([
            {
                channelDbId: 'chan',
                message_id: 9,
                sender_id: null,
                sender_username: null,
                message_text: 't',
                message_type: 'text',
                has_media: false,
                telegram_created_at: new Date('2026-01-01T00:00:00Z'),
            },
        ]);
        assert.match(built.text, /ON CONFLICT \(message_id, channel_id\) DO NOTHING/);
        assert.equal(built.params[0], 'chan');
        assert.equal(built.params[1], '9');

        const insertQuery = async (text, params) => {
            assert.ok(text.includes('INSERT INTO telegram_messages'));
            assert.ok(text.includes('ON CONFLICT (message_id, channel_id) DO NOTHING'));
            assert.equal(params[0], 'chan');
            return { rowCount: 1 };
        };
        assert.equal(await saveMessages(insertQuery, 'chan', [{
            message_id: 9,
            sender_id: null,
            sender_username: null,
            message_text: 't',
            message_type: 'text',
            has_media: false,
            telegram_created_at: new Date('2026-01-01T00:00:00Z'),
        }]), 1);
    });
});

describe('timeout classification', () => {
    it('recognizes gramJS TIMEOUT without treating unrelated errors as timeout', () => {
        assert.equal(isTimeoutError({ errorMessage: 'TIMEOUT' }), true);
        assert.equal(isTimeoutError(new Error('TIMEOUT')), true);
        assert.equal(isTimeoutError({ code: 'ETIMEDOUT' }), true);
        assert.equal(isTimeoutError(new Error('FLOOD_WAIT')), false);
        assert.equal(isTimeoutError(null), false);
    });
});
