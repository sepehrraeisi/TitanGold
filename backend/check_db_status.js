import pool from './database/db.js';

async function checkDB() {
  console.log('📊 Database Status Check\n');
  
  try {
    // Query 1: Agent keys
    console.log('=== Query 1: Agent Keys ===');
    const agents = await pool.query(`
      SELECT agent_key, status, is_enabled 
      FROM ai_agents 
      ORDER BY agent_key
    `);
    
    console.table(agents.rows);
    console.log(`Total agents: ${agents.rows.length}\n`);
    
    // Query 2: Decisions count
    console.log('=== Query 2: AI Decisions Count ===');
    const decisions = await pool.query('SELECT COUNT(*) FROM ai_decisions');
    console.log(`Total decisions: ${decisions.rows[0].count}\n`);
    
    // Query 3: Check agent_key is NOT NULL
    console.log('=== Query 3: NULL agent_key check ===');
    const nullCheck = await pool.query(`
      SELECT COUNT(*) as null_count 
      FROM ai_agents 
      WHERE agent_key IS NULL
    `);
    console.log(`Agents with NULL agent_key: ${nullCheck.rows[0].null_count}\n`);
    
    // Query 4: Check unique constraint
    console.log('=== Query 4: Unique Index Check ===');
    const indexCheck = await pool.query(`
      SELECT indexname, indexdef 
      FROM pg_indexes 
      WHERE tablename = 'ai_agents' AND indexname LIKE '%agent_key%'
    `);
    console.table(indexCheck.rows);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Check failed:', error.message);
    process.exit(1);
  }
}

checkDB();
