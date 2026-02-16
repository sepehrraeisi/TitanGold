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

    /**
     * Normalizes Telegram message data (TASK-DHT-031)
     * Supports both raw telegram-collector format and already-transferred format
     */
    normalizeTelegram(data) {
        // Handle different input formats
        const messageText = data.message_text || data.text || data.content || '';
        const messageId = data.telegram_message_id || data.message_id;
        const channelId = data.telegram_channel_id || data.channel_id;
        const channelUsername = data.channel_username || data.channel_username;
        const channelTitle = data.channel_title || data.channel_title;
        const senderId = data.sender_id || data.from?.id;
        const senderUsername = data.sender_username || data.from?.username;
        const telegramCreatedAt = data.telegram_created_at || 
            (data.date ? new Date(data.date * 1000).toISOString() : null) ||
            new Date().toISOString();
        
        // Extract title from message text (first line or first 200 chars)
        let title = messageText.split('\n')[0].trim();
        if (title.length > 200) {
            title = title.substring(0, 197) + '...';
        }
        if (!title) {
            title = `Telegram Message ${messageId || 'Unknown'}`;
        }

        // Extract tags from message text (hashtags)
        const hashtagRegex = /#(\w+)/g;
        const hashtags = [...messageText.matchAll(hashtagRegex)].map(m => m[1].toLowerCase());
        
        // Extract URLs
        const urlRegex = /https?:\/\/[^\s]+/g;
        const urls = messageText.match(urlRegex) || [];

        // Extract mentions
        const mentionRegex = /@(\w+)/g;
        const mentions = [...messageText.matchAll(mentionRegex)].map(m => m[1]);

        // Build normalized structure
        const normalized = {
            title,
            content: messageText,
            tags: [
                'telegram',
                data.channel_category || 'signals',
                ...hashtags.slice(0, 5), // Limit to 5 hashtags
            ],
            sentiment: data.sentiment_score !== undefined && data.sentiment_score !== null 
                ? parseFloat(data.sentiment_score) 
                : null,
            channel: channelUsername || channelTitle || channelId || 'unknown',
            publishedAt: telegramCreatedAt,
            entities: {
                telegram: {
                    message_id: messageId,
                    channel_id: channelId,
                    sender_id: senderId,
                    sender_username: senderUsername,
                },
                hashtags: hashtags,
                mentions: mentions,
                urls: urls,
            },
            metadata: {
                source_type: 'telegram',
                has_media: data.has_media || false,
                media_url: data.media_url || null,
                message_type: data.message_type || 'text',
                language: this.detectLanguage(messageText),
                has_url: urls.length > 0,
                has_hashtag: hashtags.length > 0,
                extracted_signals: data.extracted_signals || null,
            },
        };

        // Add URL if available
        if (channelUsername) {
            normalized.url = `https://t.me/${channelUsername.replace('@', '')}`;
        } else if (messageId && channelId) {
            normalized.url = `tg://msg?id=${messageId}`;
        }

        return normalized;
    }

    /**
     * Simple language detection (basic implementation)
     * Can be enhanced with a proper language detection library
     */
    detectLanguage(text) {
        if (!text || text.length < 10) return 'unknown';
        
        // Basic heuristics for Persian/Farsi
        const persianRegex = /[\u0600-\u06FF]/;
        if (persianRegex.test(text)) return 'fa';
        
        // Basic heuristics for English
        const englishRegex = /^[a-zA-Z0-9\s.,!?;:'"()-]+$/;
        if (englishRegex.test(text.substring(0, 100))) return 'en';
        
        return 'unknown';
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
