/**
 * Collector-local bounded concurrency helpers.
 * No DB / Telegram / provider dependencies (safe for unit tests).
 */

const DEFAULT_POLL_CONCURRENCY = 3;
const MIN_POLL_CONCURRENCY = 1;
const MAX_POLL_CONCURRENCY = 10;

/**
 * Parse TELEGRAM_POLL_CONCURRENCY.
 * Invalid / non-positive values fall back to the conservative default.
 * Values above MAX are clamped (never unbounded).
 */
function parsePollConcurrency(rawValue, fallback = DEFAULT_POLL_CONCURRENCY) {
    const parsed = typeof rawValue === 'number' ? rawValue : parseInt(rawValue, 10);
    if (!Number.isFinite(parsed) || parsed < MIN_POLL_CONCURRENCY) {
        return fallback;
    }
    return Math.min(MAX_POLL_CONCURRENCY, Math.floor(parsed));
}

/**
 * Promise.allSettled-equivalent with a bounded worker pool.
 * Every item is attempted exactly once; peak in-flight work never exceeds limit.
 */
async function mapWithConcurrency(items, concurrency, mapper) {
    const list = Array.isArray(items) ? items : [];
    if (list.length === 0) {
        return [];
    }

    const parsed = parsePollConcurrency(concurrency, MIN_POLL_CONCURRENCY);
    const limit = Math.max(MIN_POLL_CONCURRENCY, Math.min(parsed, list.length, MAX_POLL_CONCURRENCY));
    const results = new Array(list.length);
    let nextIndex = 0;

    async function worker() {
        while (true) {
            const index = nextIndex;
            nextIndex += 1;
            if (index >= list.length) {
                return;
            }
            try {
                const value = await mapper(list[index], index);
                results[index] = { status: 'fulfilled', value };
            } catch (reason) {
                results[index] = { status: 'rejected', reason };
            }
        }
    }

    await Promise.all(Array.from({ length: limit }, () => worker()));
    return results;
}

module.exports = {
    DEFAULT_POLL_CONCURRENCY,
    MIN_POLL_CONCURRENCY,
    MAX_POLL_CONCURRENCY,
    parsePollConcurrency,
    mapWithConcurrency,
};
