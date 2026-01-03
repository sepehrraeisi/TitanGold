// Seed Script for 15 TitanGold AI Agents
// Purpose: Idempotent seeding - INSERT or UPDATE all 15 agents with proper config
// Date: 2026-01-03

import pool from '../database/db.js';

// Define all 15 agents with complete configuration
const AGENTS = [
    {
        agent_key: 'technical',
        name: 'Technical Analysis Agent',
        type: 'technical_analysis',
        role: 'Market Analyzer',
        status: 'active',
        capabilities: ['RSI', 'MACD', 'Moving Averages', 'Bollinger Bands', 'Chart Patterns'],
        config: {
            indicators: ['RSI', 'MACD', 'SMA', 'EMA', 'BB'],
            timeframes: ['1h', '4h', '1d'],
            default_period: 14,
            rsi_overbought: 70,
            rsi_oversold: 30
        },
        metadata: {
            version: '1.0.0',
            last_training: null,
            model_type: 'rule_based',
            description: 'Analyzes technical indicators and chart patterns'
        }
    },
    {
        agent_key: 'risk',
        name: 'Risk Management Agent',
        type: 'risk_management',
        role: 'Risk Controller',
        status: 'active',
        capabilities: ['Position Sizing', 'Stop Loss', 'Risk Score', 'Drawdown Monitoring'],
        config: {
            max_risk_per_trade: 0.02,
            max_portfolio_risk: 0.10,
            stop_loss_default: 0.02,
            take_profit_default: 0.05,
            risk_levels: ['low', 'medium', 'high']
        },
        metadata: {
            version: '1.0.0',
            model_type: 'rule_based',
            description: 'Monitors and controls trading risks'
        }
    },
    {
        agent_key: 'sentiment',
        name: 'Sentiment Analysis Agent',
        type: 'sentiment_analysis',
        role: 'Market Sentiment Analyzer',
        status: 'active',
        capabilities: ['News Analysis', 'Social Media', 'Fear & Greed Index'],
        config: {
            sources: ['news', 'twitter', 'reddit'],
            update_interval: 300,
            sentiment_threshold: 0.6
        },
        metadata: {
            version: '1.0.0',
            model_type: 'ml_based',
            description: 'Analyzes market sentiment from multiple sources'
        }
    },
    {
        agent_key: 'pattern',
        name: 'Pattern Recognition Agent',
        type: 'pattern_recognition',
        role: 'Pattern Detector',
        status: 'active',
        capabilities: ['Candlestick Patterns', 'Chart Patterns', 'Breakouts', 'Support/Resistance'],
        config: {
            min_confidence: 0.7,
            patterns: ['doji', 'hammer', 'engulfing', 'head_shoulders', 'double_top'],
            lookback_candles: 50
        },
        metadata: {
            version: '1.0.0',
            model_type: 'hybrid',
            description: 'Detects candlestick and chart patterns'
        }
    },
    {
        agent_key: 'price_prediction',
        name: 'Price Prediction Agent',
        type: 'price_prediction',
        role: 'Price Forecaster',
        status: 'active',
        capabilities: ['Short-term Forecast', 'Trend Projection', 'Support/Resistance Levels'],
        config: {
            forecast_horizon: 24,
            model_type: 'moving_average',
            confidence_threshold: 0.6,
            update_frequency: 3600
        },
        metadata: {
            version: '1.0.0',
            model_type: 'ml_based',
            description: 'Predicts short-term price movements'
        }
    },
    {
        agent_key: 'arbitrage',
        name: 'Arbitrage Agent',
        type: 'arbitrage',
        role: 'Arbitrage Scanner',
        status: 'active',
        capabilities: ['Cross-Exchange Arbitrage', 'Opportunity Detection', 'Profit Calculation'],
        config: {
            min_profit_percent: 0.5,
            exchanges: ['binance', 'mexc', 'okx'],
            scan_interval: 10,
            include_fees: true
        },
        metadata: {
            version: '1.0.0',
            model_type: 'rule_based',
            description: 'Scans for arbitrage opportunities across exchanges'
        }
    },
    {
        agent_key: 'portfolio',
        name: 'Portfolio Allocation Agent',
        type: 'portfolio_management',
        role: 'Portfolio Manager',
        status: 'active',
        capabilities: ['Asset Allocation', 'Rebalancing', 'Diversification', 'Risk Distribution'],
        config: {
            rebalance_threshold: 0.1,
            max_assets: 10,
            min_allocation: 0.05,
            max_allocation: 0.3
        },
        metadata: {
            version: '1.0.0',
            model_type: 'optimization',
            description: 'Manages portfolio allocation and rebalancing'
        }
    },
    {
        agent_key: 'liquidity',
        name: 'Liquidity Agent',
        type: 'liquidity_analysis',
        role: 'Liquidity Analyzer',
        status: 'active',
        capabilities: ['Order Book Analysis', 'Slippage Estimation', 'Volume Analysis'],
        config: {
            depth_levels: 20,
            min_liquidity_score: 0.5,
            slippage_tolerance: 0.01
        },
        metadata: {
            version: '1.0.0',
            model_type: 'rule_based',
            description: 'Analyzes market liquidity and order book depth'
        }
    },
    {
        agent_key: 'trend',
        name: 'Trend Agent',
        type: 'trend_detection',
        role: 'Trend Detector',
        status: 'active',
        capabilities: ['Trend Direction', 'Strength Analysis', 'Multi-Timeframe Trend'],
        config: {
            timeframes: ['15m', '1h', '4h', '1d'],
            trend_strength_threshold: 0.6,
            use_multiple_indicators: true
        },
        metadata: {
            version: '1.0.0',
            model_type: 'hybrid',
            description: 'Detects and analyzes market trends'
        }
    },
    {
        agent_key: 'optimization',
        name: 'Optimization Agent',
        type: 'optimization',
        role: 'Strategy Optimizer',
        status: 'active',
        capabilities: ['Parameter Optimization', 'Backtest Optimization', 'Risk/Return Balance'],
        config: {
            optimization_metric: 'sharpe_ratio',
            min_trades: 30,
            max_iterations: 100
        },
        metadata: {
            version: '1.0.0',
            model_type: 'optimization',
            description: 'Optimizes trading strategies and parameters'
        }
    },
    {
        agent_key: 'order',
        name: 'Order Management Agent',
        type: 'order_management',
        role: 'Order Manager',
        status: 'active',
        capabilities: ['Order Execution', 'Order Tracking', 'Execution Report'],
        config: {
            order_types: ['market', 'limit', 'stop_loss', 'take_profit'],
            execution_mode: 'best_effort',
            retry_failed: true
        },
        metadata: {
            version: '1.0.0',
            model_type: 'rule_based',
            description: 'Manages order execution and tracking'
        }
    },
    {
        agent_key: 'fundamental',
        name: 'Fundamental Agent',
        type: 'fundamental_analysis',
        role: 'Fundamental Analyzer',
        status: 'active',
        capabilities: ['Market Cap Analysis', 'Volume Trends', 'Token Metrics'],
        config: {
            metrics: ['market_cap', 'volume_24h', 'circulating_supply'],
            update_interval: 3600
        },
        metadata: {
            version: '1.0.0',
            model_type: 'rule_based',
            description: 'Analyzes fundamental crypto metrics'
        }
    },
    {
        agent_key: 'market_intelligence',
        name: 'Market Intelligence Agent',
        type: 'market_intelligence',
        role: 'Intelligence Aggregator',
        status: 'active',
        capabilities: ['News Aggregation', 'Event Detection', 'Market Signals'],
        config: {
            sources: ['news', 'events', 'announcements'],
            priority_events: ['listing', 'partnership', 'upgrade'],
            update_interval: 600
        },
        metadata: {
            version: '1.0.0',
            model_type: 'ml_based',
            description: 'Aggregates market intelligence and events'
        }
    },
    {
        agent_key: 'volume',
        name: 'Volume Agent',
        type: 'volume_analysis',
        role: 'Volume Analyzer',
        status: 'active',
        capabilities: ['Volume Patterns', 'Accumulation/Distribution', 'Volume Breakouts'],
        config: {
            volume_threshold: 1.5,
            lookback_period: 20,
            detect_anomalies: true
        },
        metadata: {
            version: '1.0.0',
            model_type: 'rule_based',
            description: 'Analyzes trading volume patterns'
        }
    },
    {
        agent_key: 'timing',
        name: 'Timing Agent',
        type: 'timing',
        role: 'Market Timer',
        status: 'active',
        capabilities: ['Entry/Exit Timing', 'Momentum Analysis', 'Multi-Timeframe Sync'],
        config: {
            timeframes: ['5m', '15m', '1h', '4h'],
            sync_threshold: 0.7,
            use_momentum: true
        },
        metadata: {
            version: '1.0.0',
            model_type: 'hybrid',
            description: 'Provides optimal entry and exit timing'
        }
    }
];

async function seedAgents() {
    console.log('🌱 Starting seed: 15 TitanGold AI Agents...\n');
    
    const client = await pool.connect();
    
    try {
        await client.query('BEGIN');
        
        let inserted = 0;
        let updated = 0;
        let errors = 0;
        
        for (const agent of AGENTS) {
            try {
                // Check if agent exists
                const existingAgent = await client.query(
                    'SELECT id FROM ai_agents WHERE agent_key = $1',
                    [agent.agent_key]
                );
                
                if (existingAgent.rows.length > 0) {
                    // Update existing agent
                    await client.query(`
                        UPDATE ai_agents
                        SET 
                            name = $1,
                            type = $2,
                            status = $3,
                            config = $4,
                            metadata = $5,
                            updated_at = NOW()
                        WHERE agent_key = $6
                    `, [
                        agent.name,
                        agent.type,
                        agent.status,
                        JSON.stringify(agent.config),
                        JSON.stringify({
                            ...agent.metadata,
                            role: agent.role,
                            capabilities: agent.capabilities
                        }),
                        agent.agent_key
                    ]);
                    
                    console.log(`✅ Updated: ${agent.agent_key.padEnd(20)} | ${agent.name}`);
                    updated++;
                } else {
                    // Insert new agent
                    await client.query(`
                        INSERT INTO ai_agents (
                            agent_key, name, type, status, config, metadata,
                            performance_score, total_decisions, successful_decisions,
                            accuracy, is_enabled, created_at, updated_at
                        )
                        VALUES ($1, $2, $3, $4, $5, $6, 0, 0, 0, 0, true, NOW(), NOW())
                    `, [
                        agent.agent_key,
                        agent.name,
                        agent.type,
                        agent.status,
                        JSON.stringify(agent.config),
                        JSON.stringify({
                            ...agent.metadata,
                            role: agent.role,
                            capabilities: agent.capabilities
                        })
                    ]);
                    
                    console.log(`✨ Inserted: ${agent.agent_key.padEnd(20)} | ${agent.name}`);
                    inserted++;
                }
            } catch (error) {
                console.error(`❌ Error seeding ${agent.agent_key}:`, error.message);
                errors++;
            }
        }
        
        await client.query('COMMIT');
        
        console.log('\n📊 Seed Summary:');
        console.log(`   ✨ Inserted: ${inserted}`);
        console.log(`   ✅ Updated: ${updated}`);
        console.log(`   ❌ Errors: ${errors}`);
        console.log(`   📋 Total: ${AGENTS.length}`);
        
        // Verify final state
        const result = await client.query(`
            SELECT agent_key, name, status
            FROM ai_agents
            ORDER BY agent_key
        `);
        
        console.log('\n📋 Current Agents in Database:');
        result.rows.forEach(row => {
            console.log(`   ${row.agent_key.padEnd(20)} | ${row.name.padEnd(35)} | ${row.status}`);
        });
        
        process.exit(0);
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('❌ Seed failed:', error.message);
        console.error(error);
        process.exit(1);
    } finally {
        client.release();
    }
}

seedAgents();
