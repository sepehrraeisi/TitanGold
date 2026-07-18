/**
 * Connections routes — CONNECTIONS-WP1A
 * Canonical MEXC path delegates to exchangeConnectionService.
 * Generic /exchanges mounted as compatibility aliases only.
 */

import express from 'express';
import { authenticate } from '../middleware/auth.js';
import { requireCapability } from '../middleware/requireCapability.js';
import { rateLimit } from '../middleware/rateLimit.js';
import { CAP } from '../services/capabilities.js';
import { logger } from '../services/logger.js';
import { CONNECTION_ERROR, connectionError } from '../services/connectionErrors.js';
import {
  listConnectionsForUser,
  getConnectionForUser,
  upsertEncryptedConnection,
  deleteConnection,
  recordUntestedConnectionProbe,
  auditLocalInsecureCopyRemoved,
  ConnectionServiceError,
  CANONICAL_PROVIDER,
} from '../services/exchangeConnectionService.js';
import exchangesRouter from './exchanges.js';

const router = express.Router();

const mutationLimiter = rateLimit({ limit: 20, windowMs: 60_000 });
const testLimiter = rateLimit({ limit: 10, windowMs: 60_000 });

function mapAuthFailure(res, err) {
  // Do not expose raw middleware payloads as provider failures.
  if (err?.code === 'TOKEN_EXPIRED' || err?.name === 'TokenExpiredError') {
    return connectionError(res, 401, CONNECTION_ERROR.APP_SESSION_EXPIRED, 'Your session expired. Please sign in again.');
  }
  return null;
}

function handleServiceError(res, error, fallbackMessage) {
  if (error instanceof ConnectionServiceError) {
    return connectionError(res, error.httpStatus, error.code, error.message, error.extra);
  }
  logger.error(fallbackMessage, { message: error.message });
  return connectionError(res, 500, CONNECTION_ERROR.CONNECTION_INTERNAL_ERROR, 'Internal connection error');
}

function requestMeta(req) {
  return {
    ipAddress: req.ip || null,
    userAgent: req.get?.('user-agent') || null,
  };
}

// Compatibility / containment aliases for MultiExchange UI
router.use('/exchanges', exchangesRouter);

// ---------- Canonical MEXC routes ----------

router.get(
  '/mexc',
  authenticate,
  requireCapability(CAP.CONNECTIONS_READ),
  async (req, res) => {
    try {
      const connection = await getConnectionForUser(req.user.id, CANONICAL_PROVIDER);
      // Compatibility shape for legacy FE while remaining secret-safe
      return res.json({
        ...connection,
        apiKey: connection.maskedKeyIdentifier || '',
        apiSecret: '',
        isConnected: false,
        isTestnet: connection.isTestnet,
        lastSyncAt: connection.lastSyncAt,
      });
    } catch (error) {
      return handleServiceError(res, error, 'Failed to fetch MEXC connection');
    }
  },
);

router.post(
  '/mexc',
  authenticate,
  requireCapability(CAP.CONNECTIONS_MANAGE),
  mutationLimiter,
  async (req, res) => {
    try {
      const { apiKey, apiSecret, isTestnet } = req.body || {};
      const connection = await upsertEncryptedConnection({
        userId: req.user.id,
        provider: CANONICAL_PROVIDER,
        apiKey,
        apiSecret,
        isTestnet,
        ...requestMeta(req),
      });
      return res.json({
        success: true,
        isConnected: false,
        message: 'Connection saved. Private authentication is pending and not yet verified.',
        code: CONNECTION_ERROR.CONNECTION_UNTESTED,
        connection,
      });
    } catch (error) {
      return handleServiceError(res, error, 'Failed to save MEXC connection');
    }
  },
);

router.post(
  '/mexc/test',
  authenticate,
  requireCapability(CAP.CONNECTIONS_TEST),
  testLimiter,
  async (req, res) => {
    try {
      // WP1A: ignore body secrets for private auth; do not call provider private APIs.
      const result = await recordUntestedConnectionProbe({
        userId: req.user.id,
        provider: CANONICAL_PROVIDER,
        ...requestMeta(req),
      });
      return res.status(200).json(result);
    } catch (error) {
      return handleServiceError(res, error, 'Failed to test MEXC connection');
    }
  },
);

router.delete(
  '/mexc',
  authenticate,
  requireCapability(CAP.CONNECTIONS_MANAGE),
  mutationLimiter,
  async (req, res) => {
    try {
      const result = await deleteConnection({
        userId: req.user.id,
        provider: CANONICAL_PROVIDER,
        ...requestMeta(req),
      });
      return res.json(result);
    } catch (error) {
      return handleServiceError(res, error, 'Failed to delete MEXC connection');
    }
  },
);

/**
 * Optional client telemetry: legacy insecure browser copy removed.
 * Never accepts secret values.
 */
router.post(
  '/security/local-copy-removed',
  authenticate,
  requireCapability(CAP.CONNECTIONS_MANAGE),
  mutationLimiter,
  async (req, res) => {
    try {
      const keysRemoved = Array.isArray(req.body?.keysRemoved) ? req.body.keysRemoved : [];
      await auditLocalInsecureCopyRemoved({
        userId: req.user.id,
        keysRemoved,
        ...requestMeta(req),
      });
      return res.json({ success: true });
    } catch (error) {
      return handleServiceError(res, error, 'Failed to audit local copy removal');
    }
  },
);

// List all (safe DTO)
router.get(
  '/',
  authenticate,
  requireCapability(CAP.CONNECTIONS_READ),
  async (req, res) => {
    try {
      const connections = await listConnectionsForUser(req.user.id);
      return res.json({ connections });
    } catch (error) {
      return handleServiceError(res, error, 'Failed to list connections');
    }
  },
);

export default router;
export { mapAuthFailure };
