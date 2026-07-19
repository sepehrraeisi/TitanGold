# MEXC End-to-End Program

**Program Slice:** MEXC-E2E (Settings → Connections → MEXC + Wallet / Agents / Portfolio / Spot / Futures)
**Documentation verified:** 2026-07-19
**Official Spot docs:** https://mexcdevelop.github.io/apidocs/spot_v3_en/
**Official Futures docs:** https://mexcdevelop.github.io/apidocs/contract_v1_en/

This is the living document for the MEXC End-to-End Program Slice.
Do not create per-remediation micro-documents.

## Program outcome questions

The platform answers truthfully (not a single `connected` boolean):

1. Is public market data available?
2. Are private credentials configured?
3. Has private authentication succeeded?
4–6. Which Spot / Futures / Wallet permissions exist?
7. Which capabilities have been safely verified?
8. Which capabilities are supported but disabled?
9. Which TitanGold consumers may use the Connection?
10. Which operations are blocked and why?
11. When was each capability last verified?
12. What was the last sanitized failure?
13. Does the runtime currently allow any real side effect? → **No** in this slice

## Canonical architecture

- **Owner:** `backend/services/connections/mexc/` + `exchangeConnectionService.js` (WP1A/WP2A)
- **Capability matrix:** single owner — never duplicated per module
- **Verification orchestrator:** extends WP2A adapter; fake transports; live gated
- **DB:** additive `049_mexc_capability_states.sql` (capability state, verification history, consumer bindings)
- **Tier-4:** withdrawals, transfers, orders always blocked unless separately authorized
- **Mandatory checkpoint:** stop before first real private MEXC request

## Official Capability Inventory

Total records: **123**

### Public Market Data

| Name | Method | Endpoint | Host | Auth | Permission | R/W | Side-effect | Rate | Maintenance | TitanGold use | Module | State | Safe verify | Gate |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Test Connectivity | GET | `/api/v3/ping` | https://api.mexc.com | none | — | public | none | 1 IP | current | Connectivity | Market Data / Arbitrage | supported_via_existing_public_paths | public_probe | none |
| Check Server Time | GET | `/api/v3/time` | https://api.mexc.com | none | — | public | none | 1 IP | current | Clock sync | Market Data / Arbitrage | supported_via_existing_public_paths | public_probe | none |
| API default symbol | GET | `/api/v3/defaultSymbols` | https://api.mexc.com | none | — | public | none | 1 IP | current | Default symbols | Market Data / Arbitrage | supported_via_existing_public_paths | public_probe | none |
| Exchange Information | GET | `/api/v3/exchangeInfo` | https://api.mexc.com | none | — | public | none | 10 IP | current | Spot symbols & filters | Market Data / Arbitrage | supported_via_existing_public_paths | public_probe | none |
| Order Book | GET | `/api/v3/depth` | https://api.mexc.com | none | — | public | none | 1 IP | current | Order book | Market Data / Arbitrage | supported_via_existing_public_paths | public_probe | none |
| Recent Trades List | GET | `/api/v3/trades` | https://api.mexc.com | none | — | public | none | 5 IP | current | Public trades | Market Data / Arbitrage | supported_via_existing_public_paths | public_probe | none |
| Compressed/Aggregate Trades | GET | `/api/v3/aggTrades` | https://api.mexc.com | none | — | public | none | 1 IP | current | Agg trades | Market Data / Arbitrage | supported_via_existing_public_paths | public_probe | none |
| Kline/Candlestick Data | GET | `/api/v3/klines` | https://api.mexc.com | none | — | public | none | 1 IP | current | Candles | Market Data / Arbitrage | supported_via_existing_public_paths | public_probe | none |
| Current Average Price | GET | `/api/v3/avgPrice` | https://api.mexc.com | none | — | public | none | 1 IP | current | Avg price | Market Data / Arbitrage | supported_via_existing_public_paths | public_probe | none |
| 24hr Ticker | GET | `/api/v3/ticker/24hr` | https://api.mexc.com | none | — | public | none | varies IP | current | Ticker | Market Data / Arbitrage | supported_via_existing_public_paths | public_probe | none |
| Symbol Price Ticker | GET | `/api/v3/ticker/price` | https://api.mexc.com | none | — | public | none | varies IP | current | Price | Market Data / Arbitrage | supported_via_existing_public_paths | public_probe | none |
| Symbol Order Book Ticker | GET | `/api/v3/ticker/bookTicker` | https://api.mexc.com | none | — | public | none | 1 IP | current | Book ticker | Market Data / Arbitrage | supported_via_existing_public_paths | public_probe | none |
| Spot Public WebSocket streams | WS | `wss://wbs.mexc.com/ws` | wss://wbs.mexc.com | none | — | public | none | WS limits per official docs | current | Realtime spot market | Market Data | partial_existing | public_ws_health | none |

### Sub-accounts

| Name | Method | Endpoint | Host | Auth | Permission | R/W | Side-effect | Rate | Maintenance | TitanGold use | Module | State | Safe verify | Gate |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Create a Sub-account | POST | `/api/v3/sub-account/virtualSubAccount` | https://api.mexc.com | HMAC-SHA256 | SPOT_ACCOUNT_READ | private_write | account_mutation | 1 IP | current | Sub-account create | Connections / Wallet | architecture_gated | not_safely_testable | blocked_tier4 |
| Query Sub-account List | GET | `/api/v3/sub-account/list` | https://api.mexc.com | HMAC-SHA256 | SPOT_ACCOUNT_READ | private_read | read_only | 1 IP | current | List sub-accounts | Connections / Wallet | architecture_gated | private_read_probe | private_read_gate |
| Create APIKey for sub-account | POST | `/api/v3/sub-account/apiKey` | https://api.mexc.com | HMAC-SHA256 | SPOT_ACCOUNT_READ | private_write | account_mutation | 1 IP | current | Sub-account credentials | Connections / Wallet | architecture_gated | not_safely_testable | blocked_tier4 |
| Query sub-account APIKey | GET | `/api/v3/sub-account/apiKey` | https://api.mexc.com | HMAC-SHA256 | SPOT_ACCOUNT_READ | private_read | read_only | 1 IP | current | Sub-account credentials read | Connections / Wallet | architecture_gated | private_read_probe | private_read_gate |
| Delete sub-account APIKey | DELETE | `/api/v3/sub-account/apiKey` | https://api.mexc.com | HMAC-SHA256 | SPOT_ACCOUNT_READ | private_write | account_mutation | 1 IP | current | Delete sub-account key | Connections / Wallet | architecture_gated | not_safely_testable | blocked_tier4 |
| Universal Transfer (Master) | POST | `/api/v3/capital/sub-account/universalTransfer` | https://api.mexc.com | HMAC-SHA256 | SPOT_TRANSFER_WRITE | private_write | financial_write | 1 IP | current | Sub-account transfer | Connections / Wallet | architecture_gated | not_safely_testable | blocked_tier4 |
| Query Universal Transfer History (Master) | GET | `/api/v3/capital/sub-account/universalTransfer` | https://api.mexc.com | HMAC-SHA256 | SPOT_TRANSFER_READ | private_read | read_only | 1 IP | current | Sub-account transfer history | Connections / Wallet | architecture_gated | private_read_probe | private_read_gate |
| Query Sub-account Asset | GET | `/api/v3/sub-account/asset` | https://api.mexc.com | HMAC-SHA256 | SPOT_TRANSFER_READ | private_read | read_only | 1 IP | current | Sub-account assets | Connections / Wallet | architecture_gated | private_read_probe | private_read_gate |

### Spot Private

| Name | Method | Endpoint | Host | Auth | Permission | R/W | Side-effect | Rate | Maintenance | TitanGold use | Module | State | Safe verify | Gate |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Query KYC status | GET | `/api/v3/kyc/status` | https://api.mexc.com | HMAC-SHA256 | SPOT_ACCOUNT_READ | private_read | read_only | 1 IP | current | KYC status | Connections | architecture_gated | private_read_probe | private_read_probe |
| User API default symbol | GET | `/api/v3/selfSymbols` | https://api.mexc.com | HMAC-SHA256 | SPOT_ACCOUNT_R | private_read | read_only | 1 IP | current | API-enabled symbols | Connections | architecture_gated | private_read_probe | private_read_probe |
| Test New Order | POST | `/api/v3/order/test` | https://api.mexc.com | HMAC-SHA256 | SPOT_DEAL_WRITE | private_write | none | 1 IP | current | Validate order without matching | Spot Trading | architecture_gated | not_safely_testable_until_approved | test_order_separate_approval |
| New Order | POST | `/api/v3/order` | https://api.mexc.com | HMAC-SHA256 | SPOT_DEAL_WRITE | private_write | financial_write | 1 IP / 1 UID | current | Place spot order | Spot Trading | architecture_gated | not_safely_testable | blocked_tier4 |
| Batch Orders | POST | `/api/v3/batchOrders` | https://api.mexc.com | HMAC-SHA256 | SPOT_DEAL_WRITE | private_write | financial_write | 1 IP / 1 UID | current | Batch spot orders | Spot Trading | architecture_gated | not_safely_testable | blocked_tier4 |
| Cancel Order | DELETE | `/api/v3/order` | https://api.mexc.com | HMAC-SHA256 | SPOT_DEAL_WRITE | private_write | financial_write | 1 IP | current | Cancel spot order | Spot Trading | architecture_gated | not_safely_testable | blocked_tier4 |
| Cancel all Open Orders on a Symbol | DELETE | `/api/v3/openOrders` | https://api.mexc.com | HMAC-SHA256 | SPOT_DEAL_WRITE | private_write | financial_write | 1 IP | current | Cancel all open | Spot Trading | architecture_gated | not_safely_testable | blocked_tier4 |
| Query Order | GET | `/api/v3/order` | https://api.mexc.com | HMAC-SHA256 | SPOT_DEAL_READ | private_read | read_only | 2 IP | current | Order details | Spot Trading | architecture_gated | private_read_probe | private_read_probe |
| Current Open Orders | GET | `/api/v3/openOrders` | https://api.mexc.com | HMAC-SHA256 | SPOT_DEAL_READ | private_read | read_only | 3 IP | current | Open orders | Spot Trading | architecture_gated | private_read_probe | private_read_probe |
| All Orders | GET | `/api/v3/allOrders` | https://api.mexc.com | HMAC-SHA256 | SPOT_DEAL_READ | private_read | read_only | 10 IP | current | Order history | Spot Trading | architecture_gated | private_read_probe | private_read_probe |
| Account Information | GET | `/api/v3/account` | https://api.mexc.com | HMAC-SHA256 | SPOT_ACCOUNT_READ | private_read | read_only | 10 IP | current | Account + balances | Connections | wp2a_adapter | private_auth_probe | private_auth_probe |
| Account Trade List | GET | `/api/v3/myTrades` | https://api.mexc.com | HMAC-SHA256 | SPOT_ACCOUNT_READ | private_read | read_only | 10 IP | current | Trade history | Spot Trading | architecture_gated | private_read_probe | private_read_probe |
| Enable MX Deduct | POST | `/api/v3/mxDeduct/enable` | https://api.mexc.com | HMAC-SHA256 | SPOT_DEAL_WRITE | private_write | account_mutation | 1 IP | current | MX deduct toggle | Connections | architecture_gated | not_safely_testable | blocked_tier4 |
| Query MX Deduct Status | GET | `/api/v3/mxDeduct/enable` | https://api.mexc.com | HMAC-SHA256 | SPOT_DEAL_READ | private_read | read_only | 1 IP | current | MX deduct status | Connections | architecture_gated | private_read_probe | private_read_probe |
| Query Symbol Commission | GET | `/api/v3/tradeFee` | https://api.mexc.com | HMAC-SHA256 | SPOT_ACCOUNT_READ | private_read | read_only | 20 IP | current | Commission | Connections | architecture_gated | private_read_probe | private_read_probe |

### Wallet

| Name | Method | Endpoint | Host | Auth | Permission | R/W | Side-effect | Rate | Maintenance | TitanGold use | Module | State | Safe verify | Gate |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Query currency information | GET | `/api/v3/capital/config/getall` | https://api.mexc.com | HMAC-SHA256 | SPOT_WITHDRAW_READ | private_read | read_only | 10 IP | current | Currency/network config | Wallet | architecture_gated | private_read_probe | private_read_gate |
| Withdraw (new) | POST | `/api/v3/capital/withdraw` | https://api.mexc.com | HMAC-SHA256 | SPOT_WITHDRAW_WRITE | private_write | financial_write | 1 IP | current | Create withdrawal | Wallet | architecture_gated | not_safely_testable | blocked_tier4 |
| Cancel withdraw | DELETE | `/api/v3/capital/withdraw` | https://api.mexc.com | HMAC-SHA256 | SPOT_WITHDRAW_W | private_write | financial_write | 1 IP | current | Cancel withdrawal | Wallet | architecture_gated | not_safely_testable | blocked_tier4 |
| Deposit History | GET | `/api/v3/capital/deposit/hisrec` | https://api.mexc.com | HMAC-SHA256 | SPOT_WITHDRAW_READ | private_read | read_only | 1 IP | current | Deposit history | Wallet | architecture_gated | private_read_probe | private_read_gate |
| Withdraw History | GET | `/api/v3/capital/withdraw/history` | https://api.mexc.com | HMAC-SHA256 | SPOT_WITHDRAW_READ | private_read | read_only | 1 IP | current | Withdrawal history | Wallet | architecture_gated | private_read_probe | private_read_gate |
| Generate deposit address | POST | `/api/v3/capital/deposit/address` | https://api.mexc.com | HMAC-SHA256 | SPOT_WITHDRAW_WRITE | private_write | account_mutation | 1 IP | current | Generate deposit address | Wallet | architecture_gated | not_safely_testable | blocked_tier4 |
| Deposit Address | GET | `/api/v3/capital/deposit/address` | https://api.mexc.com | HMAC-SHA256 | SPOT_WITHDRAW_READ | private_read | read_only | 10 IP | current | Query deposit address | Wallet | architecture_gated | private_read_probe | private_read_gate |
| Withdraw Address | GET | `/api/v3/capital/withdraw/address` | https://api.mexc.com | HMAC-SHA256 | SPOT_WITHDRAW_R | private_read | read_only | 10 IP | current | Withdrawal addresses | Wallet | architecture_gated | private_read_probe | private_read_gate |
| User Universal Transfer | POST | `/api/v3/capital/transfer` | https://api.mexc.com | HMAC-SHA256 | SPOT_TRANSFER_WRITE | private_write | financial_write | 1 IP | current | Spot/Futures transfer | Wallet | architecture_gated | not_safely_testable | blocked_tier4 |
| Query Universal Transfer History | GET | `/api/v3/capital/transfer` | https://api.mexc.com | HMAC-SHA256 | SPOT_TRANSFER_READ | private_read | read_only | 1 IP | current | Transfer history | Wallet | architecture_gated | private_read_probe | private_read_gate |
| Query Universal Transfer by tranId | GET | `/api/v3/capital/transfer/tranId` | https://api.mexc.com | HMAC-SHA256 | SPOT_TRANSFER_R | private_read | read_only | 1 IP | current | Transfer by id | Wallet | architecture_gated | private_read_probe | private_read_gate |
| Get Assets Convertible Into MX | GET | `/api/v3/capital/convert/list` | https://api.mexc.com | HMAC-SHA256 | SPOT_ACCOUNT_READ | private_read | read_only | 1 IP | current | Dust candidates | Wallet | architecture_gated | private_read_probe | private_read_gate |
| Dust Transfer | POST | `/api/v3/capital/convert` | https://api.mexc.com | HMAC-SHA256 | SPOT_ACCOUNT_W | private_write | financial_write | 10 IP | current | Dust convert | Wallet | architecture_gated | not_safely_testable | blocked_tier4 |
| Dust Log | GET | `/api/v3/capital/convert` | https://api.mexc.com | HMAC-SHA256 | SPOT_DEAL_READ | private_read | read_only | 1 IP | current | Dust history | Wallet | architecture_gated | private_read_probe | private_read_gate |
| Internal Transfer | POST | `/api/v3/capital/transfer/internal` | https://api.mexc.com | HMAC-SHA256 | SPOT_WITHDRAW_WRITE | private_write | financial_write | 1 IP | current | Internal transfer | Wallet | architecture_gated | not_safely_testable | blocked_tier4 |
| Query Internal Transfer history | GET | `/api/v3/capital/transfer/internal` | https://api.mexc.com | HMAC-SHA256 | SPOT_WITHDRAW_READ | private_read | read_only | 1 IP | current | Internal transfer history | Wallet | architecture_gated | private_read_probe | private_read_gate |
| Withdraw (previous, offline soon) | POST | `/api/v3/capital/withdraw/apply` | https://api.mexc.com | HMAC-SHA256 | SPOT_WITHDRAW_WRITE | private_write | financial_write | 1 IP | deprecated_offline_soon | Legacy withdraw | Wallet | architecture_gated | not_safely_testable | blocked_tier4 |

### Spot Private Streams

| Name | Method | Endpoint | Host | Auth | Permission | R/W | Side-effect | Rate | Maintenance | TitanGold use | Module | State | Safe verify | Gate |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Generate Listen Key | POST | `/api/v3/userDataStream` | https://api.mexc.com | API-Key header (listen key) | SPOT_ACCOUNT_R | private_read | none | per docs | current | Private account/order streams | Spot Trading | architecture_gated | private_read_probe | private_read_gate |
| Get Valid Listen Keys | GET | `/api/v3/userDataStream` | https://api.mexc.com | API-Key header (listen key) | SPOT_ACCOUNT_R | private_read | none | per docs | current | Private account/order streams | Spot Trading | architecture_gated | private_read_probe | private_read_gate |
| Extend Listen Key | PUT | `/api/v3/userDataStream` | https://api.mexc.com | API-Key header (listen key) | SPOT_ACCOUNT_R | private_read | none | per docs | current | Private account/order streams | Spot Trading | architecture_gated | private_read_probe | private_read_gate |
| Close Listen Key | DELETE | `/api/v3/userDataStream` | https://api.mexc.com | API-Key header (listen key) | SPOT_ACCOUNT_R | private_read | none | per docs | current | Private account/order streams | Spot Trading | architecture_gated | private_read_probe | private_read_gate |

### Affiliate

| Name | Method | Endpoint | Host | Auth | Permission | R/W | Side-effect | Rate | Maintenance | TitanGold use | Module | State | Safe verify | Gate |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Get Rebate History Records | GET | `/api/v3/rebate/taxQuery` | https://api.mexc.com | HMAC-SHA256 | SPOT_ACCOUNT_READ | private_read | read_only | 1 IP | current | Affiliate/rebate read | Connections | deferred | private_read_probe | deferred_affiliate |

> Deferred/unsupported reason: Affiliate domain out of core Trading/Wallet consumers

| Get Rebate Records Detail | GET | `/api/v3/rebate/detail` | https://api.mexc.com | HMAC-SHA256 | SPOT_ACCOUNT_READ | private_read | read_only | 1 IP | current | Affiliate/rebate read | Connections | deferred | private_read_probe | deferred_affiliate |

> Deferred/unsupported reason: Affiliate domain out of core Trading/Wallet consumers

| Get Self Rebate Records Detail | GET | `/api/v3/rebate/detail/kickback` | https://api.mexc.com | HMAC-SHA256 | SPOT_ACCOUNT_READ | private_read | read_only | 1 IP | current | Affiliate/rebate read | Connections | deferred | private_read_probe | deferred_affiliate |

> Deferred/unsupported reason: Affiliate domain out of core Trading/Wallet consumers

| Query ReferCode | GET | `/api/v3/rebate/referCode` | https://api.mexc.com | HMAC-SHA256 | SPOT_ACCOUNT_READ | private_read | read_only | 1 IP | current | Affiliate/rebate read | Connections | deferred | private_read_probe | deferred_affiliate |

> Deferred/unsupported reason: Affiliate domain out of core Trading/Wallet consumers

| Get Affiliate Commission Record | GET | `/api/v3/rebate/affiliate/commission` | https://api.mexc.com | HMAC-SHA256 | SPOT_ACCOUNT_READ | private_read | read_only | 1 IP | current | Affiliate/rebate read | Connections | deferred | private_read_probe | deferred_affiliate |

> Deferred/unsupported reason: Affiliate domain out of core Trading/Wallet consumers

| Get Affiliate Withdraw Record | GET | `/api/v3/rebate/affiliate/withdraw` | https://api.mexc.com | HMAC-SHA256 | SPOT_ACCOUNT_READ | private_read | read_only | 1 IP | current | Affiliate/rebate read | Connections | deferred | private_read_probe | deferred_affiliate |

> Deferred/unsupported reason: Affiliate domain out of core Trading/Wallet consumers

| Get Affiliate Commission Detail | GET | `/api/v3/rebate/affiliate/commission/detail` | https://api.mexc.com | HMAC-SHA256 | SPOT_ACCOUNT_READ | private_read | read_only | 1 IP | current | Affiliate/rebate read | Connections | deferred | private_read_probe | deferred_affiliate |

> Deferred/unsupported reason: Affiliate domain out of core Trading/Wallet consumers

| Get Affiliate Campaign Data | GET | `/api/v3/rebate/affiliate/campaign` | https://api.mexc.com | HMAC-SHA256 | SPOT_ACCOUNT_READ | private_read | read_only | 1 IP | current | Affiliate/rebate read | Connections | deferred | private_read_probe | deferred_affiliate |

> Deferred/unsupported reason: Affiliate domain out of core Trading/Wallet consumers

| Get Affiliate Referral Data | GET | `/api/v3/rebate/affiliate/referral` | https://api.mexc.com | HMAC-SHA256 | SPOT_ACCOUNT_READ | private_read | read_only | 1 IP | current | Affiliate/rebate read | Connections | deferred | private_read_probe | deferred_affiliate |

> Deferred/unsupported reason: Affiliate domain out of core Trading/Wallet consumers

| Get Subaffiliates Data | GET | `/api/v3/rebate/affiliate/subaffiliates` | https://api.mexc.com | HMAC-SHA256 | SPOT_ACCOUNT_READ | private_read | read_only | 1 IP | current | Affiliate/rebate read | Connections | deferred | private_read_probe | deferred_affiliate |

> Deferred/unsupported reason: Affiliate domain out of core Trading/Wallet consumers


### Futures Public Market Data

| Name | Method | Endpoint | Host | Auth | Permission | R/W | Side-effect | Rate | Maintenance | TitanGold use | Module | State | Safe verify | Gate |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Get the server time / ping | GET | `/api/v1/contract/ping` | https://contract.mexc.com | none | — | public | none | per futures docs | current | Public futures health | Futures Trading / Market Data | architecture_gated | public_probe | none |
| Get the contract information | GET | `/api/v1/contract/detail` | https://contract.mexc.com | none | — | public | none | per futures docs | current | Futures symbols | Futures Trading / Market Data | architecture_gated | public_probe | none |
| Get transferable currencies | GET | `/api/v1/contract/support_currencies` | https://contract.mexc.com | none | — | public | none | per futures docs | current | Transferable currencies | Futures Trading / Market Data | architecture_gated | public_probe | none |
| Contract depth | GET | `/api/v1/contract/depth/{symbol}` | https://contract.mexc.com | none | — | public | none | per futures docs | current | Futures order book | Futures Trading / Market Data | architecture_gated | public_probe | none |
| Depth commits snapshot | GET | `/api/v1/contract/depth_commits/{symbol}/{limit}` | https://contract.mexc.com | none | — | public | none | per futures docs | current | Depth snapshot | Futures Trading / Market Data | architecture_gated | public_probe | none |
| Contract index price | GET | `/api/v1/contract/index_price/{symbol}` | https://contract.mexc.com | none | — | public | none | per futures docs | current | Index price | Futures Trading / Market Data | architecture_gated | public_probe | none |
| Contract fair price | GET | `/api/v1/contract/fair_price/{symbol}` | https://contract.mexc.com | none | — | public | none | per futures docs | current | Fair price | Futures Trading / Market Data | architecture_gated | public_probe | none |
| Contract funding rate | GET | `/api/v1/contract/funding_rate/{symbol}` | https://contract.mexc.com | none | — | public | none | per futures docs | current | Funding rate | Futures Trading / Market Data | architecture_gated | public_probe | none |
| K-line data | GET | `/api/v1/contract/kline/{symbol}` | https://contract.mexc.com | none | — | public | none | per futures docs | current | Futures candles | Futures Trading / Market Data | architecture_gated | public_probe | none |
| Index price K-line | GET | `/api/v1/contract/kline/index_price/{symbol}` | https://contract.mexc.com | none | — | public | none | per futures docs | current | Index candles | Futures Trading / Market Data | architecture_gated | public_probe | none |
| Fair price K-line | GET | `/api/v1/contract/kline/fair_price/{symbol}` | https://contract.mexc.com | none | — | public | none | per futures docs | current | Fair candles | Futures Trading / Market Data | architecture_gated | public_probe | none |
| Contract deals | GET | `/api/v1/contract/deals/{symbol}` | https://contract.mexc.com | none | — | public | none | per futures docs | current | Public trades | Futures Trading / Market Data | architecture_gated | public_probe | none |
| Contract ticker | GET | `/api/v1/contract/ticker` | https://contract.mexc.com | none | — | public | none | per futures docs | current | Futures ticker | Futures Trading / Market Data | architecture_gated | public_probe | none |
| Risk fund balance | GET | `/api/v1/contract/risk_reverse` | https://contract.mexc.com | none | — | public | none | per futures docs | current | Risk fund | Futures Trading / Market Data | architecture_gated | public_probe | none |
| Risk fund history | GET | `/api/v1/contract/risk_reverse/history` | https://contract.mexc.com | none | — | public | none | per futures docs | current | Risk fund history | Futures Trading / Market Data | architecture_gated | public_probe | none |
| Funding rate history | GET | `/api/v1/contract/funding_rate/history` | https://contract.mexc.com | none | — | public | none | per futures docs | current | Funding history | Futures Trading / Market Data | architecture_gated | public_probe | none |
| Futures public WebSocket | WS | `wss://contract.mexc.com/edge` | wss://contract.mexc.com | none | — | public | none | — | current | Realtime futures market | Futures Trading | architecture_gated | public_ws_health | none |

### Futures Private Read

| Name | Method | Endpoint | Host | Auth | Permission | R/W | Side-effect | Rate | Maintenance | TitanGold use | Module | State | Safe verify | Gate |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Get all user assets | GET | `/api/v1/private/account/assets` | https://contract.mexc.com | API-Key + Request-Time + Signature (futures) | Trade reading permission | private_read | read_only | 20/2s | current | Get all user assets | Futures Trading | architecture_gated | private_read_probe | private_read_gate |
| Get single currency asset | GET | `/api/v1/private/account/asset/{currency}` | https://contract.mexc.com | API-Key + Request-Time + Signature (futures) | Trade reading permission | private_read | read_only | per docs | current | Get single currency asset | Futures Trading | architecture_gated | private_read_probe | private_read_gate |
| Asset transfer records | GET | `/api/v1/private/account/transfer_record` | https://contract.mexc.com | API-Key + Request-Time + Signature (futures) | Trade reading permission | private_read | read_only | per docs | current | Asset transfer records | Futures Trading | architecture_gated | private_read_probe | private_read_gate |
| History positions | GET | `/api/v1/private/position/list/history_positions` | https://contract.mexc.com | API-Key + Request-Time + Signature (futures) | Trade reading permission | private_read | read_only | per docs | current | History positions | Futures Trading | architecture_gated | private_read_probe | private_read_gate |
| Open positions | GET | `/api/v1/private/position/open_positions` | https://contract.mexc.com | API-Key + Request-Time + Signature (futures) | Trade reading permission | private_read | read_only | per docs | current | Open positions | Futures Trading | architecture_gated | private_read_probe | private_read_gate |
| Funding records | GET | `/api/v1/private/position/funding_records` | https://contract.mexc.com | API-Key + Request-Time + Signature (futures) | Trade reading permission | private_read | read_only | per docs | current | Funding records | Futures Trading | architecture_gated | private_read_probe | private_read_gate |
| Open orders | GET | `/api/v1/private/order/list/open_orders/{symbol}` | https://contract.mexc.com | API-Key + Request-Time + Signature (futures) | Trade reading permission | private_read | read_only | per docs | current | Open orders | Futures Trading | architecture_gated | private_read_probe | private_read_gate |
| Historical orders | GET | `/api/v1/private/order/list/history_orders` | https://contract.mexc.com | API-Key + Request-Time + Signature (futures) | Trade reading permission | private_read | read_only | per docs | current | Historical orders | Futures Trading | architecture_gated | private_read_probe | private_read_gate |
| Order by external id | GET | `/api/v1/private/order/external/{symbol}/{external_oid}` | https://contract.mexc.com | API-Key + Request-Time + Signature (futures) | Trade reading permission | private_read | read_only | per docs | current | Order by external id | Futures Trading | architecture_gated | private_read_probe | private_read_gate |
| Order by order id | GET | `/api/v1/private/order/get/{order_id}` | https://contract.mexc.com | API-Key + Request-Time + Signature (futures) | Trade reading permission | private_read | read_only | per docs | current | Order by order id | Futures Trading | architecture_gated | private_read_probe | private_read_gate |
| Batch query orders | GET | `/api/v1/private/order/batch_query` | https://contract.mexc.com | API-Key + Request-Time + Signature (futures) | Trade reading permission | private_read | read_only | 5/2s | current | Batch query orders | Futures Trading | architecture_gated | private_read_probe | private_read_gate |
| Order deal details | GET | `/api/v1/private/order/deal_details/{order_id}` | https://contract.mexc.com | API-Key + Request-Time + Signature (futures) | Trade reading permission | private_read | read_only | per docs | current | Order deal details | Futures Trading | architecture_gated | private_read_probe | private_read_gate |
| All order deals | GET | `/api/v1/private/order/list/order_deals` | https://contract.mexc.com | API-Key + Request-Time + Signature (futures) | Trade reading permission | private_read | read_only | per docs | current | All order deals | Futures Trading | architecture_gated | private_read_probe | private_read_gate |
| Trigger order list | GET | `/api/v1/private/planorder/list/orders` | https://contract.mexc.com | API-Key + Request-Time + Signature (futures) | Trade reading permission | private_read | read_only | per docs | current | Trigger order list | Futures Trading | architecture_gated | private_read_probe | private_read_gate |
| Stop-Limit order list | GET | `/api/v1/private/stoporder/list/orders` | https://contract.mexc.com | API-Key + Request-Time + Signature (futures) | Trade reading permission | private_read | read_only | per docs | current | Stop-Limit order list | Futures Trading | architecture_gated | private_read_probe | private_read_gate |
| Risk limits | GET | `/api/v1/private/account/risk_limit` | https://contract.mexc.com | API-Key + Request-Time + Signature (futures) | Trade reading permission | private_read | read_only | per docs | current | Risk limits | Futures Trading | architecture_gated | private_read_probe | private_read_gate |
| Trading fee rate | GET | `/api/v1/private/account/tiered_fee_rate` | https://contract.mexc.com | API-Key + Request-Time + Signature (futures) | Trade reading permission | private_read | read_only | per docs | current | Trading fee rate | Futures Trading | architecture_gated | private_read_probe | private_read_gate |
| Get leverage | GET | `/api/v1/private/position/leverage` | https://contract.mexc.com | API-Key + Request-Time + Signature (futures) | Trading permission | private_read | read_only | 20/2s | current | Get leverage | Futures Trading | architecture_gated | private_read_probe | private_read_gate |
| Get position mode | GET | `/api/v1/private/position/position_mode` | https://contract.mexc.com | API-Key + Request-Time + Signature (futures) | Trading permission | private_read | read_only | 20/2s | current | Get position mode | Futures Trading | architecture_gated | private_read_probe | private_read_gate |

### Futures Trading

| Name | Method | Endpoint | Host | Auth | Permission | R/W | Side-effect | Rate | Maintenance | TitanGold use | Module | State | Safe verify | Gate |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Submit order | POST | `/api/v1/private/order/submit` | https://contract.mexc.com | API-Key + Request-Time + Signature (futures) | Trading permission | private_write | financial_write | 20/2s typical | maintenance | Submit order | Futures Trading | architecture_gated | not_safely_testable | blocked_tier4 |

> Deferred/unsupported reason: Official docs title: Order (Under maintenance)

| Submit batch order | POST | `/api/v1/private/order/submit_batch` | https://contract.mexc.com | API-Key + Request-Time + Signature (futures) | Trading permission | private_write | financial_write | 20/2s typical | maintenance | Submit batch order | Futures Trading | architecture_gated | not_safely_testable | blocked_tier4 |

> Deferred/unsupported reason: Official docs title: Bulk order (Under maintenance)

| Cancel order | POST | `/api/v1/private/order/cancel` | https://contract.mexc.com | API-Key + Request-Time + Signature (futures) | Trading permission | private_write | financial_write | 20/2s typical | maintenance | Cancel order | Futures Trading | architecture_gated | not_safely_testable | blocked_tier4 |

> Deferred/unsupported reason: Official docs title: Cancel the order (Under maintenance)

| Cancel with external id | POST | `/api/v1/private/order/cancel_with_external` | https://contract.mexc.com | API-Key + Request-Time + Signature (futures) | Trading permission | private_write | financial_write | 20/2s typical | maintenance | Cancel with external id | Futures Trading | architecture_gated | not_safely_testable | blocked_tier4 |

> Deferred/unsupported reason: Official docs

| Cancel all orders | POST | `/api/v1/private/order/cancel_all` | https://contract.mexc.com | API-Key + Request-Time + Signature (futures) | Trading permission | private_write | financial_write | 20/2s typical | maintenance | Cancel all orders | Futures Trading | architecture_gated | not_safely_testable | blocked_tier4 |

> Deferred/unsupported reason: Official docs

| Change margin | POST | `/api/v1/private/position/change_margin` | https://contract.mexc.com | API-Key + Request-Time + Signature (futures) | Trading permission | private_write | financial_write | 20/2s typical | current | Change margin | Futures Trading | architecture_gated | not_safely_testable | blocked_tier4 |
| Change leverage | POST | `/api/v1/private/position/change_leverage` | https://contract.mexc.com | API-Key + Request-Time + Signature (futures) | Trading permission | private_write | financial_write | 20/2s typical | current | Change leverage | Futures Trading | architecture_gated | not_safely_testable | blocked_tier4 |
| Change position mode | POST | `/api/v1/private/position/change_position_mode` | https://contract.mexc.com | API-Key + Request-Time + Signature (futures) | Trading permission | private_write | financial_write | 20/2s typical | current | Change position mode | Futures Trading | architecture_gated | not_safely_testable | blocked_tier4 |
| Change risk level | POST | `/api/v1/private/account/change_risk_level` | https://contract.mexc.com | API-Key + Request-Time + Signature (futures) | Trading permission | private_write | financial_write | 20/2s typical | current | Change risk level | Futures Trading | architecture_gated | not_safely_testable | blocked_tier4 |
| Place trigger order | POST | `/api/v1/private/planorder/place` | https://contract.mexc.com | API-Key + Request-Time + Signature (futures) | Trading permission | private_write | financial_write | 20/2s typical | maintenance | Place trigger order | Futures Trading | architecture_gated | not_safely_testable | blocked_tier4 |

> Deferred/unsupported reason: Trigger order (Under maintenance)

| Cancel trigger order | POST | `/api/v1/private/planorder/cancel` | https://contract.mexc.com | API-Key + Request-Time + Signature (futures) | Trading permission | private_write | financial_write | 20/2s typical | maintenance | Cancel trigger order | Futures Trading | architecture_gated | not_safely_testable | blocked_tier4 |
| Cancel all trigger orders | POST | `/api/v1/private/planorder/cancel_all` | https://contract.mexc.com | API-Key + Request-Time + Signature (futures) | Trading permission | private_write | financial_write | 20/2s typical | maintenance | Cancel all trigger orders | Futures Trading | architecture_gated | not_safely_testable | blocked_tier4 |

> Deferred/unsupported reason: Under maintenance

| Cancel stop order | POST | `/api/v1/private/stoporder/cancel` | https://contract.mexc.com | API-Key + Request-Time + Signature (futures) | Trading permission | private_write | financial_write | 20/2s typical | maintenance | Cancel stop order | Futures Trading | architecture_gated | not_safely_testable | blocked_tier4 |
| Cancel all stop orders | POST | `/api/v1/private/stoporder/cancel_all` | https://contract.mexc.com | API-Key + Request-Time + Signature (futures) | Trading permission | private_write | financial_write | 20/2s typical | maintenance | Cancel all stop orders | Futures Trading | architecture_gated | not_safely_testable | blocked_tier4 |

> Deferred/unsupported reason: Under maintenance

| Change stop price | POST | `/api/v1/private/stoporder/change_price` | https://contract.mexc.com | API-Key + Request-Time + Signature (futures) | Trading permission | private_write | financial_write | 20/2s typical | current | Change stop price | Futures Trading | architecture_gated | not_safely_testable | blocked_tier4 |
| Change stop plan price | POST | `/api/v1/private/stoporder/change_plan_price` | https://contract.mexc.com | API-Key + Request-Time + Signature (futures) | Trading permission | private_write | financial_write | 20/2s typical | current | Change stop plan price | Futures Trading | architecture_gated | not_safely_testable | blocked_tier4 |

### P2P

| Name | Method | Endpoint | Host | Auth | Permission | R/W | Side-effect | Rate | Maintenance | TitanGold use | Module | State | Safe verify | Gate |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| P2P read APIs | — | `PROVIDER SUPPORT NOT VERIFIED` | — | — | — | unknown | unknown | — | current | P2P read APIs | Connections | PROVIDER_SUPPORT_NOT_VERIFIED | not_safely_testable | blocked_unsupported |

> Deferred/unsupported reason: PROVIDER SUPPORT NOT VERIFIED — no current official endpoint found in Spot v3 / Contract v1 docs audited on 2026-07-19

| P2P execute APIs | — | `PROVIDER SUPPORT NOT VERIFIED` | — | — | — | unknown | unknown | — | current | P2P execute APIs | Connections | PROVIDER_SUPPORT_NOT_VERIFIED | not_safely_testable | blocked_unsupported |

> Deferred/unsupported reason: PROVIDER SUPPORT NOT VERIFIED — no current official endpoint found in Spot v3 / Contract v1 docs audited on 2026-07-19


### Account

| Name | Method | Endpoint | Host | Auth | Permission | R/W | Side-effect | Rate | Maintenance | TitanGold use | Module | State | Safe verify | Gate |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Account-edit APIs (beyond MX deduct) | — | `PROVIDER SUPPORT NOT VERIFIED` | — | — | — | unknown | unknown | — | current | Account-edit APIs (beyond MX deduct) | Connections | PROVIDER_SUPPORT_NOT_VERIFIED | not_safely_testable | blocked_unsupported |

> Deferred/unsupported reason: PROVIDER SUPPORT NOT VERIFIED — no current official endpoint found in Spot v3 / Contract v1 docs audited on 2026-07-19

| Permission-management APIs | — | `PROVIDER SUPPORT NOT VERIFIED` | — | — | — | unknown | unknown | — | current | Permission-management APIs | Connections | PROVIDER_SUPPORT_NOT_VERIFIED | not_safely_testable | blocked_unsupported |

> Deferred/unsupported reason: PROVIDER SUPPORT NOT VERIFIED — no current official endpoint found in Spot v3 / Contract v1 docs audited on 2026-07-19


## Provider support not verified

- P2P read APIs: PROVIDER SUPPORT NOT VERIFIED
- P2P execute APIs: PROVIDER SUPPORT NOT VERIFIED
- Account-edit APIs (beyond MX deduct): PROVIDER SUPPORT NOT VERIFIED
- Permission-management APIs: PROVIDER SUPPORT NOT VERIFIED

## Canonical capability IDs

See `backend/services/connections/mexc/capabilityIds.js`.

## Migration rollback

```sql
BEGIN;
DROP TABLE IF EXISTS mexc_connection_consumer_bindings;
DROP TABLE IF EXISTS mexc_capability_verifications;
DROP TABLE IF EXISTS mexc_connection_capability_state;
COMMIT;
```

## Real-provider checkpoint

Verdict target: `READY FOR CONTROLLED READ-ONLY AUTHORIZATION`

Do not execute real private MEXC calls until explicit user approval.
Do not ask the user to paste credentials into chat.


## Engineering checkpoint status (pre real-provider)

| Item | Value |
|------|--------|
| Program branch | `feat/mexc-end-to-end` |
| `origin/main` HEAD | `5ff9008` |
| Runtime implementation marker | `e436df4` |
| Frontend bundle | `assets/index-CQAeHBq6.js` |
| Environment | Staging `https://titan.zala.ir` |
| Migration | `049_mexc_capability_states.sql` applied |
| Live private verify gates | `CONNECTIONS_PRIVATE_VERIFY_LIVE` / `CONNECTIONS_CAPABILITY_VERIFY_LIVE` default **off** |
| Test Connection UI | Disabled until authorization |
| Real private MEXC calls | **None** |
| Verdict | `READY FOR CONTROLLED READ-ONLY AUTHORIZATION` |

### Proposed controlled read-only order

1. `GET /api/v3/account` (`SPOT_ACCOUNT_READ`)
2. `GET /api/v3/openOrders?symbol=BTCUSDT` (`SPOT_DEAL_READ`)
3. `GET /api/v3/myTrades?symbol=BTCUSDT&limit=1` (`SPOT_ACCOUNT_READ`)
4. `GET /api/v3/capital/config/getall` (`SPOT_WITHDRAW_READ`)
5. `GET /api/v3/capital/deposit/hisrec?limit=1`
6. `GET /api/v3/capital/withdraw/history?limit=1`
7. `GET /api/v3/capital/transfer` (history read)
8. `GET /api/v1/private/account/assets` (Futures)
9. `GET /api/v1/private/position/open_positions` (Futures)

Timeouts: 8000ms. Persistence: sanitized capability state only (no balances/raw bodies).
Test New Order / withdrawals / transfers / orders: **excluded**.

### Automated tests (executed)

| Suite | Passed |
|-------|--------|
| `connections.mexc.e2e.program.test.js` | 17 |
| WP2A private auth | included in 58 total |
| WP2A provenance gate | included in 58 total |
| **Total** | **58 passed / 0 failed** |

### Browser QA (passive / fake states)

Core Connections panel, matrix, consumers, disabled Test Connection, empty credentials, no secret leak, mobile/tablet/landscape, Spot/Futures gate panels, console: **PASS**.
Persian/RTL switch and Wallet tab deep-nav: **NEEDS HUMAN-QA** (automation flaky on Settings sub-nav overlays).
