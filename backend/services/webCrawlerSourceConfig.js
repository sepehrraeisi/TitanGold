/**
 * DH-WEBCRAWLER-P4 — Map data_sources (type=web) config to webCrawlerService.crawl() shape.
 */

function parseSourceConfig(config) {
    if (!config) return {};
    if (typeof config === 'string') {
        try {
            return JSON.parse(config);
        } catch {
            return {};
        }
    }
    return config;
}

function renderJsAllowed() {
    return String(process.env.CRAWLER_RENDER_JS_ENABLED || '').toLowerCase() === 'true';
}

/**
 * Normalize CSS selectors from Data Sources UI (selector string) or crawler JSONB.
 */
export function normalizeWebSelectors(config) {
    if (config.selectors && typeof config.selectors === 'object' && !Array.isArray(config.selectors)) {
        return { ...config.selectors };
    }
    if (typeof config.selector === 'string' && config.selector.trim()) {
        return { content: config.selector.trim() };
    }
    return {};
}

/**
 * @param {object} source - data_sources row (url, config)
 * @param {{ applyRenderJsGate?: boolean }} [options]
 * @returns {{ url: string, config: object }}
 */
export function mapDataSourceToWebCrawlConfig(source, { applyRenderJsGate = true } = {}) {
    const config = parseSourceConfig(source?.config);
    const depthRaw = config.depth ?? config.maxDepth ?? 0;
    const depth = Math.min(Math.max(0, Number(depthRaw) || 0), 5);
    const maxPages = Math.min(Math.max(1, Number(config.maxPages) || 50), 500);
    const respectRobots = config.respectRobots !== false && config.respect_robots !== false;
    const renderJsRequested = config.renderJS === true || config.render_js === true;
    const renderJS = applyRenderJsGate
        ? renderJsRequested && renderJsAllowed()
        : renderJsRequested;

    return {
        url: source.url,
        config: {
            depth,
            maxPages,
            selectors: normalizeWebSelectors(config),
            renderJS,
            skipRobots: !respectRobots,
        },
    };
}
