// Run migration 005: Add agent_key to ai_agents
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pool from './database/db.js';
import { logger } from './services/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runMigration() {
    logger.info('🚀 Starting migration 005: Add agent_key to ai_agents...');
    
    try {
        // Read migration file
        const migrationPath = path.join(__dirname, 'database/migrations/005_add_agent_key_to_ai_agents.sql');
        const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
        
        // Execute migration
        logger.info('📝 Executing migration SQL...');
        await pool.query(migrationSQL);
        
        logger.info('✅ Migration completed successfully!');
        
        // Verify results
        logger.info('\n📊 Verification:');
        const agentsResult = await pool.query(`
            SELECT 
                COUNT(*) as total,
                COUNT(agent_key) as with_key,
                COUNT(*) - COUNT(agent_key) as without_key
            FROM ai_agents
        `);
        
        logger.info('   Total agents:', agentsResult.rows[0].total);
        logger.info('   With agent_key:', agentsResult.rows[0].with_key);
        logger.info('   Without agent_key:', agentsResult.rows[0].without_key);
        
        // Show current agent_keys
        const keysResult = await pool.query(`
            SELECT agent_key, name, type, status
            FROM ai_agents
            WHERE agent_key IS NOT NULL
            ORDER BY agent_key
        `);
        
        if (keysResult.rows.length > 0) {
            logger.info('\n📋 Current agent_keys:');
            keysResult.rows.forEach(row => {
                logger.info(`   ${row.agent_key.padEnd(20)} | ${row.name.padEnd(30)} | ${row.status}`);
            });
        }
        
        process.exit(0);
    } catch (error) {
        logger.error('❌ Migration failed:', error.message);
        logger.error(error);
        process.exit(1);
    }
}

runMigration();
