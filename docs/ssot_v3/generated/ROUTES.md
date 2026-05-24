## ROUTES – Generated (SSOT v3.0)

Generated at: `2026-02-23T20:16:29.139Z`

> Source of truth: Express router stack from `backend/routes/v1/index.js`.
> Auth/Role detection is derived from middleware metadata (`authenticate`, `authorize(requiredRoles)`).

| Method | Path | Auth required? | Role required? | Source file |
|---:|---|---:|---|---|
| `GET` | `/api/v1/agents/liquidity/metrics` | Yes |  | `backend/routes/liquidity-agent.js` |
| `POST` | `/api/v1/agents/liquidity/run` | Yes |  | `backend/routes/liquidity-agent.js` |
| `GET` | `/api/v1/agents/liquidity/runs` | Yes |  | `backend/routes/liquidity-agent.js` |
| `GET` | `/api/v1/agents/liquidity/runs/latest` | Yes |  | `backend/routes/liquidity-agent.js` |
| `GET` | `/api/v1/agents/liquidity/settings` | Yes |  | `backend/routes/liquidity-agent.js` |
| `POST` | `/api/v1/agents/liquidity/settings` | Yes |  | `backend/routes/liquidity-agent.js` |
| `GET` | `/api/v1/agents/liquidity/status` | Yes |  | `backend/routes/liquidity-agent.js` |
| `GET` | `/api/v1/ai-agents/` | Yes |  | `backend/routes/ai-agents.js` |
| `GET` | `/api/v1/ai-agents/:id` | Yes |  | `backend/routes/ai-agents.js` |
| `PATCH` | `/api/v1/ai-agents/:id` | Yes |  | `backend/routes/ai-agents.js` |
| `POST` | `/api/v1/ai-agents/:id/command` | Yes |  | `backend/routes/ai-agents.js` |
| `PATCH` | `/api/v1/ai-agents/:id/config` | Yes |  | `backend/routes/ai-agents.js` |
| `GET` | `/api/v1/ai-agents/:id/details` | Yes |  | `backend/routes/ai-agents.js` |
| `POST` | `/api/v1/ai-agents/:id/run` | Yes |  | `backend/routes/ai-agents.js` |
| `POST` | `/api/v1/ai-agents/:id/run-v2` | Yes |  | `backend/routes/ai-agents.js` |
| `POST` | `/api/v1/ai-agents/chat` | Yes |  | `backend/routes/ai-agents.js` |
| `GET` | `/api/v1/ai-agents/manager-overview` | Yes |  | `backend/routes/ai-agents.js` |
| `GET` | `/api/v1/analytics/overview` | Yes |  | `backend/routes/analytics.js` |
| `PUT` | `/api/v1/artemis/config` | Yes | `admin` | `backend/routes/artemis.js` |
| `PATCH` | `/api/v1/artemis/config/decision-engine` | Yes | `admin` | `backend/routes/artemis.js` |
| `POST` | `/api/v1/artemis/decision` | Yes |  | `backend/routes/artemis.js` |
| `GET` | `/api/v1/artemis/health` | Yes |  | `backend/routes/artemis.js` |
| `GET` | `/api/v1/artemis/learning` | Yes |  | `backend/routes/artemis.js` |
| `POST` | `/api/v1/artemis/learning/event` | Yes | `admin` | `backend/routes/artemis.js` |
| `PATCH` | `/api/v1/artemis/learning/mistake/:id/mark-learned` | Yes |  | `backend/routes/artemis.js` |
| `DELETE` | `/api/v1/artemis/logs` | Yes | `admin` | `backend/routes/artemis.js` |
| `GET` | `/api/v1/artemis/logs` | Yes |  | `backend/routes/artemis.js` |
| `GET` | `/api/v1/artemis/orchestration` | Yes |  | `backend/routes/artemis.js` |
| `GET` | `/api/v1/artemis/scenarios` | Yes |  | `backend/routes/artemis.js` |
| `GET` | `/api/v1/artemis/state` | Yes |  | `backend/routes/artemis.js` |
| `PATCH` | `/api/v1/artemis/state` | Yes |  | `backend/routes/artemis.js` |
| `POST` | `/api/v1/auth/login` | No |  | `backend/routes/auth.js` |
| `POST` | `/api/v1/auth/logout` | Yes |  | `backend/routes/auth.js` |
| `GET` | `/api/v1/auth/me` | Yes |  | `backend/routes/auth.js` |
| `POST` | `/api/v1/auth/refresh` | No |  | `backend/routes/auth.js` |
| `POST` | `/api/v1/auth/register` | No |  | `backend/routes/auth.js` |
| `POST` | `/api/v1/autopilot/disable` | No |  | `backend/routes/autopilot.js` |
| `POST` | `/api/v1/autopilot/enable` | No |  | `backend/routes/autopilot.js` |
| `POST` | `/api/v1/autopilot/run-once` | No |  | `backend/routes/autopilot.js` |
| `GET` | `/api/v1/autopilot/status` | No |  | `backend/routes/autopilot.js` |
| `GET` | `/api/v1/autopilot/suggestions` | No |  | `backend/routes/autopilot.js` |
| `POST` | `/api/v1/autopilot/suggestions/:id/approve` | No |  | `backend/routes/autopilot.js` |
| `POST` | `/api/v1/autopilot/suggestions/:id/reject` | No |  | `backend/routes/autopilot.js` |
| `POST` | `/api/v1/autopilot/suggestions/:id/rollback` | No |  | `backend/routes/autopilot.js` |
| `GET` | `/api/v1/backtest/results` | Yes |  | `backend/routes/backtest.js` |
| `DELETE` | `/api/v1/backtest/results/:id` | Yes | `admin, trader` | `backend/routes/backtest.js` |
| `GET` | `/api/v1/backtest/results/:id` | Yes |  | `backend/routes/backtest.js` |
| `POST` | `/api/v1/backtest/run` | Yes |  | `backend/routes/backtest.js` |
| `GET` | `/api/v1/backtest/stats` | Yes |  | `backend/routes/backtest.js` |
| `GET` | `/api/v1/collected-data/` | Yes |  | `backend/routes/collected-data.js` |
| `POST` | `/api/v1/collected-data/` | Yes |  | `backend/routes/collected-data.js` |
| `DELETE` | `/api/v1/collected-data/:id` | Yes |  | `backend/routes/collected-data.js` |
| `GET` | `/api/v1/collected-data/:id` | Yes |  | `backend/routes/collected-data.js` |
| `PUT` | `/api/v1/collected-data/:id` | Yes |  | `backend/routes/collected-data.js` |
| `POST` | `/api/v1/collected-data/batch` | Yes |  | `backend/routes/collected-data.js` |
| `GET` | `/api/v1/collected-data/deduplication/find` | Yes |  | `backend/routes/collected-data.js` |
| `POST` | `/api/v1/collected-data/deduplication/merge/:contentHash` | Yes |  | `backend/routes/collected-data.js` |
| `POST` | `/api/v1/collected-data/deduplication/remove` | Yes |  | `backend/routes/collected-data.js` |
| `GET` | `/api/v1/collected-data/deduplication/stats` | Yes |  | `backend/routes/collected-data.js` |
| `GET` | `/api/v1/config/artemis` | No |  | `backend/routes/config.js` |
| `PUT` | `/api/v1/config/artemis` | No |  | `backend/routes/config.js` |
| `GET` | `/api/v1/config/integrations` | No |  | `backend/routes/config.js` |
| `POST` | `/api/v1/config/integrations` | No |  | `backend/routes/config.js` |
| `PATCH` | `/api/v1/config/integrations/:id` | No |  | `backend/routes/config.js` |
| `POST` | `/api/v1/config/integrations/:id/disable` | No |  | `backend/routes/config.js` |
| `POST` | `/api/v1/config/integrations/:id/reset-runtime` | No |  | `backend/routes/config.js` |
| `POST` | `/api/v1/config/integrations/:id/test` | No |  | `backend/routes/config.js` |
| `GET` | `/api/v1/config/security` | No |  | `backend/routes/config.js` |
| `PUT` | `/api/v1/config/security` | No |  | `backend/routes/config.js` |
| `GET` | `/api/v1/connections/exchanges/` | Yes |  | `backend/routes/connections.js` |
| `DELETE` | `/api/v1/connections/exchanges/:exchange` | Yes | `admin, trader` | `backend/routes/connections.js` |
| `GET` | `/api/v1/connections/exchanges/:exchange` | Yes |  | `backend/routes/connections.js` |
| `POST` | `/api/v1/connections/exchanges/:exchange` | Yes | `admin, trader` | `backend/routes/connections.js` |
| `POST` | `/api/v1/connections/exchanges/:exchange/test` | Yes |  | `backend/routes/connections.js` |
| `GET` | `/api/v1/connections/exchanges/health/status` | Yes |  | `backend/routes/connections.js` |
| `GET` | `/api/v1/connections/mexc` | Yes |  | `backend/routes/connections.js` |
| `POST` | `/api/v1/connections/mexc` | Yes | `admin, trader` | `backend/routes/connections.js` |
| `POST` | `/api/v1/connections/mexc/test` | Yes |  | `backend/routes/connections.js` |
| `GET` | `/api/v1/data-categories/` | Yes |  | `backend/routes/data-categories.js` |
| `POST` | `/api/v1/data-categories/` | Yes |  | `backend/routes/data-categories.js` |
| `DELETE` | `/api/v1/data-categories/:id` | Yes |  | `backend/routes/data-categories.js` |
| `GET` | `/api/v1/data-categories/:id` | Yes |  | `backend/routes/data-categories.js` |
| `PUT` | `/api/v1/data-categories/:id` | Yes |  | `backend/routes/data-categories.js` |
| `DELETE` | `/api/v1/data-hub/access-control/:sourceId` | Yes |  | `backend/routes/access-control.js` |
| `GET` | `/api/v1/data-hub/access-control/:sourceId` | Yes |  | `backend/routes/access-control.js` |
| `POST` | `/api/v1/data-hub/access-control/:sourceId` | Yes |  | `backend/routes/access-control.js` |
| `GET` | `/api/v1/data-sources/` | Yes |  | `backend/routes/data-sources.js` |
| `POST` | `/api/v1/data-sources/` | Yes |  | `backend/routes/data-sources.js` |
| `DELETE` | `/api/v1/data-sources/:id` | Yes |  | `backend/routes/data-sources.js` |
| `PUT` | `/api/v1/data-sources/:id` | Yes |  | `backend/routes/data-sources.js` |
| `PATCH` | `/api/v1/data-sources/:id/restore` | Yes |  | `backend/routes/data-sources.js` |
| `GET` | `/api/v1/data-sources/collected` | Yes |  | `backend/routes/data-sources.js` |
| `GET` | `/api/v1/data-sources/collected/:id` | Yes |  | `backend/routes/data-sources.js` |
| `GET` | `/api/v1/data-sources/health` | Yes |  | `backend/routes/data-sources.js` |
| `POST` | `/api/v1/data-sources/publish-telegram` | Yes |  | `backend/routes/data-sources.js` |
| `GET` | `/api/v1/data-sources/state` | Yes |  | `backend/routes/data-sources.js` |
| `GET` | `/api/v1/data-sources/stats` | Yes |  | `backend/routes/data-sources.js` |
| `GET` | `/api/v1/data-sources/telegram-account-metrics` | Yes |  | `backend/routes/data-sources.js` |
| `POST` | `/api/v1/data-sources/telegram-sync` | Yes |  | `backend/routes/data-sources.js` |
| `POST` | `/api/v1/data-sources/telegram-sync-category` | Yes |  | `backend/routes/data-sources.js` |
| `POST` | `/api/v1/data-sources/telegram-transfer-messages` | Yes |  | `backend/routes/data-sources.js` |
| `POST` | `/api/v1/data-sources/test-connection` | Yes |  | `backend/routes/data-sources.js` |
| `POST` | `/api/v1/email/send` | Yes |  | `backend/routes/email.js` |
| `POST` | `/api/v1/email/test` | Yes |  | `backend/routes/email.js` |
| `GET` | `/api/v1/exports/decisions` | Yes |  | `backend/routes/exports.js` |
| `GET` | `/api/v1/exports/manual-trades` | Yes |  | `backend/routes/exports.js` |
| `GET` | `/api/v1/exports/trades` | Yes |  | `backend/routes/exports.js` |
| `GET` | `/api/v1/favorite-alerts/:favoriteId/alerts` | Yes |  | `backend/routes/v1/index.js` |
| `POST` | `/api/v1/favorite-alerts/:favoriteId/alerts` | Yes |  | `backend/routes/v1/index.js` |
| `DELETE` | `/api/v1/favorite-alerts/alerts/:alertId` | Yes |  | `backend/routes/v1/index.js` |
| `PUT` | `/api/v1/favorite-alerts/alerts/:alertId` | Yes |  | `backend/routes/v1/index.js` |
| `POST` | `/api/v1/favorite-alerts/alerts/:alertId/test` | Yes |  | `backend/routes/v1/index.js` |
| `POST` | `/api/v1/favorite-alerts/alerts/:alertId/trigger` | Yes |  | `backend/routes/v1/index.js` |
| `GET` | `/api/v1/favorite-alerts/alerts/active` | Yes |  | `backend/routes/v1/index.js` |
| `GET` | `/api/v1/favorite-alerts/monitor/stats` | Yes |  | `backend/routes/v1/index.js` |
| `GET` | `/api/v1/favorites/` | Yes |  | `backend/routes/favorites.js` |
| `POST` | `/api/v1/favorites/` | Yes |  | `backend/routes/favorites.js` |
| `DELETE` | `/api/v1/favorites/:id` | Yes |  | `backend/routes/favorites.js` |
| `PUT` | `/api/v1/favorites/:id/view` | Yes |  | `backend/routes/favorites.js` |
| `GET` | `/api/v1/favorites/analytics` | Yes |  | `backend/routes/favorites.js` |
| `DELETE` | `/api/v1/favorites/by-asset/:assetId` | Yes |  | `backend/routes/favorites.js` |
| `GET` | `/api/v1/favorites/check/:assetId` | Yes |  | `backend/routes/favorites.js` |
| `GET` | `/api/v1/favorites/stats` | Yes |  | `backend/routes/favorites.js` |
| `POST` | `/api/v1/favorites/sync` | Yes |  | `backend/routes/favorites.js` |
| `GET` | `/api/v1/health/` | No |  | `backend/routes/health.js` |
| `GET` | `/api/v1/health/ready` | No |  | `backend/routes/health.js` |
| `GET` | `/api/v1/health/status` | No |  | `backend/routes/health.js` |
| `GET` | `/api/v1/manual-trades/balance` | Yes |  | `backend/routes/manual-trades.js` |
| `POST` | `/api/v1/manual-trades/execute` | Yes | `admin, trader` | `backend/routes/manual-trades.js` |
| `POST` | `/api/v1/manual-trades/order/advanced` | Yes | `admin, trader` | `backend/routes/manual-trades.js` |
| `GET` | `/api/v1/manual-trades/orderbook/:pair` | Yes |  | `backend/routes/manual-trades.js` |
| `DELETE` | `/api/v1/manual-trades/orders/:orderId` | Yes | `admin, trader` | `backend/routes/manual-trades.js` |
| `GET` | `/api/v1/manual-trades/orders/open` | Yes |  | `backend/routes/manual-trades.js` |
| `GET` | `/api/v1/manual-trades/page-data` | Yes |  | `backend/routes/manual-trades.js` |
| `GET` | `/api/v1/manual-trades/price/:pair` | Yes |  | `backend/routes/manual-trades.js` |
| `GET` | `/api/v1/manual-trades/recent` | Yes |  | `backend/routes/manual-trades.js` |
| `POST` | `/api/v1/manual-trades/strategies/:strategyId/toggle` | Yes | `admin, trader` | `backend/routes/manual-trades.js` |
| `GET` | `/api/v1/market/mexc/depth` | No |  | `backend/routes/market-proxy.js` |
| `GET` | `/api/v1/market/mexc/exchangeInfo` | No |  | `backend/routes/market-proxy.js` |
| `GET` | `/api/v1/market/mexc/ticker/24hr` | No |  | `backend/routes/market-proxy.js` |
| `GET` | `/api/v1/market/mexc/ticker24hr` | No |  | `backend/routes/market-proxy.js` |
| `POST` | `/api/v1/monitoring/clear-slow-queries` | Yes |  | `backend/routes/monitoring.js` |
| `GET` | `/api/v1/monitoring/db-pool` | Yes |  | `backend/routes/monitoring.js` |
| `GET` | `/api/v1/monitoring/errors` | Yes |  | `backend/routes/monitoring.js` |
| `GET` | `/api/v1/monitoring/health` | No |  | `backend/routes/monitoring.js` |
| `GET` | `/api/v1/monitoring/requests` | Yes |  | `backend/routes/monitoring.js` |
| `GET` | `/api/v1/monitoring/slow-queries` | Yes |  | `backend/routes/monitoring.js` |
| `GET` | `/api/v1/monitoring/slow-query-stats` | Yes |  | `backend/routes/monitoring.js` |
| `GET` | `/api/v1/monitoring/summary` | Yes |  | `backend/routes/monitoring.js` |
| `GET` | `/api/v1/notifications/` | Yes |  | `backend/routes/notifications.js` |
| `POST` | `/api/v1/notifications/broadcast` | Yes |  | `backend/routes/notifications.js` |
| `GET` | `/api/v1/notifications/history` | Yes |  | `backend/routes/notifications.js` |
| `DELETE` | `/api/v1/notifications/history/:id` | Yes |  | `backend/routes/notifications.js` |
| `PUT` | `/api/v1/notifications/history/:id/read` | Yes |  | `backend/routes/notifications.js` |
| `GET` | `/api/v1/notifications/settings` | Yes |  | `backend/routes/notifications.js` |
| `PUT` | `/api/v1/notifications/settings` | Yes |  | `backend/routes/notifications.js` |
| `POST` | `/api/v1/notifications/test` | Yes |  | `backend/routes/notifications.js` |
| `GET` | `/api/v1/portfolios/` | Yes |  | `backend/routes/portfolios.js` |
| `POST` | `/api/v1/portfolios/` | Yes |  | `backend/routes/portfolios.js` |
| `POST` | `/api/v1/profile/avatar` | Yes |  | `backend/routes/profile.js` |
| `POST` | `/api/v1/profile/change-password` | Yes |  | `backend/routes/profile.js` |
| `PUT` | `/api/v1/profile/communications` | Yes |  | `backend/routes/profile.js` |
| `GET` | `/api/v1/profile/details` | Yes |  | `backend/routes/profile.js` |
| `PUT` | `/api/v1/profile/details` | Yes |  | `backend/routes/profile.js` |
| `GET` | `/api/v1/ready/` | No |  | `backend/routes/health.js` |
| `GET` | `/api/v1/ready/ready` | No |  | `backend/routes/health.js` |
| `GET` | `/api/v1/ready/status` | No |  | `backend/routes/health.js` |
| `GET` | `/api/v1/scenarios/` | Yes |  | `backend/routes/scenarios.js` |
| `POST` | `/api/v1/scenarios/` | Yes |  | `backend/routes/scenarios.js` |
| `DELETE` | `/api/v1/scenarios/:id` | Yes | `admin, trader` | `backend/routes/scenarios.js` |
| `GET` | `/api/v1/scenarios/:id` | Yes |  | `backend/routes/scenarios.js` |
| `PATCH` | `/api/v1/scenarios/:id` | Yes |  | `backend/routes/scenarios.js` |
| `POST` | `/api/v1/scenarios/:id/backtest` | Yes |  | `backend/routes/scenarios.js` |
| `POST` | `/api/v1/scenarios/generate` | Yes |  | `backend/routes/scenarios.js` |
| `GET` | `/api/v1/scheduler/config` | Yes |  | `backend/routes/scheduler.js` |
| `PUT` | `/api/v1/scheduler/config/:section` | Yes | `admin, trader` | `backend/routes/scheduler.js` |
| `POST` | `/api/v1/scheduler/start` | Yes | `admin, trader` | `backend/routes/scheduler.js` |
| `GET` | `/api/v1/scheduler/status` | Yes |  | `backend/routes/scheduler.js` |
| `POST` | `/api/v1/scheduler/stop` | Yes | `admin, trader` | `backend/routes/scheduler.js` |
| `POST` | `/api/v1/security/2fa/backup-codes/generate` | Yes |  | `backend/routes/security.js` |
| `GET` | `/api/v1/security/2fa/backup-codes/remaining` | Yes |  | `backend/routes/security.js` |
| `POST` | `/api/v1/security/2fa/backup-codes/verify` | No |  | `backend/routes/security.js` |
| `POST` | `/api/v1/security/2fa/disable` | Yes |  | `backend/routes/security.js` |
| `POST` | `/api/v1/security/2fa/setup` | Yes |  | `backend/routes/security.js` |
| `POST` | `/api/v1/security/2fa/verify` | Yes |  | `backend/routes/security.js` |
| `POST` | `/api/v1/security/2fa/verify-token` | Yes |  | `backend/routes/security.js` |
| `GET` | `/api/v1/settings/` | No |  | `backend/routes/settings.js` |
| `DELETE` | `/api/v1/settings/:key` | Yes | `admin` | `backend/routes/settings.js` |
| `GET` | `/api/v1/settings/:key` | No |  | `backend/routes/settings.js` |
| `PUT` | `/api/v1/settings/:key` | Yes | `admin` | `backend/routes/settings.js` |
| `POST` | `/api/v1/settings/bulk` | Yes | `admin` | `backend/routes/settings.js` |
| `GET` | `/api/v1/settings/trading-mode` | Yes |  | `backend/routes/settings.js` |
| `POST` | `/api/v1/settings/trading-mode` | Yes |  | `backend/routes/settings.js` |
| `GET` | `/api/v1/strategies/` | Yes |  | `backend/routes/strategies.js` |
| `POST` | `/api/v1/strategies/` | Yes | `admin, trader` | `backend/routes/strategies.js` |
| `PUT` | `/api/v1/strategies/:strategyId` | Yes | `admin, trader` | `backend/routes/strategies.js` |
| `POST` | `/api/v1/strategies/:strategyId/copy` | Yes | `admin, trader` | `backend/routes/strategies.js` |
| `POST` | `/api/v1/strategies/:strategyId/toggle` | Yes | `admin, trader` | `backend/routes/strategies.js` |
| `POST` | `/api/v1/strategies/ai-generate` | Yes | `admin, trader` | `backend/routes/strategies.js` |
| `POST` | `/api/v1/strategies/allocate-portfolio` | Yes | `admin, trader` | `backend/routes/strategies.js` |
| `GET` | `/api/v1/strategies/export/all` | Yes |  | `backend/routes/strategies.js` |
| `POST` | `/api/v1/strategies/group-backtest` | Yes | `admin, trader` | `backend/routes/strategies.js` |
| `POST` | `/api/v1/strategies/optimize-all` | Yes | `admin, trader` | `backend/routes/strategies.js` |
| `GET` | `/api/v1/telegram/agents/:agentKey/feed` | No |  | `backend/routes/telegram.js` |
| `POST` | `/api/v1/telegram/agents/:agentKey/mark-processed` | Yes |  | `backend/routes/telegram.js` |
| `GET` | `/api/v1/telegram/agents/summary` | No |  | `backend/routes/telegram.js` |
| `GET` | `/api/v1/telegram/breaking-news` | No |  | `backend/routes/telegram.js` |
| `GET` | `/api/v1/telegram/categories/:category/timeline` | No |  | `backend/routes/telegram.js` |
| `GET` | `/api/v1/telegram/categories/summary` | No |  | `backend/routes/telegram.js` |
| `GET` | `/api/v1/telegram/events/recent` | No |  | `backend/routes/telegram.js` |
| `GET` | `/api/v1/telegram/health` | No |  | `backend/routes/telegram.js` |
| `GET` | `/api/v1/telegram/stats/real-time` | No |  | `backend/routes/telegram.js` |
| `GET` | `/api/v1/topic-routing/` | Yes |  | `backend/routes/topic-routing.js` |
| `POST` | `/api/v1/topic-routing/` | Yes |  | `backend/routes/topic-routing.js` |
| `DELETE` | `/api/v1/topic-routing/:id` | Yes |  | `backend/routes/topic-routing.js` |
| `PUT` | `/api/v1/topic-routing/:id` | Yes |  | `backend/routes/topic-routing.js` |
| `GET` | `/api/v1/topic-routing/logs` | Yes |  | `backend/routes/topic-routing.js` |
| `GET` | `/api/v1/trades/` | Yes |  | `backend/routes/trades.js` |
| `POST` | `/api/v1/trades/` | Yes |  | `backend/routes/trades.js` |
| `GET` | `/api/v1/trading-engine/config` | Yes |  | `backend/routes/trading-engine.js` |
| `PUT` | `/api/v1/trading-engine/config` | Yes | `admin, trader` | `backend/routes/trading-engine.js` |
| `POST` | `/api/v1/trading-engine/emergency-stop` | Yes | `admin, trader` | `backend/routes/trading-engine.js` |
| `GET` | `/api/v1/trading-engine/opportunities` | Yes |  | `backend/routes/trading-engine.js` |
| `POST` | `/api/v1/trading-engine/start` | Yes | `admin, trader` | `backend/routes/trading-engine.js` |
| `GET` | `/api/v1/trading-engine/status` | Yes |  | `backend/routes/trading-engine.js` |
| `POST` | `/api/v1/trading-engine/stop` | Yes | `admin, trader` | `backend/routes/trading-engine.js` |
| `GET` | `/api/v1/trading-engine/trades/active` | Yes |  | `backend/routes/trading-engine.js` |
| `GET` | `/api/v1/training/overview` | Yes |  | `backend/routes/training.js` |
| `GET` | `/api/v1/training/sessions` | Yes |  | `backend/routes/training.js` |
| `POST` | `/api/v1/training/sessions` | Yes |  | `backend/routes/training.js` |
| `POST` | `/api/v1/training/sessions/:id/complete` | Yes |  | `backend/routes/training.js` |
| `POST` | `/api/v1/training/sessions/:id/start` | Yes |  | `backend/routes/training.js` |
| `DELETE` | `/api/v1/user-preferences/` | Yes |  | `backend/routes/userPreferences.js` |
| `GET` | `/api/v1/user-preferences/` | Yes |  | `backend/routes/userPreferences.js` |
| `POST` | `/api/v1/user-preferences/` | Yes |  | `backend/routes/userPreferences.js` |
| `PUT` | `/api/v1/user-preferences/` | Yes |  | `backend/routes/userPreferences.js` |
| `PUT` | `/api/v1/user-preferences/bulk` | Yes |  | `backend/routes/userPreferences.js` |
| `GET` | `/api/v1/user-preferences/categories` | Yes |  | `backend/routes/userPreferences.js` |
| `DELETE` | `/api/v1/user-preferences/category/:category` | Yes |  | `backend/routes/userPreferences.js` |
| `GET` | `/api/v1/user-preferences/category/:category` | Yes |  | `backend/routes/userPreferences.js` |
| `PUT` | `/api/v1/user-preferences/category/:category` | Yes |  | `backend/routes/userPreferences.js` |
| `GET` | `/api/v1/user-preferences/history` | Yes |  | `backend/routes/userPreferences.js` |
| `POST` | `/api/v1/user-preferences/sync` | Yes |  | `backend/routes/userPreferences.js` |
| `GET` | `/api/v1/user-preferences/telegram` | Yes |  | `backend/routes/userPreferences.js` |
| `PUT` | `/api/v1/user-preferences/telegram` | Yes |  | `backend/routes/userPreferences.js` |
| `POST` | `/api/v1/user-preferences/telegram/test` | Yes |  | `backend/routes/userPreferences.js` |
| `GET` | `/api/v1/users/` | Yes | `admin` | `backend/routes/users.js` |
| `DELETE` | `/api/v1/users/:id` | Yes | `admin` | `backend/routes/users.js` |
| `GET` | `/api/v1/users/:id` | Yes |  | `backend/routes/users.js` |
| `PATCH` | `/api/v1/users/:id` | Yes |  | `backend/routes/users.js` |
| `GET` | `/api/v1/users/:id/activity` | Yes |  | `backend/routes/users.js` |
| `POST` | `/api/v1/users/:id/change-password` | Yes |  | `backend/routes/users.js` |
| `PATCH` | `/api/v1/users/:id/role` | Yes | `admin` | `backend/routes/users.js` |
| `PATCH` | `/api/v1/users/:id/status` | Yes | `admin` | `backend/routes/users.js` |
| `GET` | `/api/v1/users/stats/overview` | Yes | `admin` | `backend/routes/users.js` |
| `GET` | `/api/v1/wallet/` | Yes |  | `backend/routes/wallet.js` |
| `POST` | `/api/v1/wallet/add-funds` | Yes |  | `backend/routes/wallet.js` |
| `GET` | `/api/v1/wallet/data` | Yes |  | `backend/routes/wallet.js` |
| `PUT` | `/api/v1/wallet/preferences` | Yes |  | `backend/routes/wallet.js` |
| `POST` | `/api/v1/wallet/refresh-connector/:id` | Yes |  | `backend/routes/wallet.js` |
| `POST` | `/api/v1/wallet/reset` | Yes |  | `backend/routes/wallet.js` |
| `PUT` | `/api/v1/wallet/security-controls/:id` | Yes |  | `backend/routes/wallet.js` |
| `GET` | `/api/v1/webhooks/` | Yes |  | `backend/routes/webhooks.js` |
| `POST` | `/api/v1/webhooks/` | Yes |  | `backend/routes/webhooks.js` |
| `DELETE` | `/api/v1/webhooks/:id` | Yes |  | `backend/routes/webhooks.js` |
| `GET` | `/api/v1/webhooks/:id` | Yes |  | `backend/routes/webhooks.js` |
| `PATCH` | `/api/v1/webhooks/:id` | Yes |  | `backend/routes/webhooks.js` |
| `GET` | `/api/v1/webhooks/:id/deliveries` | Yes |  | `backend/routes/webhooks.js` |
| `POST` | `/api/v1/webhooks/:id/test` | Yes |  | `backend/routes/webhooks.js` |
| `GET` | `/api/v1/webhooks/events` | Yes |  | `backend/routes/webhooks.js` |
