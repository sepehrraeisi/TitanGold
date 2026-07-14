import { describe, expect, it } from 'vitest';
import {
  containsRawJwt,
  redactSensitiveText,
  redactSensitiveUrl,
} from '../../utils/redactSensitive.ts';

const SAMPLE_JWT =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4iLCJpYXQiOjE1MTYyMzkwMjJ9.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';

describe('redactSensitive', () => {
  it('redacts token query on absolute ws urls', () => {
    const raw = `wss://titan.zala.ir/ws/agents?token=${SAMPLE_JWT}`;
    const out = redactSensitiveUrl(raw);
    expect(out).toContain('token=[REDACTED]');
    expect(out).not.toContain(SAMPLE_JWT);
    expect(containsRawJwt(out)).toBe(false);
  });

  it('redacts Authorization Bearer headers in text', () => {
    const raw = `Authorization: Bearer ${SAMPLE_JWT}`;
    const out = redactSensitiveText(raw);
    expect(out).toMatch(/\[REDACTED(_JWT)?\]/);
    expect(out).not.toContain(SAMPLE_JWT);
  });

  it('redacts bare JWTs embedded in error strings', () => {
    const raw = `WebSocket connection to 'wss://titan.zala.ir/ws/agents?token=${SAMPLE_JWT}' failed`;
    const out = redactSensitiveText(raw);
    expect(out).not.toContain(SAMPLE_JWT);
    expect(containsRawJwt(out)).toBe(false);
  });
});
