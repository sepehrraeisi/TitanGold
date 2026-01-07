import pg from 'pg';
import dotenv from 'dotenv';
import { logger } from './services/logger.js';

dotenv.config();

const { Pool } = pg;

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME || 'titan_db',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || ''
});

async function checkAgents() {
  try {
    logger.info('\n📊 Checking ai_agents table...\n');
    
    const result = await pool.query(
      'SELECT id, agent_key, name, type, status, is_enabled FROM ai_agents ORDER BY agent_key'
    );
    
    logger.info(`Total agents: ${result.rows.length}`);
    logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    result.rows.forEach(agent => {
      logger.info(`${agent.agent_key.padEnd(20)} | ${agent.name.padEnd(30)} | ${agent.status.padEnd(10)} | enabled: ${agent.is_enabled}`);
    });
    
  } catch (error) {
    logger.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

checkAgents();
