import { query } from '../database/db.js';

async function inspectDataSources() {
    try {
        console.log('📊 Inspecting data_sources table...');
        const result = await query(`
            SELECT 
                column_name, 
                data_type, 
                is_nullable
            FROM 
                information_schema.columns
            WHERE 
                table_name = 'data_sources'
            ORDER BY 
                ordinal_position;
        `);

        console.table(result.rows);
        process.exit(0);
    } catch (error) {
        console.error('❌ Inspection failed:', error.message);
        process.exit(1);
    }
}

inspectDataSources();
