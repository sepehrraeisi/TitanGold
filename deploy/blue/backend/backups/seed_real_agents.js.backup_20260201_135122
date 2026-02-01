import { query } from '../database/db.js';

/**
 * Seed the 15 REAL TitanGold AI Agents
 * Based on frontend component mapping in AIAgents.tsx
 * 
 * CRITICAL: IDs must match hardcoded values in frontend!
 * - ID '1' → TechnicalAnalysisAgentControl
 * - ID '2' → RiskManagementAgentControl
 * ... etc
 */

const realAgents = [
  {
    id: '1',
    name: 'Technical Analyst',
    role: 'Technical Analysis',
    status: 'active',
    accuracy: 85.5,
    trainingProgress: 92.3,
    decisions: 15420,
    learningTime: 2340,
    knowledgeSize: 128.5,
    level: 'Expert',
    capabilities: ['Chart Analysis', 'Pattern Recognition', 'Indicator Analysis', 'Support/Resistance'],
    lastUpdate: new Date().toISOString(),
  },
  {
    id: '2',
    name: 'Risk Manager',
    role: 'Risk Management',
    status: 'active',
    accuracy: 91.2,
    trainingProgress: 95.8,
    decisions: 8730,
    learningTime: 1890,
    knowledgeSize: 95.3,
    level: 'Expert',
    capabilities: ['Position Sizing', 'Stop Loss', 'Risk/Reward', 'Exposure Management'],
    lastUpdate: new Date().toISOString(),
  },
  {
    id: '3',
    name: 'Sentiment Analyzer',
    role: 'Sentiment Analysis',
    status: 'active',
    accuracy: 78.9,
    trainingProgress: 88.5,
    decisions: 12340,
    learningTime: 1560,
    knowledgeSize: 156.7,
    level: 'Advanced',
    capabilities: ['Social Media', 'News Analysis', 'Market Psychology', 'Fear/Greed Index'],
    lastUpdate: new Date().toISOString(),
  },
  {
    id: '4',
    name: 'Pattern Detective',
    role: 'Pattern Recognition',
    status: 'active',
    accuracy: 82.1,
    trainingProgress: 90.2,
    decisions: 9870,
    learningTime: 1780,
    knowledgeSize: 142.3,
    level: 'Advanced',
    capabilities: ['Head & Shoulders', 'Triangles', 'Flags', 'Double Tops/Bottoms'],
    lastUpdate: new Date().toISOString(),
  },
  {
    id: '5',
    name: 'Price Predictor',
    role: 'Price Prediction',
    status: 'active',
    accuracy: 76.4,
    trainingProgress: 85.9,
    decisions: 11250,
    learningTime: 2100,
    knowledgeSize: 189.4,
    level: 'Advanced',
    capabilities: ['LSTM Models', 'Time Series', 'Regression', 'Neural Networks'],
    lastUpdate: new Date().toISOString(),
  },
  {
    id: '6',
    name: 'Arbitrage Hunter',
    role: 'Arbitrage',
    status: 'active',
    accuracy: 94.7,
    trainingProgress: 97.1,
    decisions: 6540,
    learningTime: 980,
    knowledgeSize: 67.8,
    level: 'Expert',
    capabilities: ['Cross-Exchange', 'Triangular Arb', 'Statistical Arb', 'Latency Optimization'],
    lastUpdate: new Date().toISOString(),
  },
  {
    id: '7',
    name: 'Portfolio Manager',
    role: 'Portfolio Allocation',
    status: 'active',
    accuracy: 88.3,
    trainingProgress: 93.4,
    decisions: 5430,
    learningTime: 1450,
    knowledgeSize: 103.2,
    level: 'Expert',
    capabilities: ['Asset Allocation', 'Rebalancing', 'Diversification', 'Modern Portfolio Theory'],
    lastUpdate: new Date().toISOString(),
  },
  {
    id: '8',
    name: 'Liquidity Scout',
    role: 'Liquidity Analysis',
    status: 'active',
    accuracy: 81.6,
    trainingProgress: 89.7,
    decisions: 7890,
    learningTime: 1120,
    knowledgeSize: 84.9,
    level: 'Advanced',
    capabilities: ['Order Book', 'Slippage', 'Market Depth', 'Execution Quality'],
    lastUpdate: new Date().toISOString(),
  },
  {
    id: '9',
    name: 'Trend Follower',
    role: 'Trend Analysis',
    status: 'active',
    accuracy: 83.9,
    trainingProgress: 91.2,
    decisions: 13560,
    learningTime: 1980,
    knowledgeSize: 134.6,
    level: 'Advanced',
    capabilities: ['Moving Averages', 'Trend Channels', 'Momentum', 'Breakouts'],
    lastUpdate: new Date().toISOString(),
  },
  {
    id: '10',
    name: 'Strategy Optimizer',
    role: 'Optimization',
    status: 'active',
    accuracy: 87.2,
    trainingProgress: 92.8,
    decisions: 4320,
    learningTime: 2340,
    knowledgeSize: 176.5,
    level: 'Expert',
    capabilities: ['Parameter Tuning', 'Backtesting', 'Walk-Forward', 'Genetic Algorithms'],
    lastUpdate: new Date().toISOString(),
  },
  {
    id: '11',
    name: 'Order Manager',
    role: 'Order Management',
    status: 'active',
    accuracy: 92.4,
    trainingProgress: 96.3,
    decisions: 18760,
    learningTime: 1670,
    knowledgeSize: 92.1,
    level: 'Expert',
    capabilities: ['Smart Routing', 'Order Splitting', 'TWAP/VWAP', 'Execution Algorithms'],
    lastUpdate: new Date().toISOString(),
  },
  {
    id: '12',
    name: 'Fundamental Analyst',
    role: 'Fundamental Analysis',
    status: 'active',
    accuracy: 79.8,
    trainingProgress: 87.6,
    decisions: 3210,
    learningTime: 2560,
    knowledgeSize: 245.7,
    level: 'Advanced',
    capabilities: ['On-Chain Metrics', 'Network Activity', 'Mining Data', 'Developer Activity'],
    lastUpdate: new Date().toISOString(),
  },
  {
    id: '13',
    name: 'Market Intel',
    role: 'Market Intelligence',
    status: 'active',
    accuracy: 84.6,
    trainingProgress: 90.9,
    decisions: 9430,
    learningTime: 1890,
    knowledgeSize: 167.3,
    level: 'Advanced',
    capabilities: ['Market Structure', 'Regime Detection', 'Correlation Analysis', 'Macro Events'],
    lastUpdate: new Date().toISOString(),
  },
  {
    id: '14',
    name: 'Volume Analyst',
    role: 'Volume Analysis',
    status: 'active',
    accuracy: 80.7,
    trainingProgress: 88.4,
    decisions: 10890,
    learningTime: 1450,
    knowledgeSize: 118.9,
    level: 'Advanced',
    capabilities: ['Volume Profile', 'Accumulation/Distribution', 'Money Flow', 'Volume Spread'],
    lastUpdate: new Date().toISOString(),
  },
  {
    id: '15',
    name: 'Timing Expert',
    role: 'Market Timing',
    status: 'active',
    accuracy: 77.3,
    trainingProgress: 86.1,
    decisions: 8760,
    learningTime: 1780,
    knowledgeSize: 145.2,
    level: 'Advanced',
    capabilities: ['Entry Timing', 'Exit Timing', 'Time Cycles', 'Seasonal Patterns'],
    lastUpdate: new Date().toISOString(),
  },
];

async function seedRealAgents() {
  console.log('🌱 Seeding 15 Real TitanGold AI Agents...\n');

  let inserted = 0;
  let updated = 0;

  for (const agent of realAgents) {
    try {
      // Check if agent exists
      const existing = await query(
        'SELECT id FROM ai_agents WHERE id = $1',
        [agent.id]
      );

      if (existing.rows.length > 0) {
        // Update existing
        await query(
          `UPDATE ai_agents 
           SET name = $2, role = $3, status = $4, accuracy = $5,
               trainingprogress = $6, decisions = $7, learningtime = $8,
               knowledgesize = $9, level = $10, capabilities = $11,
               lastupdate = $12, updated_at = NOW()
           WHERE id = $1`,
          [
            agent.id,
            agent.name,
            agent.role,
            agent.status,
            agent.accuracy,
            agent.trainingProgress,
            agent.decisions,
            agent.learningTime,
            agent.knowledgeSize,
            agent.level,
            JSON.stringify(agent.capabilities),
            agent.lastUpdate,
          ]
        );
        console.log(`✅ Updated: ${agent.name} (ID: ${agent.id})`);
        updated++;
      } else {
        // Insert new
        await query(
          `INSERT INTO ai_agents 
            (id, name, role, status, accuracy, trainingprogress, decisions,
             learningtime, knowledgesize, level, capabilities, lastupdate)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
          [
            agent.id,
            agent.name,
            agent.role,
            agent.status,
            agent.accuracy,
            agent.trainingProgress,
            agent.decisions,
            agent.learningTime,
            agent.knowledgeSize,
            agent.level,
            JSON.stringify(agent.capabilities),
            agent.lastUpdate,
          ]
        );
        console.log(`✅ Inserted: ${agent.name} (ID: ${agent.id})`);
        inserted++;
      }
    } catch (error) {
      console.error(`❌ Failed to seed ${agent.name}:`, error.message);
    }
  }

  console.log(`\n📊 Summary:`);
  console.log(`   ✅ Inserted: ${inserted}`);
  console.log(`   🔄 Updated: ${updated}`);
  console.log(`   📦 Total: ${realAgents.length}`);

  // Verify
  const total = await query('SELECT COUNT(*) as count FROM ai_agents');
  console.log(`\n✅ Total agents in database: ${total.rows[0].count}`);

  process.exit(0);
}

seedRealAgents().catch((error) => {
  console.error('❌ Seed failed:', error);
  process.exit(1);
});
