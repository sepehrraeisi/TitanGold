# 🧹 Cache Cleared - Test Guide

## ✅ Actions Completed

### 1. **Frontend Rebuilt & Restarted**
```bash
✅ npm run build --force (11.30s)
✅ pm2 restart titan-frontend
✅ New assets generated (index-CAGESSBC.js)
```

### 2. **Backend Verified**
```bash
✅ Commit: 9f8f8d6
✅ Health: OK
✅ Authorization header forwarding: ENABLED
```

### 3. **Nginx Config**
```nginx
✅ proxy_set_header Authorization $http_authorization;
✅ Reloaded successfully
```

---

## 🧪 Testing Checklist

### **Step 1: Clear Browser Cache** (CRITICAL)

**Option A: Hard Refresh (Quick)**
```
Windows/Linux: Ctrl + Shift + R
Mac: Cmd + Shift + R
```

**Option B: DevTools Clear (Recommended)**
1. Press `F12` (Open DevTools)
2. Go to **Application** tab
3. **Storage** → Clear site data
4. Check ALL boxes:
   - ✅ Cookies
   - ✅ Cache
   - ✅ Local storage
   - ✅ Session storage
5. Click **"Clear site data"**
6. Close DevTools
7. Refresh page (`F5`)

**Option C: Incognito Mode (Testing)**
```
Ctrl + Shift + N (Chrome)
Ctrl + Shift + P (Firefox)
```

---

### **Step 2: Login**

1. Go to: https://titan.zala.ir
2. Login with credentials
3. Wait for dashboard to load

---

### **Step 3: Test AI Agent**

1. Navigate to **"AI Agents"** panel
2. Click any agent (e.g., **"Technical Analysis"**)
3. Click **"Run Analysis"** button
4. Open DevTools (`F12`) → **Network** tab
5. Look for request: `POST /api/ai-agents/{uuid}/run`

---

### **Step 4: Check Request Headers**

**In Network tab, click on the request:**

**✅ SHOULD SEE:**
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: application/json
```

**❌ IF NOT PRESENT:**
- Problem: Frontend not sending token
- Solution: Check localStorage for `titan_token`
- Try: Logout → Login again

---

### **Step 5: Check Response**

**Status Code:**
- ✅ `200 OK` → Success!
- ❌ `401 Unauthorized` → Auth problem
- ❌ `500 Server Error` → Backend problem

**Response Body (if 200):**
```json
{
  "ok": true,
  "agent_id": "...",
  "agent_key": "technical",
  "indicators": [
    { "indicatorId": "RSI", "value": 54.3, "signal": "buy", "weight": 50 }
  ],
  "signal": "buy",
  "confidence": 0.65
}
```

**Response Body (if error but safe):**
```json
{
  "ok": false,
  "error": { "code": "...", "message": "..." },
  "indicators": [],        // ✅ UI won't crash
  "result": {
    "indicators": []       // ✅ UI won't crash
  }
}
```

---

## 🔍 Expected Results

### **✅ Success Indicators:**
1. No "No token provided" error
2. No "Analysis failed" error
3. No crash on `.filter()`
4. Indicators display (7 items)
5. Signal shown (BUY/SELL/NEUTRAL)
6. Confidence score (0-1)

### **✅ UI Behavior:**
- Loading spinner → Results appear
- No error boundary
- No console errors
- Smooth rendering

---

## 🚨 If Still Not Working

### **Scenario 1: No Authorization Header**

**Problem:** Header not sent by frontend

**Fix:**
1. Check console: `localStorage.getItem('titan_token')`
2. Should return: `"eyJ..."`
3. If null: Logout → Login again
4. If still null: Check `services/api.ts`

---

### **Scenario 2: 401 Despite Header**

**Problem:** Nginx might still be dropping header

**Debug:**
```bash
# Check nginx config
sudo cat /etc/nginx/sites-enabled/titan-zala | grep -A 5 "proxy_set_header Authorization"

# Should show:
proxy_set_header Authorization $http_authorization;

# If not present, re-apply fix and reload
```

---

### **Scenario 3: 500 Server Error**

**Problem:** Backend issue

**Debug:**
```bash
# Check backend logs
pm2 logs titan-backend --lines 50

# Look for errors with [Registry] prefix
```

---

## 📊 Verification Commands

### **Backend Status:**
```bash
curl -s http://localhost:5002/api/health | jq '.commit'
# Should show: "9f8f8d6"
```

### **Nginx Config:**
```bash
sudo cat /etc/nginx/sites-enabled/titan-zala | grep -A 3 "proxy_set_header Authorization"
# Should show the header forwarding line
```

### **Frontend Status:**
```bash
pm2 list | grep titan-frontend
# Should show: online, uptime < 5min
```

---

## 🎯 What To Send If Still Broken

**Send me these 3 screenshots/texts:**

1. **Request Headers:**
   ```
   Authorization: Bearer <token>  ← Is this present?
   ```

2. **Status Code & Response:**
   ```
   Status: 200 / 401 / 500
   Response body: { ... }
   ```

3. **Console Errors (if any):**
   ```
   Press F12 → Console tab
   Copy all errors
   ```

---

## 📝 Summary

### **What We Did:**
1. ✅ Rebuilt frontend (new assets)
2. ✅ Restarted frontend (PM2)
3. ✅ Verified nginx config (Authorization forwarding)
4. ✅ Verified backend (commit 9f8f8d6)

### **What You Must Do:**
1. ✅ Clear browser cache (DevTools → Application → Clear)
2. ✅ Login again
3. ✅ Test AI agent
4. ✅ Check Network tab for Authorization header

### **Expected:**
```
✅ Authorization header present
✅ Status 200 OK
✅ Indicators displayed
✅ No crashes
✅ All 15 agents working
```

---

**Date:** 2026-01-03  
**Status:** ✅ READY FOR TESTING

---

**اگر این کار نکرد، حتماً 3 چیز بالا را به من بدهید!** 🚀
