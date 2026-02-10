
import { describe, it, expect } from '@jest/globals';

describe('Sanity Check', () => {
    it('should match true', () => {
        expect(true).toBe(true);
    });

    it('should load schemas', async () => {
        try {
            const schemas = await import('../../schemas/dataHubSchemas.js');
            expect(schemas).toBeDefined();
        } catch (error) {
            console.error('SCHEMA IMPORT ERROR:', error);
            throw error;
        }
    });
});
