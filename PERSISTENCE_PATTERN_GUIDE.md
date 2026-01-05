# 🔐 Persistence Pattern Guide: The Golden Rule

## 📌 Problem Statement

**Root Cause**: UI shows a fake success and updates only local config; after save and on refresh (~5 minutes), config reverts due to backend persistence not being reflected in frontend state.

### Real-World Scenario
1. User changes settings in UI ✅ (local state updated)
2. User clicks "Save" → Backend saves to DB ✅
3. Frontend shows "Settings saved!" ✅
4. **BUG**: Frontend state is NOT synced with DB
5. User refreshes page after 5 minutes ❌
6. **RESULT**: Settings revert to old values (DB state wins)

---

## ✅ Solution: The Golden Rule

> **Golden Rule**: Never trust local state after save. Always refetch from backend (single source of truth).

### Pattern Steps
```typescript
const handleUpdateSettings = async (updatedSettings: Settings) => {
    setIsLoading(true);
    try {
        // 1️⃣ Save to backend
        const response = await api.updateSettings(updatedSettings);
        
        // 2️⃣ 🆕 Refetch from backend (Golden Rule)
        const freshData = await api.fetchSettings();
        
        // 3️⃣ Update local state with fresh data
        setSettings(freshData.settings);
        
        // 4️⃣ Show success
        alert('Settings saved!');
    } catch (error) {
        console.error('Save failed:', error);
        alert('Update failed');
        throw error;
    } finally {
        setIsLoading(false);
    }
};
```

---

## 🔧 Backend Requirements

### ❌ WRONG: Return only success flag
```javascript
router.post('/settings', async (req, res) => {
    await pool.query('UPDATE settings SET ...', [values]);
    return res.json({ success: true }); // ❌ Missing data!
});
```

### ✅ CORRECT: Return persisted data
```javascript
router.post('/settings', async (req, res) => {
    // 1. Save to DB
    await pool.query('UPDATE settings SET ...', [values]);
    
    // 2. 🆕 Refetch from DB (Golden Rule)
    const freshResult = await pool.query(
        'SELECT * FROM settings WHERE user_id = $1',
        [userId]
    );
    
    // 3. Return what's actually in DB
    return res.json({
        success: true,
        settings: freshResult.rows[0]
    });
});
```

---

## 🎨 Frontend Implementation

### Component Structure
```typescript
const AgentControl: React.FC<Props> = ({ agent, onClose, onUpdate }) => {
    // 1️⃣ State Management
    const [settings, setSettings] = useState<Settings | null>(null);
    const [localSettings, setLocalSettings] = useState<Settings | null>(null);
    const [isDirty, setIsDirty] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    
    // 2️⃣ Initial Load (Golden Rule)
    useEffect(() => {
        loadData();
    }, [agent.id]);
    
    const loadData = async () => {
        const settingsRes = await fetch('/api/agents/liquidity/settings', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await settingsRes.json();
        setSettings(data.settings); // Backend is source of truth
    };
    
    // 3️⃣ Sync local state with backend state
    useEffect(() => {
        setLocalSettings(settings);
        setIsDirty(false);
    }, [settings]);
    
    // 4️⃣ Update handler (Golden Rule)
    const handleSave = async () => {
        setIsSaving(true);
        try {
            // Save to backend
            const response = await fetch('/api/agents/liquidity/settings', {
                method: 'POST',
                body: JSON.stringify(localSettings)
            });
            
            const result = await response.json();
            
            // 🆕 Update state with fresh data from backend
            if (result.settings) {
                setSettings(result.settings);
            }
            
            // Reload all data (optional but recommended)
            await loadData();
            
            alert('Settings saved!');
        } catch (error) {
            console.error('Save failed:', error);
            throw error;
        } finally {
            setIsSaving(false);
        }
    };
    
    return (
        <SettingsTab 
            settings={settings} 
            onUpdate={handleSave} 
        />
    );
};
```

### Settings Component
```typescript
const SettingsTab: React.FC<{
    settings: Settings;
    onUpdate: (settings: Settings) => void;
}> = ({ settings, onUpdate }) => {
    // Track local edits
    const [localSettings, setLocalSettings] = useState(settings);
    const [isDirty, setIsDirty] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    
    // Sync with parent settings (Golden Rule)
    useEffect(() => {
        setLocalSettings(settings);
        setIsDirty(false);
    }, [settings]);
    
    const updateField = (field: string, value: any) => {
        setLocalSettings({ ...localSettings, [field]: value });
        setIsDirty(true); // Mark as dirty
    };
    
    const handleSave = async () => {
        if (!isDirty || isSaving) return;
        
        setIsSaving(true);
        try {
            await onUpdate(localSettings);
            setIsDirty(false);
        } catch (error) {
            console.error('Save failed:', error);
        } finally {
            setIsSaving(false);
        }
    };
    
    return (
        <div>
            {/* Save Button */}
            <button
                onClick={handleSave}
                disabled={!isDirty || isSaving}
                className={isDirty ? 'bg-blue-500' : 'bg-gray-500'}
            >
                {isSaving ? 'Saving...' : 'Save Changes'}
            </button>
            
            {/* Unsaved changes warning */}
            {isDirty && (
                <p className="text-yellow-400">
                    You have unsaved changes
                </p>
            )}
            
            {/* Form fields */}
            <input
                value={localSettings.field}
                onChange={(e) => updateField('field', e.target.value)}
            />
        </div>
    );
};
```

---

## 🔍 Real-World Examples

### Example 1: Fundamental Agent (Reference)
```typescript
// components/ai/FundamentalAgentControl.tsx

const handleUpdateConfig = async (updatedConfig: Config) => {
    setIsLoading(true);
    try {
        // 1. Save to backend
        await api.updateFundamentalAnalysisConfig(agent.id, updatedConfig);
        
        // 2. 🆕 Refetch from /details (Golden Rule)
        const freshData = await api.fetchFundamentalAgentData(agent.id);
        
        // 3. Update local state
        if (freshData.config) setConfig(freshData.config);
        if (freshData.metrics) setMetrics(freshData.metrics);
        if (freshData.lastAnalysis) {
            setAnalysis(normalizeFundamentalAnalysis(freshData.lastAnalysis));
        }
        
        // 4. Show success
        alert('Configuration updated successfully');
    } catch (error) {
        console.error('Failed to update config:', error);
        throw error;
    } finally {
        setIsLoading(false);
    }
};
```

### Example 2: Liquidity Agent (Fixed)
```typescript
// components/ai/LiquidityAgentControl.tsx

const handleUpdateSettings = async (updatedSettings: Settings) => {
    setIsLoading(true);
    try {
        // 1. Save to backend
        const response = await fetch('/api/agents/liquidity/settings', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(updatedSettings)
        });
        
        if (!response.ok) {
            throw new Error('Failed to update settings');
        }
        
        const result = await response.json();
        
        // 2. 🆕 Update local state with fresh data from backend
        if (result.settings) {
            setSettings(result.settings);
        }
        
        // 3. Reload all data (optional but recommended)
        await loadData();
        
        // 4. Show success
        alert('Settings updated successfully');
    } catch (error) {
        console.error('Failed to update liquidity settings:', error);
        alert('Update failed');
        throw error;
    } finally {
        setIsLoading(false);
    }
};
```

---

## 🚨 Common Mistakes

### ❌ Mistake 1: Trust local state after save
```typescript
const handleSave = async () => {
    await api.saveSettings(localSettings);
    setSettings(localSettings); // ❌ WRONG: Local state might differ from DB
    alert('Saved!');
};
```

**Problem**: Local state might have transformations, validations, or defaults applied by backend.

**Fix**: Refetch from backend.

---

### ❌ Mistake 2: Only return success flag
```javascript
// Backend
router.post('/settings', async (req, res) => {
    await saveToDb(req.body);
    res.json({ success: true }); // ❌ WRONG: No data returned
});
```

**Problem**: Frontend has no way to sync with DB state.

**Fix**: Return persisted data.

---

### ❌ Mistake 3: Overwrite JSONB fields
```javascript
// Backend
router.post('/settings', async (req, res) => {
    await pool.query(
        'UPDATE settings SET config = $1', // ❌ WRONG: Overwrites entire field
        [JSON.stringify(req.body.config)]
    );
});
```

**Problem**: Partial updates overwrite other fields.

**Fix**: Use JSONB merge.
```javascript
await pool.query(
    'UPDATE settings SET config = COALESCE(config, \'{}\'::jsonb) || $1::jsonb',
    [JSON.stringify(req.body.config)]
);
```

---

## 📊 Persistence Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    User edits settings                       │
│                    (localSettings updated)                   │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                  User clicks "Save"                          │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│              1️⃣ POST /api/settings                           │
│              (Backend saves to DB)                           │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│       2️⃣ Backend: Refetch from DB (Golden Rule)             │
│       SELECT * FROM settings WHERE user_id = $1              │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│       3️⃣ Backend: Return fresh data                         │
│       { success: true, settings: { ... } }                   │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│       4️⃣ Frontend: Update state with fresh data             │
│       setSettings(result.settings)                           │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│       5️⃣ Frontend: Reload all data (optional)               │
│       await loadData()                                       │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│              ✅ State synced with DB                         │
│              ✅ User refreshes page → No revert              │
└─────────────────────────────────────────────────────────────┘
```

---

## 🧪 Testing Checklist

### Backend Tests
- [ ] POST /settings returns `{ success: true, settings: {...} }`
- [ ] Returned settings match DB state
- [ ] JSONB fields use merge pattern (not overwrite)
- [ ] Partial updates work correctly

### Frontend Tests
- [ ] Settings load on component mount
- [ ] Local edits update `localSettings` state
- [ ] `isDirty` flag tracks unsaved changes
- [ ] Save button disabled when not dirty
- [ ] After save, state syncs with backend response
- [ ] After refresh, settings persist (no revert)

### Integration Tests
1. Open settings page
2. Change a field (e.g., enable agent)
3. Click "Save"
4. **Wait 5 minutes** (simulate session timeout)
5. Refresh page
6. ✅ Settings should still be enabled (no revert)

---

## 🎯 Key Takeaways

1. **Golden Rule**: Always refetch after save (backend is single source of truth)
2. **Backend**: Return persisted data, not just `{ success: true }`
3. **Frontend**: Track local state with `isDirty` flag
4. **JSONB**: Use merge pattern (`|| $1::jsonb`), not overwrite
5. **Testing**: Wait 5+ minutes after save, then refresh to verify persistence

---

## 📚 References

- **Fundamental Agent**: `components/ai/FundamentalAgentControl.tsx` (lines 109-134)
- **Liquidity Agent**: `components/ai/LiquidityAgentControl.tsx` (Fixed)
- **Backend Liquidity**: `backend/routes/liquidity-agent.js` (lines 440-470)

---

## 🔗 Related Commits

- `0774669` - fix(liquidity): implement Golden Rule persistence pattern
- `cf53353` - Phase 4 COMPLETE: Liquidity Agent docs locked
- `15ca573` - Phase 3A: Backend routes + metrics mapping

---

**Status**: ✅ Persistence bug RESOLVED  
**Pattern**: 🆕 Golden Rule documented  
**Next**: Deploy to production and verify
