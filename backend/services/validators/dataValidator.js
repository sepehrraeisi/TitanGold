import { logger } from '../logger.js';
import {
    SOURCE_TYPES,
    coerceReadModel,
    toIsoTimestamp,
} from '../normalizers/normalizedDataContract.js';

/**
 * Validates normalized data against the canonical datahub.normalized.v1 contract.
 */
export class DataValidator {
    /**
     * Structured validation result.
     * @param {Object|null|undefined} data
     * @returns {{ valid: boolean, errors: string[], warnings: string[], qualityHints: string[] }}
     */
    validateContract(data) {
        const errors = [];
        const warnings = [];
        const qualityHints = [];

        if (data == null || typeof data !== 'object') {
            return {
                valid: false,
                errors: ['normalized data is missing or not an object'],
                warnings,
                qualityHints,
            };
        }

        const view = coerceReadModel(data);
        if (!view) {
            return {
                valid: false,
                errors: ['normalized data could not be coerced to read model'],
                warnings,
                qualityHints,
            };
        }

        const title = typeof view.title === 'string' ? view.title.trim() : '';
        const content = typeof view.content === 'string' ? view.content.trim() : '';

        if (!title) {
            errors.push('title is required and must be non-empty after trim');
        }
        if (!content) {
            errors.push('content is required and must be non-empty after trim');
        }

        if (!view.sourceType || !SOURCE_TYPES.includes(view.sourceType)) {
            errors.push(
                `sourceType must be one of: ${SOURCE_TYPES.join(', ')} (got: ${view.sourceType})`,
            );
        }

        if (!view.timestamp || !toIsoTimestamp(view.timestamp, null)) {
            errors.push('timestamp is required and must be a parseable datetime');
        }

        const category =
            typeof view.category === 'string' ? view.category.trim() : '';
        if (!category) {
            errors.push('category is required and must be non-empty after trim');
        }

        if (data.version && data.version !== 'datahub.normalized.v1') {
            warnings.push(`unknown normalized_data version: ${data.version}`);
        } else if (!data.version) {
            warnings.push('normalized_data.version is missing (legacy shape)');
        }

        if (!view.language) {
            qualityHints.push('language not detected; consider setting language metadata');
        }
        if (!view.summary) {
            qualityHints.push('summary not provided');
        }
        if (view.sourceType === 'telegram' && !view.metadata?.telegramMessageId) {
            warnings.push('telegram metadata.telegramMessageId is missing');
        }
        if (!view.metadata?.normalizerVersion) {
            warnings.push('metadata.normalizerVersion is missing (pre-contract row)');
        }

        const valid = errors.length === 0;

        if (!valid) {
            logger.warn(`Validation failed: [${errors.join('; ')}]`);
        }

        return { valid, errors, warnings, qualityHints };
    }

    /**
     * Boolean validation (backward compatible with dataPipeline).
     * @param {Object} data
     * @returns {boolean}
     */
    validate(data) {
        return this.validateContract(data).valid;
    }
}

export const dataValidator = new DataValidator();
