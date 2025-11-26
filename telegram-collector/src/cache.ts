import { config } from './config.ts';
import { ChannelCacheEntry, TelegramMessage } from './types.ts';

class ChannelCache {
    private store = new Map<string, ChannelCacheEntry>();

    get(channel: string): ChannelCacheEntry | undefined {
        const entry = this.store.get(channel.toLowerCase());
        if (!entry) return undefined;
        const isExpired = Date.now() - entry.fetchedAt > config.cacheTtlMs;
        if (isExpired) {
            this.store.delete(channel.toLowerCase());
            return undefined;
        }
        return entry;
    }

    set(channel: string, messages: TelegramMessage[]) {
        const trimmed = messages.slice(0, config.maxMessagesPerChannel);
        this.store.set(channel.toLowerCase(), {
            channel,
            fetchedAt: Date.now(),
            messages: trimmed,
        });
    }

    stats() {
        const summary: Record<string, string> = {};
        this.store.forEach((entry, key) => {
            summary[key] = new Date(entry.fetchedAt).toISOString();
        });
        return {
            entries: this.store.size,
            lastFetch: summary,
        };
    }
}

export const channelCache = new ChannelCache();

