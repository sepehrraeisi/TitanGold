/**
 * @jest-environment node
 */

import {
  classifyCiphertext,
  decryptCompatibleSecret,
  encryptMk2Secret,
  getCurrentMasterKey,
  getPreviousMasterKey,
  isLegacyEnvelope,
  isMk2Envelope,
} from '../../utils/cryptoKeyring.js';

describe('MASTER_KEY keyring compatibility', () => {
  const originalMasterKey = process.env.MASTER_KEY;
  const originalPreviousKey = process.env.MASTER_KEY_PREVIOUS;
  const legacyKey = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
  const currentKey = 'abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789';

  beforeEach(() => {
    process.env.MASTER_KEY = currentKey;
    process.env.MASTER_KEY_PREVIOUS = legacyKey;
  });

  afterAll(() => {
    process.env.MASTER_KEY = originalMasterKey;
    process.env.MASTER_KEY_PREVIOUS = originalPreviousKey;
  });

  test('new writes use mk2 envelope and decrypt with current key', () => {
    const encrypted = encryptMk2Secret('fake-secret');
    expect(isMk2Envelope(encrypted)).toBe(true);
    expect(classifyCiphertext(encrypted)).toBe('mk2');
    expect(decryptCompatibleSecret(encrypted)).toBe('fake-secret');
  });

  test('legacy payload decrypts through previous-key path', () => {
    process.env.MASTER_KEY = legacyKey;
    delete process.env.MASTER_KEY_PREVIOUS;
    const legacy = encryptMk2Secret('legacy-only').slice(4);

    process.env.MASTER_KEY = currentKey;
    process.env.MASTER_KEY_PREVIOUS = legacyKey;
    expect(isLegacyEnvelope(legacy)).toBe(true);
    expect(classifyCiphertext(legacy)).toBe('legacy');
    expect(decryptCompatibleSecret(legacy)).toBe('legacy-only');
  });

  test('legacy decrypt falls back to current key when previous key is unset', () => {
    process.env.MASTER_KEY = legacyKey;
    delete process.env.MASTER_KEY_PREVIOUS;
    const legacy = encryptMk2Secret('same-key').slice(4);
    expect(decryptCompatibleSecret(legacy)).toBe('same-key');
  });

  test('legacy decrypt fails closed when wrong previous key is configured', () => {
    process.env.MASTER_KEY = legacyKey;
    delete process.env.MASTER_KEY_PREVIOUS;
    const legacy = encryptMk2Secret('wrong-key').slice(4);

    process.env.MASTER_KEY = currentKey;
    process.env.MASTER_KEY_PREVIOUS = '1111111111111111111111111111111111111111111111111111111111111111';
    expect(() => decryptCompatibleSecret(legacy)).toThrow('Decryption failed');
  });

  test('malformed envelope fails closed', () => {
    expect(() => decryptCompatibleSecret('mk2:not-a-real-envelope')).toThrow('Decryption failed');
    expect(classifyCiphertext('mk2:not-a-real-envelope')).toBe('malformed');
  });

  test('invalid key format fails closed', () => {
    process.env.MASTER_KEY = 'not-hex';
    expect(() => getCurrentMasterKey()).toThrow('MASTER_KEY must be 64 hex chars');

    process.env.MASTER_KEY = currentKey;
    process.env.MASTER_KEY_PREVIOUS = 'abcd';
    expect(() => getPreviousMasterKey()).toThrow('MASTER_KEY_PREVIOUS must be 32 bytes');
  });
});
