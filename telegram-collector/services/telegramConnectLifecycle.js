/**
 * Verified GramJS 2.26.22 connection lifecycle helpers.
 * Public constructor options cannot bound every reconnect entrypoint.
 * Exact path proof lives in services/__tests__/gramjs.contract.test.js
 * against the installed telegram package — do not treat this file as that proof.
 * No pg / gramJS imports (safe for unit tests that do not install telegram).
 */

const SHARED_PRIMARY_IDENTITY = 'shared-primary';

/**
 * Best-effort public options for an ephemeral C1 client.
 *
 * connectionRetries: 1
 *   TelegramClient.connect() passes this as MTProtoSender `_retries`.
 *   MTProtoSender.connect() loops `for (attempt = 0; attempt < this._retries; ...)`.
 *   0 = zero initial attempts. 1 = one initial attempt.
 *
 * reconnectRetries: -1
 *   ONLY the `_recvLoop` transport `recv()` failure path checks
 *   `_currentRetries > this._reconnectRetries` before calling reconnect().
 *   Send-loop, InvalidBufferError non-404, unhandled decrypt, ping/_updateLoop,
 *   and exported-sender `_reconnect()` do not consult this option.
 *   This is PARTIAL recv-path control, not "automatic reconnect disabled".
 *
 * autoReconnect: false
 *   Stored on MTProtoSender as `_autoReconnect`. telegram@2.26.22 reconnect()
 *   never reads `_autoReconnect`. Classification: NONE_FOR_RELEVANT_PATHS.
 *
 * PUBLIC_RECONNECT_CONTROL_SUFFICIENT = NO
 * DESTROY_RECONNECT_RACE = POSSIBLE
 *   reconnect() schedules Helpers.sleep(1000).then(() => this._reconnect())
 *   with no `_destroyed` / `userDisconnected` check in that callback.
 *   _reconnect() → connect() sets `userDisconnected = false` at entry.
 */
const GRAMJS_EPHEMERAL_CLIENT_OPTIONS = Object.freeze({
    connectionRetries: 1,
    reconnectRetries: -1,
    autoReconnect: false,
});

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
    resolvePollingSession,
    isProvenConnected,
    connectAndProve,
    accountIdFromGroup,
    connectProvenSessionClient,
    disconnectClientSafe,
};
