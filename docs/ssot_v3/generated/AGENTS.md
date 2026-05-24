## AGENTS – Generated (SSOT v3.0)

Generated at: `2026-02-23T20:16:29.766Z`

> Source of truth:
> - Registry: `backend/services/agents/registry.js` (AGENT_MODULES, listAgentKeys).
> - Database: `ai_agents` table (current runtime state).

| Agent Key | In Registry? | In DB? | Name (DB) | Type | Status | Enabled? | Accuracy | Total Decisions | Version |
|---|:---:|:---:|---|---|---|:---:|---:|---:|---|
| `arbitrage` | ✅ | ✅ | Arbitrage Agent | arbitrage | active | ✅ |  | 0 | 1.0.0 |
| `fundamental` | ✅ | ✅ | Fundamental Agent | fundamental_analysis | active | ✅ |  | 0 | 1.0.0 |
| `liquidity` | ✅ | ✅ | Liquidity Agent | liquidity_analysis | active | ✅ |  | 0 | 1.0.0 |
| `market_intelligence` | ✅ | ✅ | Market Intelligence Agent | market_intelligence | active | ✅ |  | 0 | 1.0.0 |
| `optimization` | ✅ | ✅ | Optimization Agent | optimization | active | ✅ |  | 0 | 1.0.0 |
| `order` | ✅ | ✅ | Order Management Agent | order_management | active | ✅ |  | 0 | 1.0.0 |
| `pattern` | ✅ | ✅ | Pattern Recognition Agent | pattern_recognition | active | ✅ |  | 0 | 1.0.0 |
| `portfolio` | ✅ | ✅ | Portfolio Allocation Agent | portfolio_management | active | ✅ |  | 0 | 1.0.0 |
| `price_prediction` | ✅ | ✅ | Price Prediction Agent | price_prediction | active | ✅ |  | 0 | 1.0.0 |
| `risk` | ✅ | ✅ | Risk Management Agent | risk_management | active | ✅ |  | 9 | 1.0.0 |
| `sentiment` | ✅ | ✅ | Sentiment Analysis Agent | sentiment_analysis | active | ✅ |  | 0 | 1.0.0 |
| `technical` | ✅ | ✅ | Technical Analysis Agent | technical_analysis | active | ✅ |  | 16 | 1.0.0 |
| `timing` | ✅ | ✅ | Timing Agent | timing | active | ✅ |  | 0 | 1.0.0 |
| `trend` | ✅ | ✅ | Trend Agent | trend_detection | active | ✅ |  | 0 | 1.0.0 |
| `volume` | ✅ | ✅ | Volume Agent | volume_analysis | active | ✅ |  | 0 | 1.0.0 |

### Notes

- Rows با `In Registry? = ❌` نشان می‌دهند agentهایی که در DB هستند ولی در registry فعلی کد ثبت نشده‌اند.
- Rows با `In DB? = ❌` نشان می‌دهند agentهایی که در registry تعریف شده‌اند ولی هنوز در جدول `ai_agents` درج نشده‌اند.