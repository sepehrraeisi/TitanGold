import { query } from '../database/db.js';

/**
 * Seed 15 Real TitanGold AI Agents
 * Uses TYPE column for frontend mapping (not hardcoded IDs)
 */

const realAgents = [
  {
    name: 'Technical Analyst',
    type: 'technical_analysis',
    role: 'Technical Analysis',
    status: 'active',
    accuracy: 85.5,
    performance_score: 87.2,
    total_decisions: 15420,
    successful_decisions: 13184,
    is_enabled: true,
    config: {
      indicators: ['RSI', 'MACD', 'EMA', 'Bollinger Bands'],
      timeframes: ['1h', '4h', '1d'],
      confidence_threshold: 70,
    },
    metadata: {
      capabilities: ['Chart Analysis', 'Pattern Recognition', 'Indicator Analysis', 'Support/Resistance'],
      level: 'Expert',
    },
  },
  {
    name: 'Risk Manager',
    type: 'risk_management',
    role: 'Risk Management',
    status: 'active',
    accuracy: 91.2,
    performance_score: 93.5,
    total_decisions: 8730,
    successful_decisions: 7962,
    is_enabled: true,
    config: {
      max_drawdown: 15,
      position_size_limit: 10,
      confidence_threshold: 80,
    },
    metadata: {
      capabilities: ['Position Sizing', 'Stop Loss', 'Risk/Reward', 'Exposure Management'],
      level: 'Expert',
    },
  },
  {
    name: 'Sentiment Analyzer',
    type: 'sentiment',
    role: 'Sentiment Analysis',
    status: 'active',
    accuracy: 78.9,
    performance_score: 76.4,
    total_decisions: 12340,
    successful_decisions: 9736,
    is_enabled: true,
    config: {
      sources: ['twitter', 'reddit', 'news'],
      confidence_threshold: 65,
    },
    metadata: {
      capabilities: ['Social Media', 'News Analysis', 'Market Psychology', 'Fear/Greed Index'],
      level: 'Advanced',
    },
  },
  {
    name: 'Pattern Detective',
    type: 'pattern',
    role: 'Pattern Recognition',
    status: 'active',
    accuracy: 82.1,
    performance_score: 81.3,
    total_decisions: 9870,
    successful_decisions: 8103,
    is_enabled: true,
    config: {
      patterns: ['head_shoulders', 'triangles', 'flags', 'double_tops'],
      confidence_threshold: 75,
    },
    metadata: {
      capabilities: ['Head & Shoulders', 'Triangles', 'Flags', 'Double Tops/Bottoms'],
      level: 'Advanced',
    },
  },
  {
    name: 'Price Predictor',
    type: 'price_prediction',
    role: 'Price Prediction',
    status: 'active',
    accuracy: 76.4,
    performance_score: 74.8,
    total_decisions: 11250,
    successful_decisions: 8595,
    is_enabled: true,
    config: {
      models: ['LSTM', 'regression'],
      confidence_threshold: 70,
    },
    metadata: {
      capabilities: ['LSTM Models', 'Time Series', 'Regression', 'Neural Networks'],
      level: 'Advanced',
    },
  },
  {
    name: 'Arbitrage Hunter',
    type: 'arbitrage',
    role: 'Arbitrage',
    status: 'active',
    accuracy: 94.7,
    performance_score: 96.2,
    total_decisions: 6540,
    successful_decisions: 6193,
    is_enabled: true,
    config: {
      exchanges: ['binance', 'mexc', 'kraken'],
      min_spread: 0.3,
      confidence_threshold: 90,
    },
    metadata: {
      capabilities: ['Cross-Exchange', 'Triangular Arb', 'Statistical Arb', 'Latency Optimization'],
      level: 'Expert',
    },
  },
  {
    name: 'Portfolio Manager',
    type: 'portfolio_allocation',
    role: 'Portfolio Allocation',
    status: 'active',
    accuracy: 88.3,
    performance_score: 89.7,
    total_decisions: 5430,
    successful_decisions: 4795,
    is_enabled: true,
    config: {
      rebalance_threshold: 5,
      max_position_size: 15,
      confidence_threshold: 78,
    },
    metadata: {
      capabilities: ['Asset Allocation', 'Rebalancing', 'Diversification', 'Modern Portfolio Theory'],
      level: 'Expert',
    },
  },
  {
    name: 'Liquidity Scout',
    type: 'liquidity',
    role: 'Liquidity Analysis',
    status: 'active',
    accuracy: 81.6,
    performance_score: 82.1,
    total_decisions: 7890,
    successful_decisions: 6438,
    is_enabled: true,
    config: {
      min_liquidity: 100000,
      confidence_threshold: 75,
    },
    metadata: {
      capabilities: ['Order Book', 'Slippage', 'Market Depth', 'Execution Quality'],
      level: 'Advanced',
    },
  },
  {
    name: 'Trend Follower',
    type: 'trend',
    role: 'Trend Analysis',
    status: 'active',
    accuracy: 83.9,
    performance_score: 84.5,
    total_decisions: 13560,
    successful_decisions: 11377,
    is_enabled: true,
    config: {
      indicators: ['MA', 'momentum'],
      confidence_threshold: 73,
    },
    metadata: {
      capabilities: ['Moving Averages', 'Trend Channels', 'Momentum', 'Breakouts'],
      level: 'Advanced',
    },
  },
  {
    name: 'Strategy Optimizer',
    type: 'optimization',
    role: 'Optimization',
    status: 'active',
    accuracy: 87.2,
    performance_score: 88.6,
    total_decisions: 4320,
    successful_decisions: 3767,
    is_enabled: true,
    config: {
      methods: ['genetic', 'grid_search'],
      confidence_threshold: 80,
    },
    metadata: {
      capabilities: ['Parameter Tuning', 'Backtesting', 'Walk-Forward', 'Genetic Algorithms'],
      level: 'Expert',
    },
  },
  {
    name: 'Order Manager',
    type: 'order_management',
    role: 'Order Management',
    status: 'active',
    accuracy: 92.4,
    performance_score: 94.1,
    total_decisions: 18760,
    successful_decisions: 17334,
    is_enabled: true,
    config: {
      algorithms: ['TWAP', 'VWAP'],
      confidence_threshold: 85,
    },
    metadata: {
      capabilities: ['Smart Routing', 'Order Splitting', 'TWAP/VWAP', 'Execution Algorithms'],
      level: 'Expert',
    },
  },
  {
    name: 'Fundamental Analyst',
    type: 'fundamental',
    role: 'Fundamental Analysis',
    status: 'active',
    accuracy: 79.8,
    performance_score: 78.3,
    total_decisions: 3210,
    successful_decisions: 2562,
    is_enabled: true,
    config: {
      metrics: ['on_chain', 'network_activity'],
      confidence_threshold: 72,
    },
    metadata: {
      capabilities: ['On-Chain Metrics', 'Network Activity', 'Mining Data', 'Developer Activity'],
      level: 'Advanced',
    },
  },
  {
    name: 'Market Intel',
    type: 'market_intelligence',
    role: 'Market Intelligence',
    status: 'active',
    accuracy: 84.6,
    performance_score: 85.2,
    total_decisions: 9430,
    successful_decisions: 7978,
    is_enabled: true,
    config: {
      analysis_types: ['regime', 'correlation'],
      confidence_threshold: 71,
    },
    metadata: {
      capabilities: ['Market Structure', 'Regime Detection', 'Correlation Analysis', 'Macro Events'],
      level: 'Advanced',
    },
  },
  {
    name: 'Volume Analyst',
    type: 'volume',
    role: 'Volume Analysis',
    status: 'active',
    accuracy: 80.7,
    performance_score: 81.9,
    total_decisions: 10890,
    successful_decisions: 8788,
    is_enabled: true,
    config: {
      indicators: ['volume_profile', 'money_flow'],
      confidence_threshold: 68,
    },
    metadata: {
      capabilities: ['Volume Profile', 'Accumulation/Distribution', 'Money Flow', 'Volume Spread'],
      level: 'Advanced',
    },
  },
  {
    name: 'Timing Expert',
    type: 'timing',
    role: 'Market Timing',
    status: 'active',
    accuracy: 77.3,
    performance_score: 76.8,
    total_decisions: 8760,
    successful_decisions: 6771,
    is_enabled: true,
    config: {
      methods: ['cycles', 'seasonal'],
      confidence_threshold: 70,
    },
    metadata: {
      capabilities: ['Entry Timing', 'Exit Timing', 'Time Cycles', 'Seasonal Patterns'],
      level: 'Advanced',
    },
  },
];

async function seedRealAgents() {
  console.log('🌱 Seeding 15 Real TitanGold AI Agents (Type-based mapping)...\n');

  let inserted = 0;
  let updated = 0;

  for (const agent of realAgents) {
    try {
      // Check if agent exists by type
      const existing = await query(
        'SELECT id FROM ai_agents WHERE type = $1',
        [agent.type]
      );

      if (existing.rows.length > 0) {
        // Update existing
        await query(
          `UPDATE ai_agents 
           SET name = $2, role = $3, status = $4, accuracy = $5,
               performance_score = $6, total_decisions = $7, 
               successful_decisions = $8, config = $9, metadata = $10,
               is_enabled = $11, updated_at = NOW()
           WHERE type = $1`,
          [
            agent.type,
            agent.name,
            agent.role,
            agent.status,
            agent.accuracy,
            agent.performance_score,
            agent.total_decisions,
            agent.successful_decisions,
            JSON.stringify(agent.config),
            JSON.stringify(agent.metadata),
            agent.is_enabled,
          ]
        );
        console.log(`✅ Updated: ${agent.name} (type: ${agent.type})`);
        updated++;
      } else {
        // Insert new
        await query(
          `INSERT INTO ai_agents 
            (name, type, role, status, accuracy, performance_score,
             total_decisions, successful_decisions, config, metadata, is_enabled)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
          [
            agent.name,
            agent.type,
            agent.role,
            agent.status,
            agent.accuracy,
            agent.performance_score,
            agent.total_decisions,
            agent.successful_decisions,
            JSON.stringify(agent.config),
            JSON.stringify(agent.metadata),
            agent.is_enabled,
          ]
        );
        console.log(`✅ Inserted: ${agent.name} (type: ${agent.type})`);
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
  
  // Show types
  const types = await query('SELECT type, name FROM ai_agents ORDER BY name');
  console.log('\n📋 Agent Types:');
  types.rows.forEach(a => {
    console.log(`   - ${a.type.padEnd(25)} → ${a.name}`);
  });

  process.exit(0);
}

seedRealAgents().catch((error) => {
  console.error('❌ Seed failed:', error);
  process.exit(1);
});
