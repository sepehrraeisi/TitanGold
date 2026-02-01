import { query } from './database/db.js';

async function cleanup() {
  console.log('🧹 Cleaning up test monitoring data...\n');

  try {
    // Truncate tables
    console.log('1️⃣ Truncating request_logs...');
    await query('TRUNCATE request_logs CASCADE');
    console.log('✅ request_logs cleared');

    console.log('\n2️⃣ Truncating error_logs...');
    await query('TRUNCATE error_logs CASCADE');
    console.log('✅ error_logs cleared');

    // Verify
    console.log('\n3️⃣ Verifying...');
    const reqCount = await query('SELECT COUNT(*) FROM request_logs');
    const errCount = await query('SELECT COUNT(*) FROM error_logs');
    
    console.log(`request_logs: ${reqCount.rows[0].count} rows`);
    console.log(`error_logs: ${errCount.rows[0].count} rows`);

    console.log('\n✅ Cleanup complete!');
    process.exit(0);

  } catch (error) {
    console.error('❌ Cleanup error:', error);
    process.exit(1);
  }
}

cleanup();
