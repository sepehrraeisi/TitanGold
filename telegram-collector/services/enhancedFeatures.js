/**
 * Enhanced Features Module
 * Advanced processing for 15 AI agents + 15 news categories
 * Agent impact calculation, geopolitical detection, breaking news
 */

// ==========================================
// 15 SPECIALIZED AI AGENTS
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
        interests: ['risk', 'volatility', 'loss', 'hedge', 'protection', 'ریسک', 'ضرر', 'محافظت']
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
// 15 NEWS EVENT CATEGORIES
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

module.exports = class EnhancedFeatures {
    constructor(config) {
        this.config = config;
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
        
        for (const country of this.config.countries) {
            if (upperText.includes(country.toUpperCase())) {
                countries.add(country);
            }
        }
        
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
        
        const highImpactCats = ['GEOPOLITICAL', 'FINANCIAL_CRISIS', 'ECONOMIC_INDICATORS', 'SANCTIONS_EMBARGO'];
        if (highImpactCats.includes(eventCategory)) score += 3;
        
        if (isGeopolitical) score += 2;
        if (assets.length > 2) score += 2;
        
        const majorCountries = ['USA', 'China', 'Russia', 'Iran', 'Europe'];
        if (countries.some(c => majorCountries.includes(c))) score += 2;
        
        if (Math.abs(sentiment.score) > 0.6) score += 1;
        
        if (score >= 6) return 'severe';
        if (score >= 4) return 'high';
        if (score >= 2) return 'moderate';
        return 'low';
    }

    /**
     * Calculate agent impact for a message
     */
    calculateAgentImpact(processedData) {
        const impacts = [];
        
        const {
            cleaned_text,
            event_category,
            mentioned_assets,
            sentiment,
            importance_level,
            is_actionable
        } = processedData;
        
        const categoryData = Object.values(EVENT_CATEGORIES).find(c => c.key === event_category);
        const relevantAgentKeys = categoryData ? categoryData.agents : [];
        
        for (const [agentKey, agentData] of Object.entries(AGENTS)) {
            let impactScore = 0;
            let relevanceReasons = [];
            let requiresAction = false;
            
            // 1. Category relevance
            if (relevantAgentKeys.includes(agentKey)) {
                impactScore += 0.3;
                relevanceReasons.push(`Relevant category: ${event_category}`);
            }
            
            // 2. Keyword matches
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
            
            // 3. Asset mentions
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
            
            // 5. Actionable boost
            if (is_actionable && importance_level === 'critical') {
                impactScore += 0.2;
                requiresAction = true;
                relevanceReasons.push('Critical actionable message');
            }
            
            // Only save if meaningful impact
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
            case 'technical':
                if (processedData.extracted_prices) {
                    signals.prices = processedData.extracted_prices;
                }
                break;
            
            case 'sentiment':
                signals.sentiment = processedData.sentiment;
                signals.sentiment_score = processedData.sentiment_score;
                break;
            
            case 'risk':
                signals.market_impact_level = processedData.market_impact_level;
                signals.geopolitical = processedData.geopolitical_relevance;
                break;
            
            case 'fundamental':
                signals.event_category = processedData.event_category;
                signals.countries = processedData.countries || [];
                break;
            
            case 'market_intelligence':
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

    // Expose constants
    static get AGENTS() { return AGENTS; }
    static get EVENT_CATEGORIES() { return EVENT_CATEGORIES; }
};
