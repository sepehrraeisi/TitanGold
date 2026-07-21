/**
 * Wallet access evidence vs data-contract separation.
 * @jest-environment node
 */

import { jest } from '@jest/globals';

const query = jest.fn(async () => ({ rows: [] }));
jest.unstable_mockModule('../../database/db.js', () => ({ query }));

const {
  classifyWalletAccessEvidence,
  RUN_60513_PROBE4_SANITIZED_EVIDENCE,
  WALLET_PROVIDER_SCHEMA_DRIFT,
  WALLET_ACCESS_EVIDENCE_REASON,
  buildSanitizedWalletProbeTelemetry,
  buildWalletDataContractProjection,
} = await import('../../services/connections/mexc/walletAccessEvidence.js');

const {
  applyWalletAccessSchemaSeparationCorrection,
} = await import('../../services/connections/mexc/verificationCorrectionService.js');

const { buildCapabilityMatrix } = await import('../../services/connections/mexc/capabilityMatrix.js');
const { evaluateAllConsumers } = await import('../../services/connections/mexc/consumerRegistry.js');
const {
  parseWalletCurrencyConfigResponse,
  validateWalletCurrencyRecordStrict,
  WALLET_CURRENCY_ERROR,
} = await import('../../services/connections/mexc/walletCurrencyConfigContract.js');

describe('Wallet access evidence classification', () => {
  test('run 60513 Probe 4 sanitized telemetry is evidence-insufficient', () => {
    const result = classifyWalletAccessEvidence(RUN_60513_PROBE4_SANITIZED_EVIDENCE);
    expect(result.decision).toBe('EVIDENCE_INSUFFICIENT');
    expect(result.missingForSufficiency).toEqual(expect.arrayContaining([
      'HTTP status successful 2xx',
      'Content type accepted JSON',
    ]));
    expect(result.recommendedVerdict).toBe('READY FOR FINAL PROBE-4-ONLY AUTHORIZATION');
    expect(result.table.find((r) => r.condition === 'Top-level JSON array established').status).toBe('PROVEN');
    expect(result.table.find((r) => r.condition === 'Failure was semantic item validation only').status).toBe('PROVEN');
  });

  test('2xx JSON array plus item-level schema drift verifies endpoint access', () => {
    const result = classifyWalletAccessEvidence({
      ...RUN_60513_PROBE4_SANITIZED_EVIDENCE,
      httpStatus: 200,
      httpOk: true,
      contentTypeAccepted: true,
      contentType: 'application/json',
      errorCode: WALLET_PROVIDER_SCHEMA_DRIFT,
      abortLimit: 'schema',
      parserCompleted: true,
    });
    expect(result.sufficient).toBe(true);
    expect(result.decision).toBe('EVIDENCE_SUFFICIENT');
    expect(result.recommendedVerdict).toBe('READY FOR MEXC-E2E CLOSEOUT HUMAN QA');
  });

  test('provider error envelope does not verify access', () => {
    const result = classifyWalletAccessEvidence({
      httpStatus: 200,
      httpOk: true,
      contentTypeAccepted: true,
      topLevelType: 'object',
      errorCode: 'MEXC_PROVIDER_ERROR_ENVELOPE',
      abortLimit: 'provider_envelope',
    });
    expect(result.sufficient).toBe(false);
    expect(result.table.find((r) => r.condition === 'No provider error envelope').status).toBe('NOT_PROVEN');
  });

  test('malformed JSON does not verify access', () => {
    const result = classifyWalletAccessEvidence({
      httpStatus: 200,
      httpOk: true,
      contentTypeAccepted: true,
      topLevelType: 'unknown',
      errorCode: 'MEXC_RESPONSE_MALFORMED',
      abortLimit: 'malformed',
    });
    expect(result.sufficient).toBe(false);
    expect(result.table.find((r) => r.condition === 'JSON was not malformed').status).toBe('FAILED');
  });

  test('truncated stream does not verify access', () => {
    const result = classifyWalletAccessEvidence({
      httpStatus: 200,
      httpOk: true,
      contentTypeAccepted: true,
      topLevelType: 'array',
      errorCode: 'MEXC_RESPONSE_TRUNCATED',
      abortLimit: 'truncated',
    });
    expect(result.sufficient).toBe(false);
    expect(result.table.find((r) => r.condition === 'Transport was not truncated').status).toBe('FAILED');
  });

  test('wrong content type does not verify access', () => {
    const result = classifyWalletAccessEvidence({
      httpStatus: 200,
      httpOk: true,
      contentTypeAccepted: false,
      contentType: 'text/plain',
      topLevelType: 'array',
      errorCode: 'MEXC_RESPONSE_WRONG_CONTENT_TYPE',
    });
    expect(result.sufficient).toBe(false);
    expect(result.missingForSufficiency).toContain('Content type accepted JSON');
  });

  test('authentication error does not verify access', () => {
    const result = classifyWalletAccessEvidence({
      httpStatus: 400,
      httpOk: false,
      contentTypeAccepted: true,
      topLevelType: 'object',
      errorCode: 'MEXC_SIGNATURE_INVALID',
    });
    expect(result.sufficient).toBe(false);
    expect(result.table.find((r) => r.condition === 'Signed authentication accepted').status).toBe('NOT_PROVEN');
  });

  test('response-size abort does not verify access', () => {
    const result = classifyWalletAccessEvidence({
      httpStatus: 200,
      httpOk: true,
      contentTypeAccepted: true,
      topLevelType: 'array',
      errorCode: 'MEXC_RESPONSE_DECOMPRESSED_TOO_LARGE',
      abortLimit: 'decompressed_bytes',
    });
    expect(result.sufficient).toBe(false);
    expect(result.table.find((r) => r.condition === 'Response-size limits did not abort').status).toBe('FAILED');
  });

  test('item-level semantic warning is not permission denial', async () => {
    const parsed = await parseWalletCurrencyConfigResponse({
      status: 200,
      headers: { 'content-type': 'application/json' },
      bodyText: JSON.stringify([{ coin: 'USDT', networkList: ['x'] }]),
      transportMeta: { bodyBytes: 40 },
    });
    expect(parsed.accessVerified).toBe(true);
    expect(parsed.dataContractWarningCode).toBe(WALLET_CURRENCY_ERROR.PROVIDER_SCHEMA_DRIFT);
    expect(parsed.dataContractWarningCode).not.toMatch(/PERMISSION|CREDENTIAL|AUTH/i);
  });
});

describe('Data-contract separation and consumers', () => {
  test('access verified plus contract warning limits wallet consumer only', () => {
    const matrix = buildCapabilityMatrix({
      credentialsConfigured: true,
      privateAuthVerified: true,
      storedStates: {
        PRIVATE_AUTH: { keyGrant: 'granted', verificationState: 'verified' },
        SPOT_ACCOUNT_READ: { keyGrant: 'granted', verificationState: 'verified' },
        SPOT_ORDER_READ: { keyGrant: 'granted', verificationState: 'verified' },
        SPOT_TRADE_HISTORY_READ: { keyGrant: 'granted', verificationState: 'verified' },
        DEPOSIT_HISTORY_READ: { keyGrant: 'granted', verificationState: 'verified' },
        WITHDRAWAL_HISTORY_READ: { keyGrant: 'granted', verificationState: 'verified' },
        TRANSFER_READ: { keyGrant: 'granted', verificationState: 'verified' },
        FUTURES_ACCOUNT_READ: { keyGrant: 'granted', verificationState: 'verified' },
        FUTURES_POSITION_READ: { keyGrant: 'granted', verificationState: 'verified' },
        WALLET_CURRENCY_READ: {
          keyGrant: 'granted',
          verificationState: 'verified',
          lastVerifiedAt: RUN_60513_PROBE4_SANITIZED_EVIDENCE.testedAt,
          sanitizedReason: WALLET_ACCESS_EVIDENCE_REASON.ENDPOINT_ACCESS_VERIFIED,
        },
      },
      walletDataContract: buildWalletDataContractProjection({
        dataContractState: 'warning',
        dataContractWarningCode: WALLET_PROVIDER_SCHEMA_DRIFT,
        sanitizedDataContractReason: WALLET_ACCESS_EVIDENCE_REASON.SCHEMA_WARNING,
        lastDataContractCheckedAt: RUN_60513_PROBE4_SANITIZED_EVIDENCE.testedAt,
      }),
    });

    const wallet = matrix.capabilities.find((c) => c.capabilityId === 'WALLET_CURRENCY_READ');
    expect(wallet.verificationState).toBe('verified');
    expect(wallet.keyGrant).toBe('granted');
    expect(wallet.dataContractState).toBe('warning');
    expect(wallet.consumerReadiness).toBe('limited');

    const consumers = evaluateAllConsumers(matrix);
    const walletConsumer = consumers.find((c) => c.consumerId === 'wallet');
    const deposit = consumers.find((c) => c.consumerId === 'wallet_deposit_history');
    const withdrawHist = consumers.find((c) => c.consumerId === 'wallet_withdrawal_history');
    const transfer = consumers.find((c) => c.consumerId === 'wallet_transfer_read');
    const futuresAccount = matrix.capabilities.find((c) => c.capabilityId === 'FUTURES_ACCOUNT_READ');
    const futuresPos = matrix.capabilities.find((c) => c.capabilityId === 'FUTURES_POSITION_READ');

    expect(walletConsumer.consumerReadiness).toBe('limited');
    expect(walletConsumer.limitedByDataContract).toBe(true);
    // Limited is product-visible; eligible may remain true when history/transfer reads are available.
    expect(['limited']).toContain(walletConsumer.consumerReadiness);
    expect(deposit.eligible).toBe(true);
    expect(withdrawHist.eligible).toBe(true);
    expect(transfer.eligible).toBe(true);
    expect(futuresAccount.verificationState).toBe('verified');
    expect(futuresPos.verificationState).toBe('verified');
    expect(matrix.privateAuthVerified).toBe(true);

    const dto = JSON.stringify({ matrix, consumers });
    expect(dto).not.toMatch(/withdrawFee|contractAddress|0x[a-f0-9]{20}|apiSecret|signature=/i);
  });

  test('strict consumer validation rejects malformed network records', () => {
    expect(() => validateWalletCurrencyRecordStrict({ coin: 'USDT', networkList: ['bad'] }))
      .toThrow(/Wallet|network|invalid/i);
  });

  test('sanitized telemetry never includes raw item values', () => {
    const telemetry = buildSanitizedWalletProbeTelemetry({
      httpStatus: 200,
      httpOk: true,
      contentTypeAccepted: true,
      sanitizedContentType: 'application/json',
      topLevelType: 'array',
      parserCompleted: true,
      schemaDriftCategories: ['network_item_non_object', 'coin'],
      schemaDriftCountCategory: '1_to_9',
      coin: 'USDT',
      network: 'ERC20',
    }, { testedAt: '2026-07-21T12:00:00.000Z', runId: 'run-1' });
    expect(telemetry.httpOk).toBe(true);
    expect(telemetry.schemaDriftCategories).toEqual(['network_item_non_object']);
    expect(JSON.stringify(telemetry)).not.toMatch(/USDT|ERC20|coin|fee/);
  });
});

describe('Access/schema separation correction gating', () => {
  beforeEach(() => {
    query.mockReset();
  });

  test('insufficient evidence performs no DB write and no provider transport', async () => {
    const result = await applyWalletAccessSchemaSeparationCorrection({
      connectionId: 'conn-1',
      ownerId: 'user-1',
      correctionCorrelationId: 'corr-access-1',
      evidence: RUN_60513_PROBE4_SANITIZED_EVIDENCE,
      queryFn: query,
    });
    expect(result.applied).toBe(false);
    expect(result.reason).toBe('EVIDENCE_INSUFFICIENT');
    expect(result.providerTransport).toBe(0);
    expect(result.credentialDecryption).toBe(0);
    expect(result.signatureGeneration).toBe(0);
    expect(query).toHaveBeenCalledTimes(0);
  });

  test('sufficient evidence appends one correction and is idempotent on rerun', async () => {
    const sufficient = {
      ...RUN_60513_PROBE4_SANITIZED_EVIDENCE,
      httpStatus: 200,
      httpOk: true,
      contentTypeAccepted: true,
      contentType: 'application/json',
      errorCode: WALLET_PROVIDER_SCHEMA_DRIFT,
      parserCompleted: true,
    };

    query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: 'evt-access-1', correlation_id: 'corr-access-1', tested_at: sufficient.testedAt }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });

    const first = await applyWalletAccessSchemaSeparationCorrection({
      connectionId: 'conn-1',
      ownerId: 'user-1',
      correctionCorrelationId: 'corr-access-1',
      evidence: sufficient,
      testedAt: sufficient.testedAt,
      queryFn: query,
    });
    expect(first.applied).toBe(true);
    expect(first.appended).toBe(true);
    expect(first.idempotent).toBe(false);
    expect(first.verificationState).toBe('verified');
    expect(first.keyGrant).toBe('granted');
    expect(first.dataContract.dataContractState).toBe('warning');
    expect(first.providerTransport).toBe(0);

    query.mockReset();
    query
      .mockResolvedValueOnce({
        rows: [{ id: 'evt-access-1', correlation_id: 'corr-access-1', tested_at: sufficient.testedAt }],
      })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });

    const second = await applyWalletAccessSchemaSeparationCorrection({
      connectionId: 'conn-1',
      ownerId: 'user-1',
      correctionCorrelationId: 'corr-access-1',
      evidence: sufficient,
      testedAt: sufficient.testedAt,
      queryFn: query,
    });
    expect(second.idempotent).toBe(true);
    expect(second.appended).toBe(false);
    expect(second.correctionEventId).toBe('evt-access-1');
  });
});
