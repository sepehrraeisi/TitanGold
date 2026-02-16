/**
 * Telegram Message Processor Service
 * Processes raw Telegram messages and extracts structured data
 * 
 * Features:
 * - Entity extraction (prices, assets, dates)
 * - Sentiment analysis
 * - News categorization
 * - Signal detection
 * - Automated processing pipeline
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

class TelegramMessageProcessor {
    constructor() {
        this.config = {
            enabled: process.env.TELEGRAM_PROCESSOR_ENABLED !== 'false',
            batchSize: parseInt(process.env.TELEGRAM_PROCESSOR_BATCH_SIZE || '50'),
            intervalSeconds: parseInt(process.env.TELEGRAM_PROCESSOR_INTERVAL_SECONDS || '30'),
            
            // Known assets to detect
            assets: ['BTC', 'ETH', 'USDT', 'GOLD', 'DOLLAR', 'EURO', 'DIRHAM', 'BITCOIN', 'ETHEREUM'],
            currencies: ['USD', 'IRR', 'EUR', 'AED', 'TRY'],
            
            // Persian/English asset mappings
            assetMappings: {
                'دلار': 'DOLLAR',
                'یورو': 'EURO',
                'طلا': 'GOLD',
                'سکه': 'GOLD_COIN',
                'بیت کوین': 'BTC',
                'اتریوم': 'ETH',
                'درهم': 'DIRHAM'
            }
        };
        
        this.intervalId = null;
        this.isRunning = false;
    }

    /**
     * Start the automated processor
     */
    async start() {
        if (!this.config.enabled) {
            console.log('⚠️ Telegram Message Processor is disabled');
            return;
        }

        if (this.isRunning) {
            console.log('⚠️ Telegram Message Processor is already running');
            return;
        }

        this.isRunning = true;
        console.log(`🚀 Starting Telegram Message Processor`);
        console.log(`   📊 Batch size: ${this.config.batchSize}`);
        console.log(`   ⏱️  Interval: ${this.config.intervalSeconds}s`);

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

        console.log('✅ Telegram Message Processor started successfully');
    }

    /**
     * Stop the processor
     */
    stop() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
        this.isRunning = false;
        console.log('🛑 Telegram Message Processor stopped');
    }

    /**
     * Get unprocessed messages from database
     */
    async getUnprocessedMessages() {
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
            WHERE m.id NOT IN (
                SELECT raw_message_id FROM processed_telegram_messages
            )
            AND m.message_text IS NOT NULL
            AND LENGTH(m.message_text) > 10
            ORDER BY m.created_at DESC
            LIMIT $1
        `;
        
        const result = await pool.query(query, [this.config.batchSize]);
        return result.rows;
    }

    /**
     * Detect language (simple heuristic)
     */
    detectLanguage(text) {
        const persianChars = text.match(/[\u0600-\u06FF]/g);
        const englishChars = text.match(/[a-zA-Z]/g);
        
        if (persianChars && persianChars.length > (englishChars?.length || 0)) {
            return 'fa';
        }
        return 'en';
    }

    /**
     * Clean text - remove emojis, extra spaces, URLs
     */
    cleanText(text) {
        if (!text) return '';
        
        let cleaned = text
            // Remove URLs
            .replace(/https?:\/\/[^\s]+/g, '')
            // Remove mentions
            .replace(/@[^\s]+/g, '')
            // Remove emojis (simplified)
            .replace(/[\u{1F600}-\u{1F64F}]/gu, '')
            .replace(/[\u{1F300}-\u{1F5FF}]/gu, '')
            .replace(/[\u{1F680}-\u{1F6FF}]/gu, '')
            .replace(/[\u{2600}-\u{26FF}]/gu, '')
            .replace(/[\u{2700}-\u{27BF}]/gu, '')
            // Normalize whitespace
            .replace(/\s+/g, ' ')
            .trim();
        
        return cleaned;
    }

    /**
     * Extract hashtags
     */
    extractHashtags(text) {
        const matches = text.match(/#[^\s#]+/g);
        return matches || [];
    }

    /**
     * Extract URLs
     */
    extractURLs(text) {
        const matches = text.match(/https?:\/\/[^\s]+/g);
        return matches || [];
    }

    /**
     * Extract keywords (simplified - just important words)
     */
    extractKeywords(text) {
        const cleaned = this.cleanText(text);
        const words = cleaned.split(/\s+/);
        
        // Filter out short words and common stopwords
        const stopwords = ['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'با', 'به', 'از', 'در', 'که', 'این'];
        const keywords = words
            .filter(w => w.length > 3)
            .filter(w => !stopwords.includes(w.toLowerCase()))
            .slice(0, 10);  // Max 10 keywords
        
        return keywords;
    }

    /**
     * Extract mentioned assets
     */
    extractAssets(text) {
        const assets = new Set();
        const upperText = text.toUpperCase();
        
        // Check English asset names
        for (const asset of this.config.assets) {
            if (upperText.includes(asset)) {
                assets.add(asset);
            }
        }
        
        // Check Persian mappings
        for (const [persian, english] of Object.entries(this.config.assetMappings)) {
            if (text.includes(persian)) {
                assets.add(english);
            }
        }
        
        return Array.from(assets);
    }

    /**
     * Extract mentioned currencies
     */
    extractCurrencies(text) {
        const currencies = new Set();
        const upperText = text.toUpperCase();
        
        for (const currency of this.config.currencies) {
            if (upperText.includes(currency)) {
                currencies.add(currency);
            }
        }
        
        return Array.from(currencies);
    }

    /**
     * Extract prices (simplified pattern matching)
     */
    extractPrices(text) {
        const prices = [];
        
        // Pattern: number followed by currency
        // Examples: "50,000 USD", "۱۲۳۴۵۶ تومان", "$1,234.56"
        const patterns = [
            /(\d[\d,\.]*)\s*(USD|USDT|IRR|EUR|AED|دلار|تومان)/gi,
            /\$\s*(\d[\d,\.]*)/gi,
            /€\s*(\d[\d,\.]*)/gi
        ];
        
        for (const pattern of patterns) {
            const matches = [...text.matchAll(pattern)];
            for (const match of matches) {
                const priceStr = match[1]?.replace(/,/g, '');
                const currency = match[2] || 'USD';
                
                if (priceStr) {
                    const price = parseFloat(priceStr);
                    if (!isNaN(price) && price > 0) {
                        prices.push({ price, currency });
                    }
                }
            }
        }
        
        return prices.length > 0 ? prices : null;
    }

    /**
     * Analyze sentiment (simple keyword-based)
     */
    analyzeSentiment(text) {
        const lowerText = text.toLowerCase();
        
        // Positive keywords
        const positiveKeywords = ['good', 'great', 'excellent', 'bullish', 'rise', 'up', 'profit', 'gain', 'خوب', 'عالی', 'صعودی', 'سود', 'افزایش'];
        // Negative keywords
        const negativeKeywords = ['bad', 'poor', 'bearish', 'fall', 'down', 'loss', 'drop', 'بد', 'ضعیف', 'نزولی', 'ضرر', 'کاهش'];
        
        let positiveCount = 0;
        let negativeCount = 0;
        
        for (const keyword of positiveKeywords) {
            if (lowerText.includes(keyword)) positiveCount++;
        }
        for (const keyword of negativeKeywords) {
            if (lowerText.includes(keyword)) negativeCount++;
        }
        
        let sentiment = 'neutral';
        let score = 0;
        let confidence = 0.5;
        
        if (positiveCount > negativeCount) {
            sentiment = 'positive';
            score = Math.min(0.8, 0.3 + (positiveCount * 0.1));
            confidence = Math.min(0.9, 0.5 + (positiveCount * 0.1));
        } else if (negativeCount > positiveCount) {
            sentiment = 'negative';
            score = Math.max(-0.8, -0.3 - (negativeCount * 0.1));
            confidence = Math.min(0.9, 0.5 + (negativeCount * 0.1));
        }
        
        return { sentiment, score, confidence };
    }

    /**
     * Classify news type
     */
    classifyNewsType(text, assets) {
        const lowerText = text.toLowerCase();
        
        // Check for price patterns
        if (/\d+.*(\$|usd|dollar|price|قیمت|دلار)/i.test(text)) {
            return 'price_alert';
        }
        
        // Check for analysis keywords
        if (/analy[sz]|predict|forecast|تحلیل|پیش بینی/.test(lowerText)) {
            return 'analysis';
        }
        
        // Check for news keywords
        if (/news|break|report|announce|خبر|گزارش|اعلام/.test(lowerText)) {
            return 'news';
        }
        
        // Check for market update
        if (assets.length > 0 || /market|trade|معامله|بازار/.test(lowerText)) {
            return 'market_update';
        }
        
        return 'general';
    }

    /**
     * Determine news category
     */
    determineCategory(text, assets) {
        if (assets.includes('BTC') || assets.includes('ETH') || assets.includes('USDT')) {
            return 'crypto';
        }
        if (assets.includes('GOLD') || assets.includes('GOLD_COIN')) {
            return 'gold';
        }
        if (assets.includes('DOLLAR') || assets.includes('EURO')) {
            return 'forex';
        }
        
        const lowerText = text.toLowerCase();
        if (/econom|gdp|inflation|اقتصاد|تورم/.test(lowerText)) {
            return 'economic';
        }
        if (/politic|government|سیاسی|دولت/.test(lowerText)) {
            return 'political';
        }
        
        return 'general';
    }

    /**
     * Assess importance level
     */
    assessImportance(sentiment, prices, assets, channelPriority) {
        let score = 0;
        
        // Channel priority boost
        if (channelPriority === 'high') score += 2;
        else if (channelPriority === 'normal') score += 1;
        
        // Price mentions
        if (prices && prices.length > 0) score += 2;
        
        // Multiple assets
        if (assets.length > 2) score += 1;
        
        // Strong sentiment
        if (Math.abs(sentiment.score) > 0.5) score += 1;
        
        if (score >= 4) return 'critical';
        if (score >= 2) return 'high';
        if (score >= 1) return 'medium';
        return 'low';
    }

    /**
     * Process a single message
     */
    async processMessage(message) {
        const startTime = Date.now();
        
        try {
            const text = message.message_text;
            
            // 1. Language detection
            const language = this.detectLanguage(text);
            
            // 2. Text cleaning and extraction
            const cleaned_text = this.cleanText(text);
            const keywords = this.extractKeywords(text);
            const hashtags = this.extractHashtags(text);
            const urls = this.extractURLs(text);
            
            // 3. Entity extraction
            const mentioned_assets = this.extractAssets(text);
            const mentioned_currencies = this.extractCurrencies(text);
            const extracted_prices = this.extractPrices(text);
            
            // 4. Sentiment analysis
            const sentimentResult = this.analyzeSentiment(text);
            
            // 5. Classification
            const news_type = this.classifyNewsType(text, mentioned_assets);
            const news_category = this.determineCategory(text, mentioned_assets);
            const importance_level = this.assessImportance(
                sentimentResult, 
                extracted_prices, 
                mentioned_assets, 
                message.priority
            );
            
            // 6. Determine if actionable
            const is_actionable = (
                importance_level === 'critical' || 
                importance_level === 'high'
            ) && mentioned_assets.length > 0;
            
            // 7. Simple spam detection
            const spam_probability = (text.length < 20 || hashtags.length > 5) ? 0.7 : 0.1;
            
            // 8. Save to database
            const query = `
                INSERT INTO processed_telegram_messages (
                    raw_message_id, channel_id, language, cleaned_text, 
                    keywords, hashtags, urls,
                    mentioned_assets, mentioned_currencies, extracted_prices,
                    sentiment, sentiment_score, confidence_score,
                    news_type, news_category, importance_level, is_actionable,
                    spam_probability, processing_status, 
                    processing_started_at, processing_completed_at, processing_duration_ms
                ) VALUES (
                    $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22
                ) RETURNING id
            `;
            
            const values = [
                message.id, // raw_message_id
                message.channel_id,
                language,
                cleaned_text,
                keywords,
                hashtags,
                urls,
                mentioned_assets,
                mentioned_currencies,
                extracted_prices ? JSON.stringify(extracted_prices) : null,
                sentimentResult.sentiment,
                sentimentResult.score,
                sentimentResult.confidence,
                news_type,
                news_category,
                importance_level,
                is_actionable,
                spam_probability,
                'completed',
                new Date(startTime),
                new Date(),
                Date.now() - startTime
            ];
            
            const result = await pool.query(query, values);
            
            return {
                success: true,
                processed_id: result.rows[0].id,
                duration_ms: Date.now() - startTime
            };
            
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
                    message.id,
                    message.channel_id,
                    error.message,
                    new Date(startTime),
                    new Date(),
                    Date.now() - startTime
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

    /**
     * Process batch of messages
     */
    async processMessages() {
        try {
            console.log('\n🔄 Starting message processing cycle...');
            
            // Get unprocessed messages
            const messages = await this.getUnprocessedMessages();
            
            if (messages.length === 0) {
                console.log('   ✅ No new messages to process');
                return;
            }
            
            console.log(`   📋 Found ${messages.length} message(s) to process`);
            
            // Process messages in parallel (with concurrency limit)
            const results = await Promise.allSettled(
                messages.map(msg => this.processMessage(msg))
            );
            
            // Count results
            const successful = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
            const failed = results.filter(r => r.status === 'rejected' || (r.status === 'fulfilled' && !r.value.success)).length;
            
            const avgDuration = results
                .filter(r => r.status === 'fulfilled')
                .map(r => r.value.duration_ms)
                .reduce((a, b) => a + b, 0) / results.length;
            
            console.log(`\n✅ Processing cycle completed`);
            console.log(`   📊 Successful: ${successful}`);
            console.log(`   ❌ Failed: ${failed}`);
            console.log(`   ⏱️  Avg duration: ${avgDuration.toFixed(0)}ms`);
            
        } catch (error) {
            console.error('❌ Error in processMessages:', error);
        }
    }

    /**
     * Get processing stats
     */
    async getStats() {
        const result = await pool.query('SELECT * FROM telegram_pipeline_stats');
        return result.rows[0];
    }
}

// Create singleton instance
const processor = new TelegramMessageProcessor();

// Export
module.exports = processor;

// Auto-start if running as main module
if (require.main === module) {
    console.log('🚀 Starting Telegram Message Processor as standalone service...\n');
    processor.start().catch(err => {
        console.error('❌ Fatal error:', err);
        process.exit(1);
    });
    
    // Graceful shutdown
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
