/**
 * Wallet currency-config access evidence vs data-contract readiness.
 *
 * Access = can the signed key call GET /api/v3/capital/config/getall successfully?
 * Data-contract = does TitanGold recognize every returned record for product use?
 *
 * These must not be overloaded onto keyGrant / verificationState alone.
 */

export const WALLET_DATA_CONTRACT_STATE = Object.freeze({
  READY: 'ready',
  WARNING: 'warning',
  INCOMPATIBLE: 'incompatible',
  UNKNOWN: 'unknown',
});

export const WALLET_PROVIDER_SCHEMA_DRIFT = 'MEXC_WALLET_PROVIDER_SCHEMA_DRIFT';

export const WALLET_SAFE_DRIFT_CATEGORIES = Object.freeze([
  'null',
  'boolean',
  'number',
  'string',
  'array',
  'object_missing_expected_fields',
  'network_list_non_array',
  'network_item_non_object',
]);

export const WALLET_ACCESS_EVIDENCE_REASON = Object.freeze({
  ENDPOINT_ACCESS_VERIFIED: 'Endpoint access verified',
  ENDPOINT_ACCESS_VERIFIED_FA: 'دسترسی خواندن اطلاعات کیف پول تأیید شد',
  SCHEMA_WARNING: 'Provider response contained an unrecognized optional record shape',
  SCHEMA_WARNING_FA: 'برخی ساختارهای اختیاری پاسخ ارائه‌دهنده هنوز شناخته نشده‌اند',
  ACCESS_VERIFIED_EN: 'Access verified',
  ACCESS_VERIFIED_FA: 'دسترسی تأیید شد',
  STRUCTURES_UNSUPPORTED_EN: 'Some optional provider response structures are not yet supported',
  STRUCTURES_UNSUPPORTED_FA: 'برخی ساختارهای اختیاری پاسخ ارائه‌دهنده هنوز پشتیبانی نمی‌شوند',
  CONSUMER_LIMITED_EN:
    'Required API permission is available, but direct currency-configuration verification is incomplete.',
  CONSUMER_LIMITED_FA:
    'مجوز موردنیاز API در دسترس است، اما تأیید مستقیم پیکربندی ارزها کامل نشده است.',
  CONSUMER_LIMITED_SECONDARY_EN: 'Some provider currency structures are not yet safely supported.',
  CONSUMER_LIMITED_SECONDARY_FA:
    'برخی ساختارهای اطلاعات ارز ارائه‌دهنده هنوز به‌صورت ایمن پشتیبانی نمی‌شوند.',
});

/**
 * Classify whether sanitized Probe-4 telemetry proves endpoint access.
 * Does not inspect raw bodies. Ambiguous/missing material conditions → insufficient.
 *
 * @param {object} evidence sanitized telemetry / outcome fields only
 */
export function classifyWalletAccessEvidence(evidence = {}) {
  const e = evidence || {};
  const code = String(e.errorCode || e.code || e.lastFailureCode || '');
  const abortLimit = e.abortLimit ?? null;
  const topLevelType = e.topLevelType ?? null;
  const parserCompleted = e.parserCompleted;
  const httpStatus = e.httpStatus;
  const httpOk = e.httpOk;
  const contentTypeAccepted = e.contentTypeAccepted;
  const contentType = e.contentType ?? e.sanitizedContentType ?? null;

  const table = [];
  const push = (condition, status, basis) => {
    table.push({ condition, status, basis });
  };

  // Explicit 2xx required — do not infer from parser side effects alone.
  const hasExplicitHttpOk = httpOk === true
    || (Number.isFinite(Number(httpStatus)) && Number(httpStatus) >= 200 && Number(httpStatus) < 300);
  push(
    'HTTP status successful 2xx',
    hasExplicitHttpOk ? 'PROVEN' : 'NOT_IN_TELEMETRY',
    hasExplicitHttpOk
      ? `httpStatus=${httpStatus}; httpOk=${httpOk}`
      : 'httpStatus/httpOk absent from persisted sanitized telemetry for this run',
  );

  const ctOk = contentTypeAccepted === true
    || (typeof contentType === 'string'
      && /application\/json|\+json|text\/json/i.test(contentType));
  push(
    'Content type accepted JSON',
    ctOk ? 'PROVEN' : 'NOT_IN_TELEMETRY',
    ctOk
      ? `contentTypeAccepted=${contentTypeAccepted}; contentType=${contentType}`
      : 'contentTypeAccepted / sanitized content type not persisted for this run',
  );

  const noEnvelope = topLevelType === 'array'
    && code !== 'MEXC_PROVIDER_ERROR_ENVELOPE'
    && !/PROVIDER_ERROR/i.test(code);
  push(
    'No provider error envelope',
    noEnvelope ? 'PROVEN' : 'NOT_PROVEN',
    noEnvelope ? `topLevelType=${topLevelType}; code=${code || 'none'}` : `topLevelType=${topLevelType}; code=${code}`,
  );

  push(
    'Top-level JSON array established',
    topLevelType === 'array' ? 'PROVEN' : 'NOT_PROVEN',
    `topLevelType=${topLevelType}`,
  );

  // Signed auth: only claim when private endpoint returned wallet array structures
  // after a signed GET without credential/signature failure codes.
  const authOk = topLevelType === 'array'
    && !/SIGNATURE|CREDENTIAL|TIMESTAMP|IP_RESTRICTED|ACCOUNT_RESTRICTED/i.test(code)
    && (e.reachedCurrencyOrNetworkStructure === true
      || code === 'MEXC_WALLET_NETWORK_ITEM_INVALID'
      || code === 'MEXC_WALLET_ITEM_INVALID'
      || code === 'MEXC_WALLET_NETWORK_LIST_INVALID'
      || code === WALLET_PROVIDER_SCHEMA_DRIFT
      || parserCompleted === true);
  push(
    'Signed authentication accepted',
    authOk ? 'PROVEN' : 'NOT_PROVEN',
    authOk
      ? 'Signed private GET yielded currency/network array structures without auth failure codes'
      : 'Insufficient sanitized evidence that authentication succeeded',
  );

  const reachedStructure = e.reachedCurrencyOrNetworkStructure === true
    || code === 'MEXC_WALLET_NETWORK_ITEM_INVALID'
    || code === 'MEXC_WALLET_ITEM_INVALID'
    || code === 'MEXC_WALLET_NETWORK_LIST_INVALID'
    || (parserCompleted === true && topLevelType === 'array');
  push(
    'Parser reached currency/network structure',
    reachedStructure ? 'PROVEN' : 'NOT_PROVEN',
    reachedStructure
      ? `code=${code || 'completed'}; abortLimit=${abortLimit}`
      : 'No sanitized signal that an item/network structure was visited',
  );

  const semanticOnly = abortLimit === 'schema'
    && /WALLET_(NETWORK_ITEM|ITEM|NETWORK_LIST)_INVALID|PROVIDER_SCHEMA_DRIFT/i.test(code);
  push(
    'Failure was semantic item validation only',
    semanticOnly || (parserCompleted === true && !code) ? 'PROVEN' : (code ? 'NOT_PROVEN' : 'N/A'),
    `code=${code || 'none'}; abortLimit=${abortLimit}`,
  );

  push(
    'JSON was not malformed',
    code !== 'MEXC_RESPONSE_MALFORMED' && abortLimit !== 'malformed' ? 'PROVEN' : 'FAILED',
    `code=${code || 'none'}`,
  );

  push(
    'Transport was not truncated',
    code !== 'MEXC_RESPONSE_TRUNCATED' && abortLimit !== 'truncated' ? 'PROVEN' : 'FAILED',
    `code=${code || 'none'}`,
  );

  push(
    'TLS and redirect checks passed',
    !/REDIRECT|NETWORK_ERROR|TLS/i.test(code) ? 'PROVEN' : 'FAILED',
    code ? `no transport integrity failure code (${code})` : 'no transport integrity failure code',
  );

  push(
    'Response-size limits did not abort',
    !/TOO_LARGE|ITEM_LIMIT|STRING_LIMIT|NESTING_LIMIT|PARSE_TIMEOUT/i.test(code)
      && abortLimit !== 'decompressed_bytes'
      && abortLimit !== 'decoded_body_bytes'
      && abortLimit !== 'compressed_bytes'
      ? 'PROVEN'
      : 'FAILED',
    `code=${code || 'none'}; abortLimit=${abortLimit}`,
  );

  push(
    'Runtime provenance remained valid',
    e.provenanceVerified === true || e.runtimeProvenanceValid === true
      ? 'PROVEN'
      : (e.provenanceVerified === false ? 'FAILED' : 'EXTERNAL'),
    e.provenanceVerified === true
      ? 'provenanceVerified=true at run time'
      : 'Provenance verified outside this row; confirm separately',
  );

  const blocking = table.filter((row) =>
    ['HTTP status successful 2xx', 'Content type accepted JSON'].includes(row.condition)
    && row.status !== 'PROVEN');

  const failedHard = table.some((row) => row.status === 'FAILED'
    && [
      'JSON was not malformed',
      'Transport was not truncated',
      'TLS and redirect checks passed',
      'Response-size limits did not abort',
    ].includes(row.condition));

  const sufficient = blocking.length === 0
    && !failedHard
    && table.find((r) => r.condition === 'Top-level JSON array established')?.status === 'PROVEN'
    && table.find((r) => r.condition === 'No provider error envelope')?.status === 'PROVEN'
    && table.find((r) => r.condition === 'Parser reached currency/network structure')?.status === 'PROVEN';

  return {
    sufficient,
    decision: sufficient ? 'EVIDENCE_SUFFICIENT' : 'EVIDENCE_INSUFFICIENT',
    missingForSufficiency: blocking.map((r) => r.condition),
    table,
    recommendedVerdict: sufficient
      ? 'READY FOR MEXC-E2E CLOSEOUT HUMAN QA'
      : 'READY FOR FINAL PROBE-4-ONLY AUTHORIZATION',
  };
}

/**
 * Evidence from the accepted reordered run Probe 4 row (sanitized only).
 * Intentionally omits httpStatus/contentType — they were not persisted.
 */
export const RUN_60513_PROBE4_SANITIZED_EVIDENCE = Object.freeze({
  runId: '60513a5f-6513-4838-9975-2bb16eba139a',
  historyRowId: '58a62159-a610-46b1-8e95-fa7f1ee67b84',
  errorCode: 'MEXC_WALLET_NETWORK_ITEM_INVALID',
  topLevelType: 'array',
  decompressedByteCategory: 'under_1MiB',
  parserCompleted: false,
  abortLimit: 'schema',
  providerAvailability: 'available',
  keyGrant: 'unknown',
  verificationState: 'verification_error',
  // Explicitly absent from persisted sanitized telemetry:
  httpStatus: null,
  httpOk: null,
  contentTypeAccepted: null,
  contentType: null,
  provenanceVerified: true,
  runtimeProvenanceValid: true,
  reachedCurrencyOrNetworkStructure: true,
  testedAt: '2026-07-21T12:37:54.124Z',
});

export function buildWalletDataContractProjection({
  dataContractState = WALLET_DATA_CONTRACT_STATE.UNKNOWN,
  dataContractWarningCode = null,
  sanitizedDataContractReason = null,
  lastDataContractCheckedAt = null,
  consumerReadiness = null,
} = {}) {
  return {
    dataContractState,
    dataContractWarningCode,
    sanitizedDataContractReason,
    lastDataContractCheckedAt,
    consumerReadiness: consumerReadiness
      || (dataContractState === WALLET_DATA_CONTRACT_STATE.READY
        ? 'ready'
        : dataContractState === WALLET_DATA_CONTRACT_STATE.WARNING
          ? 'limited'
          : dataContractState === WALLET_DATA_CONTRACT_STATE.INCOMPATIBLE
            ? 'blocked'
            : 'unknown'),
  };
}

/**
 * Persistable sanitized Probe-4 telemetry only — no raw body, coin, network, fee, or path values.
 * Future Probe-4-only runs must include httpOk + contentTypeAccepted for evidence sufficiency.
 */
export function buildSanitizedWalletProbeTelemetry(safe = {}, extras = {}) {
  const s = safe || {};
  return {
    httpStatus: Number.isFinite(Number(s.httpStatus)) ? Number(s.httpStatus) : null,
    httpOk: s.httpOk === true,
    contentTypeAccepted: s.contentTypeAccepted === true,
    sanitizedContentType: s.sanitizedContentType || null,
    topLevelType: s.topLevelType || null,
    parserCompleted: s.parserCompleted === true,
    abortLimit: s.abortLimit ?? null,
    reachedCurrencyOrNetworkStructure: s.reachedCurrencyOrNetworkStructure === true,
    schemaDriftCategories: Array.isArray(s.schemaDriftCategories)
      ? s.schemaDriftCategories.filter((c) => WALLET_SAFE_DRIFT_CATEGORIES.includes(c))
      : [],
    schemaDriftCountCategory: s.schemaDriftCountCategory || 'zero',
    decompressedByteCategory: s.decompressedByteCategory || s.decodedBodySizeCategory || null,
    decodedBodySizeCategory: s.decodedBodySizeCategory || s.decompressedByteCategory || null,
    encodedContentLengthCategory: s.encodedContentLengthCategory || null,
    bodyProcessingAbortLimit: s.bodyProcessingAbortLimit || s.abortLimit || null,
    itemCountCategory: s.itemCountCategory || null,
    networkItemCountCategory: s.networkItemCountCategory || null,
    testedAt: extras.testedAt || null,
    runId: extras.runId || extras.correlationId || null,
    errorCode: extras.errorCode || extras.code || null,
    dataContractState: extras.dataContractState || null,
    dataContractWarningCode: extras.dataContractWarningCode || null,
  };
}

export const ACCESS_SCHEMA_SEPARATION_CORRECTION = Object.freeze({
  probeId: 'wallet_currency_config_access_schema_separation',
  supersessionType: 'access_evidence_schema_warning_separation',
  runId: '60513a5f-6513-4838-9975-2bb16eba139a',
  originalFailureCode: 'MEXC_WALLET_NETWORK_ITEM_INVALID',
  originalHistoryRowId: '58a62159-a610-46b1-8e95-fa7f1ee67b84',
});
