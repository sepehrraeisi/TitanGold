import { TelegramClient } from 'gramjs';
import { StringSession } from 'gramjs/sessions/index.js';
import { Api } from 'gramjs';
import { config } from './config.ts';
import { channelCache } from './cache.ts';
import { logger } from './logger.ts';
import { normalizeChannelIdentifier, buildMessageLink } from './utils.ts';
import { TelegramMessage } from './types.ts';

type CollectorResult = {
    source: 'cache' | 'live';
    channel: string;
    messages: TelegramMessage[];
};

export class TelegramCollector {
    private client: TelegramClient;
    private ready = false;
    private sessionString: string;

    constructor() {
        this.sessionString = config.telegram.sessionString || '';
        this.client = this.createClient(this.sessionString);
    }

    private createClient(session: string) {
        const stringSession = new StringSession(session || '');
        return new TelegramClient(stringSession, config.telegram.apiId, config.telegram.apiHash, {
            connectionRetries: 5,
        });
    }

    async setSessionString(sessionString: string) {
        this.sessionString = sessionString;
        config.telegram.sessionString = sessionString;
        if (this.ready) {
            try {
                await this.client.disconnect();
            } catch (error) {
                logger.warn('[Collector] Failed to disconnect Telegram client during session update', { error });
            }
            this.ready = false;
        }
        this.client = this.createClient(sessionString);
        logger.info('[Collector] Telegram session updated');
    }

    async init() {
        if (this.ready) return;
        await this.client.connect();

        if (!this.client.session?.authKey || !this.client.session?.userId) {
            throw new Error('Telegram session is not authorized. Generate a session via the login flow.');
        }

        this.ready = true;
        logger.info('[Collector] Telegram client connected', {
            userId: this.client.session.userId,
        });
    }

    async getRecentMessages(rawChannel: string, limit: number): Promise<CollectorResult> {
        const normalizedChannel = normalizeChannelIdentifier(rawChannel);
        if (!normalizedChannel) {
            throw new Error('Channel username is required');
        }

        const cached = channelCache.get(normalizedChannel);
        if (cached && cached.messages.length >= Math.min(limit, config.maxMessagesPerChannel)) {
            return {
                source: 'cache',
                channel: normalizedChannel,
                messages: cached.messages.slice(0, limit),
            };
        }

        await this.init();
        const entity = await this.resolveEntity(normalizedChannel);
        const messages = await this.client.getMessages(entity, { limit: Math.min(limit, config.maxMessagesPerChannel) });

        const normalized = messages
            .filter((message): message is Api.Message => message instanceof Api.Message)
            .filter(message => Boolean(message.message) || Boolean(message.media))
            .map(message => this.toTelegramMessage(message, entity))
            .filter(msg => msg.text.length > 0)
            .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());

        channelCache.set(normalizedChannel, normalized);

        logger.info('[Collector] Fetched Telegram messages', {
            channel: normalizedChannel,
            requestedLimit: limit,
            returned: normalized.length,
        });

        return {
            source: 'live',
            channel: normalizedChannel,
            messages: normalized.slice(0, limit),
        };
    }

    private async resolveEntity(channel: string) {
        const username = channel.startsWith('@') ? channel : `@${channel}`;
        try {
            return await this.client.getEntity(username);
        } catch (error) {
            logger.warn('[Collector] Failed to resolve entity, retrying without @', { channel, error });
            return this.client.getEntity(channel);
        }
    }

    private toTelegramMessage(message: Api.Message, entity: any): TelegramMessage {
        const text = (message.message || '').trim();
        const html = message.message || '';
        const publishedAt = new Date(message.date * 1000).toISOString();
        const username = 'username' in entity ? entity.username : undefined;
        const channelTitle = 'title' in entity ? entity.title : undefined;

        return {
            id: message.id,
            channel: username || channelTitle || 'unknown',
            text,
            html,
            raw: {
                views: message.views,
                forwards: message.forwards,
                replies: message.replies,
                groupedId: message.groupedId,
            },
            author: message.postAuthor || channelTitle || username,
            publishedAt,
            link: buildMessageLink(username, message.id),
            media: this.extractMediaMeta(message),
        };
    }

    private extractMediaMeta(message: Api.Message): TelegramMessage['media'] {
        if (!message.media) return undefined;

        if (message.media instanceof Api.MessageMediaPhoto) {
            const size =
                message.media.photo instanceof Api.Photo && message.media.photo.sizes?.length
                    ? message.media.photo.sizes[0].size
                    : undefined;
            return { type: 'photo', size };
        }

        if (message.media instanceof Api.MessageMediaDocument) {
            const doc = message.media.document as Api.Document;
            const attributes = doc?.attributes || [];
            const fileNameAttr = attributes.find(attr => attr instanceof Api.DocumentAttributeFilename) as
                | Api.DocumentAttributeFilename
                | undefined;
            const mimeType = doc?.mimeType || 'application/octet-stream';
            const size = doc?.size?.toJSNumber?.() ?? (typeof doc?.size === 'number' ? doc.size : undefined);

            const mediaType = mimeType.startsWith('video/')
                ? 'video'
                : mimeType.startsWith('audio/')
                  ? 'audio'
                  : 'document';

            return {
                type: mediaType,
                fileName: fileNameAttr?.fileName,
                mimeType,
                size,
            };
        }

        return { type: 'other' };
    }
}

