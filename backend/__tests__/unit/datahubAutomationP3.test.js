/**
 * DH-AUTOMATION-ROUTING-P3 — topic validity and refresh summary tests.
 * @jest-environment node
 */

import { jest } from '@jest/globals';

const mockQuery = jest.fn();

jest.unstable_mockModule('../../database/db.js', () => ({
  query: mockQuery,
}));

jest.unstable_mockModule('../../services/logger.js', () => ({
  logger: { warn: jest.fn(), error: jest.fn(), info: jest.fn() },
}));

jest.unstable_mockModule('../../middleware/accessControlGateway.js', () => ({
  buildAllowedAccessControl: jest.fn(() => ({})),
  enforceSourceAccess: jest.fn(async () => ({ allowed: true })),
  resolveAgentKey: jest.fn(async () => null),
  RUNTIME_AGENT_KEYS: { PUBLISHER: 'publisher' },
}));

jest.unstable_mockModule('../../services/filterRulesGateway.js', () => ({
  enforcePublishingPolicy: jest.fn(async () => ({})),
  isFilterRuleBlockedError: jest.fn(() => false),
}));

jest.unstable_mockModule('../../services/telegramPublisherService.js', () => ({
  runPublisherPublish: jest.fn(async () => ({
    success: true,
    dry_run: true,
    status: 'dry_run',
    history_id: 'hist-1',
  })),
}));

const { evaluateTopicValidity, loadPublisherValidityMaps } = await import(
  '../../services/automationTopicValidity.js'
);
const { getAutomationErrorLabel, isRetryAllowedForExecution } = await import(
  '../../services/automationErrorLabels.js'
);
const { retryAutomationExecution } = await import('../../services/datahubAutomationService.js');

describe('automation P3 validity', () => {
  test('evaluateTopicValidity flags disabled publisher', () => {
    const validity = evaluateTopicValidity(
      { enabled: true, publisherTargets: ['pub-1'] },
      {
        publishersById: new Map([['pub-1', { id: 'pub-1', name: 'Demo', is_active: false }]]),
        mappingCountByPublisher: new Map(),
      },
    );
    expect(validity.status).toBe('disabled_publisher');
    expect(validity.valid).toBe(false);
  });

  test('evaluateTopicValidity flags missing mapping', () => {
    const validity = evaluateTopicValidity(
      { enabled: true, publisherTargets: ['pub-1'] },
      {
        publishersById: new Map([['pub-1', { id: 'pub-1', name: 'Active', is_active: true }]]),
        mappingCountByPublisher: new Map([['pub-1', 0]]),
      },
    );
    expect(validity.status).toBe('missing_mapping');
  });

  test('getAutomationErrorLabel returns human text', () => {
    expect(getAutomationErrorLabel('PUBLISHER_DISABLED')).toMatch(/disabled/i);
    expect(getAutomationErrorLabel('SOURCE_RECORD_NOT_FOUND')).toMatch(/no longer available/i);
  });

  test('isRetryAllowedForExecution blocks SOURCE_RECORD_NOT_FOUND', () => {
    expect(
      isRetryAllowedForExecution(
        { status: 'failed', metadata: { error_code: 'SOURCE_RECORD_NOT_FOUND' } },
        false,
      ),
    ).toBe(false);
  });

  test('retryAutomationExecution rejects SOURCE_RECORD_NOT_FOUND', async () => {
    mockQuery.mockImplementation(async sql => {
      if (sql.includes('FROM datahub_automation_executions WHERE id')) {
        return {
          rows: [
            {
              id: 'exec-1',
              record_id: 'rec-1',
              publisher_id: 'pub-1',
              topic_id: 'topic-1',
              agent_id: null,
              payload_preview: 'x',
              metadata: { error_code: 'SOURCE_RECORD_NOT_FOUND' },
            },
          ],
        };
      }
      return { rows: [] };
    });

    await expect(
      retryAutomationExecution('exec-1', 'user-1', { dryRun: true }),
    ).rejects.toMatchObject({ code: 'SOURCE_RECORD_NOT_FOUND' });
  });
});
