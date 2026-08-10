/**
 * Integration-ish checks against EnhancedMessageProcessor with DB methods stubbed.
 * Requires telegram-collector node_modules (pg/dotenv) — run with NODE_PATH set.
 */
const { describe, it, afterEach } = require('node:test');
const assert = require('node:assert/strict');

const processorModule = require('../messageProcessor');
const { EnhancedMessageProcessor, mapWithConcurrency, CompletionDrivenScheduler } =
    processorModule;

function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

describe('EnhancedMessageProcessor wiring', () => {
    /** @type {InstanceType<typeof EnhancedMessageProcessor>|null} */
    let processor = null;

    afterEach(() => {
        if (processor) {
            processor.stop();
            processor = null;
        }
    });

    it('F: processMessages uses bounded concurrency over the full batch', async () => {
        processor = new EnhancedMessageProcessor({ concurrency: 2 });
        const seen = [];
        let inFlight = 0;
        let peak = 0;

        processor.getUnprocessedMessages = async () => (
            [{ id: '1', message_text: 'x' }, { id: '2', message_text: 'y' }, { id: '3', message_text: 'z' }]
        );
        processor.processMessageEnhanced = async (msg) => {
            inFlight += 1;
            peak = Math.max(peak, inFlight);
            seen.push(msg.id);
            await delay(30);
            inFlight -= 1;
            return {
                success: true,
                duration_ms: 30,
                agents_affected: 1,
                is_breaking: false,
                event_category: 'GENERAL',
            };
        };

        await processor.processMessages();
        assert.deepEqual(seen.sort(), ['1', '2', '3']);
        assert.ok(peak <= 2, `peak ${peak} exceeded concurrency 2`);
    });

    it('A/C via processor.scheduler: no overlap and stop cancels future work', async () => {
        processor = new EnhancedMessageProcessor({ concurrency: 2 });
        processor.config.intervalSeconds = 0.05;
        let active = 0;
        let peak = 0;
        let cycles = 0;

        processor.processMessages = async () => {
            active += 1;
            peak = Math.max(peak, active);
            cycles += 1;
            await delay(100);
            active -= 1;
        };

        const started = processor.start();
        await delay(350);
        const atStop = cycles;
        processor.stop();
        await delay(250);
        await started.catch(() => {});

        assert.ok(cycles >= 2);
        assert.equal(peak, 1);
        assert.equal(cycles, atStop);
        assert.equal(processor.cycleRunning, false);
    });

    it('exports helpers used by production entrypoint', () => {
        assert.equal(typeof mapWithConcurrency, 'function');
        assert.equal(typeof CompletionDrivenScheduler, 'function');
        assert.equal(typeof processorModule.start, 'function');
        assert.equal(typeof processorModule.stop, 'function');
    });

    it('double start() on processor does not spawn a second loop', async () => {
        processor = new EnhancedMessageProcessor({ concurrency: 2 });
        processor.config.intervalSeconds = 0.05;
        let cycles = 0;
        processor.processMessages = async () => {
            cycles += 1;
            await delay(25);
        };

        const first = processor.start();
        await delay(10);
        await processor.start(); // already running → no-op
        await delay(100);
        processor.stop();
        await first.catch(() => {});
        await delay(150);

        const frozen = cycles;
        await delay(120);
        assert.equal(cycles, frozen);
        assert.equal(processor.cycleTimer, null);
        assert.ok(cycles >= 1);
    });
});
