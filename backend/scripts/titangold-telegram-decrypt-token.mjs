#!/usr/bin/env node
/**
 * Decrypt a mk2/legacy bot_token_encrypted value using live MASTER_KEY env.
 * Input JSON on stdin: { encrypted, chatId, publisherId, publisherName }
 * Output shell assignments on stdout. Never log stdout.
 */
import { decryptSecret, isEncrypted } from '../utils/crypto.js';

function fail(msg) {
  process.stderr.write(`ERROR: ${msg}\n`);
  process.exit(1);
}

const raw = await new Promise((resolve, reject) => {
  let data = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', (c) => { data += c; });
  process.stdin.on('end', () => resolve(data));
  process.stdin.on('error', reject);
});

let payload;
try {
  payload = JSON.parse(raw || '{}');
} catch {
  fail('Invalid JSON payload on stdin');
}

const encrypted = payload.encrypted;
const chatId = String(payload.chatId || '').trim();
const publisherId = String(payload.publisherId || '').trim();
const publisherName = String(payload.publisherName || '').replace(/'/g, '');

if (!encrypted) fail('Missing encrypted token');
if (!chatId) fail('Missing chatId');
if (!process.env.MASTER_KEY) fail('MASTER_KEY not set in environment');

const token = isEncrypted(encrypted) ? decryptSecret(encrypted) : String(encrypted);
if (!token || token.length < 20) fail('Decrypted bot token empty/short');

const escape = (v) => String(v).replace(/'/g, `'\"'\"'`);
process.stdout.write(`TELEGRAM_BOT_TOKEN='${escape(token)}'\n`);
process.stdout.write(`TELEGRAM_CHAT_ID='${escape(chatId)}'\n`);
process.stdout.write(`TELEGRAM_PUBLISHER_ID='${escape(publisherId)}'\n`);
process.stdout.write(`TELEGRAM_PUBLISHER_NAME='${escape(publisherName)}'\n`);
