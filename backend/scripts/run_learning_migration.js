import { query } from '../database/db.js';
import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const runMigration = async () => {
  try {
    console.log('🚀 Running learning system migration...');
    const sql = readFileSync(path.join(__dirname, '../database/migrations/003_add_learning_system.sql'), 'utf-8');
    
    // Split by statement (rough approach — works for most cases)
    const statements = sql.split(';').filter(s => s.trim());
    
    for (const statement of statements) {
      if (statement.trim()) {
        await query(statement);
      }
    }
    
    console.log('✅ Migration completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
};

runMigration();
