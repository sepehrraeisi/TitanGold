import { logger } from '../logger.js';

/**
 * Routes normalized data to appropriate AI agents
 */
export class DataRouter {
    /**
     * Identifies interested agents for a piece of data
     * @param {Object} data - Standardized data object
     * @param {string} category - Source category (optional)
     * @returns {Array} - List of agent keys
     */
    route(data, category) {
        const agents = new Set();

        // 1. Route based on content keywords
        const content = (data.title + ' ' + data.content).toLowerCase();

        // Market analysis agents
        if (this.containsKeywords(content, ['price', 'market', 'bull', 'bear', 'btc', 'eth', 'crypto'])) {
            agents.add('market_intelligence');
            agents.add('sentiment');
        }

        // Sentiment specific
        if (this.containsKeywords(content, ['feel', 'think', 'believe', 'vibe', 'mood', 'panic', 'fud', 'fomo'])) {
            agents.add('sentiment');
        }

        // Default routing based on source type
        const sourceType = data.sourceType || data.source_type;
        if (sourceType === 'rss' || sourceType === 'telegram') {
            agents.add('market_intelligence');
        }

        logger.info(`Routed data [${data.title.substring(0, 30)}...] to agents: ${Array.from(agents).join(', ')}`);
        return Array.from(agents);
    }

    containsKeywords(text, keywords) {
        return keywords.some(keyword => text.includes(keyword));
    }
}

export const dataRouter = new DataRouter();
