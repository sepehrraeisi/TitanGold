import { WebCrawlerService } from '../../services/webCrawler.js';

describe('Web Crawler Service Integration Tests', () => {
    let crawler;

    beforeEach(() => {
        crawler = new WebCrawlerService();
    });

    afterEach(async () => {
        await crawler.close();
    });

    describe('crawl({ url, config }) API', () => {
        it('returns an array of page results at depth 0', async () => {
            const results = await crawler.crawl({
                url: 'https://example.com',
                config: { depth: 0 },
            });

            expect(Array.isArray(results)).toBe(true);
            expect(results.length).toBeGreaterThan(0);
            expect(results[0].url).toMatch(/^https:\/\/example\.com\/?$/);
            expect(results[0].title).toBeDefined();
        }, 15000);

        it('respects depth config for shallow crawl', async () => {
            const results = await crawler.crawl({
                url: 'https://example.com',
                config: { depth: 1, maxPages: 5 },
            });

            expect(Array.isArray(results)).toBe(true);
            expect(results.length).toBeLessThanOrEqual(5);
        }, 20000);

        it('extracts content using selectors config', async () => {
            const results = await crawler.crawl({
                url: 'https://example.com',
                config: {
                    depth: 0,
                    selectors: { heading: 'h1', body: 'p' },
                },
            });

            expect(results[0].heading).toBeDefined();
            expect(results[0].body).toBeDefined();
        }, 15000);

        it('handles unreachable URLs gracefully with skipRobots', async () => {
            const results = await crawler.crawl({
                url: 'https://this-domain-definitely-does-not-exist-12345.com',
                config: { depth: 0, skipRobots: true },
            });

            expect(Array.isArray(results)).toBe(true);
            expect(results.length).toBe(0);
        }, 15000);
    });
});
