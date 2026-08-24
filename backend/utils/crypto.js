/**
 * Encryption/Decryption utilities for API secrets
 * Uses AES-256-GCM for authenticated encryption
 */

import {
  classifyCiphertext,
  decryptCompatibleSecret,
  encryptManagedSecret,
  encryptMk2Secret,
  getMasterKeyWriteMode,
  isLegacyEnvelope,
  isMk2Envelope,
  maskSecret,
} from './cryptoKeyring.js';

/**
 * Encrypt a secret (API key, token, etc.)
 * @param {string} plaintext - Plain text to encrypt
 * @returns {string} Encrypted format controlled by MASTER_KEY_WRITE_MODE
 */
export function encryptSecret(plaintext) {
  return encryptManagedSecret(plaintext);
}

/**
 * Decrypt a secret
 * @param {string} encrypted - Encrypted format: "iv:ciphertext:authTag"
 * @returns {string} Decrypted plaintext
 */
export function decryptSecret(encrypted) {
  return decryptCompatibleSecret(encrypted);
}

/**
 * Check if a string is already encrypted (has iv:ciphertext:authTag format)
 * @param {string} value - String to check
 * @returns {boolean} True if encrypted format
 */
export function isEncrypted(value) {
  const format = classifyCiphertext(value);
  return format === 'legacy' || format === 'mk2';
}

/**
 * Mask a secret for display (show only last 4 chars)
 * @param {string} secret - Secret to mask
 * @returns {string} Masked format: "***XXXX"
 */
export {
  maskSecret,
  classifyCiphertext,
  decryptCompatibleSecret,
  encryptManagedSecret,
  encryptMk2Secret,
  getMasterKeyWriteMode,
  isLegacyEnvelope,
  isMk2Envelope,
};
