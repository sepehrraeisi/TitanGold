# Telegram Collector Service

MTProto-based collector dedicated to Telegram sources in the Titan Data Hub.  
Provides a REST endpoint that the main app can call instead of scraping the public web view.

## Source vs dist (TASK-TC-001)

**Entry point:** `src/index.ts` compiles to `dist/index.js` and loads the full app from `dist/index.legacy.js` (and `dist/utils/`, `dist/services/`). Run with `npm run start` or `node dist/index.js`; `npm run build` compiles the TypeScript entry. See `TELEGRAM_COLLECTOR_ANALYSIS.md` and `BUILD_AND_DEPLOY.md` §2.2.

## Features

- Uses `gramjs` (MTProto) to fetch channel messages without Bot API limits.
- Normalizes messages to a lightweight JSON structure (ready for `articles` pipeline).
- In-memory caching with configurable TTL.
- `GET /telegram/:channel/recent?limit=50` endpoint for the frontend/back-end.

## Setup

1. Install dependencies:
   ```bash
   cd telegram-collector
   npm install
   ```
2. Create a `.env` file (see `.env.example` for the keys) and fill in:
   - `TELEGRAM_API_ID` / `TELEGRAM_API_HASH` from https://my.telegram.org
   - `TELEGRAM_PHONE_NUMBER` and optionally `TELEGRAM_PASSWORD` (for 2FA)
3. Generate a session string (only once per account):
   ```bash
   npm run auth
   ```
   Paste the output `TELEGRAM_SESSION_STRING=...` back into `.env`.
4. Start the collector (use dist; src may be missing):
   ```bash
   npm run start
   ```
   or `node dist/index.js`. For full setup see root `BUILD_AND_DEPLOY.md` §2.2.

## API

- `GET /health` → service status and cache stats
- `GET /telegram/:channel/recent?limit=50`
  - `channel`: username (`den_ir`) or link (`https://t.me/s/den_ir`)
  - `limit`: 1–100 (defaults to 20)
- `POST /api/telegram-collector/login/start`
  - body: `{ apiId?, apiHash?, phoneNumber }`
  - sends verification code, returns `authId`
- `POST /api/telegram-collector/login/confirm`
  - body: `{ authId, code, password? }`
  - completes login, saves session to `telegram-session.txt`, refreshes collector

## Next Steps

- Persist channel cache to Redis/Postgres.
- Add WebSocket for push updates.
- Support multi-account rotation for large channel sets.

