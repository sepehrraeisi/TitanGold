import axios from 'axios';
import { logger } from '../logger.js';

/**
 * Fetches data from an RSS feed
 * @param {Object} source - The data source configuration
 * @returns {Promise<Array>} - List of normalized items from the feed
 */
export async function fetchFromRss(source) {
    const { url } = source;

    try {
        logger.info(`Fetching from RSS: ${url}`, { sourceId: source.id });

        const response = await axios.get(url, { timeout: 10000 });
        const xml = response.data;

        // Simple regex-based RSS parser (supports basic <item> structure)
        const items = [];
        const itemRegex = /<item>([\s\S]*?)<\/item>/g;
        let match;

        while ((match = itemRegex.exec(xml)) !== null) {
            const itemContent = match[1];

            const extract = (tag) => {
                const tagRegex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`);
                const tagMatch = tagRegex.exec(itemContent);
                return tagMatch ? tagMatch[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').trim() : '';
            };

            items.push({
                title: extract('title'),
                link: extract('link'),
                description: extract('description'),
                pubDate: extract('pubDate'),
                guid: extract('guid'),
                author: extract('author') || extract('dc:creator')
            });
        }

        return items;
    } catch (error) {
        logger.error(`RSS Fetch failed for ${url}: ${error.message}`, { sourceId: source.id });
        throw error;
    }
}
