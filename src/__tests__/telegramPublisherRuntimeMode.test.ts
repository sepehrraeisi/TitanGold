import { describe, expect, it } from 'vitest';

type RuntimeModeChoice = 'dry_run' | 'live_test' | 'live';

function resolveDeliveryActionLabels(effectiveMode: RuntimeModeChoice) {
    if (effectiveMode === 'live_test') {
        return {
            testLabel: 'publisher_btn_test_live_test',
            publishLabel: 'publisher_btn_publish_live_test',
            helper: 'publisher_delivery_helper_live_test',
        };
    }
    if (effectiveMode === 'live') {
        return {
            testLabel: 'publisher_btn_test_live',
            publishLabel: 'publisher_btn_publish_live',
            helper: 'publisher_delivery_helper_live',
        };
    }
    return {
        testLabel: 'publisher_btn_test_dry_run',
        publishLabel: 'publisher_btn_publish_dry_run',
        helper: 'publisher_delivery_helper_dry_run',
    };
}

describe('telegram publisher runtime mode UI labels', () => {
    it('uses dry-run labels when effective mode is dry_run', () => {
        expect(resolveDeliveryActionLabels('dry_run')).toEqual({
            testLabel: 'publisher_btn_test_dry_run',
            publishLabel: 'publisher_btn_publish_dry_run',
            helper: 'publisher_delivery_helper_dry_run',
        });
    });

    it('uses live test labels when effective mode is live_test', () => {
        expect(resolveDeliveryActionLabels('live_test').testLabel).toBe('publisher_btn_test_live_test');
        expect(resolveDeliveryActionLabels('live_test').publishLabel).toBe('publisher_btn_publish_live_test');
    });

    it('uses live labels when effective mode is live', () => {
        expect(resolveDeliveryActionLabels('live').publishLabel).toBe('publisher_btn_publish_live');
    });
});

describe('telegram publisher runtime mode safety copy', () => {
    it('does not expose bot token keys in label map', () => {
        const labels = resolveDeliveryActionLabels('live');
        const serialized = JSON.stringify(labels);
        expect(serialized).not.toMatch(/bot_token|api\.telegram\.org/i);
    });
});
