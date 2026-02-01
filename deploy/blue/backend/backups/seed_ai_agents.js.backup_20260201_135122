import { query } from '../database/db.js';

/**
 * Seed 15 Production AI Agents
 * Safe to re-run (uses ON CONFLICT DO NOTHING)
 */

const agents = [
  {
    name: 'Technical Analysis Agent',
    type: 'technical',
    status: 'active',
    config: {
      indicators: ['RSI', 'MACD', 'EMA', 'Bollinger Bands'],
      confidence_threshold: 70,
      timeframes: ['1h', '4h', '1d'],
      risk_per_trade: 2,
    },
    metadata: {
      description: 'Analyzes price action, patterns, and technical indicators',
      specialization: 'Chart patterns, support/resistance, momentum',
    },
  },
  {
    name: 'Sentiment Analysis Agent',
    type: 'sentiment',
    status: 'active',
    config: {
      sources: ['twitter', 'reddit', 'news'],
      confidence_threshold: 65,
      sentiment_weight: 0.3,
    },
    metadata: {
      description: 'Monitors social media and news sentiment',
      specialization: 'Market psychology, crowd behavior',
    },
  },
  {
    name: 'Risk Management Agent',
    type: 'risk',
    status: 'active',
    config: {
      max_drawdown: 15,
      position_size_limit: 10,
      stop_loss_multiplier: 1.5,
      confidence_threshold: 80,
    },
    metadata: {
      description: 'Controls portfolio risk and position sizing',
      specialization: 'Drawdown control, exposure management',
    },
  },
  {
    name: 'Volume Profile Agent',
    type: 'volume',
    status: 'active',
    config: {
      volume_threshold: 1.5,
      orderflow_weight: 0.4,
      confidence_threshold: 68,
    },
    metadata: {
      description: 'Analyzes volume patterns and order flow',
      specialization: 'Market microstructure, liquidity analysis',
    },
  },
  {
    name: 'News Analysis Agent',
    type: 'news',
    status: 'active',
    config: {
      news_sources: ['bloomberg', 'reuters', 'coindesk'],
      impact_threshold: 7,
      confidence_threshold: 72,
    },
    metadata: {
      description: 'Processes breaking news and fundamental events',
      specialization: 'Event-driven trading, macro news',
    },
  },
  {
    name: 'On-Chain Metrics Agent',
    type: 'onchain',
    status: 'active',
    config: {
      metrics: ['whale_activity', 'exchange_flows', 'miner_revenue'],
      confidence_threshold: 75,
      chain_weight: 0.25,
    },
    metadata: {
      description: 'Monitors blockchain data and network metrics',
      specialization: 'Whale tracking, exchange flows, miner behavior',
    },
  },
  {
    name: 'Correlation Analysis Agent',
    type: 'correlation',
    status: 'active',
    config: {
      assets: ['BTC', 'ETH', 'SPX', 'DXY'],
      correlation_threshold: 0.7,
      confidence_threshold: 70,
    },
    metadata: {
      description: 'Tracks inter-market correlations',
      specialization: 'Cross-asset analysis, macro correlations',
    },
  },
  {
    name: 'Portfolio Allocation Agent',
    type: 'portfolio',
    status: 'active',
    config: {
      rebalance_threshold: 5,
      max_position_size: 15,
      confidence_threshold: 78,
    },
    metadata: {
      description: 'Optimizes portfolio allocation and diversification',
      specialization: 'Modern portfolio theory, asset allocation',
    },
  },
  {
    name: 'Position Sizing Agent',
    type: 'position',
    status: 'active',
    config: {
      kelly_fraction: 0.25,
      max_leverage: 3,
      confidence_threshold: 82,
    },
    metadata: {
      description: 'Calculates optimal position sizes',
      specialization: 'Kelly criterion, risk-adjusted sizing',
    },
  },
  {
    name: 'Scalping Agent',
    type: 'scalping',
    status: 'active',
    config: {
      timeframe: '1m',
      profit_target: 0.5,
      max_hold_time: 5,
      confidence_threshold: 85,
    },
    metadata: {
      description: 'High-frequency short-term trades',
      specialization: 'Micro price movements, tight spreads',
    },
  },
  {
    name: 'Swing Trading Agent',
    type: 'swing',
    status: 'active',
    config: {
      timeframe: '4h',
      hold_time: '1-5 days',
      confidence_threshold: 73,
    },
    metadata: {
      description: 'Medium-term trend following',
      specialization: 'Multi-day trends, swing highs/lows',
    },
  },
  {
    name: 'Arbitrage Agent',
    type: 'arbitrage',
    status: 'active',
    config: {
      exchanges: ['binance', 'mexc', 'kraken'],
      min_spread: 0.3,
      confidence_threshold: 90,
    },
    metadata: {
      description: 'Exploits price differences across exchanges',
      specialization: 'Cross-exchange arbitrage, funding rates',
    },
  },
  {
    name: 'Market Regime Agent',
    type: 'regime',
    status: 'active',
    config: {
      regimes: ['bull', 'bear', 'sideways', 'high_volatility'],
      regime_confidence: 75,
      confidence_threshold: 71,
    },
    metadata: {
      description: 'Identifies market regime and adapts strategy',
      specialization: 'Regime detection, volatility clustering',
    },
  },
  {
    name: 'Whale Tracker Agent',
    type: 'whale',
    status: 'active',
    config: {
      whale_threshold: 1000000,
      track_wallets: true,
      confidence_threshold: 69,
    },
    metadata: {
      description: 'Monitors large wallet movements',
      specialization: 'Whale activity, large transfers',
    },
  },
  {
    name: 'Execution Agent',
    type: 'execution',
    status: 'active',
    config: {
      slippage_tolerance: 0.5,
      execution_algo: 'TWAP',
      confidence_threshold: 88,
    },
    metadata: {
      description: 'Optimizes trade execution and minimizes slippage',
      specialization: 'Order splitting, execution algorithms',
    },
  },
];

async function seedAgents() {
  console.log('🌱 Seeding AI Agents...\n');

  let inserted = 0;
  let skipped = 0;

  for (const agent of agents) {
    try {
      // Check if agent already exists by name
      const existing = await query(
        'SELECT id FROM ai_agents WHERE name = $1',
        [agent.name]
      );

      if (existing.rows.length > 0) {
        console.log(`⏭️  ${agent.name} (${agent.type}) - Already exists`);
        skipped++;
        continue;
      }

      // Insert new agent
      await query(
        `INSERT INTO ai_agents 
          (name, type, status, config, metadata, is_enabled) 
        VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          agent.name,
          agent.type,
          agent.status,
          JSON.stringify(agent.config),
          JSON.stringify(agent.metadata),
          true,
        ]
      );

      console.log(`✅ ${agent.name} (${agent.type}) - Inserted`);
      inserted++;
    } catch (error) {
      console.error(`❌ Failed to seed ${agent.name}:`, error.message);
    }
  }

  console.log(`\n📊 Summary:`);
  console.log(`   ✅ Inserted: ${inserted}`);
  console.log(`   ⏭️  Skipped: ${skipped}`);
  console.log(`   📦 Total: ${agents.length}`);

  // Verify
  const total = await query('SELECT COUNT(*) as count FROM ai_agents');
  console.log(`\n✅ Total agents in database: ${total.rows[0].count}`);

  process.exit(0);
}

seedAgents().catch((error) => {
  console.error('❌ Seed failed:', error);
  process.exit(1);
});
