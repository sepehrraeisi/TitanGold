/**
 * MEXC Verification Orchestrator — extends WP2A private auth adapter.
 * Fake transports by default; real private probes gated.
 * Never returns raw provider bodies to the browser.
 * Never persists balances or private payloads as Connection metadata.
 */

import crypto from 'crypto';
import { logger } from '../../logger.js';
import {
  ConnectionServiceError,
  CANONICAL_PROVIDER,
  getConnectionForUser,
  loadEncryptedMexcRowForVerification,
  withDecryptedMexcCredentials,
  writeConnectionAudit,
} from '../../exchangeConnectionService.js';
import { CONNECTION_ERROR } from '../../connectionErrors.js';
import { isPrivateVerifyLiveEnabled } from '../connectionPrivateVerificationService.js';
import { verifyMexcPrivateAccountRead } from '../providers/mexcPrivateAuthAdapter.js';
import {
  buildMexcCanonicalQuery,
  signMexcTotalParams,
  MEXC_DEFAULT_RECV_WINDOW,
} from '../providers/mexcSigning.js';
import {
  KEY_GRANT,
  VERIFICATION_STATE,
} from './capabilityIds.js';
import {
  MEXC_PROBE_CATALOG,
  PROBE_RISK,
  FORBIDDEN_PROBES,
  listProbesByRisk,
} from './probes/probeCatalog.js';
import {
  mapProviderCodeToHealthCategory,
  describeHealthCategory,
} from './errorHealthModel.js';
import {
  buildE2EHttpsUrl,
  mexcE2ESafeFetch,
} from './mexcE2ESafeTransport.js';
import { query } from '../../../database/db.js';

export function isCapabilityVerifyLiveEnabled(env = process.env) {
  return env.CONNECTIONS_CAPABILITY_VERIFY_LIVE === 'true'
    || isPrivateVerifyLiveEnabled(env);
}

function assertNotForbidden(probe) {
  for (const banned of FORBIDDEN_PROBES) {
    if (banned.path === probe.path && (!banned.method || banned.method === probe.method)) {
      throw new ConnectionServiceError(
        CONNECTION_ERROR.CONNECTION_VALIDATION_FAILED,
        `Probe forbidden: ${banned.reason}`,
        400,
      );
    }
  }
}

function sanitizeProbeResult(probe, outcome) {
  return {
    probeId: probe.id,
    capabilityId: probe.capabilityId,
    success: Boolean(outcome.success),
    verificationState: outcome.verificationState,
    keyGrant: outcome.keyGrant,
    latencyMs: outcome.latencyMs ?? null,
    code: outcome.code || null,
    sanitizedReason: outcome.sanitizedReason || null,
    healthCategory: outcome.healthCategory || null,
    correctiveAction: outcome.correctiveAction || null,
    testedAt: outcome.testedAt,
  };
}

/**
 * Adapt catalog-style fake transport {method,host,path} to WP2A {url,method,headers}.
 */
export function adaptCatalogTransportToWp2a(catalogTransport) {
  if (!catalogTransport) return null;
  return async function wp2aTransport({ url, method, headers }) {
    const parsed = new URL(url);
    const res = await catalogTransport({
      method: method || 'GET',
      host: `https://${parsed.hostname}`,
      path: parsed.pathname,
      query: Object.fromEntries(parsed.searchParams.entries()),
      headers,
      url,
    });
    return {
      status: res.status ?? (res.ok ? 200 : 400),
      bodyText: typeof res.bodyText === 'string'
        ? res.bodyText
        : JSON.stringify(res.json ?? {}),
      headers: res.headers || {},
    };
  };
}

async function runPublicProbe(probe, { transport }) {
  const started = Date.now();
  const testedAt = new Date().toISOString();

  if (transport) {
    const res = await transport({
      method: probe.method,
      host: probe.host,
      path: probe.path,
    });
    const success = Boolean(res?.ok ?? (res?.status >= 200 && res?.status < 300));
    return {
      success,
      verificationState: success ? VERIFICATION_STATE.VERIFIED : VERIFICATION_STATE.FAILED,
      keyGrant: KEY_GRANT.GRANTED,
      latencyMs: res?.latencyMs ?? Date.now() - started,
      code: success ? null : 'PUBLIC_PROBE_FAILED',
      sanitizedReason: success ? null : 'Public market probe failed',
      healthCategory: success ? null : 'network',
      testedAt,
    };
  }

  const url = buildE2EHttpsUrl(probe.host, probe.path);
  const res = await mexcE2ESafeFetch({
    url,
    method: 'GET',
    timeoutMs: probe.timeoutMs,
    maxBytes: probe.maxResponseBytes,
  });
  return {
    success: Boolean(res.ok),
    verificationState: res.ok ? VERIFICATION_STATE.VERIFIED : VERIFICATION_STATE.FAILED,
    keyGrant: KEY_GRANT.GRANTED,
    latencyMs: res.latencyMs ?? Date.now() - started,
    code: res.ok ? null : 'PUBLIC_PROBE_FAILED',
    sanitizedReason: res.ok ? null : 'Public market probe failed',
    healthCategory: res.ok ? null : 'network',
    testedAt,
  };
}

async function runPrivateReadProbe(probe, { apiKey, apiSecret, transport, now }) {
  const testedAt = new Date().toISOString();

  if (probe.path === '/api/v3/account') {
    const wp2aTransport = adaptCatalogTransportToWp2a(transport);
    const adapterResult = await verifyMexcPrivateAccountRead({
      apiKey,
      apiSecret,
      transport: wp2aTransport || undefined,
      now,
    });
    const success = Boolean(adapterResult.authenticated);
    const healthCategory = success
      ? null
      : mapProviderCodeToHealthCategory(adapterResult.normalizedErrorCode);
    const health = healthCategory
      ? describeHealthCategory(healthCategory, { affectedCapability: probe.capabilityId })
      : null;
    const permissionDenied =
      adapterResult.accountReadPermission === 'denied'
      || adapterResult.normalizedErrorCode === 'MEXC_PERMISSION_INSUFFICIENT';
    return {
      success,
      verificationState: success ? VERIFICATION_STATE.VERIFIED : VERIFICATION_STATE.FAILED,
      keyGrant: success
        ? KEY_GRANT.GRANTED
        : (permissionDenied ? KEY_GRANT.DENIED : KEY_GRANT.UNKNOWN),
      latencyMs: adapterResult.latencyMs,
      code: adapterResult.normalizedErrorCode,
      sanitizedReason: adapterResult.sanitizedMessage,
      healthCategory,
      correctiveAction: health?.correctiveAction || adapterResult.correctiveAction,
      testedAt: adapterResult.testedAt || testedAt,
    };
  }

  // Futures private live signing deferred to checkpoint (architecture ready; not executed)
  if (String(probe.host).includes('contract.mexc.com') && !transport) {
    return {
      success: false,
      verificationState: VERIFICATION_STATE.NOT_TESTED,
      keyGrant: KEY_GRANT.UNKNOWN,
      latencyMs: null,
      code: 'FUTURES_PROBE_PENDING_AUTHORIZATION',
      sanitizedReason: 'Futures private probe requires controlled read-only authorization',
      healthCategory: 'runtime_blocked',
      testedAt,
    };
  }

  const timestamp = Math.trunc((now || (() => Date.now()))());
  const params = {
    ...(probe.query || {}),
    timestamp,
    recvWindow: MEXC_DEFAULT_RECV_WINDOW,
  };
  const total = buildMexcCanonicalQuery(params);
  const signature = signMexcTotalParams(apiSecret, total);
  const signedQuery = `${total}&signature=${signature}`;

  if (transport) {
    const res = await transport({
      method: probe.method,
      host: probe.host,
      path: probe.path,
      query: params,
      headers: { 'X-MEXC-APIKEY': apiKey },
    });
    const success = Boolean(res?.ok ?? (res?.status >= 200 && res?.status < 300));
    const providerCode = res?.json?.code;
    return {
      success,
      verificationState: success ? VERIFICATION_STATE.VERIFIED : VERIFICATION_STATE.FAILED,
      keyGrant: success
        ? KEY_GRANT.GRANTED
        : (providerCode === 700007 ? KEY_GRANT.DENIED : KEY_GRANT.UNKNOWN),
      latencyMs: res?.latencyMs ?? null,
      code: success ? null : String(providerCode || 'PRIVATE_PROBE_FAILED'),
      sanitizedReason: success ? null : 'Private read probe failed',
      healthCategory: success ? null : mapProviderCodeToHealthCategory(providerCode),
      testedAt,
    };
  }

  const url = buildE2EHttpsUrl(probe.host, probe.path, signedQuery);
  const res = await mexcE2ESafeFetch({
    url,
    method: 'GET',
    timeoutMs: probe.timeoutMs,
    maxBytes: probe.maxResponseBytes,
    headers: {
      'X-MEXC-APIKEY': apiKey,
      Accept: 'application/json',
    },
  });
  let json = null;
  try {
    json = JSON.parse(res.bodyText || '{}');
  } catch {
    json = null;
  }
  const providerCode = json?.code;
  const success = Boolean(res.ok) && (providerCode == null || providerCode === 0 || json?.balances != null || Array.isArray(json));
  return {
    success,
    verificationState: success ? VERIFICATION_STATE.VERIFIED : VERIFICATION_STATE.FAILED,
    keyGrant: success
      ? KEY_GRANT.GRANTED
      : (providerCode === 700007 ? KEY_GRANT.DENIED : KEY_GRANT.UNKNOWN),
    latencyMs: res.latencyMs,
    code: success ? null : String(providerCode || 'PRIVATE_PROBE_FAILED'),
    sanitizedReason: success ? null : 'Private read probe failed',
    healthCategory: success ? null : mapProviderCodeToHealthCategory(providerCode),
    testedAt,
  };
}

async function persistSafeCapabilityResults({
  connectionId,
  ownerId,
  correlationId,
  results,
  persist,
}) {
  if (!persist || !connectionId) return { persisted: false, rows: 0 };

  let rows = 0;
  for (const result of results) {
    await query(
      `INSERT INTO mexc_capability_verifications (
         connection_id, owner_id, capability_id, probe_id, correlation_id,
         key_grant, verification_state,
         last_failure_code, sanitized_reason, source_of_evidence, latency_ms, tested_at
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::timestamptz)`,
      [
        connectionId,
        ownerId,
        result.capabilityId,
        result.probeId,
        correlationId,
        result.keyGrant,
        result.verificationState,
        result.code,
        result.sanitizedReason,
        'orchestrator_probe',
        result.latencyMs,
        result.testedAt,
      ],
    );

    await query(
      `INSERT INTO mexc_connection_capability_state (
         connection_id, owner_id, capability_id, key_grant, verification_state,
         last_verified_at, last_failure_code, sanitized_reason, source_of_evidence, updated_at
       ) VALUES ($1,$2,$3,$4,$5,$6::timestamptz,$7,$8,$9,NOW())
       ON CONFLICT (connection_id, capability_id) DO UPDATE SET
         key_grant = EXCLUDED.key_grant,
         verification_state = EXCLUDED.verification_state,
         last_verified_at = COALESCE(EXCLUDED.last_verified_at, mexc_connection_capability_state.last_verified_at),
         last_failure_code = EXCLUDED.last_failure_code,
         sanitized_reason = EXCLUDED.sanitized_reason,
         source_of_evidence = EXCLUDED.source_of_evidence,
         updated_at = NOW()`,
      [
        connectionId,
        ownerId,
        result.capabilityId,
        result.keyGrant,
        result.verificationState,
        result.success ? result.testedAt : null,
        result.code,
        result.sanitizedReason,
        'orchestrator_probe',
      ],
    );
    rows += 1;
  }

  return { persisted: true, rows };
}

export async function runMexcVerificationOrchestrator(opts = {}) {
  const {
    userId,
    scope = 'public',
    persist = false,
    allowProviderCall,
    transport = null,
    probeIds = null,
    correlationId = null,
    ipAddress = null,
    userAgent = null,
    now = () => Date.now(),
  } = opts;

  const corr = correlationId || crypto.randomUUID();
  const live = allowProviderCall ?? isCapabilityVerifyLiveEnabled();

  const connection = await getConnectionForUser(userId, CANONICAL_PROVIDER);
  if (!connection?.configured && (scope === 'private_read' || scope === 'all_safe')) {
    throw new ConnectionServiceError(
      CONNECTION_ERROR.CONNECTION_NOT_CONFIGURED,
      'MEXC connection is not configured',
      404,
    );
  }

  let maxRisk = PROBE_RISK.PUBLIC;
  if (scope === 'private_read' || scope === 'all_safe') maxRisk = PROBE_RISK.PRIVATE_READ;

  let probes = listProbesByRisk(maxRisk);
  if (Array.isArray(probeIds) && probeIds.length) {
    probes = MEXC_PROBE_CATALOG.filter((p) => probeIds.includes(p.id));
  }

  for (const probe of probes) assertNotForbidden(probe);

  const privateProbes = probes.filter((p) => p.risk >= PROBE_RISK.PRIVATE_READ);
  if (privateProbes.length && !live && !transport) {
    await writeConnectionAudit({
      userId,
      action: 'mexc_capability_verify_blocked_not_live',
      entityId: connection?.id || null,
      newValue: { correlationId: corr, scope, probeCount: privateProbes.length },
      ipAddress,
      userAgent,
    }).catch(() => {});

    return {
      httpStatus: 200,
      body: {
        success: false,
        code: 'CONNECTION_CAPABILITY_VERIFY_NOT_LIVE',
        message: 'Capability verification against real MEXC is not enabled. Use fake transports in tests.',
        correlationId: corr,
        scope,
        results: [],
        decryptCount: 0,
        signCount: 0,
        transportCount: 0,
        persisted: false,
        realSideEffectsPossible: false,
      },
    };
  }

  const results = [];
  let decryptCount = 0;
  let signCount = 0;
  let transportCount = 0;

  for (const probe of probes.filter((p) => p.risk === PROBE_RISK.PUBLIC)) {
    try {
      const outcome = await runPublicProbe(probe, { transport });
      transportCount += 1;
      results.push(sanitizeProbeResult(probe, outcome));
    } catch (err) {
      logger.warn('Public probe failed', { probeId: probe.id, message: err.message, correlationId: corr });
      results.push(sanitizeProbeResult(probe, {
        success: false,
        verificationState: VERIFICATION_STATE.FAILED,
        keyGrant: KEY_GRANT.GRANTED,
        code: 'PUBLIC_PROBE_ERROR',
        sanitizedReason: 'Public market probe error',
        healthCategory: 'network',
        testedAt: new Date().toISOString(),
      }));
    }
  }

  const needPrivate = probes.some((p) => p.risk >= PROBE_RISK.PRIVATE_READ);
  if (needPrivate) {
    const row = await loadEncryptedMexcRowForVerification(userId);
    if (!row) {
      throw new ConnectionServiceError(
        CONNECTION_ERROR.CONNECTION_NOT_CONFIGURED,
        'MEXC connection is not configured',
        404,
      );
    }

    await withDecryptedMexcCredentials(row, async ({ apiKey, apiSecret }) => {
      decryptCount += 1;
      for (const probe of probes.filter((p) => p.risk >= PROBE_RISK.PRIVATE_READ)) {
        const countingTransport = transport
          ? async (req) => {
            transportCount += 1;
            if (probe.auth === 'HMAC-SHA256' || probe.auth === 'futures_signature') {
              signCount += 1;
            }
            return transport(req);
          }
          : null;

        if (!countingTransport && live) {
          signCount += 1;
          transportCount += 1;
        }

        const outcome = await runPrivateReadProbe(probe, {
          apiKey,
          apiSecret,
          transport: countingTransport,
          now,
        });
        results.push(sanitizeProbeResult(probe, outcome));
      }
    });
  }

  const persistResult = await persistSafeCapabilityResults({
    connectionId: connection?.id || null,
    ownerId: userId,
    correlationId: corr,
    results,
    persist: Boolean(persist && connection?.id),
  });

  await writeConnectionAudit({
    userId,
    action: 'mexc_capability_verify_run',
    entityId: connection?.id || null,
    newValue: {
      correlationId: corr,
      scope,
      probeIds: results.map((r) => r.probeId),
      successes: results.filter((r) => r.success).map((r) => r.capabilityId),
      failures: results.filter((r) => !r.success).map((r) => ({
        capabilityId: r.capabilityId,
        code: r.code,
      })),
      persisted: persistResult.persisted,
    },
    ipAddress,
    userAgent,
  }).catch(() => {});

  return {
    httpStatus: 200,
    body: {
      success: results.length > 0 && results.every((r) => r.success),
      correlationId: corr,
      scope,
      results,
      decryptCount,
      signCount,
      transportCount,
      persisted: persistResult.persisted,
      realSideEffectsPossible: false,
      excluded: FORBIDDEN_PROBES.map((f) => f.reason),
      note: 'No balances or raw provider payloads are returned or persisted',
    },
  };
}

export function getCheckpointProposal(connectionDto) {
  const privateProbes = MEXC_PROBE_CATALOG.filter((p) => p.requiresLiveGate);
  return {
    connection: {
      connectionId: connectionDto?.id || null,
      provider: CANONICAL_PROVIDER,
      configured: Boolean(connectionDto?.configured),
      credentialStatus: connectionDto?.credentialStatus || null,
      maskedKeyIdentifier: connectionDto?.maskedKeyIdentifier || null,
    },
    credentialSource: 'canonical encrypted server store (exchange_connections)',
    proposedReadOnlyEndpoints: privateProbes.map((p, idx) => ({
      order: idx + 1,
      probeId: p.id,
      capabilityId: p.capabilityId,
      method: p.method,
      host: p.host,
      path: p.path,
      expectedPermission: p.officialPermission,
      timeoutMs: p.timeoutMs,
      maxResponseBytes: p.maxResponseBytes,
      query: p.query || null,
      persistFields: p.persistFields,
    })),
    excludedUntilSeparateApproval: [
      'POST /api/v3/order/test (Spot Test New Order)',
      'POST /api/v3/order',
      'POST /api/v3/capital/withdraw',
      'POST /api/v3/capital/transfer',
      'POST /api/v1/private/order/submit',
    ],
    statusTransitionOnSuccess: {
      PRIVATE_AUTH: 'authenticated / keyGrant=granted / verificationState=verified',
      otherPrivateReads: 'per-capability verified without granting unrelated write capabilities',
    },
    rollbackResetPlan: [
      'Set CONNECTIONS_CAPABILITY_VERIFY_LIVE=false and CONNECTIONS_PRIVATE_VERIFY_LIVE=false',
      'DELETE FROM mexc_capability_verifications WHERE correlation_id = <id>',
      'UPDATE mexc_connection_capability_state SET verification_state=not_tested, key_grant=unknown WHERE connection_id=<id>',
      'No credential plaintext is ever written; rotation remains via Connections UI',
    ],
    proofNoFinancialMutation: {
      orchestratorForbiddenPaths: FORBIDDEN_PROBES,
      maxProbeRisk: 'PRIVATE_READ',
      testNewOrderIncluded: false,
      withdrawalIncluded: false,
      transferExecuteIncluded: false,
      futuresOrderIncluded: false,
    },
    userNeedNotPasteSecret: true,
  };
}
