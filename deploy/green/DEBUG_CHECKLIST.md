# 🔍 Debug Checklist - مشکل localStorage/Cache

## ⚠️ مشکل احتمالی:
1. Frontend قدیمی cache شده (Service Worker/Browser Cache)
2. Token در localStorage ذخیره نمی‌شود
3. API wrapper توکن را attach نمی‌کند

---

## ✅ تست‌های دقیق (همین الان انجام بده)

### **Test 1: Check Token in LocalStorage**

**در مرورگری که مشکل دارد:**

```javascript
// Open Console (F12 → Console)
// Run these commands:

// 1. Check if token exists
localStorage.getItem('titan_token')
// Expected: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
// If null → Problem: Token not stored

// 2. Check all keys
Object.keys(localStorage)
// Expected: Should include 'titan_token' or similar

// 3. Check length
localStorage.length
// Expected: > 0
```

**✅ اگر token وجود دارد:** مشکل از API wrapper است  
**❌ اگر token null است:** مشکل از login/storage است

---

### **Test 2: Check Service Worker**

```javascript
// In Console:
navigator.serviceWorker.getRegistrations().then(regs => {
  console.log('Service Workers:', regs.length);
  regs.forEach(reg => console.log(reg.scope));
});
```

**✅ اگر خروجی 0 بود:** خوب، SW نداریم  
**❌ اگر > 0 بود:** باید unregister کنیم

**Unregister:**
```
F12 → Application → Service Workers → Unregister (هر کدام)
```

---

### **Test 3: Check Network Request Headers**

**F12 → Network → Reload → GET /api/ai-agents**

**در Request Headers نگاه کن:**

```
✅ GOOD:
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

❌ BAD:
(Authorization header is missing)
```

**اگر Authorization نیست:**
- Token در localStorage هست اما attach نمی‌شود
- مشکل از `services/api.ts` است

---

### **Test 4: Force Logout & Login**

```javascript
// In Console:
localStorage.clear()
sessionStorage.clear()
location.reload()
```

**بعد:**
1. Login دوباره
2. Check localStorage again: `localStorage.getItem('titan_token')`
3. Check Network for Authorization header

---

## 🎯 سناریوهای مختلف و راه‌حل

### **Scenario A: Token exists BUT Authorization header missing**

**Problem:** API wrapper توکن را attach نمی‌کند

**Fix:** باید `services/api.ts` را چک کنیم

**What to send me:**
```
localStorage.getItem('titan_token')  // → "eyJ..."
// But in Network → Authorization: (missing)
```

---

### **Scenario B: Token is NULL after login**

**Problem:** Login موفق نیست یا توکن ذخیره نمی‌شود

**Fix:** باید login flow را چک کنیم

**What to send me:**
```
localStorage.getItem('titan_token')  // → null
// After successful login
```

---

### **Scenario C: Old JS files cached**

**Problem:** Frontend قدیمی serve می‌شود

**Fix:**
1. Clear all cache (F12 → Application → Clear)
2. Unregister Service Workers
3. Hard refresh (Ctrl+Shift+R)

**Test:**
```javascript
// Check loaded JS files in Network → JS
// Look for: index-CAGESSBC.js (new) or old hash
```

---

## 📊 What To Send Me (از مرورگر مشکل‌دار)

**Run these in Console and send results:**

```javascript
// 1. Token check
console.log('Token:', localStorage.getItem('titan_token'));

// 2. All keys
console.log('Keys:', Object.keys(localStorage));

// 3. Service Workers
navigator.serviceWorker.getRegistrations().then(regs => {
  console.log('SW Count:', regs.length);
});
```

**From Network tab:**
```
1. GET /api/ai-agents
   - Status: ?
   - Authorization header: present/missing?
   - Response body: ?

2. POST /api/ai-agents/{uuid}/run
   - Status: ?
   - Authorization header: present/missing?
   - Response body: ?
```

---

## 🔧 Quick Fixes (Try in Order)

### **Fix 1: Nuclear Clear (Most Effective)**

```javascript
// In Console:
localStorage.clear();
sessionStorage.clear();
indexedDB.databases().then(dbs => {
  dbs.forEach(db => indexedDB.deleteDatabase(db.name));
});

// Then:
// 1. F12 → Application → Service Workers → Unregister all
// 2. F12 → Application → Storage → Clear site data
// 3. Close DevTools
// 4. Ctrl+Shift+R
// 5. Login again
```

---

### **Fix 2: Incognito Test**

```
1. Open Incognito (Ctrl+Shift+N)
2. Go to https://titan.zala.ir
3. Login
4. Test AI Agents

If works → Problem is cache/storage in main browser
If fails → Problem is backend/frontend code
```

---

### **Fix 3: Different Browser Test**

```
Try in:
- Chrome Incognito
- Firefox Private
- Edge InPrivate

All fail → Backend issue
Some work → Cache/storage issue
```

---

## 📝 Expected Results (After Fixes)

### **In Console:**
```javascript
localStorage.getItem('titan_token')
// → "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

### **In Network:**
```
GET /api/ai-agents
Status: 200 OK
Request Headers:
  Authorization: Bearer eyJ...
Response:
  [{ id: "...", agent_key: "technical", ... }]
```

### **In UI:**
```
✅ No "Analysis failed"
✅ No console errors
✅ Indicators display
✅ No crashes
```

---

## 🚨 If STILL Not Working

**Send me exactly this:**

```
=== Console Commands ===
localStorage.getItem('titan_token'): [RESULT]
Object.keys(localStorage): [RESULT]
SW count: [RESULT]

=== Network Tab ===
GET /api/ai-agents:
  Status: [200/401/500]
  Authorization header: [present/missing]
  Response: [BODY]

POST /api/ai-agents/{uuid}/run:
  Status: [200/401/500]
  Authorization header: [present/missing]
  Response: [BODY]

=== Browser Info ===
Browser: [Chrome/Firefox/Edge]
Version: [RESULT]
Mode: [Normal/Incognito]
```

**I will give you EXACT fix based on this!**

---

**Date:** 2026-01-03  
**Status:** 🔍 Debugging Phase
