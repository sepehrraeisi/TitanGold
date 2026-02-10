import { logger } from '../logger.js';

/**
 * Validates normalized data against required schema
 */
export class DataValidator {
    /**
     * Validates a normalized data item
     * @param {Object} data - Standardized data object
     * @returns {boolean} - True if valid
     */
    validate(data) {
        if (!data) return false;

        const requiredFields = ['title', 'content', 'source_type', 'timestamp'];
        const missingFields = requiredFields.filter(field => !data[field]);

        if (missingFields.length > 0) {
            logger.warn(`Validation failed: missing fields [${missingFields.join(', ')}]`, { data });
            return false;
        }

        // Basic date validation
        try {
            if (isNaN(new Date(data.timestamp).getTime())) {
                logger.warn(`Validation failed: invalid timestamp [${data.timestamp}]`);
                return false;
            }
        } catch (e) {
            return false;
        }

        return true;
    }
}

export const dataValidator = new DataValidator();
