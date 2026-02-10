import axios from 'axios';
import { logger } from '../logger.js';

/**
 * Fetches data from a REST API endpoint
 * @param {Object} source - The data source configuration
 * @returns {Promise<Object>} - The raw fetched data
 */
export async function fetchFromApi(source) {
    const { url, config = {} } = source;
    const { method = 'GET', headers = {}, params = {}, body = null } = config;

    try {
        logger.info(`Fetching from API: ${url}`, { sourceId: source.id });

        const authHeaders = { ...headers };
        if (source.credentials) {
            if (source.credentials.apiKey) {
                authHeaders['X-API-Key'] = source.credentials.apiKey;
            }
            if (source.credentials.token) {
                authHeaders['Authorization'] = `Bearer ${source.credentials.token}`;
            }
        }

        const response = await axios({
            method,
            url,
            headers: authHeaders,
            params,
            data: body,
            timeout: 10000 // 10 second timeout
        });

        return response.data;
    } catch (error) {
        logger.error(`API Fetch failed for ${url}: ${error.message}`, {
            sourceId: source.id,
            status: error.response?.status,
            data: error.response?.data
        });
        throw error;
    }
}
