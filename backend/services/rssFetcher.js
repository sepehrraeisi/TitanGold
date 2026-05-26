import axios from 'axios';
import * as cheerio from 'cheerio';
import { logger } from './logger.js';

/**
 * Lightweight RSS/Atom fetch (no extra dependency).
 */
export async function fetchRssFeed(feedUrl, { timeoutMs = 15000 } = {}) {
    const response = await axios.get(feedUrl, {
        timeout: timeoutMs,
        headers: { 'User-Agent': 'TitanGold-Bot/1.0', Accept: 'application/rss+xml, application/xml, text/xml' },
        validateStatus: s => s >= 200 && s < 300,
    });

    const $ = cheerio.load(response.data, { xmlMode: true });
    const items = [];

    $('item').each((_, el) => {
        const title = $(el).find('title').first().text().trim();
        const link = $(el).find('link').first().text().trim() || $(el).find('link').attr('href') || '';
        const description = $(el).find('description').first().text().trim();
        const pubDate = $(el).find('pubDate').first().text().trim();
        if (title || link) {
            items.push({ title, url: link, content: description, published_at: pubDate });
        }
    });

    if (items.length === 0) {
        $('entry').each((_, el) => {
            const title = $(el).find('title').first().text().trim();
            const link =
                $(el).find('link[rel="alternate"]').attr('href') ||
                $(el).find('link').first().attr('href') ||
                $(el).find('id').first().text().trim();
            const summary = $(el).find('summary').first().text().trim() || $(el).find('content').first().text().trim();
            const updated = $(el).find('updated').first().text().trim();
            if (title || link) {
                items.push({ title, url: link, content: summary, published_at: updated });
            }
        });
    }

    logger.info(`RSS fetch ${feedUrl}: ${items.length} items`);
    return items;
}
