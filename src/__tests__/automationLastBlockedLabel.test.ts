import { describe, expect, it } from 'vitest';
import { formatLastBlockedSummary } from '../../components/ai/AIManager/tabs/DataHub/advanced/automation/automationErrorLabels';

const t = (key: string) =>
  ({
    automation_last_blocked_mapping: 'Missing publisher mapping',
    automation_last_blocked_unknown: 'See delivery history',
  })[key] || key;

describe('formatLastBlockedSummary', () => {
  it('maps PUBLISHER_MAPPING_REQUIRED by code', () => {
    expect(formatLastBlockedSummary(null, 'PUBLISHER_MAPPING_REQUIRED', t)).toBe(
      'Missing publisher mapping',
    );
  });

  it('maps mapping skips by long label text', () => {
    expect(
      formatLastBlockedSummary(
        'No enabled source→publisher mapping exists. Create a mapping in Telegram Publisher before routing.',
        null,
        t,
      ),
    ).toBe('Missing publisher mapping');
  });

  it('falls back to see delivery history for other blocked reasons', () => {
    expect(formatLastBlockedSummary('Publisher disabled', 'PUBLISHER_DISABLED', t)).toBe(
      'See delivery history',
    );
  });

  it('returns em dash when no block reason', () => {
    expect(formatLastBlockedSummary(null, null, t)).toBe('—');
  });

  it('never returns punctuation-only values', () => {
    const result = formatLastBlockedSummary('blocked', 'UNKNOWN_CODE', t);
    expect(result).not.toBe('!');
    expect(result.trim().length).toBeGreaterThan(1);
  });
});
