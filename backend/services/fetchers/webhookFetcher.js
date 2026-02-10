import { logger } from '../logger.js';

/**
 * Processes data received via a Webhook
 * @param {Object} source - The data source configuration
 * @param {Object} payload - The received webhook payload
 * @returns {Promise<Object>} - The normalized data
 */
export async function processWebhookData(source, payload) {
    try {
        logger.info(`Processing Webhook data for source: ${source.id}`);

        // Webhook data is already "fetched" (pushed to us)
        // We just ensure it's in a format we can store.

        return {
            receivedAt: new Date().toISOString(),
            payload: payload,
            sourceType: source.type
        };
    } catch (error) {
        logger.error(`Webhook processing failed for source ${source.id}: ${error.message}`);
        throw error;
    }
}
