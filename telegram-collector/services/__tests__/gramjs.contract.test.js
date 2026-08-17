/**
 * Dependency-backed residual-risk contract for telegram@2.26.22.
 * Documents library reconnect limitations. Does NOT claim C1 fixed those paths.
 * Reads the installed package implementation. Does not reimplement GramJS.
 * No Telegram network. No credentials. No live DB.
 */
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const REQUIRED_TELEGRAM_VERSION = '2.26.22';

function loadInstalled(relFromPackage) {
    let resolved;
    try {
        resolved = require.resolve(relFromPackage);
    } catch (error) {
        const err = new Error(
            `telegram package not installed; run npm ci in telegram-collector. Missing ${relFromPackage}`
        );
        err.cause = error;
        throw err;
    }
    return {
        resolved,
        source: fs.readFileSync(resolved, 'utf8'),
    };
}

function extractBalancedBlock(source, startIdx) {
    const open = source.indexOf('{', startIdx);
    if (open < 0) {
        throw new Error('opening brace not found');
    }
    let depth = 0;
    for (let i = open; i < source.length; i += 1) {
        const ch = source[i];
        if (ch === '{') {
            depth += 1;
        } else if (ch === '}') {
            depth -= 1;
            if (depth === 0) {
                return source.slice(open, i + 1);
            }
        }
    }
    throw new Error('unbalanced braces');
}

function extractMethod(source, signature) {
    const padded = `\n    ${signature}`;
    let idx = source.indexOf(padded);
    if (idx < 0) {
        idx = source.indexOf(`\nasync function ${signature}`);
    }
    if (idx < 0) {
        idx = source.indexOf(`\nfunction ${signature}`);
    }
    assert.notEqual(idx, -1, `missing signature: ${signature}`);
    return extractBalancedBlock(source, idx);
}

describe('installed telegram@2.26.22 residual reconnect risk (NOT fixed by C1)', () => {
    it('resolves exact package version 2.26.22', () => {
        const pkg = require('telegram/package.json');
        assert.equal(pkg.version, REQUIRED_TELEGRAM_VERSION);
        const lockPath = path.join(__dirname, '../../package-lock.json');
        const lock = JSON.parse(fs.readFileSync(lockPath, 'utf8'));
        assert.equal(lock.packages['node_modules/telegram'].version, REQUIRED_TELEGRAM_VERSION);
    });

    it('initial connect uses attempt < this._retries (0 attempts when retries=0)', () => {
        const { source, resolved } = loadInstalled('telegram/network/MTProtoSender.js');
        assert.match(resolved, /node_modules\/telegram\/network\/MTProtoSender\.js$/);
        const connect = extractMethod(source, 'async connect(connection, force)');
        assert.equal(
            connect.includes('for (let attempt = 0; attempt < this._retries; attempt++)'),
            true
        );
        const client = loadInstalled('telegram/client/TelegramClient.js').source;
        const clientConnect = extractMethod(client, 'async connect()');
        assert.equal(clientConnect.includes('retries: this._connectionRetries'), true);
    });

    it('autoReconnect does not gate reconnect() — NONE_FOR_RELEVANT_PATHS', () => {
        const { source } = loadInstalled('telegram/network/MTProtoSender.js');
        const reconnect = extractMethod(source, 'reconnect() {');
        assert.equal(reconnect.includes('_autoReconnectCallback'), false);
        assert.equal(reconnect.includes('this._autoReconnect'), false);
        assert.equal(/if\s*\(\s*this\._autoReconnect\b/.test(source), false);
        const reconnectFnCount = (source.match(/\breconnect\(\)/g) || []).length;
        assert.ok(reconnectFnCount >= 1);
    });

    it('send-loop transport failure calls reconnect() without reconnectRetries', () => {
        const { source } = loadInstalled('telegram/network/MTProtoSender.js');
        const sendLoop = extractMethod(source, 'async _sendLoop()');
        const sendCall = sendLoop.indexOf('await this._connection.send(data);');
        assert.notEqual(sendCall, -1);
        const catchIdx = sendLoop.indexOf('catch (e)', sendCall);
        assert.notEqual(catchIdx, -1);
        const sendCatch = extractBalancedBlock(sendLoop, catchIdx);
        assert.equal(sendCatch.includes('this.reconnect()'), true);
        assert.equal(sendCatch.includes('_reconnectRetries'), false);
        assert.equal(sendCatch.includes('_currentRetries'), false);
        assert.equal(sendCatch.includes('_autoReconnect'), false);
    });

    it('recv-loop transport failure IS gated by reconnectRetries before reconnect()', () => {
        const { source } = loadInstalled('telegram/network/MTProtoSender.js');
        const recvLoop = extractMethod(source, 'async _recvLoop()');
        const recvCall = recvLoop.indexOf('body = await this._connection.recv();');
        assert.notEqual(recvCall, -1);
        const catchIdx = recvLoop.indexOf('catch (e)', recvCall);
        assert.notEqual(catchIdx, -1);
        const recvCatch = extractBalancedBlock(recvLoop, catchIdx);
        assert.equal(
            recvCatch.includes('if (this._currentRetries > this._reconnectRetries)'),
            true
        );
        const gateIdx = recvCatch.indexOf('this._currentRetries > this._reconnectRetries');
        const reconnectIdx = recvCatch.indexOf('this.reconnect()');
        assert.ok(gateIdx >= 0 && reconnectIdx > gateIdx);
        assert.equal(recvCatch.includes('_autoReconnect'), false);
    });

    it('InvalidBufferError non-404 and unhandled decrypt reconnect bypass reconnectRetries', () => {
        const { source } = loadInstalled('telegram/network/MTProtoSender.js');
        const recvLoop = extractMethod(source, 'async _recvLoop()');
        const invalid = recvLoop.indexOf('else if (e instanceof errors_1.InvalidBufferError)');
        assert.notEqual(invalid, -1);
        const invalidBlock = extractBalancedBlock(recvLoop, invalid);
        assert.equal(invalidBlock.includes('e.code === 404'), true);
        const warnIdx = invalidBlock.indexOf('Invalid buffer');
        assert.notEqual(warnIdx, -1);
        const non404Window = invalidBlock.slice(warnIdx, warnIdx + 400);
        assert.equal(non404Window.includes('this.reconnect()'), true);
        assert.equal(non404Window.includes('_reconnectRetries'), false);

        const unhandled = recvLoop.indexOf('Unhandled error while receiving data');
        assert.notEqual(unhandled, -1);
        const unhandledWindow = recvLoop.slice(unhandled, unhandled + 600);
        assert.equal(unhandledWindow.includes('this.reconnect()'), true);
        assert.equal(unhandledWindow.includes('_reconnectRetries'), false);
    });

    it('ping/_updateLoop reconnects without reconnectRetries or autoReconnect', () => {
        const { source, resolved } = loadInstalled('telegram/client/updates.js');
        assert.match(resolved, /node_modules\/telegram\/client\/updates\.js$/);
        const loop = extractMethod(source, '_updateLoop(client)');
        assert.equal(loop.includes('client._sender.reconnect()'), true);
        assert.equal(loop.includes('reconnectRetries'), false);
        assert.equal(loop.includes('_autoReconnect'), false);
        assert.equal(loop.includes('while (!client._destroyed)'), true);
    });

    it('reconnect() schedules async _reconnect after 1s without destroy cancellation', () => {
        const { source } = loadInstalled('telegram/network/MTProtoSender.js');
        const reconnect = extractMethod(source, 'reconnect() {');
        assert.equal(reconnect.includes('if (this._userConnected && !this.isReconnecting)'), true);
        assert.equal(reconnect.includes('_currentRetries++'), true);
        assert.equal(reconnect.includes('sender.reconnect()'), true);
        assert.equal(
            reconnect.includes('(0, Helpers_1.sleep)(1000).then(() => {'),
            true
        );
        assert.equal(reconnect.includes('this._reconnect()'), true);
        assert.equal(reconnect.includes('_destroyed'), false);
        assert.equal(reconnect.includes('userDisconnected'), false);
        assert.equal(reconnect.includes('_reconnectRetries'), false);
    });

    it('_reconnect() force-connects and resets userDisconnected via connect()', () => {
        const { source } = loadInstalled('telegram/network/MTProtoSender.js');
        const reconnectImpl = extractMethod(source, 'async _reconnect()');
        assert.equal(reconnectImpl.includes('await this.connect(newConnection, true)'), true);
        const connect = extractMethod(source, 'async connect(connection, force)');
        const firstLines = connect.slice(0, 180);
        assert.equal(firstLines.includes('this.userDisconnected = false'), true);
    });

    it('destroy() sets _destroyed then disconnect(); does not cancel reconnect sleep', () => {
        const { source } = loadInstalled('telegram/client/telegramBaseClient.js');
        const destroy = extractMethod(source, 'async destroy()');
        assert.equal(destroy.includes('this._destroyed = true'), true);
        assert.equal(destroy.includes('this.disconnect()'), true);
        assert.equal(destroy.includes('_eventBuilders = []'), true);
        assert.equal(destroy.includes('reconnect'), false);
    });

    it('exported-sender paths include unbounded connect retry and direct _reconnect()', () => {
        const { source } = loadInstalled('telegram/client/telegramBaseClient.js');
        const connectSender = extractMethod(source, 'async _connectSender(sender, dcId)');
        assert.equal(connectSender.includes('while (true)'), true);
        assert.equal(connectSender.includes('_reconnectRetries'), false);
        const borrow = extractMethod(
            source,
            'async _borrowExportedSender(dcId, shouldReconnect, existingSender)'
        );
        assert.equal(borrow.includes('sender._reconnect()'), true);
    });
});
