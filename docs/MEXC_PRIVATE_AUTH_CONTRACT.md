# MEXC Private Authentication Contract (CONNECTIONS-WP2A)

**Sources (official only):**

- https://www.mexc.com/api-docs/spot-v3/introduction
- https://mexcdevelop.github.io/apidocs/spot_v3_en/

**Environment:** Staging documentation for TitanGold Connections WP2A  
**Credentials in this document:** none — fake placeholders only

---

## 1. Private REST base URL

| Item | Value |
|------|--------|
| Official Spot v3 base | `https://api.mexc.com` |
| Scheme | HTTPS only |
| Allowlisted hostname | `api.mexc.com` |

No user-supplied base URL is accepted by TitanGold.

---

## 2. Selected read-only verification endpoint

| Item | Value |
|------|--------|
| Method | `GET` |
| Full URL | `https://api.mexc.com/api/v3/account` |
| Path | `/api/v3/account` |
| Purpose | Account Information — **read-only credential verification** (no order placement) |
| Required API permission | `SPOT_ACCOUNT_READ` |
| Official weight | `Weight(IP): 10` |
| Official account endpoint rate note | `rate limit: 2 times/s` |

This is the safest official **read-only** private endpoint for proving that stored credentials can authenticate and read account metadata.

Successful account read proves **account-read** authentication. It does **not** by itself authorize order placement. Trading permission may be inferred only from explicit response fields such as `canTrade` when present.

---

## 3. Credential headers

| Header | Required | Notes |
|--------|----------|-------|
| `X-MEXC-APIKEY` | Yes | Access key (API key) |
| `Content-Type` | Recommended | `application/json` for signed REST usage |

The API Secret is **never** sent as a header. It is used only as the HMAC key.

---

## 4. Signing algorithm

| Item | Value |
|------|--------|
| Algorithm | HMAC-SHA256 |
| HMAC key | API Secret |
| HMAC message | `totalParams` |
| Signature encoding | Hex, **lowercase only** |
| Signature parameter name | `signature` (query string for GET) |

### totalParams

Per official Spot v3 docs:

> `totalParams` is defined as the query string concatenated with the request body.

For `GET /api/v3/account` TitanGold uses **query string only** (empty body).

### Fake official-style example (placeholders only)

Parameters before signing:

```text
recvWindow=5000&timestamp=1644489390087
```

Fake Secret:

```text
FAKESECRET_mexc_do_not_use_0123456789abcdef
```

Signature = HMAC_SHA256_HEX_LOWERCASE(secret, totalParams)

Request URL shape (fake key):

```text
GET https://api.mexc.com/api/v3/account?recvWindow=5000&timestamp=1644489390087&signature=<hex>
Header: X-MEXC-APIKEY: FAKEKEY_mexc_do_not_use
```

---

## 5. Canonical query construction

For account verification TitanGold builds parameters in this fixed order:

1. `recvWindow` (optional but always sent by TitanGold)
2. `timestamp` (required)
3. `signature` (appended **after** HMAC over steps 1–2 only)

Rules:

- Deterministic key order (no object enumeration nondeterminism)
- No locale-dependent number formatting
- Timestamp is an integer millisecond string
- `recvWindow` is an integer string
- Parameter values that contain special characters must be URL-encoded for signing; official docs require **uppercase** percent-encoding where encoding is applied

---

## 6. Timestamp and receive-window

| Item | Official rule |
|------|----------------|
| `timestamp` | Unix time in **milliseconds** when the request is created |
| Default `recvWindow` | `5000` ms if omitted |
| Maximum `recvWindow` | Must be **less than 60000** (error `700005`) |
| Acceptance window | Request valid when roughly `timestamp < serverTime + 1000` and `(serverTime - timestamp) <= recvWindow` |

TitanGold defaults:

- `recvWindow = 5000`
- injectable clock for tests
- no automatic retry on timestamp/signature failures

---

## 7. Required account permissions

| Check | Permission / field |
|-------|---------------------|
| Private account read | API key must include `SPOT_ACCOUNT_READ` |
| Trading enablement (optional inference) | Response field `canTrade` when present |
| Withdraw / deposit | `canWithdraw` / `canDeposit` — recorded as informational only; not required for WP2A auth success |

WP2A success criteria for **authenticated = true**:

- HTTP success from signed `GET /api/v3/account`
- Parseable JSON account object

WP2A **does not** set `tradingPermission = verified` unless `canTrade === true`.

---

## 8. Relevant provider error codes

| Code | Official meaning | TitanGold category |
|------|------------------|--------------------|
| `700001` | API-key format invalid | `MEXC_CREDENTIAL_INVALID` |
| `700002` | Signature for this request is not valid | `MEXC_SIGNATURE_INVALID` |
| `700003` | Timestamp outside recvWindow | `MEXC_TIMESTAMP_INVALID` |
| `700005` | recvWindow must less than 60000 | `MEXC_TIMESTAMP_INVALID` |
| `700006` | IP non white list | `MEXC_IP_RESTRICTED` |
| `700007` | No permission to access the endpoint | `MEXC_PERMISSION_INSUFFICIENT` |
| `60005` / `730100` / unusual account | Account abnormal / unusual status | `MEXC_ACCOUNT_RESTRICTED` |
| HTTP `429` | Too many requests / rate limit | `MEXC_RATE_LIMITED` |
| HTTP `500` | Internal / upstream failure | `MEXC_PROVIDER_UNAVAILABLE` |
| HTTP `503` | Service unavailable / maintenance | `MEXC_PROVIDER_UNAVAILABLE` |
| HTTP `504` | Gateway timeout | `MEXC_PROVIDER_UNAVAILABLE` |
| Other HTTP `5xx` / empty body | Provider unavailable | `MEXC_PROVIDER_UNAVAILABLE` |

Raw provider messages are never forwarded to the frontend. Safe code may be preserved when non-sensitive.

---

## 9. Rate-limit and IP behavior

Official notes (Spot v3):

- HTTP `429` when breaking a request rate limit
- Signed endpoints typically limited by account (UID); public by IP
- Repeated `429` without backoff may lead to automated IP ban (minutes to days)
- API keys without linked IP may expire; linking IP addresses is recommended

TitanGold WP2A:

- Single request, **zero retries** on provider call
- Application-level route rate limit remains (Connections test limiter)

---

## 10. Restrictions and unavailability

| Condition | Behavior |
|-----------|----------|
| IP not on key whitelist | `MEXC_IP_RESTRICTED`, non-retryable for same network |
| Account / region / risk control | `MEXC_ACCOUNT_RESTRICTED` |
| Maintenance / 5xx / connection reset | `MEXC_PROVIDER_UNAVAILABLE` or `MEXC_NETWORK_ERROR` |
| Client timeout | `MEXC_TIMEOUT` (retryable at WP2B policy layer) |

---

## 11. What this contract intentionally excludes

- Order placement endpoints
- Withdrawal endpoints
- Unofficial SDKs or third-party signing snippets as authority
- Real credentials, real signatures, or real account payloads in docs or logs

---

## 12. TitanGold ownership boundary

| Concern | Owner |
|---------|-------|
| Signing + provider HTTP | `mexcPrivateAuthAdapter` |
| Encryption / decryption | `backend/utils/crypto.js` + connection service |
| Ownership / capabilities | Connections routes + middleware |
| Persistence of status | Explicit verification service flag (disabled in WP2A) |
| Frontend Test UI | Not restored in WP2A |
