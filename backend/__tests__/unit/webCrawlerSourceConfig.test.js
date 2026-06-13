/**
 * DH-WEBCRAWLER-P4
 * @jest-environment node
 */

import {
    mapDataSourceToWebCrawlConfig,
    normalizeWebSelectors,
} from '../../services/webCrawlerSourceConfig.js';

describe('webCrawlerSourceConfig', () => {
    test('maps maxDepth to depth', () => {
        const mapped = mapDataSourceToWebCrawlConfig(
            {
                url: 'https://example.com',
                config: { maxDepth: 3 },
            },
            { applyRenderJsGate: false },
        );
        expect(mapped.config.depth).toBe(3);
    });

    test('maps selector string to selectors.content', () => {
        const mapped = mapDataSourceToWebCrawlConfig(
            {
                url: 'https://example.com',
                config: { selector: 'article, .content' },
            },
            { applyRenderJsGate: false },
        );
        expect(mapped.config.selectors).toEqual({ content: 'article, .content' });
    });

    test('passes selectors object through', () => {
        const mapped = mapDataSourceToWebCrawlConfig(
            {
                url: 'https://example.com',
                config: { selectors: { title: 'h1', content: 'article' } },
            },
            { applyRenderJsGate: false },
        );
        expect(mapped.config.selectors).toEqual({ title: 'h1', content: 'article' });
    });

    test('respect_robots false maps to skipRobots true', () => {
        const mapped = mapDataSourceToWebCrawlConfig(
            {
                url: 'https://example.com',
                config: { respectRobots: false },
            },
            { applyRenderJsGate: false },
        );
        expect(mapped.config.skipRobots).toBe(true);
    });

    test('renderJS maps from renderJS config key', () => {
        const mapped = mapDataSourceToWebCrawlConfig(
            {
                url: 'https://example.com',
                config: { renderJS: true },
            },
            { applyRenderJsGate: false },
        );
        expect(mapped.config.renderJS).toBe(true);
    });

    test('normalizeWebSelectors handles empty config', () => {
        expect(normalizeWebSelectors({})).toEqual({});
    });
});
