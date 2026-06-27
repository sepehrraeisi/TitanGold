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
    expect(topicValidityLabel('disabled_publisher', t)).toBe('automation_disabled_publisher');
  });

  it('topicValidityVariant marks invalid topics as error/warning', () => {
    expect(topicValidityVariant('disabled_publisher')).toBe('error');
    expect(topicValidityVariant('missing_mapping')).toBe('warning');
    expect(topicValidityVariant('valid')).toBe('success');
  });

  it('queueEmptyMessage explains disabled publisher skip', () => {
    const msg = queueEmptyMessage(undefined, {
      reasons: [{ code: 'PUBLISHER_DISABLED', label: 'disabled', count: 3 }],
    }, t);
    expect(msg).toBe('automation_queue_empty_disabled_publisher');
  });
});
