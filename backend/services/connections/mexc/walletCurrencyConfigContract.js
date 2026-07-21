/**
 * MEXC Wallet currency/network response contract.
 * Accepts official field-name variants and returns only sanitized structural evidence.
 */

/**
 * Endpoint-specific defensive engineering bound for Wallet currency/network config.
 * Larger than ordinary private endpoints because the official response is a full
 * currency/network list. Not a claim about the original Probe 4 response size.
 */
export const WALLET_CURRENCY_RESPONSE_MAX_BYTES = 768 * 1024;

export const WALLET_CURRENCY_ERROR = Object.freeze({
  HTML_RESPONSE: 'MEXC_HTML_RESPONSE',
  CONTENT_TYPE_INVALID: 'MEXC_CONTENT_TYPE_INVALID',
  JSON_INVALID: 'MEXC_JSON_INVALID',
  RESPONSE_TRUNCATED: 'MEXC_RESPONSE_TRUNCATED',
  TOP_LEVEL_INVALID: 'MEXC_WALLET_TOP_LEVEL_INVALID',
  ITEM_INVALID: 'MEXC_WALLET_ITEM_INVALID',
  NETWORK_LIST_INVALID: 'MEXC_WALLET_NETWORK_LIST_INVALID',
  NETWORK_ITEM_INVALID: 'MEXC_WALLET_NETWORK_ITEM_INVALID',
  PROVIDER_ERROR: 'MEXC_PROVIDER_ERROR',
});

export class WalletCurrencyConfigContractError extends Error {
  constructor(code, message, safe = {}) {
    super(message);
    this.name = 'WalletCurrencyConfigContractError';
    this.code = code;
    this.safe = safe;
  }
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function categorizeWalletBodyBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes < 0) return 'unknown';
  if (bytes < 1024) return 'under_1KiB';
  if (bytes < 16 * 1024) return '1KiB_to_16KiB';
  if (bytes < 64 * 1024) return '16KiB_to_64KiB';
  if (bytes < 256 * 1024) return '64KiB_to_256KiB';
  if (bytes < 768 * 1024) return '256KiB_to_768KiB';
  if (bytes < 1024 * 1024) return '768KiB_to_1MiB';
  return '1MiB_plus';
}

function categorizeItemCount(count) {
  if (!Number.isFinite(count) || count < 0) return 'unknown';
  if (count === 0) return 'zero';
  if (count < 10) return '1_to_9';
  if (count < 100) return '10_to_99';
  return '100_plus';
}

function normalizeHeaderLookup(headers = {}) {
  const entries = Object.entries(headers || {}).map(([k, v]) => [String(k).toLowerCase(), v]);
  return Object.fromEntries(entries);
}

function detectTopLevelType(value) {
  if (Array.isArray(value)) return 'array';
  if (value === null) return 'null';
  return typeof value;
}

function looksLikeHtml(bodyText) {
  const trimmed = String(bodyText || '').trimStart().slice(0, 256).toLowerCase();
  return trimmed.startsWith('<!doctype html')
    || trimmed.startsWith('<html')
    || trimmed.startsWith('<body')
    || trimmed.startsWith('<head');
}

function isOptionalString(value) {
  return value == null || typeof value === 'string';
}

function isOptionalBoolean(value) {
  return value == null || typeof value === 'boolean';
}

function isOptionalNumber(value) {
  return value == null || typeof value === 'number';
}

function buildSafeMeta({ status, headers, bodyText, transportMeta = {} }) {
  const normalizedHeaders = normalizeHeaderLookup(headers);
  const contentType = normalizedHeaders['content-type'] || null;
  const contentLengthRaw = normalizedHeaders['content-length'] || null;
  const contentLength = Number.parseInt(String(contentLengthRaw || ''), 10);
  const bodyBytes = transportMeta.bodyBytes ?? Buffer.byteLength(String(bodyText || ''), 'utf8');
  return {
    httpStatus: status ?? null,
    contentType,
    contentLengthPresent: Boolean(contentLengthRaw),
    contentLength: Number.isFinite(contentLength) ? contentLength : null,
    bodyBytes,
    bodyByteCategory: categorizeWalletBodyBytes(bodyBytes),
    topLevelType: 'unknown',
    itemCountCategory: null,
    transportTruncated: Boolean(transportMeta.truncated),
    limitCategory: transportMeta.limitCategory || null,
  };
}

function validateNetworkItem(networkItem, itemIndex, networkIndex, safe) {
  if (!isPlainObject(networkItem)) {
    throw new WalletCurrencyConfigContractError(
      WALLET_CURRENCY_ERROR.NETWORK_ITEM_INVALID,
      'Wallet network entry must be an object',
      {
        ...safe,
        schemaPath: `[${
          itemIndex
        }].networkList[${networkIndex}]`,
        validationFailure: 'networkList.item_not_object',
      },
    );
  }

  if (!isOptionalString(networkItem.name) || !isOptionalString(networkItem.Name)) {
    throw new WalletCurrencyConfigContractError(
      WALLET_CURRENCY_ERROR.NETWORK_ITEM_INVALID,
      'Wallet network name variant invalid',
      {
        ...safe,
        schemaPath: `[${
          itemIndex
        }].networkList[${networkIndex}].name|Name`,
        validationFailure: 'networkList.name_variant',
      },
    );
  }
  if (!isOptionalString(networkItem.network) || !isOptionalString(networkItem.netWork)) {
    throw new WalletCurrencyConfigContractError(
      WALLET_CURRENCY_ERROR.NETWORK_ITEM_INVALID,
      'Wallet network code variant invalid',
      {
        ...safe,
        schemaPath: `[${
          itemIndex
        }].networkList[${networkIndex}].network|netWork`,
        validationFailure: 'networkList.network_variant',
      },
    );
  }
  if (!isOptionalBoolean(networkItem.depositEnable) || !isOptionalBoolean(networkItem.withdrawEnable)) {
    throw new WalletCurrencyConfigContractError(
      WALLET_CURRENCY_ERROR.NETWORK_ITEM_INVALID,
      'Wallet network enable flags invalid',
      {
        ...safe,
        schemaPath: `[${
          itemIndex
        }].networkList[${networkIndex}].depositEnable|withdrawEnable`,
        validationFailure: 'networkList.enable_flags',
      },
    );
  }
  if (
    !isOptionalNumber(networkItem.minConfirm)
    || !isOptionalNumber(networkItem.withdrawFee)
    || !isOptionalNumber(networkItem.withdrawMin)
    || !isOptionalNumber(networkItem.withdrawMax)
  ) {
    throw new WalletCurrencyConfigContractError(
      WALLET_CURRENCY_ERROR.NETWORK_ITEM_INVALID,
      'Wallet numeric limits invalid',
      {
        ...safe,
        schemaPath: `[${
          itemIndex
        }].networkList[${networkIndex}].limits`,
        validationFailure: 'networkList.numeric_variant',
      },
    );
  }
  if (
    !isOptionalString(networkItem.contract)
    || !isOptionalString(networkItem.depositTips)
    || !isOptionalString(networkItem.withdrawTips)
  ) {
    throw new WalletCurrencyConfigContractError(
      WALLET_CURRENCY_ERROR.NETWORK_ITEM_INVALID,
      'Wallet optional text fields invalid',
      {
        ...safe,
        schemaPath: `[${
          itemIndex
        }].networkList[${networkIndex}].contract|depositTips|withdrawTips`,
        validationFailure: 'networkList.optional_text_variant',
      },
    );
  }
}

function validateWalletItem(item, itemIndex, safe) {
  if (!isPlainObject(item)) {
    throw new WalletCurrencyConfigContractError(
      WALLET_CURRENCY_ERROR.ITEM_INVALID,
      'Wallet item must be an object',
      {
        ...safe,
        schemaPath: `[${itemIndex}]`,
        validationFailure: 'wallet_item.not_object',
      },
    );
  }
  if (typeof item.coin !== 'string' || !item.coin.trim()) {
    throw new WalletCurrencyConfigContractError(
      WALLET_CURRENCY_ERROR.ITEM_INVALID,
      'Wallet coin must be a non-empty string',
      {
        ...safe,
        schemaPath: `[${itemIndex}].coin`,
        validationFailure: 'wallet_item.coin',
      },
    );
  }
  if (!isOptionalString(item.name) || !isOptionalString(item.Name)) {
    throw new WalletCurrencyConfigContractError(
      WALLET_CURRENCY_ERROR.ITEM_INVALID,
      'Wallet name variant invalid',
      {
        ...safe,
        schemaPath: `[${itemIndex}].name|Name`,
        validationFailure: 'wallet_item.name_variant',
      },
    );
  }
  if (item.networkList != null && !Array.isArray(item.networkList)) {
    throw new WalletCurrencyConfigContractError(
      WALLET_CURRENCY_ERROR.NETWORK_LIST_INVALID,
      'Wallet networkList must be an array',
      {
        ...safe,
        schemaPath: `[${itemIndex}].networkList`,
        validationFailure: 'networkList.not_array',
      },
    );
  }
  for (const [networkIndex, networkItem] of (item.networkList || []).entries()) {
    validateNetworkItem(networkItem, itemIndex, networkIndex, safe);
  }
}

function isProviderErrorEnvelope(json) {
  return isPlainObject(json) && (json.code != null || json.msg != null || json.message != null);
}

export function parseWalletCurrencyConfigResponse({ status, headers, bodyText, transportMeta = {} }) {
  const safe = buildSafeMeta({ status, headers, bodyText, transportMeta });
  const normalizedHeaders = normalizeHeaderLookup(headers);
  const contentType = String(normalizedHeaders['content-type'] || '').toLowerCase();

  if (safe.transportTruncated) {
    throw new WalletCurrencyConfigContractError(
      WALLET_CURRENCY_ERROR.RESPONSE_TRUNCATED,
      'Wallet response stream truncated',
      {
        ...safe,
        validationFailure: 'transport.truncated',
      },
    );
  }

  if (looksLikeHtml(bodyText)) {
    throw new WalletCurrencyConfigContractError(
      WALLET_CURRENCY_ERROR.HTML_RESPONSE,
      'Wallet response was HTML',
      {
        ...safe,
        validationFailure: 'content_type.html',
      },
    );
  }

  if (contentType && !contentType.includes('application/json') && !contentType.includes('+json')) {
    throw new WalletCurrencyConfigContractError(
      WALLET_CURRENCY_ERROR.CONTENT_TYPE_INVALID,
      'Wallet response content type invalid',
      {
        ...safe,
        validationFailure: 'content_type.invalid',
      },
    );
  }

  let json;
  try {
    json = JSON.parse(String(bodyText || ''));
  } catch {
    throw new WalletCurrencyConfigContractError(
      WALLET_CURRENCY_ERROR.JSON_INVALID,
      'Wallet response JSON invalid',
      {
        ...safe,
        validationFailure: 'json.parse',
      },
    );
  }

  safe.topLevelType = detectTopLevelType(json);

  if (isProviderErrorEnvelope(json)) {
    throw new WalletCurrencyConfigContractError(
      WALLET_CURRENCY_ERROR.PROVIDER_ERROR,
      'Wallet response carried provider error envelope',
      {
        ...safe,
        providerCode: json.code ?? null,
        validationFailure: 'provider.error_envelope',
      },
    );
  }

  if (!Array.isArray(json)) {
    throw new WalletCurrencyConfigContractError(
      WALLET_CURRENCY_ERROR.TOP_LEVEL_INVALID,
      'Wallet response top level must be an array',
      {
        ...safe,
        validationFailure: 'top_level.not_array',
      },
    );
  }

  safe.itemCountCategory = categorizeItemCount(json.length);

  for (const [itemIndex, item] of json.entries()) {
    validateWalletItem(item, itemIndex, safe);
  }

  return {
    itemCountCategory: safe.itemCountCategory,
    providerAvailability: 'available',
    safe,
  };
}
