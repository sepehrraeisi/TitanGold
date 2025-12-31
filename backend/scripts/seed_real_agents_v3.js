/**
 * Seed 15 Real TitanGold AI Agents with agent_key mapping
 * Matches frontend AIAgents.tsx mapping
 * Preserves UUID in id column, adds agent_key for frontend lookup
 */

import { query } from '../database/db.js';

// GUARD: Block test agents from being seeded
const BLOCKED_AGENT_KEYS = ['test_technical', 'test', 'demo'];

const realAgents = [
  {
    agent_key: 'technical',
    name: 'Technical Analysis Agent',
    type: 'technical',
    status: 'active',
    is_enabled: true,
    performance_score: 85.5,
    accuracy: 87.2,
    config: {
      strategy: 'indicators',
      parameters: {
        indicators: ['RSI', 'MACD', 'EMA', 'Bollinger Bands'],
        timeframes: ['1h', '4h', '1d'],
        sensitivity: 'medium'
      }
    },
    metadata: {
      description: 'Analyzes price action using technical indicators',
      capabilities: ['RSI', 'MACD', 'Pattern Recognition'],
      version: '2.1.0'
    }
  },
  {
    agent_key: 'risk',
    name: 'Risk Management Agent',
    type: 'risk',
    status: 'active',
    is_enabled: true,
    performance_score: 92.3,
    accuracy: 94.1,
    config: {
      strategy: 'risk_control',
      parameters: {
        max_drawdown: 15,
        position_limit: 10,
        stop_loss_percent: 2
      }
    },
    metadata: {
      description: 'Manages portfolio risk and position sizing',
      capabilities: ['Stop Loss', 'Position Sizing', 'Risk Assessment'],
      version: '2.0.0'
    }
  },
  {
    agent_key: 'sentiment',
    name: 'Sentiment Analysis Agent',
    type: 'sentiment',
    status: 'active',
    is_enabled: true,
    performance_score: 78.9,
    accuracy: 81.5,
    config: {
      strategy: 'social_sentiment',
      parameters: {
        sources: ['Twitter', 'Reddit', 'News'],
        sentiment_threshold: 0.6
      }
    },
    metadata: {
      description: 'Analyzes market sentiment from social media',
      capabilities: ['Social Media Analysis', 'News Sentiment', 'Fear & Greed'],
      version: '1.8.0'
    }
  },
  {
    agent_key: 'pattern',
    name: 'Pattern Recognition Agent',
    type: 'pattern',
    status: 'active',
    is_enabled: true,
    performance_score: 83.7,
    accuracy: 85.3,
    config: {
      strategy: 'pattern_detection',
      parameters: {
        patterns: ['Head and Shoulders', 'Double Top', 'Triangle'],
        min_confidence: 0.75
      }
    },
    metadata: {
      description: 'Identifies chart patterns and formations',
      capabilities: ['Chart Patterns', 'Candlestick Patterns', 'Formation Detection'],
      version: '2.2.0'
    }
  },
  {
    agent_key: 'price_prediction',
    name: 'Price Prediction Agent',
    type: 'prediction',
    status: 'active',
    is_enabled: true,
    performance_score: 76.4,
    accuracy: 79.2,
    config: {
      strategy: 'ml_prediction',
      parameters: {
        model: 'LSTM',
        lookback_period: 30,
        prediction_horizon: 24
      }
    },
    metadata: {
      description: 'Predicts future price movements using ML',
      capabilities: ['Price Forecasting', 'Trend Prediction', 'ML Models'],
      version: '3.0.0'
    }
  },
  {
    agent_key: 'arbitrage',
    name: 'Arbitrage Agent',
    type: 'arbitrage',
    status: 'active',
    is_enabled: true,
    performance_score: 91.2,
    accuracy: 93.8,
    config: {
      strategy: 'cross_exchange',
      parameters: {
        min_spread: 0.3,
        execution_speed: 'fast',
        exchanges: ['Binance', 'MEXC', 'Bybit']
      }
    },
    metadata: {
      description: 'Exploits price differences across exchanges',
      capabilities: ['Cross-Exchange Arbitrage', 'Triangular Arbitrage', 'Statistical Arbitrage'],
      version: '2.5.0'
    }
  },
  {
    agent_key: 'portfolio',
    name: 'Portfolio Allocation Agent',
    type: 'portfolio',
    status: 'active',
    is_enabled: true,
    performance_score: 88.6,
    accuracy: 90.2,
    config: {
      strategy: 'dynamic_allocation',
      parameters: {
        rebalance_threshold: 5,
        asset_classes: ['BTC', 'ETH', 'Alts', 'Stables'],
        risk_tolerance: 'moderate'
      }
    },
    metadata: {
      description: 'Optimizes portfolio allocation dynamically',
      capabilities: ['Asset Allocation', 'Rebalancing', 'Diversification'],
      version: '2.3.0'
    }
  },
  {
    agent_key: 'liquidity',
    name: 'Liquidity Agent',
    type: 'liquidity',
    status: 'active',
    is_enabled: true,
    performance_score: 84.1,
    accuracy: 86.7,
    config: {
      strategy: 'liquidity_analysis',
      parameters: {
        depth_threshold: 100000,
        slippage_tolerance: 0.5
      }
    },
    metadata: {
      description: 'Analyzes market liquidity and depth',
      capabilities: ['Order Book Analysis', 'Slippage Prediction', 'Liquidity Scoring'],
      version: '1.9.0'
    }
  },
  {
    agent_key: 'trend',
    name: 'Trend Agent',
    type: 'trend',
    status: 'active',
    is_enabled: true,
    performance_score: 82.5,
    accuracy: 84.9,
    config: {
      strategy: 'trend_following',
      parameters: {
        trend_strength: 'strong',
        timeframe: '4h',
        indicators: ['EMA', 'ADX']
      }
    },
    metadata: {
      description: 'Identifies and follows market trends',
      capabilities: ['Trend Detection', 'Trend Strength', 'Reversal Detection'],
      version: '2.1.0'
    }
  },
  {
    agent_key: 'optimization',
    name: 'Optimization Agent',
    type: 'optimization',
    status: 'active',
    is_enabled: true,
    performance_score: 87.3,
    accuracy: 89.5,
    config: {
      strategy: 'parameter_optimization',
      parameters: {
        optimization_method: 'genetic_algorithm',
        objective: 'sharpe_ratio'
      }
    },
    metadata: {
      description: 'Optimizes trading parameters and strategies',
      capabilities: ['Parameter Tuning', 'Strategy Optimization', 'Backtesting'],
      version: '2.4.0'
    }
  },
  {
    agent_key: 'order',
    name: 'Order Management Agent',
    type: 'order',
    status: 'active',
    is_enabled: true,
    performance_score: 93.8,
    accuracy: 95.2,
    config: {
      strategy: 'smart_execution',
      parameters: {
        execution_algo: 'TWAP',
        order_types: ['limit', 'market', 'stop']
      }
    },
    metadata: {
      description: 'Manages order execution and lifecycle',
      capabilities: ['Order Routing', 'Execution Algorithms', 'Order Tracking'],
      version: '2.6.0'
    }
  },
  {
    agent_key: 'fundamental',
    name: 'Fundamental Agent',
    type: 'fundamental',
    status: 'active',
    is_enabled: true,
    performance_score: 79.2,
    accuracy: 82.4,
    config: {
      strategy: 'fundamental_analysis',
      parameters: {
        metrics: ['market_cap', 'volume', 'supply'],
        data_sources: ['CoinGecko', 'CoinMarketCap']
      }
    },
    metadata: {
      description: 'Analyzes fundamental metrics and tokenomics',
      capabilities: ['Tokenomics Analysis', 'Market Cap Analysis', 'Supply Dynamics'],
      version: '1.7.0'
    }
  },
  {
    agent_key: 'market_intelligence',
    name: 'Market Intelligence Agent',
    type: 'intelligence',
    status: 'active',
    is_enabled: true,
    performance_score: 86.9,
    accuracy: 88.7,
    config: {
      strategy: 'market_intelligence',
      parameters: {
        data_sources: ['Bloomberg', 'Reuters', 'CoinDesk'],
        update_frequency: '1h'
      }
    },
    metadata: {
      description: 'Aggregates and analyzes market intelligence',
      capabilities: ['News Aggregation', 'Market Analysis', 'Event Detection'],
      version: '2.0.0'
    }
  },
  {
    agent_key: 'volume',
    name: 'Volume Agent',
    type: 'volume',
    status: 'active',
    is_enabled: true,
    performance_score: 85.7,
    accuracy: 87.9,
    config: {
      strategy: 'volume_analysis',
      parameters: {
        volume_indicators: ['OBV', 'Volume Profile', 'VWAP'],
        anomaly_threshold: 2.5
      }
    },
    metadata: {
      description: 'Analyzes trading volume and flow',
      capabilities: ['Volume Analysis', 'Order Flow', 'Volume Anomaly Detection'],
      version: '2.2.0'
    }
  },
  {
    agent_key: 'timing',
    name: 'Timing Agent',
    type: 'timing',
    status: 'active',
    is_enabled: true,
    performance_score: 81.4,
    accuracy: 83.8,
    config: {
      strategy: 'entry_exit_timing',
      parameters: {
        timing_model: 'momentum',
        confirmation_signals: 3
      }
    },
    metadata: {
      description: 'Optimizes entry and exit timing',
      capabilities: ['Entry Timing', 'Exit Timing', 'Momentum Analysis'],
      version: '2.1.0'
    }
  }
];

async function seedRealAgents() {
  try {
    console.log('🌱 Starting Real Agents Seed (v3 with agent_key)...\n');
    
    let inserted = 0;
    let updated = 0;
    
    for (const agent of realAgents) {
      try {
        // GUARD: Block test/demo agents
        if (BLOCKED_AGENT_KEYS.includes(agent.agent_key)) {
          console.log(`⏭️  Skipping blocked agent: ${agent.agent_key}`);
          continue;
        }
        
        // Check if agent exists by agent_key
        const existing = await query(
          'SELECT id FROM ai_agents WHERE agent_key = $1',
          [agent.agent_key]
        );
        
        if (existing.rows.length > 0) {
          // Update existing
          await query(`
            UPDATE ai_agents SET
              name = $1,
              type = $2,
              status = $3,
              is_enabled = $4,
              performance_score = $5,
              accuracy = $6,
              config = $7,
              metadata = $8,
              updated_at = NOW()
            WHERE agent_key = $9
          `, [
            agent.name,
            agent.type,
            agent.status,
            agent.is_enabled,
            agent.performance_score,
            agent.accuracy,
            JSON.stringify(agent.config),
            JSON.stringify(agent.metadata),
            agent.agent_key
          ]);
          updated++;
          console.log(`✅ Updated: ${agent.name} (${agent.agent_key})`);
        } else {
          // Insert new
          await query(`
            INSERT INTO ai_agents (
              agent_key, name, type, status, is_enabled,
              performance_score, accuracy, config, metadata,
              created_at, updated_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
          `, [
            agent.agent_key,
            agent.name,
            agent.type,
            agent.status,
            agent.is_enabled,
            agent.performance_score,
            agent.accuracy,
            JSON.stringify(agent.config),
            JSON.stringify(agent.metadata)
          ]);
          inserted++;
          console.log(`✅ Inserted: ${agent.name} (${agent.agent_key})`);
        }
      } catch (err) {
        console.error(`❌ Error processing ${agent.name}:`, err.message);
      }
    }
    
    console.log('\n📊 Summary:');
    console.log(`   Inserted: ${inserted}`);
    console.log(`   Updated: ${updated}`);
    console.log(`   Total: ${realAgents.length}`);
    
    // Final verification
    const result = await query('SELECT COUNT(*) as count FROM ai_agents');
    console.log(`\n✅ Total agents in database: ${result.rows[0].count}`);
    
    // Show all agents with agent_key
    const allAgents = await query(`
      SELECT id, agent_key, name, type, status 
      FROM ai_agents 
      ORDER BY agent_key
    `);
    
    console.log('\n📋 All Agents:');
    console.table(allAgents.rows);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Seed failed:', error);
    process.exit(1);
  }
}

seedRealAgents();
