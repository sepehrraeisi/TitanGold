
import { query } from './database/db.js';

async function debug() {
    console.log('Debugging TASK-DF-006...');

    try {
        // 1. Check Index Definition
        console.log('1. Checking Index Definition...');
        const indexResult = await query(`
      SELECT indexname, indexdef 
      FROM pg_indexes 
      WHERE tablename = 'data_sources' AND indexname = 'idx_data_sources_name_type'
    `);

        if (indexResult.rows.length === 0) {
            console.error('❌ Index idx_data_sources_name_type NOT FOUND!');
        } else {
            console.log('✅ Index Found:', indexResult.rows[0]);
        }

        // 2. Check Table Columns
        console.log('2. Checking Table Columns...');
        const columnsResult = await query(`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'data_sources'
    `);
        console.log('Columns:', columnsResult.rows.map(r => r.column_name).join(', '));

    } catch (error) {
        console.error('Debug script failed:', error);
    } finally {
        process.exit(0);
    }
}

debug();
