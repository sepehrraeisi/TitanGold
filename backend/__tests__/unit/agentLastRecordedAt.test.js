/**
 * @jest-environment node
 */
import { describe, expect, it } from '@jest/globals';

function resolveAgentLastRecordedAt(agent, decisionStats = {}) {
  const fromDecisions = decisionStats.last_completed_at || null;
  const fromActive = agent?.last_active_at || null;
  const total = parseInt(decisionStats.total, 10) || 0;
  if (fromDecisions) return fromDecisions;
  if (total > 0 && fromActive) return fromActive;
  if (fromActive) return fromActive;
  return null;
}

describe('resolveAgentLastRecordedAt', () => {
  it('prefers ai_decisions last_completed_at over updated_at', () => {
    const at = '2026-07-14T08:30:00.000Z';
    expect(
      resolveAgentLastRecordedAt(
        { updated_at: '2026-01-03T00:00:00.000Z', last_active_at: null },
        { total: 11, last_completed_at: at },
      ),
    ).toBe(at);
  });

  it('returns null when no persisted run evidence exists', () => {
    expect(
      resolveAgentLastRecordedAt(
        { updated_at: '2026-01-03T00:00:00.000Z', last_active_at: null },
        { total: 0 },
      ),
    ).toBeNull();
  });
});
