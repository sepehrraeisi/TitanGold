import { describe, expect, it } from 'vitest';
import {
  getAutomationErrorLabel,
  queueEmptyMessage,
  topicValidityLabel,
  topicValidityVariant,
} from '../../components/ai/AIManager/tabs/DataHub/advanced/automation/automationErrorLabels';

const t = (key: string) => key;

describe('automationErrorLabels', () => {
  it('maps PUBLISHER_DISABLED to human-readable text', () => {
    expect(getAutomationErrorLabel('PUBLISHER_DISABLED')).toMatch(/disabled/i);
  });

  it('maps SOURCE_RECORD_NOT_FOUND without retry implication', () => {
    expect(getAutomationErrorLabel('SOURCE_RECORD_NOT_FOUND')).toMatch(/no longer available/i);
  });

  it('topicValidityLabel returns disabled publisher label', () => {
    const tWithLocale = (key: string) =>
      key === 'automation_disabled_publisher' ? 'Disabled publisher' : key;
    expect(topicValidityLabel('disabled_publisher', tWithLocale)).toBe('Disabled publisher');
  });

  it('topicValidityVariant marks invalid topics as error/warning', () => {
    expect(topicValidityVariant('disabled_publisher')).toBe('error');
    expect(topicValidityVariant('missing_mapping')).toBe('warning');
    expect(topicValidityVariant('valid')).toBe('success');
  });

  it('queueEmptyMessage explains disabled publisher skip', () => {
    const tWithLocale = (key: string) =>
      key === 'automation_queue_empty_disabled_publisher'
        ? 'Queue is empty because routing topics target disabled publishers.'
        : key;
    const msg = queueEmptyMessage(undefined, {
      reasons: [{ code: 'PUBLISHER_DISABLED', label: 'disabled', count: 3 }],
    }, tWithLocale);
    expect(msg).toMatch(/disabled publisher/i);
  });
});
