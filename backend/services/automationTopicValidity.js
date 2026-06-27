import { query } from '../database/db.js';

/**
 * Topic validity statuses exposed to UI.
 * valid | disabled_publisher | missing_mapping | disabled | no_candidates
 */
export async function loadPublisherValidityMaps(publisherIds = []) {
  const uniqueIds = [...new Set((publisherIds || []).filter(Boolean))];
  if (uniqueIds.length === 0) {
    return { publishersById: new Map(), mappingCountByPublisher: new Map() };
  }
  const [publishers, mappings] = await Promise.all([
    query(
      `SELECT id, name, is_active FROM telegram_publishers WHERE id = ANY($1::uuid[])`,
      [uniqueIds],
    ),
    query(
      `SELECT publisher_id, COUNT(*)::int AS enabled_count
       FROM datahub_publisher_source_mappings
       WHERE publisher_id = ANY($1::uuid[]) AND is_enabled = true
       GROUP BY publisher_id`,
      [uniqueIds],
    ),
  ]);
  return {
    publishersById: new Map(publishers.rows.map(row => [String(row.id), row])),
    mappingCountByPublisher: new Map(
      mappings.rows.map(row => [String(row.publisher_id), Number(row.enabled_count || 0)]),
    ),
  };
}

export function evaluateTopicValidity(topic, { publishersById, mappingCountByPublisher } = {}) {
  const publisherIds = topic.publisherTargets || [];
  const publishers = publishersById || new Map();
  const mappingCounts = mappingCountByPublisher || new Map();

  if (!topic.enabled) {
    return {
      status: 'disabled',
      valid: false,
      reasons: ['Topic is disabled'],
      repairActions: ['enable_topic'],
    };
  }
  if (publisherIds.length === 0) {
    return {
      status: 'missing_mapping',
      valid: false,
      reasons: ['No Telegram Publisher target configured'],
      repairActions: ['select_publisher', 'create_mapping'],
    };
  }

  const disabledNames = [];
  const missingIds = [];
  for (const id of publisherIds) {
    const publisher = publishers.get(String(id));
    if (!publisher) missingIds.push(id);
    else if (publisher.is_active !== true) disabledNames.push(publisher.name || id);
  }

  if (missingIds.length > 0) {
    return {
      status: 'disabled_publisher',
      valid: false,
      reasons: ['Configured publisher target was not found'],
      repairActions: ['select_publisher'],
      missingPublisherIds: missingIds,
    };
  }

  if (disabledNames.length > 0) {
    return {
      status: 'disabled_publisher',
      valid: false,
      reasons: [
        `Publisher target is disabled: ${disabledNames.join(', ')}. Select an active publisher.`,
      ],
      repairActions: ['select_publisher'],
      disabledPublishers: disabledNames,
    };
  }

  const unmapped = publisherIds.filter(id => (mappingCounts.get(String(id)) || 0) === 0);
  if (unmapped.length > 0) {
    return {
      status: 'missing_mapping',
      valid: false,
      reasons: [
        'No enabled source→publisher mapping exists for the configured publisher target.',
      ],
      repairActions: ['create_mapping', 'select_publisher'],
      unmappedPublisherIds: unmapped,
    };
  }

  return {
    status: 'valid',
    valid: true,
    reasons: [],
    repairActions: ['validate', 'test_dry_run'],
  };
}

export function computeAutomationHealth({ topics = [], queue = [], schedule = null }) {
  const validTopics = topics.filter(t => t.validity?.valid).length;
  const invalidTopics = topics.filter(t => t.enabled && !t.validity?.valid).length;
  const pending = queue.filter(q => q.status === 'pending').length;

  if (invalidTopics > 0 && topics.some(t => t.validity?.status === 'disabled_publisher')) {
    return {
      banner: 'disabled_publisher',
      label: 'Disabled publisher',
      message:
        'One or more routing topics target a disabled Telegram Publisher. Edit topics to select an active publisher.',
    };
  }
  if (invalidTopics > 0 && topics.some(t => t.validity?.status === 'missing_mapping')) {
    return {
      banner: 'missing_mapping',
      label: 'Missing mapping',
      message:
        'Publisher mapping is required before records can be queued. Create mappings in Telegram Publisher.',
    };
  }
  if (validTopics > 0 && pending === 0) {
    return {
      banner: 'manual_refresh',
      label: 'Manual refresh required',
      message:
        'Automation scheduler is manual-only. Use Refresh queue after processed data matches your topic rules.',
    };
  }
  if (validTopics === 0 && topics.length > 0) {
    return {
      banner: 'needs_setup',
      label: 'Needs setup',
      message: 'Routing topics need an active publisher and source mapping before automation can run.',
    };
  }
  if (validTopics > 0 && pending > 0) {
    return {
      banner: 'healthy',
      label: 'Ready to dispatch',
      message: `${pending} item(s) pending. Use dry-run dispatch to preview delivery without sending live Telegram messages.`,
    };
  }
  return {
    banner: 'healthy',
    label: 'Configured',
    message: schedule?.enabled
      ? 'Schedule is stored but no background worker is configured. Use manual refresh and dry-run dispatch.'
      : 'Manual only — no background worker configured. Use Refresh queue and dry-run dispatch.',
  };
}
