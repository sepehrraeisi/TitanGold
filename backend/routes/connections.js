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
import { verifyOwnedMexcConnection } from '../services/connections/connectionPrivateVerificationService.js';
import { buildMexcConnectionSummary, assertTier4Blocked } from '../services/connections/mexc/connectionCapabilityService.js';
import { runMexcVerificationOrchestrator } from '../services/connections/mexc/verificationOrchestrator.js';
import exchangesRouter from './exchanges.js';

const router = express.Router();

const mutationLimiter = rateLimit({ limit: 20, windowMs: 60_000 });
const testLimiter = rateLimit({ limit: 10, windowMs: 60_000 });
const privateVerifyLimiter = rateLimit({ limit: 5, windowMs: 60_000 });
const capabilityVerifyLimiter = rateLimit({ limit: 5, windowMs: 60_000 });

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
      // WP1A deferred probe (no private provider call). Kept for compatibility.
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

/**
 * CONNECTIONS-WP2A — private authentication verify.
 * Live provider call gated by CONNECTIONS_PRIVATE_VERIFY_LIVE (default off).
 * Persistence disabled (persist=false). No client credentials or base URL accepted.
 */
router.post(
  '/mexc/verify-private',
  authenticate,
  requireCapability(CAP.CONNECTIONS_TEST),
  privateVerifyLimiter,
  async (req, res) => {
    try {
      if (req.body && (req.body.apiKey || req.body.apiSecret || req.body.secret || req.body.baseUrl)) {
        return connectionError(
          res,
          400,
          CONNECTION_ERROR.CONNECTION_VALIDATION_FAILED,
          'Credential or provider URL fields are not accepted on this route',
        );
      }

      const result = await verifyOwnedMexcConnection({
        userId: req.user.id,
        provider: CANONICAL_PROVIDER,
        persist: false,
        correlationId: req.get?.('x-correlation-id') || null,
        ...requestMeta(req),
      });
      return res.status(result.httpStatus).json(result.body);
    } catch (error) {
      return handleServiceError(res, error, 'Failed to verify MEXC connection privately');
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
 * MEXC-E2E — canonical capability summary (matrix + consumers + truthful state).
 * Never returns secrets or raw provider payloads.
 */
router.get(
  '/mexc/capabilities',
  authenticate,
  requireCapability(CAP.CONNECTIONS_READ),
  async (req, res) => {
    try {
      const summary = await buildMexcConnectionSummary(req.user.id);
      return res.json(summary);
    } catch (error) {
      return handleServiceError(res, error, 'Failed to load MEXC capability summary');
    }
  },
);

router.get(
  '/mexc/consumers',
  authenticate,
  requireCapability(CAP.CONNECTIONS_READ),
  async (req, res) => {
    try {
      const summary = await buildMexcConnectionSummary(req.user.id);
      return res.json({
        provider: CANONICAL_PROVIDER,
        consumers: summary.consumers,
        runtime: summary.runtime,
      });
    } catch (error) {
      return handleServiceError(res, error, 'Failed to load MEXC consumers');
    }
  },
);

/**
 * Capability verification orchestrator.
 * Live private probes gated; Test Connection UI remains disabled until checkpoint approval.
 * Body must not include credentials or base URLs.
 */
router.post(
  '/mexc/verify-capabilities',
  authenticate,
  requireCapability(CAP.CONNECTIONS_TEST),
  capabilityVerifyLimiter,
  async (req, res) => {
    try {
      if (req.body && (req.body.apiKey || req.body.apiSecret || req.body.secret || req.body.baseUrl)) {
        return connectionError(
          res,
          400,
          CONNECTION_ERROR.CONNECTION_VALIDATION_FAILED,
          'Credential or provider URL fields are not accepted on this route',
        );
      }

      const scope = ['public', 'private_read', 'all_safe'].includes(req.body?.scope)
        ? req.body.scope
        : 'public';

      // Reject any attempt to run write / test-order scopes
      if (req.body?.includeTestOrder || req.body?.allowWrites) {
        return connectionError(
          res,
          400,
          CONNECTION_ERROR.CONNECTION_VALIDATION_FAILED,
          'Write and Test New Order probes are not authorized on this route',
        );
      }

      const result = await runMexcVerificationOrchestrator({
        userId: req.user.id,
        scope,
        persist: false,
        correlationId: req.get?.('x-correlation-id') || null,
        ...requestMeta(req),
      });
      return res.status(result.httpStatus).json(result.body);
    } catch (error) {
      return handleServiceError(res, error, 'Failed to verify MEXC capabilities');
    }
  },
);

/**
 * Explicit Tier-4 block probe for Wallet/Trading consumers (always denied).
 */
router.post(
  '/mexc/tier4/:operation',
  authenticate,
  requireCapability(CAP.CONNECTIONS_READ),
  mutationLimiter,
  async (req, res) => {
    const operation = String(req.params.operation || '');
    const blocked = assertTier4Blocked(operation);
    return res.status(403).json(blocked);
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
