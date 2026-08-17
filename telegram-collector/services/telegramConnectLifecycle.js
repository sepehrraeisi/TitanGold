/**
 * Verified GramJS 2.26.22 connection lifecycle helpers.
 * Source: telegram@2.26.22 network/MTProtoSender.js + client/TelegramClient.js
 * No pg / gramJS imports (safe for unit tests).
 */

const SHARED_PRIMARY_IDENTITY = 'shared-primary';

/**
 * Exact MTProtoSender.connect loop:
 *   for (let attempt = 0; attempt < retries; attempt++)
 * TelegramClient.connect() passes clientParams.connectionRetries as sender retries.
 *
 * connectionRetries=0 => zero initial attempts (loop never runs).
 * connectionRetries=1 => exactly one initial attempt.
 *
 * reconnectRetries is checked as `_currentRetries > reconnectRetries` BEFORE
 * calling reconnect(). _currentRetries starts at 0, so:
 *   reconnectRetries=0  => one automatic reconnect is still allowed (0 > 0 is false)
 *   reconnectRetries=-1 => automatic reconnect is skipped (0 > -1 is true)
 *
 * autoReconnect is stored on MTProtoSender in 2.26.22 but does NOT gate reconnect().
 * It is still set false so we do not request the default autoReconnect:true contract.
 */
const GRAMJS_EPHEMERAL_CLIENT_OPTIONS = Object.freeze({
    connectionRetries: 1,
    reconnectRetries: -1,
    autoReconnect: false,
});

function gramJsInitialConnectAttemptCount(connectionRetries) {
    let attempts = 0;
    for (let attempt = 0; attempt < connectionRetries; attempt += 1) {
        attempts += 1;
    }
    return attempts;
}

function gramJsWouldAttemptAutomaticReconnect(currentRetries, reconnectRetries) {
    return !(currentRetries > reconnectRetries);
}

async function resolvePollingSession({
    requestedAccountId,
    loadAccountSession,
    loadPrimarySession,
    loadLegacySession,
}) {
    if (requestedAccountId != null && String(requestedAccountId).length > 0) {
        let accountSession;
        try {
            accountSession = await loadAccountSession(requestedAccountId);
        } catch (error) {
            const err = new Error(
                `Assigned Telegram account session unavailable for account ${requestedAccountId}`
            );
            err.code = 'TELEGRAM_ACCOUNT_SESSION_UNAVAILABLE';
            err.cause = error;
            throw err;
        }
        if (!accountSession || !accountSession.sessionString) {
            const err = new Error(
                `Assigned Telegram account session unavailable for account ${requestedAccountId}`
            );
            err.code = 'TELEGRAM_ACCOUNT_SESSION_UNAVAILABLE';
            throw err;
        }
        return {
            identityKey: `account:${String(requestedAccountId)}`,
            source: 'account',
            sessionString: accountSession.sessionString,
        };
    }

    const primary = loadPrimarySession ? await loadPrimarySession() : null;
    if (primary && primary.sessionString) {
        return {
            identityKey: SHARED_PRIMARY_IDENTITY,
            source: 'primary',
            sessionString: primary.sessionString,
        };
    }

    const legacy = loadLegacySession ? await loadLegacySession() : null;
    if (legacy && legacy.sessionString) {
        return {
            identityKey: SHARED_PRIMARY_IDENTITY,
            source: 'legacy',
            sessionString: legacy.sessionString,
        };
    }

    throw new Error('No active Telegram session found. Please complete login first.');
}

function isProvenConnected(client, connectResult) {
    if (connectResult === false) {
        return false;
    }
    if (client && client.connected === false) {
        return false;
    }
    if (connectResult === true) {
        return true;
    }
    if (client && client.connected === true) {
        return true;
    }
    return false;
}

async function connectAndProve(client) {
    if (!client || typeof client.connect !== 'function') {
        const err = new Error('Telegram client cannot connect');
        err.code = 'TELEGRAM_CONNECT_FAILED';
        throw err;
    }
    const connectResult = await client.connect();
    if (!isProvenConnected(client, connectResult)) {
        const err = new Error('Telegram connection was not established');
        err.code = 'TELEGRAM_CONNECT_FAILED';
        throw err;
    }
    return client;
}

function accountIdFromGroup(identityKey, channels) {
    if (identityKey && String(identityKey).startsWith('account:')) {
        return String(identityKey).slice('account:'.length);
    }
    return (channels && channels[0] && channels[0].account_id) || null;
}

async function connectProvenSessionClient(identityKey, channels, getTelegramClient) {
    const accountId = accountIdFromGroup(identityKey, channels);
    const client = await getTelegramClient(accountId);
    try {
        return await connectAndProve(client);
    } catch (error) {
        if (error && typeof error === 'object') {
            error.telegramClient = client;
        }
        throw error;
    }
}

/**
 * Canonical terminal cleanup for ephemeral C1 clients.
 * GramJS 2.26.22 destroy() already calls disconnect() and clears event builders.
 * Prefer destroy() when present; otherwise disconnect().
 * Do not call both — destroy() already disconnects.
 */
async function disconnectClientSafe(client) {
    if (!client) {
        return { disconnected: false, method: null };
    }
    if (typeof client.destroy === 'function') {
        try {
            await client.destroy();
        } catch (_err) {
            // Cleanup errors remain bounded.
        }
        return { disconnected: true, method: 'destroy' };
    }
    if (typeof client.disconnect === 'function') {
        try {
            await client.disconnect();
        } catch (_err) {
            // Cleanup errors remain bounded.
        }
        return { disconnected: true, method: 'disconnect' };
    }
    return { disconnected: false, method: null };
}

module.exports = {
    SHARED_PRIMARY_IDENTITY,
    GRAMJS_EPHEMERAL_CLIENT_OPTIONS,
    gramJsInitialConnectAttemptCount,
    gramJsWouldAttemptAutomaticReconnect,
    resolvePollingSession,
    isProvenConnected,
    connectAndProve,
    accountIdFromGroup,
    connectProvenSessionClient,
    disconnectClientSafe,
};
