/**
 * Encryption/Decryption utilities for API secrets
 * Uses AES-256-GCM for authenticated encryption
 */

import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16; // 128 bits
const AUTH_TAG_LENGTH = 16; // 128 bits

/**
 * Get encryption key from environment
 * @returns {Buffer} 32-byte key
 */
function getEncryptionKey() {
  const keyHex = process.env.MASTER_KEY;
  
  if (!keyHex) {
    throw new Error('MASTER_KEY not set in environment');
  }
  
  const key = Buffer.from(keyHex, 'hex');
  
  if (key.length !== 32) {
    throw new Error(`MASTER_KEY must be 32 bytes (64 hex chars), got ${key.length} bytes`);
  }
  
  return key;
}

/**
 * Encrypt a secret (API key, token, etc.)
 * @param {string} plaintext - Plain text to encrypt
 * @returns {string} Encrypted format: "iv:ciphertext:authTag" (all hex)
 */
export function encryptSecret(plaintext) {
  if (!plaintext) {
    throw new Error('Cannot encrypt empty string');
  }
  
  try {
    const key = getEncryptionKey();
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    
    let encrypted = cipher.update(plaintext, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();
    
    // Format: iv:ciphertext:authTag (all hex)
    return `${iv.toString('hex')}:${encrypted}:${authTag.toString('hex')}`;
  } catch (error) {
    throw new Error(`Encryption failed: ${error.message}`);
  }
}

/**
 * Decrypt a secret
 * @param {string} encrypted - Encrypted format: "iv:ciphertext:authTag"
 * @returns {string} Decrypted plaintext
 */
export function decryptSecret(encrypted) {
  if (!encrypted) {
    throw new Error('Cannot decrypt empty string');
  }
  
  try {
    const parts = encrypted.split(':');
    
    if (parts.length !== 3) {
      throw new Error('Invalid encrypted format (expected iv:ciphertext:authTag)');
    }
    
    const [ivHex, ciphertext, authTagHex] = parts;
    
    const key = getEncryptionKey();
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(ciphertext, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (error) {
    throw new Error(`Decryption failed: ${error.message}`);
  }
}

/**
 * Check if a string is already encrypted (has iv:ciphertext:authTag format)
 * @param {string} value - String to check
 * @returns {boolean} True if encrypted format
 */
export function isEncrypted(value) {
  if (!value || typeof value !== 'string') {
    return false;
  }
  
  const parts = value.split(':');
  if (parts.length !== 3) {
    return false;
  }
  
  // Check if all parts are valid hex
  const hexRegex = /^[0-9a-f]+$/i;
  return parts.every(part => hexRegex.test(part));
}

/**
 * Mask a secret for display (show only last 4 chars)
 * @param {string} secret - Secret to mask
 * @returns {string} Masked format: "***XXXX"
 */
export function maskSecret(secret) {
  if (!secret || secret.length < 4) {
    return '***';
  }
  
  return '***' + secret.slice(-4);
}
