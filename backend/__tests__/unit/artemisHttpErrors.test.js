/**
 * @jest-environment node
 */
import { describe, expect, it, jest } from '@jest/globals';

jest.unstable_mockModule('../../services/logger.js', () => ({
  logger: { error: jest.fn(), warn: jest.fn(), info: jest.fn() },
}));

const { ARTEMIS_READINESS_ERROR, sendArtemisInternalError } = await import('../../services/artemisHttpErrors.js');

describe('Artemis sanitized HTTP errors', () => {
  it('returns a stable 500 without internal exception text', () => {
    const res = {
      statusCode: null,
      body: null,
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(body) {
        this.body = body;
        return this;
      },
    };

    sendArtemisInternalError(
      res,
      ARTEMIS_READINESS_ERROR,
      new Error('relation "system_logs" does not exist'),
    );

    expect(res.statusCode).toBe(500);
    expect(res.body).toEqual({ error: 'Failed to build Artemis readiness' });
    expect(JSON.stringify(res.body)).not.toMatch(/system_logs/);
    expect(JSON.stringify(res.body)).not.toMatch(/does not exist/);
    expect(res.body.message).toBeUndefined();
    expect(res.body.stack).toBeUndefined();
  });
});
