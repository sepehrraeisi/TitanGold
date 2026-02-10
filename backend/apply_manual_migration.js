
import { query } from './database/db.js';

async function apply() {
    console.log('Applying migration manually...');
    try {
        // Up Migration SQL
        const sql = `CREATE UNIQUE INDEX idx_data_sources_name_type ON data_sources(name, type) WHERE is_active = TRUE;`;

        await query(sql);
        console.log('✅ Index created successfully.');

        // Optional: Record in pgmigrations to avoid future re-run issues if tool is fixed
        // await query("INSERT INTO pgmigrations (name, run_on) VALUES ('023_add_unique_constraint_data_sources', NOW())");

    } catch (error) {
        if (error.code === '42P07') { // duplicate_table/relation (index already exists)
            console.log('⚠️ Index already exists.');
        } else {
            console.error('❌ Failed to apply migration:', error);
            process.exit(1);
        }
    } finally {
        process.exit(0);
    }
}

apply();
