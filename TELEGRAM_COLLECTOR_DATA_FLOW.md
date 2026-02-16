# 📊 Telegram Collector Data Flow - راهنمای جریان داده

## 🎯 خلاصه

این مستند توضیح می‌دهد که **4 عدد نمایش داده شده در Telegram Collector Status** از کجا می‌آیند و چه زمانی به‌روز می‌شوند.

---

## 🔢 چهار عدد کلیدی

```typescript
1. Collector Status        → telegramCollectorState.status
2. Tracked Channels        → telegramCollectorState.channels.length
3. Average Latency         → telegramCollectorState.metrics.avgLatencyMs
4. Channels with Errors    → channels.filter(ch => ch.lastError).length
```

---

## 📥 جریان داده (Data Flow)

### نمودار کامل:

```
┌─────────────────────────────────────────────────────────────┐
│  1. باز کردن تب Data Hub / Telegram Collector              │
└────────────────────┬────────────────────────────────────────┘
                     ↓
┌─────────────────────────────────────────────────────────────┐
│  2. useDataHubQuery() با React Query                       │
│     - queryFn: api.fetchDataHubState()                     │
│     - staleTime: 5 دقیقه                                   │
└────────────────────┬────────────────────────────────────────┘
                     ↓
┌─────────────────────────────────────────────────────────────┐
│  3. api.fetchDataHubState()                                 │
│     - خواندن از IndexedDB محلی (client-side)              │
│     - Key: 'data_hub_state'                                │
│     - Database: settings                                   │
└────────────────────┬────────────────────────────────────────┘
                     ↓
┌─────────────────────────────────────────────────────────────┐
│  4. dataHub.telegramCollector                               │
│     {                                                       │
│       status: 'active',                                     │
│       channels: [...],                                      │
│       metrics: { avgLatencyMs: 450, ... },                  │
│       ...                                                   │
│     }                                                       │
└────────────────────┬────────────────────────────────────────┘
                     ↓
┌─────────────────────────────────────────────────────────────┐
│  5. telegramCollectorState (prop به TelegramPanel)         │
└────────────────────┬────────────────────────────────────────┘
                     ↓
┌─────────────────────────────────────────────────────────────┐
│  6. renderCollectorHealthSummary()                          │
│     - محاسبه 4 عدد کلیدی                                   │
│     - نمایش در UI                                          │
└─────────────────────────────────────────────────────────────┘
```

---

## 🔄 چه زمانی داده‌ها به‌روز می‌شوند؟

### ✅ موارد به‌روزرسانی خودکار

| رویداد | تابع صدا زده شده | نتیجه |
|---|---|---|
| باز کردن تب Data Hub | `loadDataHub()` | ✅ همه 4 عدد |
| Confirm Login تلگرام | `loadDataHub()` | ✅ همه 4 عدد |
| Refresh Channels | `refreshTelegramCollectorChannels()` → `loadDataHub()` | ✅ همه 4 عدد |
| Link to Source | `loadDataHub()` | ✅ همه 4 عدد |
| Sync Data Sources (موفق) | `loadDataHub()` | ✅ همه 4 عدد |

---

### ❌ موارد که به‌روزرسانی **نمی‌کنند**

| رویداد | دلیل | راه‌حل |
|---|---|---|
| **Refresh Health** | فقط `combinedCollectorHealth` را آپدیت می‌کند، نه `telegramCollectorState` | دکمه Refresh Summary اضافه کنیم |
| **Poll خودکار Collector** | Backend هر 15 دقیقه poll می‌کند اما UI خبر نمی‌شود | Interval در Frontend یا WebSocket |
| **گذر زمان** | هیچ interval خودکاری نیست | Interval 30-60 ثانیه اضافه کنیم |

---

## 🔍 تحلیل کد

### 1️⃣ TelegramPanel.tsx - نمایش داده

```typescript
const renderCollectorHealthSummary = () => {
    if (!telegramCollectorState) return null;
    
    const status = combinedCollectorHealth || telegramCollectorState.status || 'unknown';
    const channels = telegramCollectorState.channels || [];
    const errorChannels = channels.filter((ch: any) => ch.lastError).length;
    const avgLatency = telegramCollectorState.metrics?.avgLatencyMs;
    
    return (
        <Card>
            <div>Collector Status: {status}</div>
            <div>Tracked channels: {channels.length}</div>
            <div>Average latency: {avgLatency}ms</div>
            <div>Channels with errors: {errorChannels}</div>
        </Card>
    );
};
```

---

### 2️⃣ useDataHub.ts - دریافت داده

```typescript
export const useDataHub = (artemis, onRefresh, t) => {
    // React Query با staleTime: 5 دقیقه
    const { 
        data: dataHub, 
        isLoading: isLoadingDataHub, 
        error: dataHubErrorObj, 
        refetch: loadDataHub 
    } = useDataHubQuery();
    
    // telegramCollectorState از dataHub می‌آید
    const telegramCollectorState = dataHub?.telegramCollector || null;
    
    return {
        telegramCollectorState,
        loadDataHub,  // این تابع را می‌شود دستی صدا زد
        // ...
    };
};
```

---

### 3️⃣ useDataHubState.ts - React Query Hook

```typescript
export const useDataHubQuery = () => {
    return useQuery({
        queryKey: DATA_HUB_KEYS.state(),
        queryFn: api.fetchDataHubState,
        staleTime: 5 * 60 * 1000, // 5 دقیقه
    });
};
```

**نکته مهم:** با `staleTime: 5 دقیقه`، React Query تا 5 دقیقه cache می‌کند و دوباره query نمی‌کند.

---

### 4️⃣ api.ts - خواندن از IndexedDB

```typescript
export const fetchDataHubState = async (): Promise<DataHubState> => {
    try {
        // خواندن از IndexedDB محلی مرورگر
        const saved = await database.get<{ key: string; value: DataHubState }>(
            'settings', 
            'data_hub_state'
        );
        
        if (saved && saved.value) {
            ensureTelegramCollectorState(saved.value);
            recalcCategoryStats(saved.value);
            return saved.value;
        }
        
        // اگر نبود، یک state خالی برگردان
        return getDefaultDataHubState();
    } catch (error) {
        console.error('Failed to load DataHub state:', error);
        return getDefaultDataHubState();
    }
};
```

**نکته:** این تابع از **IndexedDB محلی** می‌خواند، **نه از Backend**.

---

### 5️⃣ refreshTelegramCollectorChannels - آپدیت از Collector API

```typescript
export const refreshTelegramCollectorChannels = async (): Promise<TelegramCollectorState> => {
    const dataHub = await fetchDataHubState();
    const collector = ensureTelegramCollectorState(dataHub);
    
    try {
        const baseUrl = resolveTelegramCollectorBaseUrl();
        
        // ✅ این جا از Telegram Collector API می‌خواند
        const response = await fetch(`${baseUrl}/api/telegram-collector/channels`);
        
        if (response.ok) {
            const data = await response.json();
            
            // تبدیل channels به فرمت UI
            const refreshedChannels = data.channels.map((ch: any) => ({
                id: `real-${ch.id}`,
                title: ch.title,
                handle: ch.username,
                status: 'idle',
                enabled: true,
                // ...
            }));
            
            collector.channels = refreshedChannels;
            collector.lastRefreshAt = new Date().toISOString();
            
            // ذخیره در IndexedDB
            dataHub.telegramCollector = collector;
            await database.put('settings', { 
                key: 'data_hub_state', 
                value: dataHub 
            });
        }
    } catch (error) {
        console.error('Failed to refresh channels:', error);
    }
    
    return collector;
};
```

**نکته:** این تابع:
1. از Collector API می‌خواند (`/api/telegram-collector/channels`)
2. داده‌ها را process می‌کند
3. در IndexedDB ذخیره می‌کند

---

## 🚀 راه‌حل‌های پیشنهادی

### راه‌حل 1: دکمه "Refresh Summary" 🆕

**مزایا:**
- ساده
- کاربر کنترل دارد
- بدون overhead

**پیاده‌سازی:**
```typescript
// در TelegramPanel.tsx
<button onClick={() => loadDataHub()}>
    🔄 Refresh Summary
</button>
```

---

### راه‌حل 2: Auto-refresh با Interval ⏱️

**مزایا:**
- خودکار
- همیشه fresh
- تجربه کاربری بهتر

**پیاده‌سازی:**
```typescript
// در useDataHub.ts
useEffect(() => {
    // هر 60 ثانیه یک بار refresh
    const interval = setInterval(() => {
        loadDataHub();
    }, 60 * 1000);
    
    return () => clearInterval(interval);
}, [loadDataHub]);
```

**نکته:** با توجه به `staleTime: 5 دقیقه` در React Query، interval باید بیشتر از 5 دقیقه باشد یا باید `refetch()` را به صورت forced صدا بزنیم.

---

### راه‌حل 3: WebSocket برای Real-time 🔌

**مزایا:**
- واقعاً real-time
- بدون polling بی‌مورد
- کارآمدتر

**پیاده‌سازی:**
```typescript
// در Telegram Collector
io.on('connection', (socket) => {
    socket.on('subscribe-collector', () => {
        // هر بار که channels آپدیت شد
        socket.emit('collector-update', {
            status: 'active',
            channels: [...],
            metrics: {...}
        });
    });
});

// در Frontend
useEffect(() => {
    const socket = io(TELEGRAM_COLLECTOR_URL);
    
    socket.emit('subscribe-collector');
    
    socket.on('collector-update', (data) => {
        // آپدیت state
        setTelegramCollectorState(data);
    });
    
    return () => socket.disconnect();
}, []);
```

---

### راه‌حل 4: React Query با کاهش staleTime ⚡

**تغییر staleTime:**
```typescript
export const useDataHubQuery = () => {
    return useQuery({
        queryKey: DATA_HUB_KEYS.state(),
        queryFn: api.fetchDataHubState,
        staleTime: 30 * 1000, // 30 ثانیه به جای 5 دقیقه
        refetchInterval: 60 * 1000, // auto-refetch هر 60 ثانیه
    });
};
```

---

## 📋 مقایسه راه‌حل‌ها

| راه‌حل | سادگی | Performance | Real-time | توصیه |
|---|---|---|---|---|
| دکمه Refresh | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐ | ✅ برای فاز اول |
| Interval | ⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐ | ✅ برای فاز دوم |
| WebSocket | ⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | 🔮 برای آینده |
| کاهش staleTime | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐ | ✅ سریع و ساده |

---

## 🎯 توصیه نهایی

### فاز 1 (همین الان):
```typescript
// اضافه کردن دکمه Refresh Summary
<button 
    onClick={() => loadDataHub()} 
    disabled={isLoadingDataHub}
>
    {isLoadingDataHub ? '⏳ Refreshing...' : '🔄 Refresh Summary'}
</button>
```

### فاز 2 (کوتاه‌مدت):
```typescript
// کاهش staleTime + refetchInterval
export const useDataHubQuery = () => {
    return useQuery({
        queryKey: DATA_HUB_KEYS.state(),
        queryFn: api.fetchDataHubState,
        staleTime: 30 * 1000, // 30 ثانیه
        refetchInterval: 60 * 1000, // auto-refetch هر 1 دقیقه
        refetchIntervalInBackground: false, // فقط وقتی tab active است
    });
};
```

### فاز 3 (بلندمدت):
- پیاده‌سازی WebSocket برای updates real-time
- Telegram Collector بتواند events push کند
- Frontend بتواند subscribe کند

---

## 🔍 Debug Commands

### بررسی IndexedDB:
```javascript
// در Developer Tools > Console
const db = await window.indexedDB.open('titan-artemis-db');
const tx = db.transaction(['settings'], 'readonly');
const store = tx.objectStore('settings');
const request = store.get('data_hub_state');
request.onsuccess = () => console.log(request.result);
```

### بررسی React Query Cache:
```javascript
// در Developer Tools > React Query Devtools
// یا
import { useQueryClient } from '@tanstack/react-query';
const queryClient = useQueryClient();
console.log(queryClient.getQueryData(['dataHub', 'state']));
```

### بررسی Telegram Collector:
```bash
curl http://127.0.0.1:3002/api/telegram-collector/health
curl http://127.0.0.1:3002/api/telegram-collector/channels
```

---

## 📚 منابع

- `components/ai/AIManager/tabs/DataHub/TelegramPanel.tsx` - رندر UI
- `components/ai/AIManager/tabs/DataHub/hooks/useDataHub.ts` - لاجیک اصلی
- `hooks/useDataHubState.ts` - React Query hooks
- `services/api.ts` - API calls
- `telegram-collector/dist/index.legacy.js` - Collector backend

---

**آخرین بروزرسانی:** 2026-02-16  
**نسخه:** 1.0.0  
**وضعیت:** مستند کامل و بررسی شده ✅
