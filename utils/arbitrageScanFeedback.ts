export type ArbitrageScanFeedbackKind =
  | 'idle'
  | 'confirm'
  | 'scanning'
  | 'success'
  | 'conflict'
  | 'rate_limited'
  | 'unauthorized'
  | 'public_data_unavailable'
  | 'validation'
  | 'server';

export type ArbitrageScanFeedback = {
  kind: ArbitrageScanFeedbackKind;
  message: string;
  retryable: boolean;
};

export type ArbitrageApiErrorShape = Error & {
  status?: number;
  code?: string;
  details?: Record<string, unknown>;
};

export function resolveArbitrageScanFeedback(
  error: ArbitrageApiErrorShape | null | undefined,
  t: (key: string) => string,
): ArbitrageScanFeedback {
  const code = error?.code || '';
  const status = error?.status || 0;

  if (status === 401 || code === 'UNAUTHORIZED' || code === 'AUTH_REQUIRED') {
    return {
      kind: 'unauthorized',
      message: t('arb_scan_unauthorized') || 'You do not have permission to run this scan.',
      retryable: false,
    };
  }

  if (
    code === 'ARBITRAGE_SCAN_IN_PROGRESS'
    || code === 'SCAN_IN_PROGRESS'
  ) {
    return {
      kind: 'conflict',
      message:
        t('arb_scan_in_progress') ||
        'An analytical scan is already running. Try again after it finishes.',
      retryable: true,
    };
  }

  if (status === 429 || code === 'RATE_LIMITED') {
    return {
      kind: 'rate_limited',
      message: t('arb_scan_rate_limited') || 'Too many scan requests. Please wait and try again.',
      retryable: true,
    };
  }

  if (
    code === 'PUBLIC_DATA_UNAVAILABLE'
    || code === 'PROVIDER_UNAVAILABLE'
    || code === 'MARKET_DATA_UNAVAILABLE'
  ) {
    return {
      kind: 'public_data_unavailable',
      message:
        t('arb_scan_public_data_unavailable') ||
        'Public market data is temporarily unavailable. Try again later.',
      retryable: true,
    };
  }

  if (status === 400 || code === 'VALIDATION_ERROR') {
    return {
      kind: 'validation',
      message: t('arb_scan_validation_failed') || 'The scan request was invalid.',
      retryable: false,
    };
  }

  return {
    kind: 'server',
    message: t('arb_scan_server_failed') || 'The analytical scan could not be completed.',
    retryable: true,
  };
}

export function createScanIdempotencyKey(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `arb-scan-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}
