/**
 * Pure helpers for Telegram message processor scheduling + in-batch concurrency.
 * No DB / network / provider dependencies (safe for unit tests).
 */

/**
 * Default in-batch concurrency.
 * Host is 8-core and currently under CPU/IO/memory/swap pressure with heavy
 * anti-join SELECTs. A conservative default of 4 keeps correctness while
 * preventing up to batchSize (150) simultaneous DB-heavy message transactions.
 * Override with TELEGRAM_PROCESSOR_CONCURRENCY.
 */
const DEFAULT_PROCESSOR_CONCURRENCY = 4;

/**
 * Parse TELEGRAM_PROCESSOR_CONCURRENCY (or provided raw value).
 * Invalid / non-positive values fall back to the conservative default.
 */
function parseProcessorConcurrency(rawValue, fallback = DEFAULT_PROCESSOR_CONCURRENCY) {
    const parsed = parseInt(rawValue, 10);
    if (!Number.isFinite(parsed) || parsed < 1) {
        return fallback;
    }
    return parsed;
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

    const limit = Math.max(1, Math.min(parseProcessorConcurrency(concurrency, 1), list.length));
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

/**
 * Completion-driven cycle scheduler:
 * run one cycle → await completion → schedule next only after completion.
 * Guarantees no overlapping cycles in the same process.
 */
class CompletionDrivenScheduler {
    /**
     * @param {{
     *   getIntervalSeconds: () => number,
     *   runCycle: () => Promise<unknown>,
     *   onError?: (err: unknown) => void,
     * }} options
     */
    constructor(options) {
        this.getIntervalSeconds = options.getIntervalSeconds;
        this.runCycle = options.runCycle;
        this.onError = options.onError || ((err) => {
            console.error('❌ Error in processing cycle:', err);
        });

        this.cycleTimer = null;
        this.isRunning = false;
        this.cycleRunning = false;
        this._stopped = true;
        this._scheduleGeneration = 0;
    }

    _clearCycleTimer() {
        if (this.cycleTimer) {
            clearTimeout(this.cycleTimer);
            this.cycleTimer = null;
        }
    }

    async runOneCycle() {
        if (this.cycleRunning) {
            return { skipped: true, reason: 'cycle_in_flight' };
        }

        this.cycleRunning = true;
        try {
            await this.runCycle();
            return { skipped: false };
        } finally {
            this.cycleRunning = false;
        }
    }

    _scheduleNextCycle(generation) {
        if (this._stopped || !this.isRunning || generation !== this._scheduleGeneration) {
            return;
        }

        this._clearCycleTimer();
        const delayMs = Math.max(0, Number(this.getIntervalSeconds()) * 1000);
        this.cycleTimer = setTimeout(() => {
            this.cycleTimer = null;
            this._runLoop(generation).catch((err) => {
                this.onError(err);
            });
        }, delayMs);
    }

    async _runLoop(generation) {
        if (this._stopped || !this.isRunning || generation !== this._scheduleGeneration) {
            return;
        }

        try {
            await this.runOneCycle();
        } catch (err) {
            this.onError(err);
        }

        this._scheduleNextCycle(generation);
    }

    /**
     * Starts with an immediate cycle, then completion-driven rescheduling.
     */
    async start() {
        if (this.isRunning) {
            return { alreadyRunning: true };
        }

        this._stopped = false;
        this.isRunning = true;
        this._scheduleGeneration += 1;
        const generation = this._scheduleGeneration;
        await this._runLoop(generation);
        return { alreadyRunning: false };
    }

    stop() {
        this._stopped = true;
        this.isRunning = false;
        this._scheduleGeneration += 1;
        this._clearCycleTimer();
    }
}

module.exports = {
    DEFAULT_PROCESSOR_CONCURRENCY,
    parseProcessorConcurrency,
    mapWithConcurrency,
    CompletionDrivenScheduler,
};
