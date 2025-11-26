import 'dotenv/config';
import { TelegramClient } from 'gramjs';
import { StringSession } from 'gramjs/sessions/index.js';
import input from 'input';
import { logger } from '../logger.ts';
import { config } from '../config.ts';

const run = async () => {
    if (!config.telegram.apiId || !config.telegram.apiHash) {
        throw new Error('TELEGRAM_API_ID and TELEGRAM_API_HASH must be set in your .env file.');
    }

    const stringSession = new StringSession('');
    const client = new TelegramClient(stringSession, config.telegram.apiId, config.telegram.apiHash, {
        connectionRetries: 5,
    });

    await client.start({
        phoneNumber: async () => config.telegram.phoneNumber || (await input.text('Phone number: ')),
        password: async () => config.telegram.password || (await input.text('Password (if 2FA enabled, otherwise leave empty): ')),
        phoneCode: async () => await input.text('Telegram code: '),
        onError: (err) => logger.error('Auth error', { err }),
    });

    const sessionString = client.session.save();
    console.log('\n✅ Session generated successfully. Add the following to your .env file:\n');
    console.log(`TELEGRAM_SESSION_STRING=${sessionString}\n`);

    await client.disconnect();
    process.exit(0);
};

run().catch((error) => {
    logger.error('Failed to generate Telegram session', {
        error: error instanceof Error ? error.message : String(error),
    });
    process.exit(1);
});

