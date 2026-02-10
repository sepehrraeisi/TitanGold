import { WebCrawlerService } from '../../services/webCrawler.js';
import express from 'express';
import { logger } from '../../services/logger.js';

describe('Web Crawler JS Rendering Integration Tests (TASK-BE-014)', () => {
    let crawler;
    let server;
    const port = 3033;
    const baseUrl = `http://localhost:${port}`;

    beforeAll(async () => {
        // Setup a simple mock server with JS content
        const app = express();

        app.get('/dynamic', (req, res) => {
            res.send(`
                <!DOCTYPE html>
                <html>
                <head><title>Dynamic Page</title></head>
                <body>
                    <div id="root">Loading...</div>
                    <script>
                        setTimeout(() => {
                            document.getElementById('root').innerHTML = '<h1 id="content">JS Rendered Content</h1><p>This content was loaded via JS.</p>';
                        }, 500);
                    </script>
                </body>
                </html>
            `);
        });

        app.get('/static', (req, res) => {
            res.send(`
                <!DOCTYPE html>
                <html>
                <head><title>Static Page</title></head>
                <body>
                    <h1 id="content">Static Content</h1>
                </body>
                </html>
            `);
        });

        server = app.listen(port);
        crawler = new WebCrawlerService();
    });

    afterAll(async () => {
        if (server) await server.close();
        if (crawler) await crawler.close();
    });

    it('should NOT see dynamic content with static fetch (renderJS: false)', async () => {
        const sourceConfig = {
            url: `${baseUrl}/dynamic`,
            config: {
                renderJS: false,
                selectors: {
                    main: '#content'
                }
            }
        };

        const results = await crawler.crawl(sourceConfig);

        // cheeiro will see "Loading..." but not the h1#content
        expect(results).toHaveLength(1);
        expect(results[0].main).toBeNull();
    }, 15000);

    it('should see dynamic content with JS rendering (renderJS: true)', async () => {
        const sourceConfig = {
            url: `${baseUrl}/dynamic`,
            config: {
                renderJS: true,
                selectors: {
                    main: '#content'
                }
            }
        };

        const results = await crawler.crawl(sourceConfig);

        expect(results).toHaveLength(1);
        expect(results[0].main).toBe('JS Rendered Content');
    }, 40000); // Higher timeout for JS rendering and browser launch

    it('should still work for static pages with renderJS: true', async () => {
        const sourceConfig = {
            url: `${baseUrl}/static`,
            config: {
                renderJS: true,
                selectors: {
                    main: '#content'
                }
            }
        };

        const results = await crawler.crawl(sourceConfig);

        expect(results).toHaveLength(1);
        expect(results[0].main).toBe('Static Content');
    }, 30000);
});
