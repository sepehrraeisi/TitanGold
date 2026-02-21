/**
 * Enhanced Telegram Message Processor v2.0 - Modular
 * Combines Core helpers + Enhanced features
 * Processes messages for 15 AI agents + 15 news categories
 */

// Load env from telegram-collector/.env so we use same DB as collector (PM2 cwd may be repo root)
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const { Pool } = require('pg');
const ProcessorCore = require('./messageProcessorCore');
const EnhancedFeatures = require('./enhancedFeatures');

// Database connection (same as collector via telegram-collector/.env)
const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5433'),
    database: process.env.DB_NAME || 'titangold_db',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '',
    connectionTimeoutMillis: 10000
});

class EnhancedMessageProcessor {
    constructor() {
        this.config = {
            enabled: process.env.TELEGRAM_PROCESSOR_ENABLED !== 'false',
            batchSize: parseInt(process.env.TELEGRAM_PROCESSOR_BATCH_SIZE || '150'),
            intervalSeconds: parseInt(process.env.TELEGRAM_PROCESSOR_INTERVAL_SECONDS || '15'),
            
            // Assets
            assets: ['BTC', 'ETH', 'USDT', 'GOLD', 'DOLLAR', 'EURO', 'DIRHAM', 'BITCOIN', 'ETHEREUM', 'OIL', 'SILVER'],
            currencies: ['USD', 'IRR', 'EUR', 'AED', 'TRY', 'GBP', 'JPY'],
            assetMappings: {
                'دلار': 'DOLLAR',
                'یورو': 'EURO',
                'طلا': 'GOLD',
                'سکه': 'GOLD_COIN',
                'بیت کوین': 'BTC',
                'اتریوم': 'ETH',
                'درهم': 'DIRHAM',
                'نفت': 'OIL',
                'نقره': 'SILVER'
            },
            
            // Countries
            countries: ['Iran', 'USA', 'Russia', 'China', 'Europe', 'UK', 'Germany', 'France', 'Turkey', 'UAE', 'Israel', 'Syria', 'Iraq'],
            countryMappings: {
                'ایران': 'Iran',
                'آمریکا': 'USA',
                'روسیه': 'Russia',
                'چین': 'China',
                'اروپا': 'Europe',
                'انگلیس': 'UK',
                'آلمان': 'Germany',
                'فرانسه': 'France',
                'ترکیه': 'Turkey',
                'امارات': 'UAE',
                'اسرائیل': 'Israel',
                'سوریه': 'Syria',
                'عراق': 'Iraq'
            }
        };
        
        // Initialize modules
        this.core = new ProcessorCore(this.config);
        this.enhanced = new EnhancedFeatures(this.config);
        
        this.intervalId = null;
        this.isRunning = false;
    }

    /**
     * Get unprocessed messages
     */
    async getUnprocessedMessages() {
        // Use NOT EXISTS instead of NOT IN for better performance and to avoid hang on large processed set
        const query = `
            SELECT 
                m.id,
                m.channel_id,
                m.message_text,
                m.telegram_created_at,
                c.username as channel_username,
                c.title as channel_title,
                c.priority
            FROM telegram_messages m
            JOIN telegram_channels c ON m.channel_id = c.id
            WHERE NOT EXISTS (
                SELECT 1 FROM processed_telegram_messages p WHERE p.raw_message_id = m.id
            )
            AND m.message_text IS NOT NULL
            AND LENGTH(TRIM(m.message_text)) > 10
            ORDER BY m.created_at ASC
            LIMIT $1
        `;
        
        const result = await pool.query(query, [this.config.batchSize]);
        return result.rows;
    }

    /**
     * Process a single message (Enhanced v2)
     */
    async processMessageEnhanced(message) {
        const startTime = Date.now();
        
        try {
            const text = message.message_text;
            
            // === PHASE 1: Core Processing ===
            const language = this.core.detectLanguage(text);
            const cleaned_text = this.core.cleanText(text);
            const keywords = this.core.extractKeywords(text);
            const hashtags = this.core.extractHashtags(text);
            const urls = this.core.extractURLs(text);
            
            // === PHASE 2: Entity Extraction ===
            const mentioned_assets = this.core.extractAssets(text);
            const mentioned_currencies = this.core.extractCurrencies(text);
            const extracted_prices = this.core.extractPrices(text);
            const countries = this.enhanced.extractCountries(text);
            
            // === PHASE 3: Enhanced Categorization ===
            const event_category = this.enhanced.detectEventCategory(text);
            const geopolitical_relevance = this.enhanced.detectGeopoliticalRelevance(text);
            
            // === PHASE 4: Sentiment Analysis ===
            const sentimentResult = this.core.analyzeSentiment(text);
            
            // === PHASE 5: Classification ===
            const news_type = this.core.classifyNewsType(text, mentioned_assets);
            const news_category = this.core.determineCategory(text, mentioned_assets);
            
            // === PHASE 6: Impact Assessment ===
            const market_impact_level = this.enhanced.assessMarketImpact(
                event_category,
                sentimentResult,
                mentioned_assets,
                countries,
                geopolitical_relevance
            );
            
            const importance_level = this.core.assessImportance(
                sentimentResult,
                extracted_prices,
                mentioned_assets,
                message.priority,
                market_impact_level
            );
            
            const is_actionable = (
                importance_level === 'critical' ||
                importance_level === 'high'
            ) && (mentioned_assets.length > 0 || geopolitical_relevance);
            
            // === PHASE 7: Breaking News Detection ===
            const is_breaking = this.enhanced.detectBreakingNews(text, event_category, market_impact_level);
            
            // === PHASE 8: Spam Detection ===
            const spam_probability = (text.length < 20 || hashtags.length > 5) ? 0.7 : 0.1;
            
            // Prepare processed data object
            const processedData = {
                cleaned_text,
                event_category,
                mentioned_assets,
                mentioned_currencies,
                countries,
                sentiment: sentimentResult.sentiment,
                sentiment_score: sentimentResult.score,
                importance_level,
                is_actionable,
                market_impact_level,
                geopolitical_relevance,
                extracted_prices,
                news_type,
                news_category,
                is_breaking,
                event_urgency: is_breaking ? 'immediate' : 'medium_term'
            };
            
            // === PHASE 9: Agent Impact Calculation ===
            const agentImpacts = this.enhanced.calculateAgentImpact(processedData);
            const affected_agents = agentImpacts.map(ai => ai.agent_key);
            const agent_impact_summary = {
                total_agents: agentImpacts.length,
                high_impact_agents: agentImpacts.filter(ai => ai.impact_score >= 0.7).map(ai => ai.agent_key),
                action_required: agentImpacts.filter(ai => ai.requires_action).length
            };
            
            // === PHASE 10: Save to Database ===
            const client = await pool.connect();
            try {
                await client.query('BEGIN');
                
                // Insert processed message
                const insertQuery = `
                    INSERT INTO processed_telegram_messages (
                        raw_message_id, channel_id, language, cleaned_text,
                        keywords, hashtags, urls,
                        mentioned_assets, mentioned_currencies, extracted_prices,
                        sentiment, sentiment_score, confidence_score,
                        news_type, news_category, importance_level, is_actionable,
                        event_category, geopolitical_relevance, market_impact_level,
                        affected_agents, agent_impact_summary,
                        spam_probability, processing_status,
                        processing_started_at, processing_completed_at, processing_duration_ms
                    ) VALUES (
                        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17,
                        $18, $19, $20, $21, $22, $23, $24, $25, $26, $27
                    ) RETURNING id
                `;
                
                const values = [
                    message.id, message.channel_id, language, cleaned_text,
                    keywords, hashtags, urls,
                    mentioned_assets, mentioned_currencies,
                    extracted_prices ? JSON.stringify(extracted_prices) : null,
                    sentimentResult.sentiment, sentimentResult.score, sentimentResult.confidence,
                    news_type, news_category, importance_level, is_actionable,
                    event_category, geopolitical_relevance, market_impact_level,
                    affected_agents, JSON.stringify(agent_impact_summary),
                    spam_probability, 'completed',
                    new Date(startTime), new Date(), Date.now() - startTime
                ];
                
                const result = await client.query(insertQuery, values);
                const processedId = result.rows[0].id;
                
                // Insert agent impacts
                for (const impact of agentImpacts) {
                    await client.query(`
                        INSERT INTO telegram_agent_impacts (
                            processed_message_id, agent_key, agent_name,
                            impact_score, impact_type, confidence,
                            relevance_reasons, extracted_signals,
                            priority_level, requires_action, action_type
                        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
                    `, [
                        processedId, impact.agent_key, impact.agent_name,
                        impact.impact_score, impact.impact_type, impact.confidence,
                        impact.relevance_reasons, JSON.stringify(impact.extracted_signals),
                        impact.priority_level, impact.requires_action, impact.action_type
                    ]);
                }
                
                // Insert news event if significant
                if (geopolitical_relevance || is_breaking || market_impact_level === 'severe' || market_impact_level === 'high') {
                    await client.query(`
                        INSERT INTO telegram_news_events (
                            processed_message_id, primary_category, event_type,
                            countries, affected_markets, affected_assets,
                            market_impact_level, is_breaking, is_developing,
                            event_urgency, source_reliability
                        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
                    `, [
                        processedId, event_category, news_type,
                        countries, ['forex', 'crypto', 'gold'], mentioned_assets,
                        market_impact_level, is_breaking, false,
                        processedData.event_urgency, 0.8
                    ]);
                }
                
                await client.query('COMMIT');
                
                return {
                    success: true,
                    processed_id: processedId,
                    duration_ms: Date.now() - startTime,
                    agents_affected: agentImpacts.length,
                    is_breaking: is_breaking,
                    event_category: event_category
                };
                
            } catch (error) {
                await client.query('ROLLBACK');
                throw error;
            } finally {
                client.release();
            }
            
        } catch (error) {
            console.error(`❌ Error processing message ${message.id}:`, error.message);
            
            // Save error
            try {
                await pool.query(`
                    INSERT INTO processed_telegram_messages (
                        raw_message_id, channel_id, processing_status,
                        error_message, processing_started_at, processing_completed_at, processing_duration_ms
                    ) VALUES ($1, $2, 'failed', $3, $4, $5, $6)
                `, [
                    message.id, message.channel_id, error.message,
                    new Date(startTime), new Date(), Date.now() - startTime
                ]);
            } catch (dbError) {
                console.error('❌ Error saving failure:', dbError.message);
            }
            
            return {
                success: false,
                error: error.message,
                duration_ms: Date.now() - startTime
            };
        }
    }

    /**
     * Process batch of messages
     */
    async processMessages() {
        try {
            console.log('\n🔄 Starting enhanced processing cycle...');
            
            const messages = await this.getUnprocessedMessages();
            
            if (messages.length === 0) {
                console.log('   ✅ No new messages to process');
                return;
            }
            
            console.log(`   📋 Found ${messages.length} message(s) to process`);
            
            const results = await Promise.allSettled(
                messages.map(msg => this.processMessageEnhanced(msg))
            );
            
            const successful = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
            const failed = results.filter(r => r.status === 'rejected' || (r.status === 'fulfilled' && !r.value.success)).length;
            const breaking = results.filter(r => r.status === 'fulfilled' && r.value.is_breaking).length;
            const totalAgents = results
                .filter(r => r.status === 'fulfilled' && r.value.success)
                .reduce((sum, r) => sum + (r.value.agents_affected || 0), 0);
            
            const avgDuration = results
                .filter(r => r.status === 'fulfilled')
                .map(r => r.value.duration_ms)
                .reduce((a, b) => a + b, 0) / results.length;
            
            // Category breakdown
            const categories = {};
            results.filter(r => r.status === 'fulfilled' && r.value.success).forEach(r => {
                const cat = r.value.event_category || 'GENERAL';
                categories[cat] = (categories[cat] || 0) + 1;
            });
            
            console.log(`\n✅ Enhanced processing cycle completed`);
            console.log(`   📊 Successful: ${successful}`);
            console.log(`   ❌ Failed: ${failed}`);
            console.log(`   🚨 Breaking news: ${breaking}`);
            console.log(`   🤖 Agent impacts: ${totalAgents}`);
            console.log(`   ⏱️  Avg duration: ${avgDuration.toFixed(0)}ms`);
            console.log(`   📰 Categories:`, Object.entries(categories).map(([k,v]) => `${k}=${v}`).join(', '));
            
        } catch (error) {
            console.error('❌ Error in processMessages:', error);
        }
    }

    /**
     * Start the processor
     */
    async start() {
        if (!this.config.enabled) {
            console.log('⚠️ Enhanced Processor is disabled');
            return;
        }

        if (this.isRunning) {
            console.log('⚠️ Enhanced Processor already running');
            return;
        }

        this.isRunning = true;
        console.log(`🚀 Starting Enhanced Telegram Message Processor v2.0`);
        console.log(`   📊 Batch size: ${this.config.batchSize}`);
        console.log(`   ⏱️  Interval: ${this.config.intervalSeconds}s`);
        console.log(`   🤖 AI Agents: 15 specialized agents`);
        console.log(`   📰 Categories: 15 news categories`);

        // Run immediately
        await this.processMessages().catch(err =>
            console.error('❌ Error in initial processing:', err)
        );

        // Schedule periodic processing
        this.intervalId = setInterval(async () => {
            await this.processMessages().catch(err =>
                console.error('❌ Error in periodic processing:', err)
            );
        }, this.config.intervalSeconds * 1000);

        console.log('✅ Enhanced Processor started successfully\n');
    }

    stop() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
        this.isRunning = false;
        console.log('🛑 Enhanced Processor stopped');
    }

    async getStats() {
        const result = await pool.query('SELECT * FROM telegram_pipeline_stats');
        return result.rows[0];
    }
}

// Export
const processor = new EnhancedMessageProcessor();
module.exports = processor;

// Auto-start
if (require.main === module) {
    console.log('🚀 Starting Enhanced Telegram Message Processor v2.0...\n');
    processor.start().catch(err => {
        console.error('❌ Fatal error:', err);
        process.exit(1);
    });
    
    process.on('SIGINT', () => {
        console.log('\n📡 Received SIGINT, shutting down...');
        processor.stop();
        process.exit(0);
    });
    
    process.on('SIGTERM', () => {
        console.log('\n📡 Received SIGTERM, shutting down...');
        processor.stop();
        process.exit(0);
    });
}
