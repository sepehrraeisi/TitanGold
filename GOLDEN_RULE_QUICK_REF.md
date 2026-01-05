# 🔐 Golden Rule: Quick Reference

> **Never trust local state after save. Always refetch from backend.**

---

## 🎯 The Pattern (3 Steps)

```typescript
const handleSave = async () => {
    // 1️⃣ Save to backend
    await api.saveSettings(localSettings);
    
    // 2️⃣ Refetch from backend (Golden Rule ⭐)
    const freshData = await api.fetchSettings();
    
    // 3️⃣ Update state with fresh data
    setSettings(freshData.settings);
};
```

---

## ❌ WRONG (Causes revert bug)

```typescript
// Frontend
const handleSave = async () => {
    await api.saveSettings(localSettings);
    // ❌ Missing refetch!
    alert('Saved!');
};

// Backend
router.post('/settings', async (req, res) => {
    await saveToDb(req.body);
    res.json({ success: true }); // ❌ No data returned!
});
```

**Result**: Settings revert after refresh (~5 min).

---

## ✅ CORRECT (Persistence works)

```typescript
// Frontend
const handleSave = async () => {
    const response = await fetch('/api/settings', {
        method: 'POST',
        body: JSON.stringify(localSettings)
    });
    
    const result = await response.json();
    
    // ✅ Update state with backend response
    if (result.settings) {
        setSettings(result.settings);
    }
    
    alert('Saved!');
};

// Backend
router.post('/settings', async (req, res) => {
    await saveToDb(req.body);
    
    // ✅ Refetch from DB
    const fresh = await pool.query('SELECT * FROM settings WHERE user_id = $1', [userId]);
    
    // ✅ Return persisted data
    res.json({ success: true, settings: fresh.rows[0] });
});
```

**Result**: Settings persist after refresh ✅

---

## 🔍 Why This Works

1. **Backend applies transformations** (defaults, validations, JSONB merge)
2. **Local state might differ** from what's actually saved
3. **Refetch ensures sync** between frontend state and DB state
4. **After refresh**, state loads from DB (always correct)

---

## 📊 Flow Diagram

```
User edits → Save to DB → Refetch from DB → Update state → ✅ Persisted
                              ↑
                         Golden Rule
```

---

## 🚨 Red Flags

- Backend returns only `{ success: true }` ❌
- Frontend doesn't refetch after save ❌
- Settings work initially but revert after refresh ❌
- JSONB fields overwritten instead of merged ❌

---

## ✅ Checklist

- [ ] Backend returns persisted data after save
- [ ] Frontend updates state with backend response
- [ ] JSONB fields use merge pattern (`|| $1::jsonb`)
- [ ] Test: Save → Wait 5 min → Refresh → Settings persist

---

## 📚 Examples

- **Fundamental Agent**: `components/ai/FundamentalAgentControl.tsx` (lines 109-134)
- **Liquidity Agent**: `components/ai/LiquidityAgentControl.tsx` (Fixed ✅)

---

**Remember**: Backend is single source of truth. Always refetch after save! 🔐
