import { query } from '../database/db.js';

async function inspectTable() {
    try {
        console.log('📊 Inspecting pgmigrations table...');
        const result = await query(`
            SELECT 
                column_name, 
                data_type, 
                is_nullable
            FROM 
                information_schema.columns
            WHERE 
                table_name = 'pgmigrations'
            ORDER BY 
                ordinal_position;
        `);

        console.log('Columns:');
        console.table(result.rows);

        const constraints = await query(`
            SELECT 
                conname as constraint_name, 
                contype as constraint_type
            FROM 
                pg_constraint 
            JOIN 
                pg_class ON pg_class.oid = pg_constraint.conrelid
            WHERE 
                pg_class.relname = 'pgmigrations';
        `);

        console.log('Constraints:');
        console.table(constraints.rows);

        process.exit(0);
    } catch (error) {
        console.error('❌ Inspection failed:', error.message);
        process.exit(1);
    }
}

inspectTable();
