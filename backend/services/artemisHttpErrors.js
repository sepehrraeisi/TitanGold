/**
 * Sanitized Artemis HTTP errors. Full exception stays in server logs only.
 */

import { logger } from './logger.js';

export const ARTEMIS_READINESS_ERROR = 'Failed to build Artemis readiness';

export function sendArtemisInternalError(res, publicMessage, error) {
  logger.error(publicMessage, error);
  return res.status(500).json({ error: publicMessage });
}
