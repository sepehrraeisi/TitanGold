import { webCrawlerService } from '../webCrawler.js';
import { logger } from '../logger.js';
import { mapDataSourceToWebCrawlConfig } from '../webCrawlerSourceConfig.js';

/**
 * Fetcher adapter for web crawler (TASK-BE-012)
 * @param {Object} source - Data source configuration
 * @returns {Promise<Array>} - Array of crawled data
 */
export async function fetchFromWeb(source) {
    logger.info(`Web crawler fetcher: ${source.url}`);

    try {
        const crawlConfig = mapDataSourceToWebCrawlConfig(source);
        const data = await webCrawlerService.crawl(crawlConfig);
        return data;
    } catch (error) {
        logger.error(`Web crawler error: ${error.message}`);
        throw error;
    }
}
