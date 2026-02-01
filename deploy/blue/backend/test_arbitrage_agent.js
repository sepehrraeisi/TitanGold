import fetch from 'node-fetch';
import { logger } from './services/logger.js';

const BASE_URL = 'https://titan.zala.ir/api';
const USERNAME = 'testuser';
const PASSWORD = 'Test@123456';

async function testArbitrageAgent() {
  try {
    logger.info('🔐 Step 1: Login...');
    
    // Login
    const loginResponse = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        username: USERNAME,
        password: PASSWORD
      })
    });
    
    if (!loginResponse.ok) {
      throw new Error(`Login failed: ${loginResponse.status}`);
    }
    
    const loginData = await loginResponse.json();
    const token = loginData.token;
    logger.info('✅ Login successful');
    
    // Get agents
    logger.info('\n📋 Step 2: Get AI Agents...');
    const agentsResponse = await fetch(`${BASE_URL}/ai-agents`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (!agentsResponse.ok) {
      throw new Error(`Get agents failed: ${agentsResponse.status}`);
    }
    
    const agentsData = await agentsResponse.json();
    const agents = agentsData.agents || [];
    
    logger.info(`✅ Total agents: ${agents.length}`);
    
    // Find arbitrage agent
    const arbitrageAgent = agents.find(a => a.agent_key === 'arbitrage');
    
    if (!arbitrageAgent) {
      throw new Error('Arbitrage agent not found');
    }
    
    logger.info(`✅ Found arbitrage agent: ${arbitrageAgent.name} (ID: ${arbitrageAgent.id})`);
    logger.info(`   Status: ${arbitrageAgent.status}`);
    logger.info(`   Enabled: ${arbitrageAgent.is_enabled}`);
    
    // Run arbitrage scan
    logger.info('\n🚀 Step 3: Run Arbitrage Scan...');
    const runResponse = await fetch(`${BASE_URL}/ai-agents/${arbitrageAgent.id}/run`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        // No symbol/timeframe needed for arbitrage
      })
    });
    
    if (!runResponse.ok) {
      const errorData = await runResponse.text();
      throw new Error(`Run failed: ${runResponse.status} - ${errorData}`);
    }
    
    const result = await runResponse.json();
    
    logger.info('\n✅ Arbitrage scan complete!');
    logger.info('\n📊 RESULTS:');
    logger.info('─'.repeat(80));
    
    if (result.summary) {
      logger.info('\n📈 Summary:');
      logger.info(`   Total Opportunities: ${result.summary.totalOpportunities}`);
      logger.info(`   Total Profit: $${result.summary.totalProfitUSDT} USDT`);
      logger.info(`   Avg Spread: ${result.summary.avgSpreadPct}%`);
      logger.info(`   Avg Risk Score: ${result.summary.avgRiskScore}/100`);
      logger.info(`   Risk Alerts: ${result.summary.riskAlertCount}`);
    }
    
    if (result.opportunities && result.opportunities.length > 0) {
      logger.info(`\n🎯 Top Opportunities (${result.opportunities.length}):`);
      result.opportunities.forEach((opp, idx) => {
        logger.info(`\n   ${idx + 1}. ${opp.symbol} (${opp.exchange})`);
        logger.info(`      Spread: ${opp.spreadPct?.toFixed(2)}%`);
        logger.info(`      Net Spread: ${opp.netSpreadPct?.toFixed(2)}%`);
        logger.info(`      Est. Profit: $${opp.estimatedProfitUSDT?.toFixed(2)} USDT`);
        logger.info(`      Volume 24h: $${opp.volume24hUSDT?.toLocaleString()} USDT`);
        logger.info(`      Risk: ${opp.riskLevel} (${opp.riskScore}/100)`);
        logger.info(`      Bid: $${opp.bidPrice?.toFixed(2)} | Ask: $${opp.askPrice?.toFixed(2)}`);
      });
    } else {
      logger.info('\n⚠️  No opportunities found (spreads too low or volume too low)');
    }
    
    if (result.riskAlerts && result.riskAlerts.length > 0) {
      logger.info(`\n⚠️  Risk Alerts (${result.riskAlerts.length}):`);
      result.riskAlerts.forEach((alert, idx) => {
        logger.info(`   ${idx + 1}. ${alert.symbol}: ${alert.reason} (Risk: ${alert.riskScore}/100)`);
      });
    }
    
    if (result.config) {
      logger.info('\n⚙️  Config Used:');
      logger.info(`   Symbols: ${result.config.symbols?.join(', ')}`);
      logger.info(`   Min Spread: ${result.config.minSpreadPct}%`);
      logger.info(`   Max Spread: ${result.config.maxSpreadPct}%`);
      logger.info(`   Min Volume: $${result.config.minVolumeUSDT?.toLocaleString()} USDT`);
      logger.info(`   Fee: ${result.config.feeBps} bps (${result.config.feeBps / 100}%)`);
      logger.info(`   Slippage: ${result.config.slippageBps} bps (${result.config.slippageBps / 100}%)`);
    }
    
    logger.info('\n─'.repeat(80));
    logger.info('✅ Test complete!\n');
    
  } catch (error) {
    logger.error('\n❌ Test failed:', error.message);
    process.exit(1);
  }
}

// Run test
testArbitrageAgent();
