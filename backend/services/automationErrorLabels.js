/** Human-readable labels for automation error codes (UI + API). */

export const AUTOMATION_ERROR_LABELS = {
  PUBLISHER_DISABLED:
    'The selected Telegram Publisher is disabled. Choose an active publisher or enable it in Telegram Publisher.',
  PUBLISHER_NOT_FOUND:
    'The configured Telegram Publisher no longer exists. Edit the topic and select a valid publisher.',
  PUBLISHER_MAPPING_REQUIRED:
    'No enabled source→publisher mapping exists. Create a mapping in Telegram Publisher before routing.',
  SOURCE_ACCESS_DENIED:
    'Source access control blocked this record for the configured agent or publisher.',
  FILTER_RULE_BLOCKED:
    'A DataHub filter rule blocked this record from being published.',
  SOURCE_RECORD_NOT_FOUND:
    'The original source record is no longer available. This history entry is stale and cannot be retried.',
  LIVE_CONFIRMATION_REQUIRED:
    'Live publish requires explicit confirmation (confirm_live=true).',
  MAX_RETRIES_EXCEEDED: 'Maximum retry attempts reached for this record.',
  MANUAL_REJECTED: 'This queue item was manually rejected.',
  AUTOMATION_ERROR: 'Automation processing failed. Check publisher configuration and try a dry-run test.',
  QUEUE_ITEM_NOT_PENDING: 'This queue item is no longer pending.',
  QUEUE_ITEM_PROCESSING: 'This queue item is already being processed.',
};

export function getAutomationErrorLabel(code, fallbackMessage) {
  if (!code) return fallbackMessage || 'Automation event recorded';
  return AUTOMATION_ERROR_LABELS[code] || fallbackMessage || code;
}

export function isRetryAllowedForExecution(row, recordExists = null) {
  const code = row.metadata?.error_code;
  if (code === 'SOURCE_RECORD_NOT_FOUND') return false;
  if (row.status === 'skipped' || row.status === 'blocked') return false;
  if (row.status !== 'failed') return false;
  if (recordExists === false) return false;
  if (code === 'PUBLISHER_DISABLED' || code === 'PUBLISHER_MAPPING_REQUIRED') return false;
  return true;
}
