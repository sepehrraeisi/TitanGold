/**
 * @jest-environment node
 */

import {
  classifyCiphertext,
  decryptCompatibleSecret,
  encryptLegacySecret,
  encryptManagedSecret,
  encryptMk2Secret,
  getCurrentMasterKey,
  getMasterKeyWriteMode,
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
    delete process.env.MASTER_KEY_WRITE_MODE;
  });

  afterAll(() => {
    process.env.MASTER_KEY = originalMasterKey;
    process.env.MASTER_KEY_PREVIOUS = originalPreviousKey;
  });

  test('compatibility deployment default writes legacy', () => {
    delete process.env.MASTER_KEY_PREVIOUS;
    const encrypted = encryptManagedSecret('fake-secret');
    expect(isLegacyEnvelope(encrypted)).toBe(true);
    expect(classifyCiphertext(encrypted)).toBe('legacy');
    expect(decryptCompatibleSecret(encrypted)).toBe('fake-secret');
  });

  test('explicit mk2 mode writes mk2 envelope and decrypts with current key', () => {
    process.env.MASTER_KEY_WRITE_MODE = 'mk2';
    const encrypted = encryptManagedSecret('fake-secret');
    expect(isMk2Envelope(encrypted)).toBe(true);
    expect(classifyCiphertext(encrypted)).toBe('mk2');
    expect(decryptCompatibleSecret(encrypted)).toBe('fake-secret');
  });

  test('legacy payload decrypts through previous-key path after cutover', () => {
    process.env.MASTER_KEY = legacyKey;
    delete process.env.MASTER_KEY_PREVIOUS;
    const legacy = encryptLegacySecret('legacy-only');

    process.env.MASTER_KEY = currentKey;
    process.env.MASTER_KEY_PREVIOUS = legacyKey;
    expect(isLegacyEnvelope(legacy)).toBe(true);
    expect(classifyCiphertext(legacy)).toBe('legacy');
    expect(decryptCompatibleSecret(legacy)).toBe('legacy-only');
  });

  test('legacy decrypt falls back to current key when previous key is unset', () => {
    process.env.MASTER_KEY = legacyKey;
    delete process.env.MASTER_KEY_PREVIOUS;
    const legacy = encryptLegacySecret('same-key');
    expect(decryptCompatibleSecret(legacy)).toBe('same-key');
  });

  test('legacy decrypt fails closed when wrong previous key is configured', () => {
    process.env.MASTER_KEY = legacyKey;
    delete process.env.MASTER_KEY_PREVIOUS;
    const legacy = encryptLegacySecret('wrong-key');

    process.env.MASTER_KEY = currentKey;
    process.env.MASTER_KEY_PREVIOUS = '1111111111111111111111111111111111111111111111111111111111111111';
    expect(() => decryptCompatibleSecret(legacy)).toThrow('Decryption failed');
  });

  test('pre-cutover legacy write survives NEW/PREVIOUS cutover', () => {
    process.env.MASTER_KEY = legacyKey;
    delete process.env.MASTER_KEY_PREVIOUS;
    const preCutover = encryptManagedSecret('survives-cutover');

    process.env.MASTER_KEY = currentKey;
    process.env.MASTER_KEY_PREVIOUS = legacyKey;
    process.env.MASTER_KEY_WRITE_MODE = 'mk2';
    const postCutover = encryptManagedSecret('new-secret');

    expect(decryptCompatibleSecret(preCutover)).toBe('survives-cutover');
    expect(decryptCompatibleSecret(postCutover)).toBe('new-secret');
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

  test('invalid write mode fails closed', () => {
    process.env.MASTER_KEY_WRITE_MODE = 'bad-mode';
    expect(() => getMasterKeyWriteMode()).toThrow('MASTER_KEY_WRITE_MODE must be one of: legacy, mk2');
    expect(() => encryptManagedSecret('bad-mode-secret')).toThrow('MASTER_KEY_WRITE_MODE must be one of: legacy, mk2');
  });
});
