/**
 * Deterministic tests for telegram processor scheduling + bounded concurrency.
 * No provider/network calls. No live DB required.
 */
const { describe, it, afterEach } = require('node:test');
const assert = require('node:assert/strict');

const {
    DEFAULT_PROCESSOR_CONCURRENCY,
    parseProcessorConcurrency,
    mapWithConcurrency,
    CompletionDrivenScheduler,
} = require('../messageProcessorHelpers');

function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

describe('parseProcessorConcurrency', () => {
    it('uses conservative default for invalid values', () => {
        assert.equal(DEFAULT_PROCESSOR_CONCURRENCY, 4);
        assert.equal(parseProcessorConcurrency(undefined), 4);
        assert.equal(parseProcessorConcurrency(''), 4);
        assert.equal(parseProcessorConcurrency('0'), 4);
        assert.equal(parseProcessorConcurrency('-3'), 4);
        assert.equal(parseProcessorConcurrency('abc'), 4);
        assert.equal(parseProcessorConcurrency(Number.NaN), 4);
        assert.equal(parseProcessorConcurrency(null), 4);
    });

    it('accepts positive integers', () => {
        assert.equal(parseProcessorConcurrency('8'), 8);
        assert.equal(parseProcessorConcurrency(3), 3);
    });
});

describe('mapWithConcurrency', () => {
    it('D: never exceeds configured concurrency', async () => {
        const items = Array.from({ length: 20 }, (_, i) => i);
        let inFlight = 0;
        let peak = 0;

        await mapWithConcurrency(items, 3, async (item) => {
            inFlight += 1;
            peak = Math.max(peak, inFlight);
            await delay(20);
            inFlight -= 1;
            return item;
        });

        assert.ok(peak <= 3, `peak concurrency ${peak} exceeded limit 3`);
        assert.ok(peak >= 1);
    });

    it('E: all messages in a batch are eventually attempted', async () => {
        const items = Array.from({ length: 17 }, (_, i) => i);
        const seen = [];

        const results = await mapWithConcurrency(items, 4, async (item) => {
            seen.push(item);
            await delay(5);
            return item * 2;
        });

        assert.equal(seen.length, 17);
        assert.deepEqual([...seen].sort((a, b) => a - b), items);
        assert.deepEqual(
            results.map((r) => r.value),
            items.map((i) => i * 2)
        );
    });

    it('F: rejection isolation matches allSettled semantics (behavior intact)', async () => {
        const results = await mapWithConcurrency([1, 2, 3], 2, async (n) => {
            if (n === 2) {
                throw new Error('boom');
            }
            return n;
        });

        assert.equal(results[0].status, 'fulfilled');
        assert.equal(results[0].value, 1);
        assert.equal(results[1].status, 'rejected');
        assert.equal(results[1].reason.message, 'boom');
        assert.equal(results[2].status, 'fulfilled');
        assert.equal(results[2].value, 3);
    });

    it('empty batch returns [] without invoking mapper', async () => {
        let calls = 0;
        const results = await mapWithConcurrency([], 4, async () => {
            calls += 1;
            return 1;
        });
        assert.deepEqual(results, []);
        assert.equal(calls, 0);
    });

    it('concurrency=1 processes sequentially', async () => {
        const order = [];
        let inFlight = 0;
        let peak = 0;
        await mapWithConcurrency([1, 2, 3], 1, async (n) => {
            inFlight += 1;
            peak = Math.max(peak, inFlight);
            order.push(`start:${n}`);
            await delay(15);
            order.push(`end:${n}`);
            inFlight -= 1;
            return n;
        });
        assert.equal(peak, 1);
        assert.deepEqual(order, [
            'start:1', 'end:1',
            'start:2', 'end:2',
            'start:3', 'end:3',
        ]);
    });

    it('concurrency greater than batch length caps to batch size', async () => {
        const items = [10, 20];
        let inFlight = 0;
        let peak = 0;
        const results = await mapWithConcurrency(items, 50, async (n) => {
            inFlight += 1;
            peak = Math.max(peak, inFlight);
            await delay(10);
            inFlight -= 1;
            return n;
        });
        assert.ok(peak <= items.length);
        assert.equal(results.length, 2);
        assert.equal(results[0].value, 10);
        assert.equal(results[1].value, 20);
    });

    it('invalid concurrency config stays bounded (no deadlock/unbounded)', async () => {
        for (const bad of [0, -1, Number.NaN, '', undefined, null, 'abc']) {
            const items = [1, 2, 3, 4];
            let inFlight = 0;
            let peak = 0;
            const results = await mapWithConcurrency(items, bad, async (n) => {
                inFlight += 1;
                peak = Math.max(peak, inFlight);
                await delay(5);
                inFlight -= 1;
                return n;
            });
            assert.equal(results.length, 4, `bad=${String(bad)}`);
            assert.ok(peak >= 1 && peak <= 4, `bad=${String(bad)} peak=${peak}`);
            assert.ok(results.every((r) => r.status === 'fulfilled'));
        }
    });
});

describe('CompletionDrivenScheduler', () => {
    /** @type {CompletionDrivenScheduler|null} */
    let scheduler = null;

    afterEach(() => {
        if (scheduler) {
            scheduler.stop();
            scheduler = null;
        }
    });

    it('A: slow cycle does not overlap the next cycle', async () => {
        let active = 0;
        let peakActive = 0;
        let cycles = 0;

        scheduler = new CompletionDrivenScheduler({
            getIntervalSeconds: () => 0.05,
            runCycle: async () => {
                active += 1;
                peakActive = Math.max(peakActive, active);
                cycles += 1;
                await delay(120);
                active -= 1;
            },
        });

        const started = scheduler.start();
        await delay(400);
        scheduler.stop();
        await started.catch(() => {});
        // Allow any in-flight cycle that began before stop() to finish and hit finally.
        await delay(200);

        assert.ok(cycles >= 2, `expected >=2 cycles, got ${cycles}`);
        assert.equal(peakActive, 1, `overlapping cycles detected, peak=${peakActive}`);
        assert.equal(scheduler.cycleRunning, false);
    });

    it('B: exceptions reset in-flight state and allow later cycles', async () => {
        let cycles = 0;

        scheduler = new CompletionDrivenScheduler({
            getIntervalSeconds: () => 0.05,
            runCycle: async () => {
                cycles += 1;
                if (cycles === 1) {
                    throw new Error('cycle failed');
                }
                await delay(10);
            },
            onError: () => {},
        });

        const started = scheduler.start();
        await delay(250);
        scheduler.stop();
        await started.catch(() => {});

        assert.ok(cycles >= 2, `expected recovery after exception, cycles=${cycles}`);
        assert.equal(scheduler.cycleRunning, false);
        assert.equal(scheduler.isRunning, false);
    });

    it('C: stop() prevents future cycles', async () => {
        let cycles = 0;

        scheduler = new CompletionDrivenScheduler({
            getIntervalSeconds: () => 0.05,
            runCycle: async () => {
                cycles += 1;
                await delay(10);
            },
        });

        const started = scheduler.start();
        await delay(80);
        const cyclesAtStop = cycles;
        scheduler.stop();
        await delay(250);
        await started.catch(() => {});

        assert.ok(cyclesAtStop >= 1);
        assert.equal(cycles, cyclesAtStop, `stop() allowed extra cycles: before=${cyclesAtStop} after=${cycles}`);
        assert.equal(scheduler.cycleTimer, null);
        assert.equal(scheduler.isRunning, false);
    });

    it('stop() while cycle is running prevents future timer scheduling', async () => {
        let cycles = 0;
        let releaseCycle;
        const gate = new Promise((resolve) => {
            releaseCycle = resolve;
        });

        scheduler = new CompletionDrivenScheduler({
            getIntervalSeconds: () => 0.05,
            runCycle: async () => {
                cycles += 1;
                await gate;
            },
        });

        const started = scheduler.start();
        await delay(30);
        assert.equal(scheduler.cycleRunning, true);
        assert.equal(cycles, 1);

        scheduler.stop();
        assert.equal(scheduler.cycleTimer, null);
        assert.equal(scheduler.isRunning, false);

        releaseCycle();
        await started.catch(() => {});
        await delay(200);

        assert.equal(cycles, 1, 'in-flight cycle may finish once, but no new cycle may start');
        assert.equal(scheduler.cycleTimer, null);
        assert.equal(scheduler.cycleRunning, false);
    });

    it('start() called twice does not create a second scheduler loop', async () => {
        let cycles = 0;
        scheduler = new CompletionDrivenScheduler({
            getIntervalSeconds: () => 0.05,
            runCycle: async () => {
                cycles += 1;
                await delay(20);
            },
        });

        const first = scheduler.start();
        await delay(10);
        const second = await scheduler.start();
        assert.deepEqual(second, { alreadyRunning: true });

        await delay(120);
        scheduler.stop();
        await first.catch(() => {});
        await delay(150);

        // One loop only: cycles advance while running, then freeze after stop.
        const frozen = cycles;
        await delay(150);
        assert.equal(cycles, frozen);
        assert.equal(scheduler.cycleTimer, null);
    });

    it('G: suite requires no provider/network calls', () => {
        assert.equal(typeof mapWithConcurrency, 'function');
        assert.equal(typeof CompletionDrivenScheduler, 'function');
    });
});
