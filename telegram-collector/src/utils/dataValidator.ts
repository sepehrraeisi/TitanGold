/**
 * Data Validation and Normalization Service
 * Validates, normalizes, and enriches collected Telegram data
 */

import crypto from 'crypto';

export interface TelegramMessage {
    id: number;
    date: number;
    text?: string;
    views?: number;
    forwards?: number;
    media?: any;
    replyTo?: number;
    edited?: number;
}

export interface NormalizedMessage {
    message_id: number;
    content: string;
    timestamp: string;
    metadata: {
        views: number;
        forwards: number;
        has_media: boolean;
        media_type?: string;
        is_reply: boolean;
        is_edited: boolean;
        char_count: number;
        word_count: number;
        has_url: boolean;
        has_hashtag: boolean;
        has_mention: boolean;
        language?: string;
        sentiment?: 'positive' | 'negative' | 'neutral';
    };
    extracted: {
        urls: string[];
        hashtags: string[];
        mentions: string[];
        prices?: Array<{ value: number; currency: string }>;
        dates?: string[];
    };
}

export interface ValidationResult {
    valid: boolean;
    errors: string[];
    warnings: string[];
}

/**
 * Validate raw Telegram message data
 */
export function validateTelegramMessage(rawData: any): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Required fields
    if (typeof rawData.id !== 'number') {
        errors.push('Message ID must be a number');
    }

    if (typeof rawData.date !== 'number') {
        errors.push('Message date must be a Unix timestamp (number)');
    } else if (rawData.date < 0 || rawData.date > Date.now() / 1000 + 86400) {
        warnings.push('Message date is in the future or suspiciously old');
    }

    // Optional but validated fields
    if (rawData.text !== undefined && typeof rawData.text !== 'string') {
        errors.push('Message text must be a string');
    }

    if (rawData.views !== undefined && typeof rawData.views !== 'number') {
        warnings.push('Views count should be a number');
    }

    if (rawData.forwards !== undefined && typeof rawData.forwards !== 'number') {
        warnings.push('Forwards count should be a number');
    }

    // Check for empty message
    if (!rawData.text && !rawData.media) {
        warnings.push('Message has no text or media content');
    }

    return {
        valid: errors.length === 0,
        errors,
        warnings
    };
}

/**
 * Normalize Telegram message to standard format
 */
export function normalizeTelegramMessage(rawData: TelegramMessage): NormalizedMessage {
    const text = rawData.text || '';
    const words = text.trim().split(/\s+/).filter(w => w.length > 0);

    // Extract URLs
    const urlRegex = /(https?:\/\/[^\s]+)/gi;
    const urls = text.match(urlRegex) || [];

    // Extract hashtags
    const hashtagRegex = /#(\w+)/gi;
    const hashtags = text.match(hashtagRegex) || [];

    // Extract mentions
    const mentionRegex = /@(\w+)/gi;
    const mentions = text.match(mentionRegex) || [];

    // Extract prices (simple pattern for USD, EUR, etc.)
    const priceRegex = /(\$|€|£|¥)?\s*(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)\s*(USD|EUR|GBP|JPY|BTC|ETH)?/gi;
    const priceMatches = [...text.matchAll(priceRegex)];
    const prices = priceMatches.map(match => ({
        value: parseFloat(match[2].replace(/,/g, '')),
        currency: match[1] || match[3] || 'unknown'
    }));

    // Detect language (simple heuristic)
    const persianChars = text.match(/[\u0600-\u06FF]/g);
    const language = persianChars && persianChars.length > text.length * 0.3 ? 'fa' : 'en';

    return {
        message_id: rawData.id,
        content: text,
        timestamp: new Date(rawData.date * 1000).toISOString(),
        metadata: {
            views: rawData.views || 0,
            forwards: rawData.forwards || 0,
            has_media: !!rawData.media,
            media_type: rawData.media?.type || undefined,
            is_reply: !!rawData.replyTo,
            is_edited: !!rawData.edited,
            char_count: text.length,
            word_count: words.length,
            has_url: urls.length > 0,
            has_hashtag: hashtags.length > 0,
            has_mention: mentions.length > 0,
            language
        },
        extracted: {
            urls,
            hashtags,
            mentions,
            prices: prices.length > 0 ? prices : undefined,
            dates: undefined // TODO: Extract dates from text
        }
    };
}

/**
 * Generate content hash for deduplication
 */
export function generateContentHash(rawData: TelegramMessage): string {
    // Use message ID + date + text for hash
    const content = `${rawData.id}:${rawData.date}:${rawData.text || ''}`;
    return crypto.createHash('sha256').update(content).digest('hex');
}

/**
 * Check if message is duplicate based on content hash
 */
export async function isDuplicate(contentHash: string, pool: any): Promise<boolean> {
    const result = await pool.query(
        'SELECT COUNT(*) FROM collected_data WHERE content_hash = $1',
        [contentHash]
    );
    return parseInt(result.rows[0].count) > 0;
}

/**
 * Validate and normalize message in one step
 */
export function processMessage(rawData: any): {
    validation: ValidationResult;
    normalized: NormalizedMessage | null;
    contentHash: string;
} {
    const validation = validateTelegramMessage(rawData);
    
    if (!validation.valid) {
        return {
            validation,
            normalized: null,
            contentHash: ''
        };
    }

    const normalized = normalizeTelegramMessage(rawData);
    const contentHash = generateContentHash(rawData);

    return {
        validation,
        normalized,
        contentHash
    };
}

/**
 * Enrich normalized data with additional processing
 */
export function enrichMessage(normalized: NormalizedMessage): NormalizedMessage {
    // Simple sentiment analysis based on keywords
    const positiveWords = ['good', 'great', 'excellent', 'profit', 'gain', 'up', 'high', 'success'];
    const negativeWords = ['bad', 'loss', 'down', 'low', 'fail', 'drop', 'crash', 'risk'];
    
    const content = normalized.content.toLowerCase();
    const positiveCount = positiveWords.filter(w => content.includes(w)).length;
    const negativeCount = negativeWords.filter(w => content.includes(w)).length;

    let sentiment: 'positive' | 'negative' | 'neutral' = 'neutral';
    if (positiveCount > negativeCount + 1) {
        sentiment = 'positive';
    } else if (negativeCount > positiveCount + 1) {
        sentiment = 'negative';
    }

    return {
        ...normalized,
        metadata: {
            ...normalized.metadata,
            sentiment
        }
    };
}

/**
 * Batch process multiple messages
 */
export function batchProcessMessages(rawMessages: any[]): Array<{
    index: number;
    validation: ValidationResult;
    normalized: NormalizedMessage | null;
    contentHash: string;
}> {
    return rawMessages.map((rawData, index) => ({
        index,
        ...processMessage(rawData)
    }));
}

export default {
    validateTelegramMessage,
    normalizeTelegramMessage,
    generateContentHash,
    isDuplicate,
    processMessage,
    enrichMessage,
    batchProcessMessages
};
