import pg from 'pg';
import { logger } from './services/logger.js';
const { Client } = pg;

const client = new Client({
  host: 'localhost',
  port: 5433,
  database: 'titangold_db',
  user: 'postgres'
});

async function updateArbitrageConfig() {
  try {
    await client.connect();
    logger.info('✅ Connected to PostgreSQL');
    
    // Complete arbitrage config
    const config = {
      enabled: true,
      exchanges: ['mexc'],
      symbols: ['BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'SOLUSDT', 'ADAUSDT'],
      minSpreadPct: 0.20,
      maxSpreadPct: 5.00,
      minVolumeUSDT: 100000,
      scanIntervalSec: 10,
      feeBps: 10,
      slippageBps: 10,
      orderbookDepth: 20,
      mode: 'spot',
      autoTrade: false,
      
      // Risk management
      maxRiskPerTrade: 0.02,
      stopLossDefault: 0.015,
      
      // Execution settings
      maxSimultaneousTrades: 3,
      executionTimeoutSec: 30
    };
    
    const result = await client.query(
      `UPDATE ai_agents 
       SET config = $1::jsonb,
           updated_at = NOW()
       WHERE agent_key = 'arbitrage'
       RETURNING agent_key, name, config`,
      [JSON.stringify(config)]
    );
    
    if (result.rows.length === 0) {
      logger.info('❌ Arbitrage agent not found in database');
      return;
    }
    
    logger.info('✅ Arbitrage config updated successfully');
    logger.info('Agent:', result.rows[0].name);
    logger.info('Config:', JSON.stringify(result.rows[0].config, null, 2));
    
  } catch (error) {
    logger.error('❌ Error:', error.message);
  } finally {
    await client.end();
  }
}

updateArbitrageConfig();
