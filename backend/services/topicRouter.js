import { query } from '../database/db.js';
import { logger } from './logger.js';

/**
 * Topic Router Service (TASK-BE-013)
 * Routes data to agents based on keyword/topic matching
 */
export class TopicRouter {
    constructor() {
        this.rules = [];
        this.lastRulesLoad = null;
        this.refreshInterval = 60000; // Refresh every 60 seconds
    }

    /**
     * Loads active routing rules from database
     * Rules are cached in memory and auto-refreshed
     */
    async loadRules() {
        try {
            const result = await query(
                `SELECT id, name, keywords, agent_key, priority 
                 FROM topic_routing_rules 
                 WHERE is_active = TRUE 
                 ORDER BY priority DESC`,
                []
            );

            this.rules = result.rows;
            this.lastRulesLoad = Date.now();

            logger.info(`Loaded ${this.rules.length} active topic routing rules`);
        } catch (error) {
            logger.error(`Failed to load topic routing rules: ${error.message}`);
            // Keep existing rules if reload fails
        }
    }

    /**
     * Ensures rules are fresh (auto-refresh if needed)
     */
    async ensureRulesLoaded() {
        if (!this.lastRulesLoad || (Date.now() - this.lastRulesLoad > this.refreshInterval)) {
            await this.loadRules();
        }
    }

    /**
     * Checks if text contains any of the keywords (case-insensitive)
     */
    matchKeywords(text, keywords) {
        if (!text || !keywords || keywords.length === 0) {
            return [];
        }

        const lowerText = text.toLowerCase();
        const matched = [];

        for (const keyword of keywords) {
            const lowerKeyword = keyword.toLowerCase();
            if (lowerText.includes(lowerKeyword)) {
                matched.push(keyword);
            }
        }

        return matched;
    }

    /**
     * Extracts text content from normalized data for keyword matching
     */
    extractTextContent(normalizedData) {
        const parts = [];

        if (normalizedData.title) parts.push(normalizedData.title);
        if (normalizedData.content) parts.push(normalizedData.content);
        if (normalizedData.description) parts.push(normalizedData.description);
        if (normalizedData.summary) parts.push(normalizedData.summary);

        // If data is an object with nested text, try to extract it
        if (typeof normalizedData === 'object') {
            const jsonStr = JSON.stringify(normalizedData);
            parts.push(jsonStr);
        }

        return parts.join(' ');
    }

    /**
     * Routes data based on topic/keyword matching
     * @param {Object} normalizedData - Normalized data object
     * @param {string} dataId - Collected data ID (for logging)
     * @returns {Promise<Array>} - Array of agent keys to route to
     */
    async route(normalizedData, dataId) {
        try {
            await this.ensureRulesLoaded();

            if (this.rules.length === 0) {
                return [];
            }

            const textContent = this.extractTextContent(normalizedData);
            const routedAgents = new Set();
            const routingDecisions = [];

            // Check each rule in priority order
            for (const rule of this.rules) {
                const matchedKeywords = this.matchKeywords(textContent, rule.keywords);

                if (matchedKeywords.length > 0) {
                    routedAgents.add(rule.agent_key);

                    // Log this routing decision
                    routingDecisions.push({
                        ruleId: rule.id,
                        ruleName: rule.name,
                        matchedKeywords,
                        agentKey: rule.agent_key
                    });
                }
            }

            // Log all routing decisions
            for (const decision of routingDecisions) {
                await this.logRouting(
                    dataId,
                    decision.ruleId,
                    decision.matchedKeywords,
                    decision.agentKey
                );

                logger.info(
                    `Topic routing: [${decision.ruleName}] matched keywords ${decision.matchedKeywords.join(', ')} → ${decision.agentKey}`
                );
            }

            return Array.from(routedAgents);

        } catch (error) {
            logger.error(`Topic routing failed: ${error.message}`);
            return [];
        }
    }

    /**
     * Logs a routing decision to the database
     */
    async logRouting(dataId, ruleId, matchedKeywords, agentKey) {
        try {
            await query(
                `INSERT INTO topic_routing_logs (data_id, rule_id, matched_keywords, agent_key) 
                 VALUES ($1, $2, $3, $4)`,
                [dataId, ruleId, matchedKeywords, agentKey]
            );
        } catch (error) {
            logger.error(`Failed to log topic routing: ${error.message}`);
            // Don't throw - logging failure shouldn't break routing
        }
    }

    /**
     * Manually refresh rules cache (useful for testing or after rule changes)
     */
    async refreshRules() {
        await this.loadRules();
    }
}

export const topicRouter = new TopicRouter();
