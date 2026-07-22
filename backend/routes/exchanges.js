/**
 * /connections/exchanges compatibility + containment (CONNECTIONS-WP1A).
 * - No plaintext credential write/read
 * - MEXC delegates to canonical encrypted service
 * - Unsupported providers fail closed
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
  ConnectionServiceError,
  LISTED_PROVIDERS,
  CANONICAL_PROVIDER,
} from '../services/exchangeConnectionService.js';

const router = express.Router();
const mutationLimiter = rateLimit({ limit: 20, windowMs: 60_000 });
const testLimiter = rateLimit({ limit: 10, windowMs: 60_000 });

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

function toLegacyCompatibleDto(dto) {
  return {
    exchange: dto.provider,
    provider: dto.provider,
    // Never return stored secrets or ciphertext
    apiKey: dto.maskedKeyIdentifier || '',
    apiSecret: '',
    isConnected: false,
    isTestnet: dto.isTestnet,
    lastSyncAt: dto.lastSyncAt,
    permissions: [],
    accountInfo: {},
    configured: dto.configured,
    credentialStatus: dto.credentialStatus,
    status: dto.status,
    secretReentryRequired: dto.secretReentryRequired,
    privateAuthVerified: Boolean(dto.privateAuthVerified),
    maskedKeyIdentifier: dto.maskedKeyIdentifier || null,
    createdAt: dto.createdAt || null,
    updatedAt: dto.updatedAt || null,
    id: dto.id,
  };
}

router.get(
  '/',
  authenticate,
  requireCapability(CAP.CONNECTIONS_READ),
  async (req, res) => {
    try {
      const connections = await listConnectionsForUser(req.user.id);
      return res.json({ connections: connections.map(toLegacyCompatibleDto) });
    } catch (error) {
      return handleServiceError(res, error, 'Failed to fetch exchange connections');
    }
  },
);

// Health status — metadata only, no polling loop amplification from invalid sessions
router.get(
  '/health/status',
  authenticate,
  requireCapability(CAP.CONNECTIONS_READ),
  async (req, res) => {
    try {
      const connections = await listConnectionsForUser(req.user.id);
      const health = connections
        .filter((c) => c.configured)
        .map((c) => ({
          exchange: c.provider,
          status: c.secretReentryRequired
            ? 'reentry_required'
            : (c.credentialStatus || 'configured_unverified'),
          lastSync: c.lastSyncAt,
          minutesSinceSync: null,
          accountInfo: {},
          privateAuthVerified: false,
        }));
      return res.json({ health });
    } catch (error) {
      return handleServiceError(res, error, 'Failed to fetch health status');
    }
  },
);

router.get(
  '/:exchange',
  authenticate,
  requireCapability(CAP.CONNECTIONS_READ),
  async (req, res) => {
    try {
      const connection = await getConnectionForUser(req.user.id, req.params.exchange);
      return res.json(toLegacyCompatibleDto(connection));
    } catch (error) {
      return handleServiceError(res, error, 'Failed to fetch connection settings');
    }
  },
);

router.post(
  '/:exchange',
  authenticate,
  requireCapability(CAP.CONNECTIONS_MANAGE),
  mutationLimiter,
  async (req, res) => {
    try {
      const exchange = req.params.exchange;
      if (exchange !== CANONICAL_PROVIDER && !LISTED_PROVIDERS.includes(exchange)) {
        return connectionError(
          res,
          400,
          CONNECTION_ERROR.CONNECTION_PROVIDER_UNSUPPORTED,
          'Unsupported exchange',
          { supported: LISTED_PROVIDERS },
        );
      }
      if (exchange !== CANONICAL_PROVIDER) {
        return connectionError(
          res,
          400,
          CONNECTION_ERROR.CONNECTION_PROVIDER_UNSUPPORTED,
          `${exchange} credential persistence is not available in this release`,
          { provider: exchange, supported: [CANONICAL_PROVIDER] },
        );
      }

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
        permissions: [],
        accountInfo: {},
        connection: toLegacyCompatibleDto(connection),
      });
    } catch (error) {
      return handleServiceError(res, error, 'Failed to save connection settings');
    }
  },
);

router.post(
  '/:exchange/test',
  authenticate,
  requireCapability(CAP.CONNECTIONS_TEST),
  testLimiter,
  async (req, res) => {
    try {
      // Do not use request-body secrets for private provider calls in WP1A.
      const result = await recordUntestedConnectionProbe({
        userId: req.user.id,
        provider: req.params.exchange,
        ...requestMeta(req),
      });
      return res.status(200).json(result);
    } catch (error) {
      return handleServiceError(res, error, 'Failed to test connection');
    }
  },
);

router.delete(
  '/:exchange',
  authenticate,
  requireCapability(CAP.CONNECTIONS_MANAGE),
  mutationLimiter,
  async (req, res) => {
    try {
      if (req.params.exchange !== CANONICAL_PROVIDER) {
        return connectionError(
          res,
          400,
          CONNECTION_ERROR.CONNECTION_PROVIDER_UNSUPPORTED,
          `${req.params.exchange} deletion via this path is limited to MEXC in this release`,
          { supported: [CANONICAL_PROVIDER] },
        );
      }
      const result = await deleteConnection({
        userId: req.user.id,
        provider: CANONICAL_PROVIDER,
        ...requestMeta(req),
      });
      return res.json({ ...result, message: 'MEXC connection removed' });
    } catch (error) {
      return handleServiceError(res, error, 'Failed to delete connection');
    }
  },
);

export default router;
