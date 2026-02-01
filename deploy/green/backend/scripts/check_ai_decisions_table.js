import { query } from '../database/db.js';

async function checkTable() {
  try {
    console.log('🔍 Checking ai_decisions table...\n');
    
    // Get table columns
    const colsResult = await query(`
      SELECT column_name, data_type, column_default 
      FROM information_schema.columns 
      WHERE table_name = 'ai_decisions' 
      ORDER BY ordinal_position
    `);
    
    console.log('📋 Table Structure:');
    colsResult.rows.forEach(col => {
      console.log(`  - ${col.column_name}: ${col.data_type} ${col.column_default || ''}`);
    });
    
    // Get row count and date range
    const statsResult = await query(`
      SELECT 
        COUNT(*) as total_rows,
        MIN(created_at) as earliest_date,
        MAX(created_at) as latest_date
      FROM ai_decisions
    `);
    
    console.log('\n📊 Table Statistics:');
    console.log(`  - Total Rows: ${statsResult.rows[0].total_rows}`);
    console.log(`  - Earliest: ${statsResult.rows[0].earliest_date}`);
    console.log(`  - Latest: ${statsResult.rows[0].latest_date}`);
    
    // Get indexes
    const idxResult = await query(`
      SELECT indexname, indexdef 
      FROM pg_indexes 
      WHERE tablename = 'ai_decisions'
    `);
    
    console.log('\n📇 Indexes:');
    idxResult.rows.forEach(idx => {
      console.log(`  - ${idx.indexname}`);
    });
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

checkTable();
