import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const { Pool } = pg;
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const pool = new Pool({
  connectionString: 'postgresql://postgres@localhost:5433/titangold_db'
});

const migrations = [
  '012_create_collected_data.sql',
  '013_create_data_categories.sql',
  '014_create_data_queue.sql',
  '015_add_audit_to_data_sources.sql',
  '016_encrypt_credentials.sql',
  '018_log_retention_system.sql',
  '019_create_topic_routing.sql',
  '020_alter_data_sources.sql',
  '021_create_source_access_control.sql',
  '023_add_unique_constraint_data_sources.sql',
  '024_scheduling_and_incremental.sql'
];

async function runMigrations() {
  for (const migration of migrations) {
    try {
      console.log(`\n🔄 Running: ${migration}`);
      
      // Check if already applied
      const checkResult = await pool.query(
        'SELECT * FROM pgmigrations WHERE name = $1',
        [migration.replace('.sql', '')]
      );
      
      if (checkResult.rows.length > 0) {
        console.log(`  ✅ Already applied`);
        continue;
      }
      
      // Read migration file
      const migrationPath = path.join(__dirname, 'database', 'migrations', migration);
      const sql = fs.readFileSync(migrationPath, 'utf8');
      
      // Run migration
      await pool.query(sql);
      
      // Record migration
      await pool.query(
        'INSERT INTO pgmigrations (name, run_on) VALUES ($1, NOW())',
        [migration.replace('.sql', '')]
      );
      
      console.log(`  ✅ Success`);
    } catch (error) {
      console.error(`  ❌ Error: ${error.message}`);
      // Continue
    }
  }
  
  console.log('\n✅ All migrations done');
  await pool.end();
  process.exit(0);
}

runMigrations().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
