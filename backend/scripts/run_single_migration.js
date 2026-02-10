import { readFileSync } from 'fs';
import { query } from '../database/db.js';
import { logger } from '../services/logger.js';
import path from 'path';

async function runMigration() {
    const migrationPath = process.argv[2];
    if (!migrationPath) {
        console.error('Usage: node scripts/run_single_migration.js <path_to_sql>');
        process.exit(1);
    }

    try {
        const sql = readFileSync(migrationPath, 'utf8');
        console.log(`🚀 Executing migration: ${path.basename(migrationPath)}`);

        // Execute the SQL
        try {
            await query(sql);
            console.log('✅ Migration applied successfully!');
        } catch (e) {
            if (e.message.includes('already exists')) {
                console.log('ℹ️  Columns/Indexes already exist, continuing to record migration.');
            } else {
                throw e;
            }
        }

        // Ensure unique constraint exists on pgmigrations.name
        try {
            await query('ALTER TABLE pgmigrations ADD CONSTRAINT pgmigrations_name_key UNIQUE (name)');
            console.log('✅ Added unique constraint to pgmigrations.name');
        } catch (e) {
            console.log('ℹ️  Unique constraint might already exist or failed: ' + e.message);
        }

        // Record it in pgmigrations
        const name = path.basename(migrationPath, '.sql');
        await query(
            'INSERT INTO pgmigrations (name, run_on) VALUES ($1, NOW()) ON CONFLICT (name) DO NOTHING',
            [name]
        );
        console.log(`✅ Migration recorded in pgmigrations: ${name}`);

        process.exit(0);
    } catch (error) {
        console.error('❌ Migration failed:', error.message);
        process.exit(1);
    }
}

runMigration();
