/**
 * Enhanced Telegram Message Processor v2.0
 * Multi-category news processing + 15 AI Agent impact assessment
 * 
 * New Features:
 * - 15 comprehensive news categories (war, politics, economics, etc.)
 * - Impact assessment for all 15 specialized agents
 * - Geopolitical event detection
 * - Entity extraction (people, places, organizations)
 * - Agent-specific signal generation
 * - Breaking news detection
 * - Market impact prediction
 */

const { Pool } = require('pg');

// Database connection
const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5433'),
    database: process.env.DB_NAME || 'titangold_db',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || ''
});

// ==========================================
// AGENT DEFINITIONS - 15 Specialized Agents
// ==========================================
const AGENTS = {
    TECHNICAL: {
        key: 'technical',
        name: 'Technical Analysis Agent',
        interests: ['price', 'volume', 'indicator', 'pattern', 'support', 'resistance', 'chart', 'تحلیل تکنیکال', 'نمودار']
    },
    RISK: {
        key: 'risk',
        name: 'Risk Management Agent',
        interests: ['risk', 'volatility', 'loss', 'hedge', 'protection', 'insurance', 'ریسک', 'ضرر', 'محافظت']
    },
    SENTIMENT: {
        key: 'sentiment',
        name: 'Sentiment Agent',
        interests: ['sentiment', 'feeling', 'mood', 'fear', 'greed', 'احساس', 'ترس', 'طمع']
    },
    PATTERN: {
        key: 'pattern',
        name: 'Pattern Agent',
        interests: ['pattern', 'formation', 'structure', 'الگو', 'ساختار']
    },
    PRICE_PREDICTION: {
        key: 'price_prediction',
        name: 'Price Prediction Agent',
        interests: ['predict', 'forecast', 'target', 'projection', 'پیش بینی', 'هدف']
    },
    ARBITRAGE: {
        key: 'arbitrage',
        name: 'Arbitrage Agent',
        interests: ['arbitrage', 'spread', 'difference', 'opportunity', 'آربیتراژ', 'اختلاف']
    },
    PORTFOLIO: {
        key: 'portfolio',
        name: 'Portfolio Allocation Agent',
        interests: ['portfolio', 'allocation', 'diversification', 'balance', 'پورتفولیو', 'تنوع']
    },
    LIQUIDITY: {
        key: 'liquidity',
        name: 'Liquidity Agent',
        interests: ['liquidity', 'depth', 'slippage', 'نقدینگی', 'عمق']
    },
    TREND: {
        key: 'trend',
        name: 'Trend Agent',
        interests: ['trend', 'direction', 'momentum', 'روند', 'جهت', 'شتاب']
    },
    OPTIMIZATION: {
        key: 'optimization',
        name: 'Optimization Agent',
        interests: ['optimize', 'improve', 'enhance', 'efficiency', 'بهینه', 'کارایی']
    },
    ORDER: {
        key: 'order',
        name: 'Order Management Agent',
        interests: ['order', 'execution', 'fill', 'سفارش', 'اجرا']
    },
    FUNDAMENTAL: {
        key: 'fundamental',
        name: 'Fundamental Agent',
        interests: ['fundamental', 'value', 'economy', 'growth', 'بنیادی', 'ارزش', 'اقتصاد']
    },
    MARKET_INTELLIGENCE: {
        key: 'market_intelligence',
        name: 'Market Intelligence Agent',
        interests: ['market', 'intelligence', 'news', 'event', 'هوش بازار', 'خبر', 'رویداد']
    },
    VOLUME: {
        key: 'volume',
        name: 'Volume Agent',
        interests: ['volume', 'activity', 'participation', 'حجم', 'فعالیت']
    },
    TIMING: {
        key: 'timing',
        name: 'Timing Agent',
        interests: ['timing', 'entry', 'exit', 'when', 'زمان', 'ورود', 'خروج']
    }
};

// ==========================================
// NEWS EVENT CATEGORIES
// ==========================================
const EVENT_CATEGORIES = {
    MARKET_DATA: {
        key: 'MARKET_DATA',
        keywords: ['price', 'volume', 'market', 'trade', 'قیمت', 'بازار', 'معامله', 'حجم'],
        agents: ['TECHNICAL', 'VOLUME', 'TREND', 'LIQUIDITY']
    },
    ECONOMIC_INDICATORS: {
        key: 'ECONOMIC_INDICATORS',
        keywords: ['gdp', 'inflation', 'employment', 'interest rate', 'central bank', 'تورم', 'بانک مرکزی', 'نرخ بهره'],
        agents: ['FUNDAMENTAL', 'MARKET_INTELLIGENCE', 'PRICE_PREDICTION', 'RISK']
    },
    GEOPOLITICAL: {
        key: 'GEOPOLITICAL',
        keywords: ['war', 'conflict', 'military', 'attack', 'invasion', 'جنگ', 'حمله', 'درگیری', 'نظامی'],
        agents: ['RISK', 'SENTIMENT', 'MARKET_INTELLIGENCE', 'FUNDAMENTAL']
    },
    POLITICAL: {
        key: 'POLITICAL',
        keywords: ['election', 'government', 'policy', 'president', 'parliament', 'انتخابات', 'دولت', 'سیاست'],
        agents: ['FUNDAMENTAL', 'MARKET_INTELLIGENCE', 'SENTIMENT', 'RISK']
    },
    SANCTIONS_EMBARGO: {
        key: 'SANCTIONS_EMBARGO',
        keywords: ['sanction', 'embargo', 'restrict', 'ban', 'تحریم', 'محدودیت', 'ممنوعیت'],
        agents: ['RISK', 'FUNDAMENTAL', 'MARKET_INTELLIGENCE', 'ARBITRAGE']
    },
    ENERGY_COMMODITIES: {
        key: 'ENERGY_COMMODITIES',
        keywords: ['oil', 'gas', 'energy', 'opec', 'نفت', 'گاز', 'انرژی'],
        agents: ['FUNDAMENTAL', 'PRICE_PREDICTION', 'TREND', 'MARKET_INTELLIGENCE']
    },
    CRYPTO_BLOCKCHAIN: {
        key: 'CRYPTO_BLOCKCHAIN',
        keywords: ['bitcoin', 'crypto', 'blockchain', 'btc', 'eth', 'بیت کوین', 'ارز دیجیتال'],
        agents: ['TECHNICAL', 'SENTIMENT', 'VOLUME', 'TREND', 'ARBITRAGE']
    },
    FOREX_CURRENCY: {
        key: 'FOREX_CURRENCY',
        keywords: ['dollar', 'euro', 'currency', 'exchange rate', 'forex', 'دلار', 'یورو', 'ارز'],
        agents: ['FUNDAMENTAL', 'TECHNICAL', 'TREND', 'ARBITRAGE', 'PRICE_PREDICTION']
    },
    PRECIOUS_METALS: {
        key: 'PRECIOUS_METALS',
        keywords: ['gold', 'silver', 'precious', 'metal', 'طلا', 'سکه', 'فلز'],
        agents: ['FUNDAMENTAL', 'TECHNICAL', 'TREND', 'SENTIMENT']
    },
    SOCIAL_UNREST: {
        key: 'SOCIAL_UNREST',
        keywords: ['protest', 'riot', 'unrest', 'demonstration', 'تظاهرات', 'ناآرامی', 'اعتراض'],
        agents: ['RISK', 'SENTIMENT', 'MARKET_INTELLIGENCE']
    },
    NATURAL_DISASTERS: {
        key: 'NATURAL_DISASTERS',
        keywords: ['earthquake', 'flood', 'disaster', 'hurricane', 'زلزله', 'سیل', 'فاجعه'],
        agents: ['RISK', 'FUNDAMENTAL', 'MARKET_INTELLIGENCE']
    },
    CORPORATE_BUSINESS: {
        key: 'CORPORATE_BUSINESS',
        keywords: ['company', 'corporate', 'earnings', 'merger', 'acquisition', 'شرکت', 'درآمد'],
        agents: ['FUNDAMENTAL', 'MARKET_INTELLIGENCE', 'SENTIMENT']
    },
    TECHNOLOGY: {
        key: 'TECHNOLOGY',
        keywords: ['technology', 'tech', 'innovation', 'ai', 'software', 'فناوری', 'نرم افزار'],
        agents: ['MARKET_INTELLIGENCE', 'FUNDAMENTAL', 'TREND']
    },
    FINANCIAL_CRISIS: {
        key: 'FINANCIAL_CRISIS',
        keywords: ['crisis', 'crash', 'collapse', 'default', 'bankruptcy', 'بحران', 'سقوط', 'ورشکستگی'],
        agents: ['RISK', 'SENTIMENT', 'MARKET_INTELLIGENCE', 'FUNDAMENTAL', 'PORTFOLIO']
    },
    TRADE_COMMERCE: {
        key: 'TRADE_COMMERCE',
        keywords: ['trade', 'import', 'export', 'tariff', 'commerce', 'تجارت', 'صادرات', 'واردات'],
        agents: ['FUNDAMENTAL', 'MARKET_INTELLIGENCE', 'PRICE_PREDICTION']
    }
};

class EnhancedMessageProcessor {
    constructor() {
        this.config = {
            enabled: process.env.TELEGRAM_PROCESSOR_ENABLED !== 'false',
            batchSize: parseInt(process.env.TELEGRAM_PROCESSOR_BATCH_SIZE || '50'),
            intervalSeconds: parseInt(process.env.TELEGRAM_PROCESSOR_INTERVAL_SECONDS || '30'),
            
            // Enhanced detection
            enableAgentImpact: true,
            enableGeopoliticalDetection: true,
            enableBreakingNewsDetection: true,
            
            // Known entities
            assets: ['BTC', 'ETH', 'USDT', 'GOLD', 'DOLLAR', 'EURO', 'DIRHAM', 'BITCOIN', 'ETHEREUM', 'OIL', 'SILVER'],
            currencies: ['USD', 'IRR', 'EUR', 'AED', 'TRY', 'GBP', 'JPY', 'CNY'],
            
            // Persian mappings
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
            
            // Countries & regions
            countries: ['Iran', 'USA', 'Russia', 'China', 'Europe', 'UK', 'Germany', 'France', 'Turkey', 'UAE', 'Israel', 'Syria', 'Iraq', 'Afghanistan'],
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
                'عراق': 'Iraq',
                'افغانستان': 'Afghanistan'
            }
        };
        
        this.intervalId = null;
        this.isRunning = false;
    }

    /**
     * Detect event category from text
     */
    detectEventCategory(text) {
        const lowerText = text.toLowerCase();
        let bestMatch = null;
        let maxScore = 0;
        
        for (const [catKey, catData] of Object.entries(EVENT_CATEGORIES)) {
            let score = 0;
            for (const keyword of catData.keywords) {
                if (lowerText.includes(keyword.toLowerCase())) {
                    score++;
                }
            }
            
            if (score > maxScore) {
                maxScore = score;
                bestMatch = catData;
            }
        }
        
        return bestMatch ? bestMatch.key : 'GENERAL';
    }

    /**
     * Detect geopolitical relevance
     */
    detectGeopoliticalRelevance(text) {
        const geopoliticalKeywords = [
            'war', 'conflict', 'military', 'sanction', 'embargo', 'invasion', 'attack',
            'جنگ', 'درگیری', 'نظامی', 'تحریم', 'حمله', 'تهاجم'
        ];
        
        const lowerText = text.toLowerCase();
        return geopoliticalKeywords.some(kw => lowerText.includes(kw));
    }

    /**
     * Extract countries mentioned
     */
    extractCountries(text) {
        const countries = new Set();
        const upperText = text.toUpperCase();
        
        // Check English country names
        for (const country of this.config.countries) {
            if (upperText.includes(country.toUpperCase())) {
                countries.add(country);
            }
        }
        
        // Check Persian mappings
        for (const [persian, english] of Object.entries(this.config.countryMappings)) {
            if (text.includes(persian)) {
                countries.add(english);
            }
        }
        
        return Array.from(countries);
    }

    /**
     * Assess market impact level
     */
    assessMarketImpact(eventCategory, sentiment, assets, countries, isGeopolitical) {
        let score = 0;
        
        // High-impact categories
        const highImpactCats = ['GEOPOLITICAL', 'FINANCIAL_CRISIS', 'ECONOMIC_INDICATORS', 'SANCTIONS_EMBARGO'];
        if (highImpactCats.includes(eventCategory)) score += 3;
        
        // Geopolitical events
        if (isGeopolitical) score += 2;
        
        // Multiple assets affected
        if (assets.length > 2) score += 2;
        
        // Major countries involved
        const majorCountries = ['USA', 'China', 'Russia', 'Iran', 'Europe'];
        if (countries.some(c => majorCountries.includes(c))) score += 2;
        
        // Strong sentiment
        if (Math.abs(sentiment.score) > 0.6) score += 1;
        
        if (score >= 6) return 'severe';
        if (score >= 4) return 'high';
        if (score >= 2) return 'moderate';
        return 'low';
    }

    /**
     * Calculate agent impact for a message
     */
    calculateAgentImpact(message, processedData) {
        const impacts = [];
        
        const {
            cleaned_text,
            event_category,
            mentioned_assets,
            sentiment,
            importance_level,
            is_actionable
        } = processedData;
        
        // Get relevant agents for this event category
        const categoryData = Object.values(EVENT_CATEGORIES).find(c => c.key === event_category);
        const relevantAgentKeys = categoryData ? categoryData.agents : [];
        
        // Calculate impact for each agent
        for (const [agentKey, agentData] of Object.entries(AGENTS)) {
            let impactScore = 0;
            let relevanceReasons = [];
            let requiresAction = false;
            
            // 1. Check if event category is relevant to agent
            if (relevantAgentKeys.includes(agentKey)) {
                impactScore += 0.3;
                relevanceReasons.push(`Relevant category: ${event_category}`);
            }
            
            // 2. Check keyword matches with agent interests
            const lowerText = cleaned_text.toLowerCase();
            let keywordMatches = 0;
            for (const interest of agentData.interests) {
                if (lowerText.includes(interest.toLowerCase())) {
                    keywordMatches++;
                }
            }
            if (keywordMatches > 0) {
                impactScore += Math.min(0.4, keywordMatches * 0.1);
                relevanceReasons.push(`${keywordMatches} keyword matches`);
            }
            
            // 3. Asset mentions boost certain agents
            if (mentioned_assets.length > 0) {
                const assetAgents = ['TECHNICAL', 'PRICE_PREDICTION', 'TREND', 'ARBITRAGE', 'FUNDAMENTAL'];
                if (assetAgents.includes(agentKey)) {
                    impactScore += 0.2;
                    relevanceReasons.push(`${mentioned_assets.length} assets mentioned`);
                }
            }
            
            // 4. Sentiment relevance
            if (Math.abs(sentiment.score) > 0.5) {
                const sentimentAgents = ['SENTIMENT', 'RISK', 'MARKET_INTELLIGENCE'];
                if (sentimentAgents.includes(agentKey)) {
                    impactScore += 0.1;
                    relevanceReasons.push('Strong sentiment detected');
                }
            }
            
            // 5. Actionable messages require immediate attention
            if (is_actionable && importance_level === 'critical') {
                impactScore += 0.2;
                requiresAction = true;
                relevanceReasons.push('Critical actionable message');
            }
            
            // Only save if impact is meaningful
            if (impactScore >= 0.3) {
                impacts.push({
                    agent_key: agentData.key,
                    agent_name: agentData.name,
                    impact_score: Math.min(1.0, impactScore),
                    impact_type: impactScore >= 0.7 ? 'direct' : 'indirect',
                    confidence: 0.8,
                    relevance_reasons: relevanceReasons,
                    extracted_signals: this.extractAgentSignals(agentData.key, processedData),
                    priority_level: importance_level,
                    requires_action: requiresAction,
                    action_type: requiresAction ? 'trigger_analysis' : null
                });
            }
        }
        
        return impacts;
    }

    /**
     * Extract agent-specific signals
     */
    extractAgentSignals(agentKey, processedData) {
        const signals = {};
        
        switch (agentKey) {
            case 'TECHNICAL':
                if (processedData.extracted_prices) {
                    signals.prices = processedData.extracted_prices;
                }
                break;
            
            case 'SENTIMENT':
                signals.sentiment = processedData.sentiment;
                signals.sentiment_score = processedData.sentiment_score;
                break;
            
            case 'RISK':
                signals.market_impact_level = processedData.market_impact_level;
                signals.geopolitical = processedData.geopolitical_relevance;
                break;
            
            case 'FUNDAMENTAL':
                signals.event_category = processedData.event_category;
                signals.countries = processedData.countries || [];
                break;
            
            case 'MARKET_INTELLIGENCE':
                signals.is_breaking = processedData.is_breaking || false;
                signals.event_urgency = processedData.event_urgency || 'medium_term';
                break;
        }
        
        return signals;
    }

    /**
     * Detect breaking news
     */
    detectBreakingNews(text, eventCategory, marketImpact) {
        const breakingKeywords = ['breaking', 'urgent', 'alert', 'just in', 'فوری', 'خبر فوری'];
        const lowerText = text.toLowerCase();
        
        const hasBreakingKeyword = breakingKeywords.some(kw => lowerText.includes(kw));
        const isHighImpact = marketImpact === 'severe' || marketImpact === 'high';
        const isCriticalCategory = ['GEOPOLITICAL', 'FINANCIAL_CRISIS', 'ECONOMIC_INDICATORS'].includes(eventCategory);
        
        return hasBreakingKeyword || (isHighImpact && isCriticalCategory);
    }

    /**
     * Process a single message (enhanced version)
     */
    async processMessageEnhanced(message) {
        const startTime = Date.now();
        
        try {
            const text = message.message_text;
            
            // === PHASE 1: Basic Processing (from v1) ===
            const language = this.detectLanguage(text);
            const cleaned_text = this.cleanText(text);
            const keywords = this.extractKeywords(text);
            const hashtags = this.extractHashtags(text);
            const urls = this.extractURLs(text);
            
            // === PHASE 2: Entity Extraction ===
            const mentioned_assets = this.extractAssets(text);
            const mentioned_currencies = this.extractCurrencies(text);
            const extracted_prices = this.extractPrices(text);
            const countries = this.extractCountries(text);
            const regions = this.mapCountriesToRegions(countries);
            
            // === PHASE 3: Categorization (Enhanced) ===
            const event_category = this.detectEventCategory(text);
            const geopolitical_relevance = this.detectGeopoliticalRelevance(text);
            
            // === PHASE 4: Sentiment Analysis ===
            const sentimentResult = this.analyzeSentiment(text);
            
            // === PHASE 5: Classification ===
            const news_type = this.classifyNewsType(text, mentioned_assets);
            const news_category = this.determineCategory(text, mentioned_assets);
            
            // === PHASE 6: Impact Assessment ===
            const market_impact_level = this.assessMarketImpact(
                event_category,
                sentimentResult,
                mentioned_assets,
                countries,
                regions,
                geopolitical_relevance
            );
            
            const importance_level = this.assessImportance(
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
            const is_breaking = this.detectBreakingNews(text, event_category, market_impact_level);
            
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
            const agentImpacts = this.calculateAgentImpact(message, processedData);
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
                
                // Insert news event if geopolitically relevant or breaking
                if (geopolitical_relevance || is_breaking || market_impact_level === 'severe') {
                    await client.query(`
                        INSERT INTO telegram_news_events (
                            processed_message_id, primary_category, event_type,
                            countries, regions, affected_markets, affected_assets,
                            market_impact_level, is_breaking, is_developing,
                            event_urgency, source_reliability
                        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
                    `, [
                        processedId, event_category, news_type,
                        countries, regions, ['forex', 'crypto', 'gold'], mentioned_assets,
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
                    is_breaking: is_breaking
                };
                
            } catch (error) {
                await client.query('ROLLBACK');
                throw error;
            } finally {
                client.release();
            }
            
        } catch (error) {
            console.error(`❌ Error processing message ${message.id}:`, error.message);
            
            // Save error to database
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
                console.error('❌ Error saving failure record:', dbError.message);
            }
            
            return {
                success: false,
                error: error.message,
                duration_ms: Date.now() - startTime
            };
        }
    }

    // Copy all helper methods from v1 (detectLanguage, cleanText, extractAssets, etc.)
    // ... (include all the methods from the original processor)

    /**
     * Start the processor
     */
    async start() {
        if (!this.config.enabled) {
            console.log('⚠️ Enhanced Telegram Message Processor is disabled');
            return;
        }

        if (this.isRunning) {
            console.log('⚠️ Enhanced Telegram Message Processor is already running');
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

        console.log('✅ Enhanced Telegram Message Processor started successfully\n');
    }

    stop() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
        this.isRunning = false;
        console.log('🛑 Enhanced Telegram Message Processor stopped');
    }
}

// Export
const processor = new EnhancedMessageProcessor();
module.exports = processor;

// Auto-start if running as main module
if (require.main === module) {
    console.log('🚀 Starting Enhanced Telegram Message Processor v2.0...\n');
    processor.start().catch(err => {
        console.error('❌ Fatal error:', err);
        process.exit(1);
    });
    
    process.on('SIGINT', () => {
        console.log('\n📡 Received SIGINT, shutting down gracefully...');
        processor.stop();
        process.exit(0);
    });
    
    process.on('SIGTERM', () => {
        console.log('\n📡 Received SIGTERM, shutting down gracefully...');
        processor.stop();
        process.exit(0);
    });
}
