#!/usr/bin/env node
/**
 * Migrate Telegram session from .env to encrypted database
 */

import dotenv from 'dotenv';
import pkg from 'pg';
import { encryptSecret } from '../../backend/utils/crypto.js';

const { Pool } = pkg;

// Load .env
dotenv.config();

const pool = new Pool({
    host: 'localhost',
    port: 5433,
    database: 'titangold_db',
    user: 'postgres'
});

async function migrateTelegramSession() {
    try {
        console.log('🔐 Starting Telegram Session Migration...\n');

        // Step 1: Read from .env
        const apiId = process.env.TELEGRAM_API_ID;
        const apiHash = process.env.TELEGRAM_API_HASH;
        const phoneNumber = process.env.TELEGRAM_PHONE_NUMBER;
        const sessionString = process.env.TELEGRAM_SESSION_STRING;

        console.log('📋 Current .env configuration:');
        console.log(`   API ID: ${apiId ? '✅ Set' : '❌ Missing'}`);
        console.log(`   API Hash: ${apiHash ? '✅ Set (' + apiHash.substring(0, 8) + '...)' : '❌ Missing'}`);
        console.log(`   Phone: ${phoneNumber || '❌ Missing'}`);
        console.log(`   Session: ${sessionString ? '✅ Set (' + sessionString.substring(0, 20) + '...)' : '❌ Missing'}`);
        console.log();

        if (!sessionString) {
            console.log('⚠️  No session string found in .env');
            console.log('   Skipping migration (session will be created on first login)');
            process.exit(0);
        }

        // Step 2: Encrypt session string
        console.log('🔒 Encrypting session string...');
        const encryptedSession = encryptSecret(sessionString);
        console.log(`✅ Session encrypted (length: ${encryptedSession.length})\n`);

        // Step 3: Check if already exists
        const existingResult = await pool.query(
            "SELECT id, service_name FROM telegram_sessions WHERE service_name = 'telegram-collector'"
        );

        if (existingResult.rows.length > 0) {
            console.log('⚠️  Session already exists in database');
            console.log(`   ID: ${existingResult.rows[0].id}`);
            console.log('   Updating existing record...\n');

            // Update existing
            await pool.query(
                `UPDATE telegram_sessions 
                 SET session_string = $1,
                     phone_number = $2,
                     api_id = $3,
                     api_hash = $4,
                     updated_at = NOW(),
                     last_used_at = NOW()
                 WHERE service_name = 'telegram-collector'`,
                [encryptedSession, phoneNumber, apiId, apiHash]
            );

            console.log('✅ Session updated in database');
        } else {
            console.log('💾 Inserting session into database...');

            // Insert new
            const result = await pool.query(
                `INSERT INTO telegram_sessions 
                 (service_name, session_string, phone_number, api_id, api_hash, metadata)
                 VALUES ($1, $2, $3, $4, $5, $6)
                 RETURNING id, service_name, created_at`,
                [
                    'telegram-collector',
                    encryptedSession,
                    phoneNumber,
                    apiId,
                    apiHash,
                    JSON.stringify({ migrated_from_env: true, migration_date: new Date().toISOString() })
                ]
            );

            console.log('✅ Session inserted into database');
            console.log(`   ID: ${result.rows[0].id}`);
            console.log(`   Service: ${result.rows[0].service_name}`);
            console.log(`   Created: ${result.rows[0].created_at}\n`);
        }

        // Step 4: Verify
        console.log('🔍 Verifying migration...');
        const verifyResult = await pool.query(
            "SELECT service_name, phone_number, is_active, created_at FROM telegram_sessions WHERE service_name = 'telegram-collector'"
        );

        if (verifyResult.rows.length > 0) {
            const session = verifyResult.rows[0];
            console.log('✅ Verification successful:');
            console.log(`   Service: ${session.service_name}`);
            console.log(`   Phone: ${session.phone_number}`);
            console.log(`   Active: ${session.is_active}`);
            console.log(`   Created: ${session.created_at}\n`);
        }

        console.log('✅ ✅ ✅ Migration COMPLETED! ✅ ✅ ✅\n');
        console.log('📝 Next steps:');
        console.log('   1. Update telegram-collector to read from database');
        console.log('   2. Test authentication');
        console.log('   3. Remove TELEGRAM_SESSION_STRING from .env (optional)');
        console.log('   4. Restart telegram-collector service\n');

    } catch (error) {
        console.error('\n❌ Migration FAILED:', error);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

migrateTelegramSession();
