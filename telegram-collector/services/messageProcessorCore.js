/**
 * Message Processor Core - Helper Methods
 * Pure utility functions for message processing
 * No dependencies on enhanced features
 */

module.exports = class ProcessorCore {
    constructor(config) {
        this.config = config;
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
            .replace(/https?:\/\/[^\s]+/g, '')
            .replace(/@[^\s]+/g, '')
            .replace(/[\u{1F600}-\u{1F64F}]/gu, '')
            .replace(/[\u{1F300}-\u{1F5FF}]/gu, '')
            .replace(/[\u{1F680}-\u{1F6FF}]/gu, '')
            .replace(/[\u{2600}-\u{26FF}]/gu, '')
            .replace(/[\u{2700}-\u{27BF}]/gu, '')
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
     * Extract keywords
     */
    extractKeywords(text) {
        const cleaned = this.cleanText(text);
        const words = cleaned.split(/\s+/);
        
        const stopwords = ['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'با', 'به', 'از', 'در', 'که', 'این'];
        const keywords = words
            .filter(w => w.length > 3)
            .filter(w => !stopwords.includes(w.toLowerCase()))
            .slice(0, 10);
        
        return keywords;
    }

    /**
     * Extract mentioned assets
     */
    extractAssets(text) {
        const assets = new Set();
        const upperText = text.toUpperCase();
        
        for (const asset of this.config.assets) {
            if (upperText.includes(asset)) {
                assets.add(asset);
            }
        }
        
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
     * Extract prices
     */
    extractPrices(text) {
        const prices = [];
        
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
     * Analyze sentiment (keyword-based)
     */
    analyzeSentiment(text) {
        const lowerText = text.toLowerCase();
        
        const positiveKeywords = ['good', 'great', 'excellent', 'bullish', 'rise', 'up', 'profit', 'gain', 'خوب', 'عالی', 'صعودی', 'سود', 'افزایش'];
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
        
        if (/\d+.*(\$|usd|dollar|price|قیمت|دلار)/i.test(text)) {
            return 'price_alert';
        }
        
        if (/analy[sz]|predict|forecast|تحلیل|پیش بینی/.test(lowerText)) {
            return 'analysis';
        }
        
        if (/news|break|report|announce|خبر|گزارش|اعلام/.test(lowerText)) {
            return 'news';
        }
        
        if (assets.length > 0 || /market|trade|معامله|بازار/.test(lowerText)) {
            return 'market_update';
        }
        
        return 'general';
    }

    /**
     * Determine news category (basic)
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
    assessImportance(sentiment, prices, assets, channelPriority, marketImpact = 'low') {
        let score = 0;
        
        if (channelPriority === 'high') score += 2;
        else if (channelPriority === 'normal') score += 1;
        
        if (prices && prices.length > 0) score += 2;
        if (assets.length > 2) score += 1;
        if (Math.abs(sentiment.score) > 0.5) score += 1;
        
        if (marketImpact === 'severe') score += 2;
        else if (marketImpact === 'high') score += 1;
        
        if (score >= 5) return 'critical';
        if (score >= 3) return 'high';
        if (score >= 1) return 'medium';
        return 'low';
    }
};
