# Runtime Test Helpers - Temporary Failure Injection

این فایل شامل کدهای موقت برای تزریق خطا در تست‌های T2 و T3 است.

**⚠️ مهم**: بعد از تست، این تغییرات را revert کنید!

---

## T2 - AICenter Failure Injection

### روش 1: موقتاً throw کردن خطا در `components/AICenter.tsx`

**قبل از تست** (backup کنید):
```typescript
// در components/AICenter.tsx، خط 24 را موقتاً تغییر دهید:
await api.fetchAIManagerData();
```

**برای تست** (تزریق خطا):
```typescript
// موقتاً این را جایگزین کنید:
throw new Error('TEST: Simulated fetchAIManagerData failure');
// await api.fetchAIManagerData();
```

**بعد از تست** (revert):
```typescript
// به حالت قبل برگردانید:
await api.fetchAIManagerData();
```

---

## T3 - AIAgents Failure Injection

### روش 1: موقتاً throw کردن خطا در `components/ai/AIAgents.tsx`

**قبل از تست** (backup کنید):
```typescript
// در components/ai/AIAgents.tsx، خط 32 را موقتاً تغییر دهید:
const agentData = await api.fetchAIAgents();
```

**برای تست** (تزریق خطا):
```typescript
// موقتاً این را جایگزین کنید:
throw new Error('TEST: Simulated fetchAIAgents failure');
// const agentData = await api.fetchAIAgents();
// setAgents(agentData);
```

**بعد از تست** (revert):
```typescript
// به حالت قبل برگردانید:
const agentData = await api.fetchAIAgents();
setAgents(agentData);
```

---

## T4 - DataHub Backward Compatibility Test

### روش: استفاده از DevTools Console

**مراحل**:
1. باز کردن DevTools → Application → IndexedDB → `titan_db` → `settings`
2. پیدا کردن key: `data_hub_state`
3. کلیک راست → Edit
4. در JSON value، یکی از این تغییرات را اعمال کنید:

**Test 4a: Missing cache**
```json
{
  "key": "data_hub_state",
  "value": {
    "sources": [],
    "categories": [],
    // cache حذف شده است
    "updatedAt": "2025-12-24T00:00:00.000Z"
  }
}
```

**Test 4b: Missing cache.data**
```json
{
  "key": "data_hub_state",
  "value": {
    "sources": [],
    "categories": [],
    "cache": {
      "totalEntries": 0,
      "hitRate": 0
      // cache.data حذف شده است
    },
    "updatedAt": "2025-12-24T00:00:00.000Z"
  }
}
```

5. Save
6. Refresh صفحه
7. باز کردن AI Menu → Manager → Data Hub Tab

**بعد از تست**: می‌توانید state را به حالت قبل برگردانید یا بگذارید `fetchDataHubState` آن را اصلاح کند.

---

## دستورات راه‌اندازی

### Frontend:
```bash
cd /path/to/TitanGold
npm run dev
# Frontend روی http://localhost:3000 اجرا می‌شود
```

### Backend:
```bash
cd /path/to/TitanGold/backend
node server.js
# یا
npm start
# Backend روی http://localhost:5002 اجرا می‌شود
```

---

## چک‌لیست قبل از تست

- [ ] Frontend در حال اجرا است (npm run dev)
- [ ] Backend در حال اجرا است (node server.js)
- [ ] DevTools باز است (Console + Network tabs)
- [ ] لاگ‌های console پاک شده‌اند
- [ ] Backup از فایل‌های تغییر یافته گرفته شده است

---

## نکات مهم

1. **هرگز کلیدهای API را لاگ نکنید**: فقط index کلید در key pool لاگ می‌شود.
2. **بعد از تست revert کنید**: تمام تغییرات موقت را به حالت قبل برگردانید.
3. **Screenshots بگیرید**: از console errors و UI states screenshot بگیرید.
4. **Network tab را بررسی کنید**: درخواست‌های API را در Network tab بررسی کنید.

---

**پایان راهنما**

