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

    beforeAll(() => {
        // defined a 32-byte hex key for testing
        process.env.MASTER_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
    });

    afterAll(() => {
        // Restore environment
        process.env.MASTER_KEY = originalMasterKey;
    });

    describe('encryptSecret', () => {
        test('should encrypt a string successfully', () => {
            const plain = 'superSecret123';
            const encrypted = cryptoUtils.encryptSecret(plain);

            expect(encrypted).toBeDefined();
            expect(encrypted).not.toBe(plain);
            expect(encrypted).toMatch(/^[0-9a-f]+:[0-9a-f]+:[0-9a-f]+$/); // iv:content:tag
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

            // Tamper with the ciphertext (middle part)
            const tampered = `${parts[0]}:${parts[1].replace('a', 'b')}:${parts[2]}`;

            expect(() => cryptoUtils.decryptSecret(tampered)).toThrow();
        });
    });

    describe('isEncrypted', () => {
        test('should return true for valid encrypted format', () => {
            const encrypted = cryptoUtils.encryptSecret('something');
            expect(cryptoUtils.isEncrypted(encrypted)).toBe(true);
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
