import { logger } from '../logger.js';

/**
 * Normalizes raw data from various sources into a standard format
 */
export class DataNormalizer {
    /**
     * Normalizes an item based on its source type
     * @param {Object} rawData - The raw data from the fetcher
     * @param {string} sourceType - rss, api, telegram, webhook
     * @returns {Object} - Normalized data object
     */
    normalize(rawData, sourceType) {
        try {
            switch (sourceType) {
                case 'rss':
                    return this.normalizeRss(rawData);
                case 'api':
                    return this.normalizeApi(rawData);
                case 'telegram':
                    return this.normalizeTelegram(rawData);
                case 'webhook':
                    return this.normalizeWebhook(rawData);
                default:
                    logger.warn(`Unknown source type for normalization: ${sourceType}`);
                    return rawData;
            }
        } catch (error) {
            logger.error(`Normalization failed for ${sourceType}: ${error.message}`);
            throw error;
        }
    }

    normalizeRss(data) {
        return {
            title: data.title || '',
            content: data.description || '',
            url: data.link || '',
            timestamp: data.pubDate ? new Date(data.pubDate).toISOString() : new Date().toISOString(),
            source_type: 'rss',
            metadata: {
                guid: data.guid,
                author: data.author
            }
        };
    }

    normalizeApi(data) {
        // API data format varies; we try to map common fields
        return {
            title: data.title || data.name || data.subject || '',
            content: data.body || data.content || data.description || JSON.stringify(data),
            url: data.url || data.link || '',
            timestamp: data.published_at || data.created_at || new Date().toISOString(),
            source_type: 'api',
            metadata: data.metadata || {}
        };
    }

    normalizeTelegram(data) {
        return {
            title: data.text ? data.text.substring(0, 100) : 'Telegram Message',
            content: data.text || '',
            url: data.message_id ? `tg://msg?id=${data.message_id}` : '',
            timestamp: data.date ? new Date(data.date * 1000).toISOString() : new Date().toISOString(),
            source_type: 'telegram',
            metadata: {
                chat_id: data.chat?.id,
                from_id: data.from?.id
            }
        };
    }

    normalizeWebhook(data) {
        const payload = data.payload || data;
        return {
            title: payload.title || 'Webhook Event',
            content: payload.content || payload.message || JSON.stringify(payload),
            url: payload.url || '',
            timestamp: data.receivedAt || new Date().toISOString(),
            source_type: 'webhook',
            metadata: payload.metadata || {}
        };
    }
}

export const dataNormalizer = new DataNormalizer();
