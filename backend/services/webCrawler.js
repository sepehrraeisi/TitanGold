import axios from 'axios';
import * as cheerio from 'cheerio';
import robotsParser from 'robots-parser';
import { chromium } from 'playwright';
import { logger } from './logger.js';

/**
 * Web Crawler Service (TASK-BE-012)
 * Crawls URLs with configurable depth, CSS selectors, robots.txt compliance, and rate limiting
 */
export class WebCrawlerService {
    constructor() {
        // Track last request time per domain for rate limiting
        this.domainLastRequest = new Map();
        // Cache robots.txt parsers per domain
        this.robotsCache = new Map();
        // Browser instance for JS rendering
        this.browser = null;
    }

    /**
     * Fetches and parses robots.txt for a domain
     */
    async fetchRobotsTxt(baseUrl) {
        try {
            const url = new URL(baseUrl);
            const domain = `${url.protocol}//${url.host}`;
            const robotsTxtUrl = `${domain}/robots.txt`;

            // Check cache first
            if (this.robotsCache.has(domain)) {
                return this.robotsCache.get(domain);
            }

            logger.info(`Fetching robots.txt from ${robotsTxtUrl}`);

            const response = await axios.get(robotsTxtUrl, {
                timeout: 5000,
                validateStatus: (status) => status === 200 || status === 404
            });

            let robotsTxt = '';
            if (response.status === 200) {
                robotsTxt = response.data;
            }

            const robots = robotsParser(robotsTxtUrl, robotsTxt);
            this.robotsCache.set(domain, robots);

            return robots;
        } catch (error) {
            logger.warn(`Failed to fetch robots.txt: ${error.message}`);
            // Return permissive robots.txt on error
            return robotsParser('', '');
        }
    }

    /**
     * Enforces rate limiting (1 request per second per domain)
     */
    async enforceRateLimit(url) {
        const domain = new URL(url).host;
        const lastRequest = this.domainLastRequest.get(domain);

        if (lastRequest) {
            const timeSinceLastRequest = Date.now() - lastRequest;
            const minDelay = 1000; // 1 second

            if (timeSinceLastRequest < minDelay) {
                const waitTime = minDelay - timeSinceLastRequest;
                logger.info(`Rate limiting: waiting ${waitTime}ms for ${domain}`);
                await new Promise(resolve => setTimeout(resolve, waitTime));
            }
        }

        this.domainLastRequest.set(domain, Date.now());
    }

    /**
     * Fetches and parses a single page, with optional JS rendering
     */
    async fetchPage(url, renderJS = false) {
        await this.enforceRateLimit(url);

        if (renderJS) {
            return this.renderPageWithJS(url);
        }

        const response = await axios.get(url, {
            timeout: 10000,
            headers: {
                'User-Agent': 'TitanGold-Bot/1.0'
            }
        });

        return response.data;
    }

    /**
     * Renders a page using Playwright (TASK-BE-014)
     */
    async renderPageWithJS(url) {
        logger.info(`Rendering page with JS: ${url}`);

        if (!this.browser) {
            this.browser = await chromium.launch({ headless: true });
        }

        const context = await this.browser.newContext({
            userAgent: 'TitanGold-Bot/1.0 (JS Rendering)'
        });
        const page = await context.newPage();

        try {
            // Navigate and wait for network to be idle
            await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });

            // Give it a bit more time for dynamic content that might not be captured by networkidle
            await page.waitForTimeout(2000);

            const content = await page.content();
            return content;
        } catch (error) {
            logger.error(`JS rendering failed for ${url}: ${error.message}`);
            throw error;
        } finally {
            await context.close();
        }
    }

    /**
     * Close the browser instance
     */
    async close() {
        if (this.browser) {
            await this.browser.close();
            this.browser = null;
        }
    }

    /**
     * Extract data from HTML using CSS selectors
     */
    extractData(html, selectors, url) {
        const $ = cheerio.load(html);
        const data = { url };

        // If no selectors provided, return basic page info
        if (!selectors || Object.keys(selectors).length === 0) {
            data.title = $('title').text().trim();
            data.description = $('meta[name="description"]').attr('content') || '';
            return data;
        }

        // Extract data using provided selectors
        for (const [key, selector] of Object.entries(selectors)) {
            const elements = $(selector);
            if (elements.length === 0) {
                data[key] = null;
            } else if (elements.length === 1) {
                data[key] = elements.text().trim();
            } else {
                // Multiple matches - return array
                data[key] = elements.map((i, el) => $(el).text().trim()).get();
            }
        }

        return data;
    }

    /**
     * Find links on a page for crawling
     */
    findLinks(html, baseUrl) {
        const $ = cheerio.load(html);
        const links = new Set();
        const base = new URL(baseUrl);

        $('a[href]').each((i, elem) => {
            try {
                const href = $(elem).attr('href');
                const absoluteUrl = new URL(href, baseUrl).href;
                const linkUrl = new URL(absoluteUrl);

                // Only crawl same domain
                if (linkUrl.host === base.host) {
                    // Remove fragments
                    linkUrl.hash = '';
                    links.add(linkUrl.href);
                }
            } catch (error) {
                // Invalid URL, skip
            }
        });

        return Array.from(links);
    }

    /**
     * Main crawl method
     * @param {Object} sourceConfig - Configuration object
     * @param {string} sourceConfig.url - Starting URL
     * @param {number} sourceConfig.config.depth - Maximum crawl depth (default: 0)
     * @param {Object} sourceConfig.config.selectors - CSS selectors for data extraction
     * @returns {Promise<Array>} - Array of extracted data objects
     */
    async crawl(sourceConfig) {
        const startUrl = sourceConfig.url;
        const maxDepth = sourceConfig.config?.depth ?? 0;
        const selectors = sourceConfig.config?.selectors || {};

        logger.info(`Starting web crawl: ${startUrl} (depth: ${maxDepth})`);

        // Check robots.txt
        const robots = await this.fetchRobotsTxt(startUrl);
        if (!robots.isAllowed(startUrl, 'TitanGold-Bot')) {
            throw new Error(`Crawling ${startUrl} is disallowed by robots.txt`);
        }

        const visited = new Set();
        const queue = [{ url: startUrl, depth: 0 }];
        const results = [];

        while (queue.length > 0) {
            const { url, depth } = queue.shift();

            // Skip if already visited
            if (visited.has(url)) {
                continue;
            }

            // Check robots.txt permission
            if (!robots.isAllowed(url, 'TitanGold-Bot')) {
                logger.info(`Skipping ${url} (disallowed by robots.txt)`);
                continue;
            }

            visited.add(url);

            try {
                // Fetch page (with optional JS rendering)
                const html = await this.fetchPage(url, sourceConfig.config?.renderJS);

                // Extract data
                const data = this.extractData(html, selectors, url);
                results.push(data);

                // Find links for next depth level
                if (depth < maxDepth) {
                    const links = this.findLinks(html, url);
                    for (const link of links) {
                        if (!visited.has(link)) {
                            queue.push({ url: link, depth: depth + 1 });
                        }
                    }
                }

            } catch (error) {
                logger.error(`Failed to crawl ${url}: ${error.message}`);
                // Continue with other URLs
            }
        }

        logger.info(`Web crawl completed: ${results.length} pages crawled`);
        return results;
    }
}

export const webCrawlerService = new WebCrawlerService();
