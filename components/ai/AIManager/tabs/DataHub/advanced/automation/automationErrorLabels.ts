export const AUTOMATION_ERROR_LABELS: Record<string, string> = {
  PUBLISHER_DISABLED:
    'The selected Telegram Publisher is disabled. Choose an active publisher or enable it in Telegram Publisher.',
  PUBLISHER_NOT_FOUND:
    'The configured Telegram Publisher no longer exists. Edit the topic and select a valid publisher.',
  PUBLISHER_MAPPING_REQUIRED:
    'No enabled source→publisher mapping exists. Create a mapping in Telegram Publisher before routing.',
  SOURCE_ACCESS_DENIED:
    'Source access control blocked this record for the configured agent or publisher.',
  FILTER_RULE_BLOCKED: 'A DataHub filter rule blocked this record from being published.',
  SOURCE_RECORD_NOT_FOUND:
    'The original source record is no longer available. This history entry is stale and cannot be retried.',
  LIVE_CONFIRMATION_REQUIRED:
    'Live publish requires explicit confirmation (confirm_live=true).',
  MAX_RETRIES_EXCEEDED: 'Maximum retry attempts reached for this record.',
  MANUAL_REJECTED: 'This queue item was manually rejected.',
  AUTOMATION_ERROR: 'Automation processing failed. Check publisher configuration and try a dry-run test.',
};

export function getAutomationErrorLabel(code?: string | null, fallback?: string | null): string {
  if (!code) return fallback || 'Automation event recorded';
  return AUTOMATION_ERROR_LABELS[code] || fallback || code;
}

export type TopicValidityStatus =
  | 'valid'
  | 'disabled_publisher'
  | 'missing_mapping'
  | 'disabled'
  | 'no_candidates';

export function topicValidityLabel(status: TopicValidityStatus, t: (k: string) => string): string {
  const map: Record<TopicValidityStatus, string> = {
    valid: t('automation_valid') || 'Valid',
    disabled_publisher: t('automation_disabled_publisher') || 'Disabled publisher',
    missing_mapping: t('automation_missing_mapping') || 'Missing mapping',
    disabled: t('disabled') || 'Disabled',
    no_candidates: t('automation_no_candidates') || 'No candidates',
  };
  return map[status] || status;
}

export function topicValidityVariant(
  status: TopicValidityStatus,
): 'success' | 'error' | 'warning' | 'neutral' | 'info' {
  if (status === 'valid') return 'success';
  if (status === 'disabled' || status === 'disabled_publisher') return 'error';
  if (status === 'missing_mapping' || status === 'no_candidates') return 'warning';
  return 'neutral';
}

export function queueEmptyMessage(
  healthBanner: string | undefined,
  refreshSummary: { reasons?: Array<{ code: string; label: string; count: number }> } | null,
  t: (k: string) => string,
): string {
  if (refreshSummary?.reasons?.some(r => r.code === 'PUBLISHER_DISABLED')) {
    return (
      t('automation_queue_empty_disabled_publisher') ||
      'Queue is empty because routing topics target disabled publishers. Select an active publisher to continue.'
    );
  }
  if (refreshSummary?.reasons?.some(r => r.code === 'PUBLISHER_MAPPING_REQUIRED')) {
    return (
      t('automation_queue_empty_missing_mapping') ||
      'Queue is empty because source→publisher mapping is missing. Create mappings in Telegram Publisher.'
    );
  }
  if (healthBanner === 'manual_refresh') {
    return (
      t('automation_queue_empty_manual') ||
      'Automation scheduler is manual-only. Use Refresh queue after processed data matches your routing rules.'
    );
  }
  return (
    t('automation_queue_empty_no_match') ||
    'No processed records matched active routing rules, or all candidates were skipped.'
  );
}
