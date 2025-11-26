export type TelegramMessage = {
    id: number;
    channel: string;
    text: string;
    html?: string;
    raw?: any;
    author?: string;
    publishedAt: string;
    link?: string;
    media?: {
        type: 'photo' | 'video' | 'document' | 'voice' | 'audio' | 'other';
        fileName?: string;
        mimeType?: string;
        size?: number;
    };
};

export type ChannelCacheEntry = {
    channel: string;
    fetchedAt: number;
    messages: TelegramMessage[];
};

export type CollectorHealth = {
    status: 'ok' | 'degraded' | 'error';
    uptime: number;
    channelsTracked: number;
    cacheEntries: number;
    lastFetch?: Record<string, string>;
};

