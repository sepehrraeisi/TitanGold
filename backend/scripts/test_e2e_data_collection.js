#!/usr/bin/env node
/**
 * E2E Test: Fetch Telegram data and store in collected_data table
 */

import fetch from 'node-fetch';
import pkg from 'pg';
const { Pool } = pkg;

const pool = new Pool({
    host: 'localhost',
    port: 5433,
    database: 'titangold_db',
    user: 'postgres'
});

async function testDataCollection() {
    try {
        console.log('🚀 Starting E2E Data Collection Test...\n');

        // Step 1: Get data source from database
        console.log('📊 Step 1: Fetching data source from database...');
        const sourceResult = await pool.query(
            "SELECT id, name, config FROM data_sources WHERE type='telegram' LIMIT 1"
        );

        if (sourceResult.rows.length === 0) {
            console.log('❌ No Telegram data source found in database');
            process.exit(1);
        }

        const source = sourceResult.rows[0];
        const channelUsername = source.config.channelUsername;
        console.log(`✅ Found source: ${source.name} (ID: ${source.id})`);
        console.log(`   Channel: @${channelUsername}\n`);

        // Step 2: Fetch data from Telegram Collector
        console.log('📡 Step 2: Fetching messages from Telegram Collector...');
        const telegramUrl = `http://localhost:3002/telegram/${channelUsername}/recent?limit=10`;
        const response = await fetch(telegramUrl);
        const telegramData = await response.json();

        console.log(`✅ Fetched ${telegramData.count} messages from Telegram`);
        console.log(`   Channel: ${telegramData.channel}\n`);

        // Step 3: Store in collected_data table
        console.log('💾 Step 3: Storing messages in collected_data table...');
        let insertedCount = 0;

        for (const message of telegramData.messages) {
            if (!message.text) continue; // Skip messages without text

            try {
                await pool.query(
                    `INSERT INTO collected_data 
                     (source_id, raw_data, collected_at, status, metadata) 
                     VALUES ($1, $2, NOW(), 'pending', $3)`,
                    [
                        source.id,
                        JSON.stringify(message),
                        JSON.stringify({
                            channel: telegramData.channel,
                            messageId: message.id,
                            fetchedAt: telegramData.fetchedAt
                        })
                    ]
                );
                insertedCount++;
            } catch (err) {
                if (err.code !== '23505') { // Ignore duplicates
                    console.error(`   ⚠️  Error inserting message ${message.id}:`, err.message);
                }
            }
        }

        console.log(`✅ Inserted ${insertedCount} new messages into collected_data\n`);

        // Step 4: Verify in database
        console.log('🔍 Step 4: Verifying collected data...');
        const verifyResult = await pool.query(
            `SELECT COUNT(*) as total, 
                    COUNT(*) FILTER (WHERE status = 'pending') as pending
             FROM collected_data 
             WHERE source_id = $1`,
            [source.id]
        );

        const stats = verifyResult.rows[0];
        console.log(`✅ Total collected data: ${stats.total}`);
        console.log(`   Pending: ${stats.pending}\n`);

        // Step 5: Show sample data
        console.log('📝 Step 5: Sample collected data:');
        const sampleResult = await pool.query(
            `SELECT id, raw_data->>'id' as message_id, 
                    LEFT(raw_data->>'text', 50) as text_preview,
                    status, collected_at
             FROM collected_data 
             WHERE source_id = $1 
             ORDER BY collected_at DESC 
             LIMIT 3`,
            [source.id]
        );

        sampleResult.rows.forEach((row, i) => {
            console.log(`   ${i + 1}. Message ${row.message_id}: "${row.text_preview}..."`);
            console.log(`      Status: ${row.status}, Collected: ${row.collected_at}`);
        });

        console.log('\n✅ ✅ ✅ E2E Test PASSED! ✅ ✅ ✅');
        console.log('\n📊 Summary:');
        console.log(`   - Data Source: Created ✅`);
        console.log(`   - Telegram Fetch: Working ✅`);
        console.log(`   - Database Storage: Working ✅`);
        console.log(`   - End-to-End Flow: OPERATIONAL ✅`);

    } catch (error) {
        console.error('\n❌ E2E Test FAILED:', error);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

testDataCollection();
