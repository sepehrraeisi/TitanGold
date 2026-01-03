import pg from 'pg';
import dotenv from 'dotenv';

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
    console.log('\n📊 Checking ai_agents table...\n');
    
    const result = await pool.query(
      'SELECT id, agent_key, name, type, status, is_enabled FROM ai_agents ORDER BY agent_key'
    );
    
    console.log(`Total agents: ${result.rows.length}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    result.rows.forEach(agent => {
      console.log(`${agent.agent_key.padEnd(20)} | ${agent.name.padEnd(30)} | ${agent.status.padEnd(10)} | enabled: ${agent.is_enabled}`);
    });
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

checkAgents();
