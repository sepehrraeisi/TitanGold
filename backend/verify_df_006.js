
import { query } from './database/db.js';

async function verify() {
    console.log('Starting verification for TASK-DF-006...');

    const testName = 'Test Unique Source';
    const testType = 'api';

    try {
        // Clean up any existing test data
        await query('DELETE FROM data_sources WHERE name = $1', [testName]);

        // 1. Insert first data source
        console.log('1. Inserting first data source...');
        await query("INSERT INTO data_sources (name, type, url, category, is_active) VALUES ($1, $2, 'http://test.com', 'test', true)", [testName, testType]);
        console.log('   Success.');

        // 2. Attempt to insert duplicate (should fail)
        console.log('2. Attempting to insert duplicate (active)...');
        try {
            await query("INSERT INTO data_sources (name, type, url, category, is_active) VALUES ($1, $2, 'http://test2.com', 'test', true)", [testName, testType]);
            console.error('   FAILED: Duplicate insert managed to succeed!');
        } catch (err) {
            if (err.code === '23505') {
                console.log('   Success: Duplicate insert failed with code 23505.');
            } else {
                console.error('   FAILED: Unexpected error code:', err.code);
            }
        }

        // 3. Disable first data source
        console.log('3. Disabling first data source...');
        await query("UPDATE data_sources SET is_active = false WHERE name = $1", [testName]);
        console.log('   Success.');

        // 4. Insert duplicate again (should succeed now)
        console.log('4. Attempting to insert duplicate (active) while first is inactive...');
        try {
            await query("INSERT INTO data_sources (name, type, url, category, is_active) VALUES ($1, $2, 'http://test2.com', 'test', true)", [testName, testType]);
            console.log('   Success: Insert succeeded as expected.');
        } catch (err) {
            console.error('   FAILED: Insert failed unexpectedly:', err);
        }

        // 5. Attempt to re-enable first data source (should fail)
        console.log('5. Attempting to re-enable first data source...');
        try {
            // We have two rows with same name/type. One active (from step 4), one inactive (from step 1).
            // Try to update the inactive one to active.
            // We need to target the specific row that is inactive.
            await query("UPDATE data_sources SET is_active = true WHERE name = $1 AND is_active = false", [testName]);
            console.error('   FAILED: Re-enable managed to succeed!');
        } catch (err) {
            if (err.code === '23505') {
                console.log('   Success: Re-enable failed with code 23505.');
            } else {
                console.error('   FAILED: Unexpected error code:', err.code);
            }
        }

        console.log('Verification Complete.');

    } catch (error) {
        console.error('Verification script failed:', error);
    } finally {
        // Cleanup
        await query('DELETE FROM data_sources WHERE name = $1', [testName]);
        process.exit(0);
    }
}

verify();
