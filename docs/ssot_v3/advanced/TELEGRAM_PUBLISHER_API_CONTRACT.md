# DataHub Advanced — Telegram Publisher API Contract (GAP-016)

> Subtab: `dataHub.advanced.telegramPublisher` · UI: `TelegramPublisher.tsx`  
> **Scope این فاز:** فقط Publisher (channels + history + metrics). Queue/automation → subtab `advanced.automation`.

## ۱. UI دقیقاً چه چیزی لازم دارد؟

| نیاز | منبع فعلی (قبل از wiring) | پس از wiring |
|------|---------------------------|--------------|
| لیست publisher channels | `dataHub.advanced.telegramPublishers` (IndexedDB) | `GET .../telegram-publishers` |
| تاریخچه ارسال (۱۰–۵۰ ردیف) | `dataHub.advanced.publisherHistory` | همان view یا `.../history` |
| متریک‌ها (channels, delivered/failed 24h, success rate) | محاسبه client از history | `metrics` در پاسخ API |
| mapping input telegram sources → output publishers | `dataHub.sources` (از API Sources) + publishers | ترکیب sources API + publishers API |
| CRUD channel / Test | دکمه‌ها (بخشی stub) | `POST/PUT/DELETE` + `POST .../test` (اختیاری v3.1) |

**خارج از scope:** templates tab (هنوز static)؛ ارسال واقعی Telegram (`publishToTelegram` mock) → worker جدا.

---

## ۲. Backend موجود

| Path | وضعیت |
|------|--------|
| `/api/v1/telegram/*` | health, feeds, agents — **بدون** publisher CRUD |
| `services/api.ts` | `createTelegramPublisher` / `update` / `delete` → **IndexedDB** (`fetchDataHubState`) |
| DB | **بدون** جدول `telegram_publishers` در migrations رسمی |

SSOT قبلی «`/api/v1/telegram/...` publisher» **نادرست** بود — اصلاح به مسیر زیر.

---

## ۳. Endpoint پیشنهادی (پیاده‌سازی GAP-016)

### `GET /api/v1/data-hub/telegram-publishers`

**Auth:** `authenticate` + `readRateLimiter`  
**Response:**

```json
{
  "publishers": [
    {
      "id": "uuid",
      "name": "Signals Channel",
      "chatId": "-100…",
      "enabled": true,
      "filters": {},
      "template": "…",
      "sentCount": 0,
      "lastSent": null,
      "agentId": null,
      "sourceIds": [],
      "isPrivate": false
    }
  ],
  "history": [
    {
      "id": "uuid",
      "queueId": "",
      "recordId": "",
      "topicId": "",
      "publisherId": "uuid",
      "agentId": "system",
      "status": "sent",
      "sentAt": "ISO",
      "payloadPreview": "…"
    }
  ],
  "metrics": {
    "totalChannels": 1,
    "delivered24h": 0,
    "failed24h": 0,
    "successRate": 100
  }
}
```

`botToken` در پاسخ **هرگز** plain برنمی‌گردد (`hasToken: true` یا omit).

### `POST /api/v1/data-hub/telegram-publishers`

Body: `name`, `chatId`, `botToken`, `enabled`, `filters`, `template`, …

### `PUT /api/v1/data-hub/telegram-publishers/:id`

### `DELETE /api/v1/data-hub/telegram-publishers/:id`

**DB:** `telegram_publishers`, `publisher_delivery_history` (migration `025_create_telegram_publishers.sql`).

**Security:** `authenticate` only → RBAC write در **GAP-017** (جدا از wiring).

---

## ۴. Done criteria

- [ ] UI Publisher: `useTelegramPublishersQuery` — نه `dataHub.advanced.telegramPublishers` برای دادهٔ اصلی
- [ ] Demo در `DataHub_DEMOS.md`
- [ ] SSOT: `dataHub.advanced.telegramPublisher` → **Implemented** یا **Partial** + GAP-016 Closed
