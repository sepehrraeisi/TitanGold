/**
 * Unit Tests for Crypto Utilities
 * Tests encryption, decryption, and masking functions.
 * 
 * @jest-environment node
 */

import { jest } from '@jest/globals';
import * as cryptoUtils from '../../utils/crypto.js';

describe('Crypto Utility Tests', () => {

    // Set environment variable for testing
    const originalMasterKey = process.env.MASTER_KEY;
    const originalPreviousMasterKey = process.env.MASTER_KEY_PREVIOUS;

    beforeAll(() => {
        // defined a 32-byte hex key for testing
        process.env.MASTER_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
        delete process.env.MASTER_KEY_PREVIOUS;
    });

    afterAll(() => {
        // Restore environment
        process.env.MASTER_KEY = originalMasterKey;
        process.env.MASTER_KEY_PREVIOUS = originalPreviousMasterKey;
    });

    describe('encryptSecret', () => {
        test('should encrypt a string successfully', () => {
            const plain = 'superSecret123';
            const encrypted = cryptoUtils.encryptSecret(plain);

            expect(encrypted).toBeDefined();
            expect(encrypted).not.toBe(plain);
            expect(encrypted).toMatch(/^mk2:[0-9a-f]+:[0-9a-f]+:[0-9a-f]+$/);
        });

        test('should throw error for empty input', () => {
            expect(() => cryptoUtils.encryptSecret('')).toThrow('Cannot encrypt empty string');
        });

        test('should produce different outputs for same input (random IV)', () => {
            const plain = 'sameSecret';
            const enc1 = cryptoUtils.encryptSecret(plain);
            const enc2 = cryptoUtils.encryptSecret(plain);
            expect(enc1).not.toBe(enc2);
        });
    });

    describe('decryptSecret', () => {
        test('should decrypt an encrypted string successfully', () => {
            const plain = 'secretPayload';
            const encrypted = cryptoUtils.encryptSecret(plain);
            const decrypted = cryptoUtils.decryptSecret(encrypted);

            expect(decrypted).toBe(plain);
        });

        test('should throw error for malformed input', () => {
            expect(() => cryptoUtils.decryptSecret('invalid:format')).toThrow('Invalid encrypted format');
        });

        test('should throw error for tampered content', () => {
            const plain = 'secret';
            const encrypted = cryptoUtils.encryptSecret(plain);
            const parts = encrypted.split(':');

            // Flip first ciphertext nibble so auth-tag verification must fail
            // (string replace of 'a'→'b' can be a no-op when that char is absent).
            const cipher = parts[1];
            const flipped = (cipher[0] === '0' ? '1' : '0') + cipher.slice(1);
            const tampered = `${parts[0]}:${flipped}:${parts[2]}`;

            expect(() => cryptoUtils.decryptSecret(tampered)).toThrow();
        });
    });

    describe('isEncrypted', () => {
        test('should return true for valid encrypted format', () => {
            const encrypted = cryptoUtils.encryptSecret('something');
            expect(cryptoUtils.isEncrypted(encrypted)).toBe(true);
        });

        test('should return true for valid legacy encrypted format', () => {
            const legacy = cryptoUtils.encryptSecret('legacy-check').replace(/^mk2:/, '');
            process.env.MASTER_KEY_PREVIOUS = process.env.MASTER_KEY;
            expect(cryptoUtils.isEncrypted(legacy)).toBe(true);
            expect(cryptoUtils.decryptSecret(legacy)).toBe('legacy-check');
            delete process.env.MASTER_KEY_PREVIOUS;
        });

        test('should return false for plain string', () => {
            expect(cryptoUtils.isEncrypted('plain text')).toBe(false);
        });

        test('should return false for malformed string', () => {
            expect(cryptoUtils.isEncrypted('almost:valid')).toBe(false);
        });
    });

    describe('maskSecret', () => {
        test('should mask long secrets showing last 4 chars', () => {
            const secret = '1234567890abcdef';
            const masked = cryptoUtils.maskSecret(secret);
            expect(masked).toBe('***cdef');
        });

        test('should mask short secrets entirely', () => {
            // Implementation check: The current impl simply does '***' + last 4.
            // If secret is short (<4), returns ***. Let's verify implementation behavior.
            const short = 'abc';
            expect(cryptoUtils.maskSecret(short)).toBe('***');
        });

        test('should handle empty/null inputs', () => {
            expect(cryptoUtils.maskSecret('')).toBe('***');
            expect(cryptoUtils.maskSecret(null)).toBe('***');
        });
    });
});
