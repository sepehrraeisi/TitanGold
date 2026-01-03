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

async function checkArbitrageConfig() {
  try {
    const result = await pool.query(
      `SELECT agent_key, config, is_enabled, status, metadata 
       FROM ai_agents 
       WHERE agent_key = 'arbitrage'`
    );
    
    if (result.rows.length === 0) {
      console.log('❌ Arbitrage agent not found in DB!');
      process.exit(1);
    }
    
    const agent = result.rows[0];
    console.log('\n📊 Arbitrage Agent Config:\n');
    console.log('agent_key:', agent.agent_key);
    console.log('status:', agent.status);
    console.log('is_enabled:', agent.is_enabled);
    console.log('\nconfig:', JSON.stringify(agent.config, null, 2));
    console.log('\nmetadata:', JSON.stringify(agent.metadata, null, 2));
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

checkArbitrageConfig();
