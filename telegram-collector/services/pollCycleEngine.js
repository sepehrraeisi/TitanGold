/**
 * Polling-cycle engine: session-identity client reuse + bounded channel work.
 * No pg / gramJS imports (safe for unit tests with fake clients).
 */

const { parsePollConcurrency, mapWithConcurrency } = require('./pollConcurrency');

const SHARED_PRIMARY_IDENTITY = 'shared-primary';

function isTimeoutError(error) {
    if (!error) {
        return false;
    }
    const code = error.code || error.errorCode;
    if (code === 'ETIMEDOUT' || code === 'TIMEOUT') {
        return true;
    }
    const msg = String(error.errorMessage || error.message || '');
    return error.errorMessage === 'TIMEOUT' || /\bTIMEOUT\b/i.test(msg);
}

function sessionIdentityKey(channel) {
    if (channel && channel.account_id != null && String(channel.account_id).length > 0) {
        return `account:${String(channel.account_id)}`;
    }
    return SHARED_PRIMARY_IDENTITY;
}

function groupChannelsBySessionIdentity(channels) {
    const list = Array.isArray(channels) ? channels : [];
    const map = new Map();
    for (const channel of list) {
        const identityKey = sessionIdentityKey(channel);
        if (!map.has(identityKey)) {
            map.set(identityKey, []);
        }
        map.get(identityKey).push(channel);
    }
    return Array.from(map.entries()).map(([identityKey, grouped]) => ({
        identityKey,
        channels: grouped,
    }));
}

async function disconnectClientSafe(client) {
    if (!client) {
        return { disconnected: false };
    }
    try {
        if (typeof client.disconnect === 'function') {
            await client.disconnect();
        }
    } catch (_err) {
        // Ignore disconnect errors — cleanup must remain best-effort and non-throwing.
    }
    try {
        if (typeof client.destroy === 'function') {
            await client.destroy();
        }
    } catch (_err) {
        // Optional gramJS destroy; ignore if unsupported or already closed.
    }
    return { disconnected: true };
}

function emptySummary(pollConcurrency) {
    return {
        channelsAttempted: 0,
        channelsSucceeded: 0,
        channelsFailed: 0,
        pollConcurrency,
        connectAttempts: 0,
        timeoutCount: 0,
        durationMs: 0,
    };
}

function formatCycleSummary(summary) {
    return [
        'polling_cycle',
        `attempted=${summary.channelsAttempted}`,
        `succeeded=${summary.channelsSucceeded}`,
        `failed=${summary.channelsFailed}`,
        `concurrency=${summary.pollConcurrency}`,
        `connects=${summary.connectAttempts}`,
        `timeouts=${summary.timeoutCount}`,
        `duration_ms=${summary.durationMs}`,
    ].join(' ');
}

class PollCycleEngine {
    /**
     * @param {{
     *   pollConcurrency?: number|string,
     *   getActiveChannels: () => Promise<unknown[]>,
     *   connectSession: (identityKey: string, channels: unknown[]) => Promise<object>,
     *   pollChannel: (client: object, channel: unknown) => Promise<{success: boolean, messagesCount?: number, timeout?: boolean, error?: string}>,
     *   disconnectClient?: (client: object|null) => Promise<unknown>,
     * }} options
     */
    constructor(options) {
        this.pollConcurrency = parsePollConcurrency(options.pollConcurrency);
        this.getActiveChannels = options.getActiveChannels;
        this.connectSession = options.connectSession;
        this.pollChannel = options.pollChannel;
        this.disconnectClient = options.disconnectClient || disconnectClientSafe;
        this.isRunning = false;
    }

    async runPollingCycle() {
        if (this.isRunning) {
            return { skipped: true, reason: 'cycle_in_flight' };
        }

        this.isRunning = true;
        const started = Date.now();
        const summary = emptySummary(this.pollConcurrency);
        const results = [];

        try {
            const channels = await this.getActiveChannels();
            const list = Array.isArray(channels) ? channels : [];
            summary.channelsAttempted = list.length;

            if (list.length === 0) {
                summary.durationMs = Date.now() - started;
                return { skipped: false, results, summary };
            }

            const groups = groupChannelsBySessionIdentity(list);

            for (const group of groups) {
                let client = null;
                try {
                    summary.connectAttempts += 1;
                    client = await this.connectSession(group.identityKey, group.channels);
                    const groupResults = await mapWithConcurrency(
                        group.channels,
                        this.pollConcurrency,
                        (channel) => this.pollChannel(client, channel)
                    );

                    for (const item of groupResults) {
                        if (item.status === 'fulfilled') {
                            const value = item.value || {};
                            if (value.timeout || isTimeoutError({ message: value.error })) {
                                summary.timeoutCount += 1;
                            }
                            if (value.success) {
                                summary.channelsSucceeded += 1;
                            } else {
                                summary.channelsFailed += 1;
                            }
                            results.push(item);
                        } else {
                            const timeout = isTimeoutError(item.reason);
                            if (timeout) {
                                summary.timeoutCount += 1;
                            }
                            summary.channelsFailed += 1;
                            results.push(item);
                        }
                    }
                } catch (error) {
                    if (isTimeoutError(error)) {
                        summary.timeoutCount += 1;
                    }
                    for (const _channel of group.channels) {
                        summary.channelsFailed += 1;
                        results.push({
                            status: 'fulfilled',
                            value: {
                                success: false,
                                messagesCount: 0,
                                timeout: isTimeoutError(error),
                                error: error && error.message ? error.message : String(error),
                            },
                        });
                    }
                } finally {
                    await this.disconnectClient(client);
                    client = null;
                }
            }

            summary.durationMs = Date.now() - started;
            return { skipped: false, results, summary };
        } catch (error) {
            summary.durationMs = Date.now() - started;
            throw error;
        } finally {
            this.isRunning = false;
        }
    }
}

module.exports = {
    SHARED_PRIMARY_IDENTITY,
    isTimeoutError,
    sessionIdentityKey,
    groupChannelsBySessionIdentity,
    disconnectClientSafe,
    formatCycleSummary,
    PollCycleEngine,
};
