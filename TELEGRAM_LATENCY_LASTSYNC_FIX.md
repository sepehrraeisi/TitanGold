# 🐛 Telegram Collector - Average Latency & Last Synced Issues

## تاریخ: 2026-02-16
## وضعیت: ✅ حل شد

---

## 📊 خلاصه مشکلات

### 1️⃣ Average Latency نشان می‌داد: `-`
### 2️⃣ Last Synced نشان می‌داد: `never` (برای همه کانال‌ها)

---

## 🔍 تحلیل مشکل 1: Average Latency

### ❌ کد قبلی (اشتباه):

```typescript
// TelegramPanel.tsx
const avgLatency = telegramCollectorState.metrics?.avgLatencyMs;

// HealthPanel.tsx
avgLatency: collector.metrics?.avgLatencyMs || null
```

### ⚠️ مشکل:
`telegramCollectorState.metrics?.avgLatencyMs` وجود **ندارد**!

### ✅ مسیر صحیح (طبق `types.ts`):

```typescript
telegramCollectorState.healthSummary?.avgLatencyMs
```

---

## 🛠 چگونه `avgLatencyMs` محاسبه می‌شود؟

### فرآیند:

```
1. هر کانال دارای fetchLatencyMs است
   ↓
2. api.buildCollectorHealthSummary(collector)
   - از همه channels.fetchLatencyMs میانگین می‌گیرد
   - مقدار را در collector.healthSummary.avgLatencyMs می‌نویسد
   ↓
3. Frontend از healthSummary.avgLatencyMs می‌خواند
   ↓
4. UI نمایش می‌دهد: "450ms"
```

### کد محاسبه در `api.ts`:

```typescript
export function buildCollectorHealthSummary(collector: TelegramCollectorState) {
    const channels = collector.channels || [];
    
    // محاسبه میانگین latency
    const latencies = channels
        .map(ch => ch.fetchLatencyMs)
        .filter(lat => lat != null && lat > 0);
    
    const avgLatencyMs = latencies.length > 0
        ? Math.round(latencies.reduce((sum, lat) => sum + lat, 0) / latencies.length)
        : null;
    
    collector.healthSummary = {
        ...collector.healthSummary,
        avgLatencyMs,
        // ...
    };
    
    return collector;
}
```

---

## ✅ راه‌حل مشکل 1

### تغییرات:

#### **TelegramPanel.tsx:**
```typescript
// ❌ قبل:
const avgLatency = telegramCollectorState.metrics?.avgLatencyMs;

// ✅ بعد:
const avgLatency = telegramCollectorState.healthSummary?.avgLatencyMs;
```

#### **HealthPanel.tsx:**
```typescript
// ❌ قبل:
avgLatency: collector.metrics?.avgLatencyMs || null

// ✅ بعد:
avgLatency: collector.healthSummary?.avgLatencyMs ?? null
```

---

## 📊 رفتار مورد انتظار بعد از Fix:

| حالت | مقدار avgLatencyMs | نمایش در UI |
|---|---|---|
| هیچ کانالی poll نشده | `null` | `-` |
| یک کانال poll شده | `450` | `450ms` |
| چند کانال poll شده | میانگین مثلاً `520` | `520ms` |
| همه کانال‌ها fetchLatencyMs = 0 | `null` | `-` |

---

## 🔍 تحلیل مشکل 2: Last Synced

### ❌ همه کانال‌ها نشان می‌دهند: `never`

### کد فعلی (صحیح است):

```typescript
// TelegramPanel.tsx - جدول کانال‌ها
{ch.lastSyncedAt
    ? formatTimeAgo(ch.lastSyncedAt)
    : t('never') || 'never'
}
```

### ⚠️ علت `never`:

مقدار `lastSyncedAt` از **Backend API** می‌آید:

```
GET /api/telegram-collector/collector-channels
  ↓
  خواندن از DB: telegram_channels.last_synced_at
  ↓
  اگر NULL → API برمی‌گرداند: lastSyncedAt: null
  ↓
  UI نمایش می‌دهد: "never"
```

---

## 🔧 چه زمانی `last_synced_at` آپدیت می‌شود؟

### 3 حالت:

#### 1️⃣ **Collector polling موفق شود:**
```typescript
// در telegram-collector
await client.getMessages(channel, { limit: 50 });
// اگر موفق بود:
await db.run(
    `UPDATE telegram_channels 
     SET last_synced_at = CURRENT_TIMESTAMP 
     WHERE channel_id = ?`,
    [channelId]
);
```

#### 2️⃣ **Backend sync job اجرا شود:**
```typescript
// backend/services/telegramPipeline.js
async function syncChannelMessages(channelId) {
    // پیام‌ها را از collector بگیر
    // در DB ذخیره کن
    // آپدیت last_synced_at
    await query(
        `UPDATE telegram_channels 
         SET last_synced_at = NOW() 
         WHERE channel_id = $1`,
        [channelId]
    );
}
```

#### 3️⃣ **Test Fetch از UI:**
```typescript
// وقتی کاربر "Test Fetch" را بزند
// اگر موفق بود:
// last_synced_at آپدیت می‌شود
```

---

## ✅ رفتار مورد انتظار برای Last Synced:

| حالت | last_synced_at در DB | نمایش در UI |
|---|---|---|
| کانال جدید (هنوز sync نشده) | `NULL` | `never` ✅ |
| 5 دقیقه پیش sync شده | `2026-02-16 15:00:00` | `5m ago` ✅ |
| 2 ساعت پیش sync شده | `2026-02-16 13:05:00` | `2h ago` ✅ |
| دیروز sync شده | `2026-02-15 15:05:00` | `1d ago` ✅ |

---

## 🧪 تست‌های لازم

### تست 1: Average Latency

```bash
# 1. باز کردن Data Hub → Telegram Collector
# 2. روی یک کانال کلیک "Test Fetch"
# 3. بعد از موفقیت:
#    ✅ باید Average Latency عددی مثل "450ms" نشان دهد
```

---

### تست 2: Last Synced (نیاز به بررسی Backend)

#### بررسی 1: آیا polling کار می‌کند؟

```bash
# چک کردن لاگ‌های collector:
pm2 logs telegram-collector --lines 100 | grep -i "poll\|sync"

# باید ببینید:
# ✅ "Polling channel: ..."
# ✅ "Saved X messages"
# ✅ "Updated last_synced_at"
```

#### بررسی 2: آیا DB آپدیت می‌شود؟

```sql
-- بررسی telegram_channels
SELECT 
    channel_id,
    username,
    title,
    last_synced_at,
    CASE 
        WHEN last_synced_at IS NULL THEN 'never'
        ELSE strftime('%Y-%m-%d %H:%M:%S', last_synced_at)
    END as sync_time
FROM telegram_channels
ORDER BY last_synced_at DESC NULLS LAST;
```

#### بررسی 3: آیا API درست برمی‌گرداند؟

```bash
# تست API:
curl http://127.0.0.1:3002/api/telegram-collector/collector-channels | jq '.[].lastSyncedAt'

# باید ببینید:
# "2026-02-16T15:05:30.000Z"  ← اگر sync شده
# null                         ← اگر sync نشده
```

---

## 🔧 اگر Last Synced همچنان `never` است

### احتمال 1: Polling متوقف است

```bash
# چک کردن Collector:
pm2 logs telegram-collector --lines 50

# اگر خطا دیدید (مثل AUTH_KEY_UNREGISTERED):
# → باید دوباره Login کنید
```

---

### احتمال 2: DB Update نمی‌شود

بیایید چک کنیم که آیا کد آپدیت `last_synced_at` وجود دارد:

```bash
# در telegram-collector
cd /home/ubuntu/webapp/TitanGold/telegram-collector
grep -r "last_synced_at" dist/

# باید ببینید:
# UPDATE telegram_channels SET last_synced_at = ...
```

اگر نبود، باید اضافه کنیم.

---

### احتمال 3: Backend sync job اجرا نمی‌شود

```bash
# چک کردن scheduler:
pm2 logs titan-backend --lines 100 | grep -i "telegram\|sync"

# باید ببینید:
# "Running telegram sync job..."
# "Synced X channels"
```

---

## 📝 مستندات مرتبط

| سند | توضیح |
|---|---|
| `types.ts` | تعریف `TelegramCollectorState.healthSummary` |
| `services/api.ts` | `buildCollectorHealthSummary()` - محاسبه avgLatencyMs |
| `TELEGRAM_COLLECTOR_DATA_FLOW.md` | جریان کامل داده |

---

## 📊 Git History

```
d654312 – fix(datahub): Fix Average Latency displaying '-'   ← الان
e110dcb – feat(datahub): Add auto-refresh for Telegram Collector metrics
28fd9ce – docs: Add comprehensive Telegram Collector data flow documentation
138678b – fix(backend): Fix SQL parameter type error in telegram sync
```

---

## ✅ خلاصه

### Average Latency:
- ✅ **حل شد** - تغییر مسیر از `metrics` به `healthSummary`
- ✅ Deploy شد - Build جدید: 2026-02-16 15:30 UTC
- ✅ تست شد - بعد از Test Fetch عدد نشان می‌دهد

### Last Synced:
- ⚠️ **نیاز به بررسی بیشتر**
- فعلاً `never` منطقی است (اگر هنوز sync نشده)
- بعد از polling موفق یا sync job، باید آپدیت شود
- اگر همچنان `never` ماند، باید Backend را بررسی کنیم

---

**آخرین بروزرسانی:** 2026-02-16 15:35 UTC  
**وضعیت:** Average Latency ✅ | Last Synced ⚠️ (نیاز به بررسی)
