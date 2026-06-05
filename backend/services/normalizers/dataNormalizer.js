import { logger } from '../logger.js';
import {
    buildNormalizedV1,
    normalizeSourceType,
    toIsoTimestamp,
    truncateText,
} from './normalizedDataContract.js';

/**
 * Normalizes raw data from various sources into canonical datahub.normalized.v1.
 */
export class DataNormalizer {
    /**
     * @param {Object} rawData
     * @param {string} sourceType - rss, api, telegram, webhook, crawler
     * @param {Object} [context] - sourceId, sourceName, category, ingestionMode, collectedAt
     */
    normalize(rawData, sourceType, context = {}) {
        try {
            const type = normalizeSourceType(sourceType);
            switch (type) {
                case 'rss':
                    return this.normalizeRss(rawData, context);
                case 'api':
                    return this.normalizeApi(rawData, context);
                case 'telegram':
                    return this.normalizeTelegram(rawData, context);
                case 'webhook':
                    return this.normalizeWebhook(rawData, context);
                case 'crawler':
                    return this.normalizeCrawler(rawData, context);
                default:
                    logger.warn(`Unknown source type for normalization: ${sourceType}`);
                    return this.normalizeUnknown(rawData, type, context);
            }
        } catch (error) {
            logger.error(`Normalization failed for ${sourceType}: ${error.message}`);
            throw error;
        }
    }

    normalizeRss(data, context = {}) {
        const pub = toIsoTimestamp(data.pubDate, null);
        const collected = toIsoTimestamp(context.collectedAt, new Date().toISOString());
        const timestamp = pub || collected;
        const title = data.title || 'Untitled RSS item';
        const content = data.description || data.content || '';

        return buildNormalizedV1(
            {
                title,
                content,
                summary: truncateText(content, 280) || null,
                sourceType: 'rss',
                sourceId: context.sourceId,
                sourceName: context.sourceName,
                category: context.category || 'uncategorized',
                timestamp,
                publishedAt: pub,
                ingestionMode: context.ingestionMode || 'fetch',
                tags: ['rss'],
                url: data.link || data.url || null,
                metadataExtra: {
                    guid: data.guid ?? null,
                    author: data.author ?? null,
                },
                entities: {
                    rss: { guid: data.guid, link: data.link || data.url },
                },
            },
            { link: data.link },
        );
    }

    normalizeApi(data, context = {}) {
        const timestamp =
            toIsoTimestamp(data.published_at, null) ||
            toIsoTimestamp(data.created_at, null) ||
            toIsoTimestamp(context.collectedAt, new Date().toISOString());
        const title = data.title || data.name || data.subject || context.sourceName || 'API payload';
        const content =
            data.body ||
            data.content ||
            data.description ||
            (typeof data === 'object' ? JSON.stringify(data) : String(data));

        return buildNormalizedV1({
            title,
            content,
            summary: truncateText(content, 280) || null,
            sourceType: 'api',
            sourceId: context.sourceId,
            sourceName: context.sourceName,
            category: context.category || 'uncategorized',
            timestamp,
            publishedAt: timestamp,
            ingestionMode: context.ingestionMode || 'fetch',
            tags: ['api'],
            url: data.url || data.link || null,
            metadataExtra: {
                ...(data.metadata && typeof data.metadata === 'object' ? data.metadata : {}),
            },
            entities: { api: { keys: Object.keys(data || {}).slice(0, 20) } },
        });
    }

    /**
     * Telegram — raw collector or transfer envelope in raw_data.
     */
    normalizeTelegram(data, context = {}) {
        const messageText = data.message_text || data.text || data.content || '';
        const messageId = data.telegram_message_id ?? data.message_id;
        const channelId = data.telegram_channel_id ?? data.channel_id;
        const channelUsername = data.channel_username || data.from?.username;
        const channelTitle = data.channel_title;
        const senderId = data.sender_id ?? data.from?.id;
        const senderUsername = data.sender_username ?? data.from?.username;
        const telegramCreatedAt =
            toIsoTimestamp(data.telegram_created_at, null) ||
            (data.date ? toIsoTimestamp(data.date * 1000, null) : null) ||
            toIsoTimestamp(context.collectedAt, new Date().toISOString());

        let title = messageText.split('\n')[0].trim();
        title = truncateText(title, 200);
        if (!title) {
            title = `Telegram Message ${messageId ?? 'Unknown'}`;
        }

        const hashtagRegex = /#(\w+)/g;
        const hashtags = [...messageText.matchAll(hashtagRegex)].map((m) => m[1].toLowerCase());
        const urlRegex = /https?:\/\/[^\s]+/g;
        const urls = messageText.match(urlRegex) || [];
        const mentionRegex = /@(\w+)/g;
        const mentions = [...messageText.matchAll(mentionRegex)].map((m) => m[1]);

        const language = this.detectLanguage(messageText);
        const channel = channelUsername || channelTitle || channelId || 'unknown';
        let url = null;
        if (channelUsername) {
            url = `https://t.me/${String(channelUsername).replace(/^@/, '')}`;
        } else if (messageId && channelId) {
            url = `tg://msg?id=${messageId}`;
        }

        const sentiment =
            data.sentiment_score !== undefined && data.sentiment_score !== null
                ? parseFloat(data.sentiment_score)
                : null;

        return buildNormalizedV1(
            {
                title,
                content: messageText,
                summary: truncateText(messageText, 280) || null,
                sourceType: 'telegram',
                sourceId: context.sourceId,
                sourceName: context.sourceName,
                category: context.category || data.channel_category || 'uncategorized',
                language,
                timestamp: telegramCreatedAt,
                publishedAt: telegramCreatedAt,
                ingestionMode: context.ingestionMode || 'collector',
                telegramMessageId: messageId != null ? String(messageId) : null,
                telegramChannelId: channelId != null ? String(channelId) : null,
                telegramChannelUsername: channelUsername ?? null,
                tags: ['telegram', data.channel_category || 'signals', ...hashtags.slice(0, 5)],
                url,
                sentiment,
                channel,
                metadataExtra: {
                    has_media: data.has_media || false,
                    media_url: data.media_url || null,
                    message_type: data.message_type || 'text',
                    has_url: urls.length > 0,
                    has_hashtag: hashtags.length > 0,
                    extracted_signals: data.extracted_signals ?? null,
                },
                entities: {
                    telegram: {
                        message_id: messageId,
                        channel_id: channelId,
                        sender_id: senderId,
                        sender_username: senderUsername,
                    },
                    hashtags,
                    mentions,
                    urls,
                },
                signals: data.extracted_signals != null ? [data.extracted_signals] : [],
            },
            { channel },
        );
    }

    detectLanguage(text) {
        if (!text || text.length < 10) return null;
        const persianRegex = /[\u0600-\u06FF]/;
        if (persianRegex.test(text)) return 'fa';
        const englishRegex = /^[a-zA-Z0-9\s.,!?;:'"()-]+$/;
        if (englishRegex.test(text.substring(0, 100))) return 'en';
        return null;
    }

    normalizeWebhook(data, context = {}) {
        const payload = data.payload || data;
        const timestamp =
            toIsoTimestamp(data.receivedAt, null) ||
            toIsoTimestamp(context.collectedAt, new Date().toISOString());
        const title = payload.title || 'Webhook Event';
        const content =
            payload.content || payload.message || JSON.stringify(payload);

        return buildNormalizedV1({
            title,
            content,
            sourceType: 'webhook',
            sourceId: context.sourceId,
            sourceName: context.sourceName,
            category: context.category || 'uncategorized',
            timestamp,
            publishedAt: timestamp,
            ingestionMode: context.ingestionMode || 'fetch',
            tags: ['webhook'],
            url: payload.url || null,
            metadataExtra:
                payload.metadata && typeof payload.metadata === 'object'
                    ? payload.metadata
                    : {},
            entities: { webhook: { event: payload.event ?? null } },
        });
    }

    normalizeCrawler(data, context = {}) {
        const text = data.content || data.text || data.description || '';
        const title = data.title || truncateText(text, 120) || 'Crawler document';
        const timestamp =
            toIsoTimestamp(data.published_at, null) ||
            toIsoTimestamp(data.fetched_at, null) ||
            toIsoTimestamp(context.collectedAt, new Date().toISOString());

        return buildNormalizedV1({
            title,
            content: text || JSON.stringify(data),
            sourceType: 'crawler',
            sourceId: context.sourceId,
            sourceName: context.sourceName,
            category: context.category || 'uncategorized',
            timestamp,
            publishedAt: timestamp,
            ingestionMode: context.ingestionMode || 'fetch',
            tags: ['crawler'],
            url: data.url || null,
            metadataExtra: {
                crawler_ingest: data.crawler_ingest ?? true,
                ...(data.metadata && typeof data.metadata === 'object' ? data.metadata : {}),
            },
        });
    }

    normalizeUnknown(data, sourceType, context = {}) {
        const content = typeof data === 'string' ? data : JSON.stringify(data);
        return buildNormalizedV1({
            title: context.sourceName || 'Unknown source item',
            content,
            sourceType: sourceType || 'unknown',
            sourceId: context.sourceId,
            sourceName: context.sourceName,
            category: context.category || 'uncategorized',
            timestamp: toIsoTimestamp(context.collectedAt, new Date().toISOString()),
            ingestionMode: context.ingestionMode || 'unknown',
            tags: ['unknown'],
        });
    }
}

export const dataNormalizer = new DataNormalizer();
