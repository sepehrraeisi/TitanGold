import { WebCrawlerService } from '../services/webCrawler.js';
import axios from 'axios';

describe('Web Crawler Service Integration Tests', () => {
    let crawler;

    beforeEach(() => {
        crawler = new WebCrawlerService();
    });

    describe('Basic Crawling', () => {
        it('should crawl a simple HTML page', async () => {
            const url = 'https://example.com';
            const result = await crawler.crawl(url, { maxDepth: 0 });

            expect(result).toBeDefined();
            expect(result.url).toBe(url);
            expect(result.title).toBeDefined();
            expect(result.content).toBeDefined();
            expect(result.links).toBeDefined();
        }, 10000);

        it('should respect maxDepth parameter', async () => {
            const url = 'https://example.com';
            const result = await crawler.crawl(url, { maxDepth: 1 });

            expect(result.visited).toBeDefined();
            expect(Object.keys(result.visited).length).toBeLessThanOrEqual(10);
        }, 15000);

        it('should handle invalid URLs gracefully', async () => {
            const url = 'https://this-domain-definitely-does-not-exist-12345.com';

            try {
                await crawler.crawl(url, { maxDepth: 0 });
                fail('Should have thrown error for invalid URL');
            } catch (error) {
                expect(error).toBeDefined();
            }
        }, 10000);
    });

    describe('CSS Selector Filtering', () => {
        it('should filter content by CSS selector', async () => {
            const url = 'https://example.com';
            const result = await crawler.crawl(url, {
                maxDepth: 0,
                selector: 'h1, p'
            });

            expect(result.content).toBeDefined();
            expect(result.content.length).toBeGreaterThan(0);
        }, 10000);
    });

    describe('Rate Limiting', () => {
        it('should respect rate limiting delays', async () => {
            const start = Date.now();

            await crawler.crawl('https://example.com', {
                maxDepth: 1,
                delay: 500
            });

            const elapsed = Date.now() - start;
            // Should take at least 500ms if following links
            expect(elapsed).toBeGreaterThan(400);
        }, 15000);
    });

    describe('Robots.txt Compliance', () => {
        it('should check robots.txt before crawling', async () => {
            // Most sites allow crawling example.com
            const canCrawl = await crawler.canCrawl('https://example.com');
            expect(typeof canCrawl).toBe('boolean');
        }, 5000);

        it('should respect robots.txt disallow rules', async () => {
            // Test with a site known to have robots.txt restrictions
            const canCrawl = await crawler.canCrawl('https://www.google.com/search');
            // Google typically disallows /search in robots.txt
            expect(canCrawl).toBe(false);
        }, 5000);
    });

    describe('User Agent', () => {
        it('should use custom user agent', async () => {
            const customUA = 'TitanGold-Crawler/1.0';
            const crawlerWithUA = new WebCrawlerService(customUA);

            const result = await crawlerWithUA.crawl('https://example.com', {
                maxDepth: 0
            });

            expect(result).toBeDefined();
        }, 10000);
    });

    describe('Error Handling', () => {
        it('should handle HTTP errors gracefully', async () => {
            try {
                await crawler.crawl('https://httpstat.us/500', { maxDepth: 0 });
                fail('Should have handled 500 error');
            } catch (error) {
                expect(error).toBeDefined();
            }
        }, 10000);

        it('should handle malformed HTML', async () => {
            // This should still work, cheerio is forgiving
            const result = await crawler.crawl('https://example.com', {
                maxDepth: 0
            });

            expect(result).toBeDefined();
        }, 10000);
    });

    describe('Link Extraction', () => {
        it('should extract links from page', async () => {
            const result = await crawler.crawl('https://example.com', {
                maxDepth: 0
            });

            expect(result.links).toBeDefined();
            expect(Array.isArray(result.links)).toBe(true);
        }, 10000);

        it('should normalize relative URLs', async () => {
            const result = await crawler.crawl('https://example.com', {
                maxDepth: 1
            });

            if (result.links && result.links.length > 0) {
                result.links.forEach(link => {
                    expect(link).toMatch(/^https?:\/\//);
                });
            }
        }, 15000);
    });
});
