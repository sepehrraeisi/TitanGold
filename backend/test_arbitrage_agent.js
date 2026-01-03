import fetch from 'node-fetch';

const BASE_URL = 'https://titan.zala.ir/api';
const USERNAME = 'testuser';
const PASSWORD = 'Test@123456';

async function testArbitrageAgent() {
  try {
    console.log('🔐 Step 1: Login...');
    
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
    console.log('✅ Login successful');
    
    // Get agents
    console.log('\n📋 Step 2: Get AI Agents...');
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
    
    console.log(`✅ Total agents: ${agents.length}`);
    
    // Find arbitrage agent
    const arbitrageAgent = agents.find(a => a.agent_key === 'arbitrage');
    
    if (!arbitrageAgent) {
      throw new Error('Arbitrage agent not found');
    }
    
    console.log(`✅ Found arbitrage agent: ${arbitrageAgent.name} (ID: ${arbitrageAgent.id})`);
    console.log(`   Status: ${arbitrageAgent.status}`);
    console.log(`   Enabled: ${arbitrageAgent.is_enabled}`);
    
    // Run arbitrage scan
    console.log('\n🚀 Step 3: Run Arbitrage Scan...');
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
    
    console.log('\n✅ Arbitrage scan complete!');
    console.log('\n📊 RESULTS:');
    console.log('─'.repeat(80));
    
    if (result.summary) {
      console.log('\n📈 Summary:');
      console.log(`   Total Opportunities: ${result.summary.totalOpportunities}`);
      console.log(`   Total Profit: $${result.summary.totalProfitUSDT} USDT`);
      console.log(`   Avg Spread: ${result.summary.avgSpreadPct}%`);
      console.log(`   Avg Risk Score: ${result.summary.avgRiskScore}/100`);
      console.log(`   Risk Alerts: ${result.summary.riskAlertCount}`);
    }
    
    if (result.opportunities && result.opportunities.length > 0) {
      console.log(`\n🎯 Top Opportunities (${result.opportunities.length}):`);
      result.opportunities.forEach((opp, idx) => {
        console.log(`\n   ${idx + 1}. ${opp.symbol} (${opp.exchange})`);
        console.log(`      Spread: ${opp.spreadPct?.toFixed(2)}%`);
        console.log(`      Net Spread: ${opp.netSpreadPct?.toFixed(2)}%`);
        console.log(`      Est. Profit: $${opp.estimatedProfitUSDT?.toFixed(2)} USDT`);
        console.log(`      Volume 24h: $${opp.volume24hUSDT?.toLocaleString()} USDT`);
        console.log(`      Risk: ${opp.riskLevel} (${opp.riskScore}/100)`);
        console.log(`      Bid: $${opp.bidPrice?.toFixed(2)} | Ask: $${opp.askPrice?.toFixed(2)}`);
      });
    } else {
      console.log('\n⚠️  No opportunities found (spreads too low or volume too low)');
    }
    
    if (result.riskAlerts && result.riskAlerts.length > 0) {
      console.log(`\n⚠️  Risk Alerts (${result.riskAlerts.length}):`);
      result.riskAlerts.forEach((alert, idx) => {
        console.log(`   ${idx + 1}. ${alert.symbol}: ${alert.reason} (Risk: ${alert.riskScore}/100)`);
      });
    }
    
    if (result.config) {
      console.log('\n⚙️  Config Used:');
      console.log(`   Symbols: ${result.config.symbols?.join(', ')}`);
      console.log(`   Min Spread: ${result.config.minSpreadPct}%`);
      console.log(`   Max Spread: ${result.config.maxSpreadPct}%`);
      console.log(`   Min Volume: $${result.config.minVolumeUSDT?.toLocaleString()} USDT`);
      console.log(`   Fee: ${result.config.feeBps} bps (${result.config.feeBps / 100}%)`);
      console.log(`   Slippage: ${result.config.slippageBps} bps (${result.config.slippageBps / 100}%)`);
    }
    
    console.log('\n─'.repeat(80));
    console.log('✅ Test complete!\n');
    
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    process.exit(1);
  }
}

// Run test
testArbitrageAgent();
