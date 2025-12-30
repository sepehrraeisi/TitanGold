# Navigation Redirect Tests

## Test Environment
- URL: https://titan.zala.ir
- User: Admin
- Date: 2025-12-30

## Test Scenarios

### ✅ Test 1: AI Center → Config → Open in Settings
**Path**: Dashboard → AI Center (tab) → Config (tab) → Click "Open in Settings" button

**Expected Result**:
- Should navigate to Settings
- Configuration tab should be active
- Integrations sub-tab should be active
- No console errors
- Navigation should be instant (no delay)

**Test Steps**:
1. Login as Admin
2. Click "AI Center" in main navigation
3. Click "Config" tab in AI Center
4. Click "Open in Settings" button
5. Verify: Settings > Configuration > Integrations is active
6. Refresh page (F5)
7. Navigate back to AI Center → Config
8. Click "Open in Settings" again
9. Verify: Still works correctly after refresh

**Status**: ⏳ Pending Manual Test

---

### ✅ Test 2: AI Manager → Decision Engine → Open in Settings
**Path**: Dashboard → AI Center → Manager (tab) → Decision Engine (tab) → Click "Open in Settings" button

**Expected Result**:
- Should navigate to Settings
- Configuration tab should be active
- Decision Engine sub-tab should be active
- No console errors
- Navigation should be instant

**Test Steps**:
1. Login as Admin
2. Click "AI Center" in main navigation
3. Click "Manager" tab (default active)
4. Click "Decision Engine" tab in AI Manager
5. Click "Open in Settings" button
6. Verify: Settings > Configuration > Decision Engine is active
7. Refresh page (F5)
8. Navigate back to AI Center → Manager → Decision Engine
9. Click "Open in Settings" again
10. Verify: Still works correctly after refresh

**Status**: ⏳ Pending Manual Test

---

### ✅ Test 3: AI Manager → Monitoring → Open in Settings
**Path**: Dashboard → AI Center → Manager (tab) → Monitoring (tab) → Click "Open in Settings" button

**Expected Result**:
- Should navigate to Settings
- Configuration tab should be active
- Monitoring sub-tab should be active
- No console errors
- Navigation should be instant

**Test Steps**:
1. Login as Admin
2. Click "AI Center" in main navigation
3. Click "Manager" tab
4. Click "Monitoring" tab in AI Manager
5. Click "Open in Settings" button
6. Verify: Settings > Configuration > Monitoring is active
7. Refresh page (F5)
8. Navigate back to AI Center → Manager → Monitoring
9. Click "Open in Settings" again
10. Verify: Still works correctly after refresh

**Status**: ⏳ Pending Manual Test

---

## Browser Back Button Tests

### Test 4: Back Button After Redirect
**Test Steps**:
1. Navigate: AI Center → Config → "Open in Settings"
2. Click browser back button
3. Expected: Should go back to AI Center Config tab
4. Click "Open in Settings" again
5. Expected: Should navigate forward to Settings again

**Status**: ⏳ Pending Manual Test

---

## Console Errors Check

**During all tests, open browser DevTools Console and verify**:
- ❌ No React warnings
- ❌ No "querySelector" errors
- ❌ No "Cannot read property" errors
- ❌ No timing-related warnings
- ✅ Clean console log

---

## Performance Check

**Navigation should be**:
- ⚡ Instant (< 50ms)
- 🎯 Deterministic (same result every time)
- 🔄 Reliable after refresh
- 📱 Works on mobile/desktop

---

## Implementation Details

### Previous (Fragile):
```typescript
// ❌ BAD: DOM selectors + setTimeout
setTimeout(() => {
  const configTab = document.querySelector('[data-tab-id="configuration"]');
  configTab?.click();
  setTimeout(() => {
    const subTab = document.querySelector('[data-subtab-id="monitoring"]');
    subTab?.click();
  }, 100);
}, 200);
```

### Current (Production-Safe):
```typescript
// ✅ GOOD: State-based navigation
onNavigate({
  view: 'settings',
  settingsTab: 'configuration',
  settingsSubtab: 'monitoring'
});
```

---

## Manual Testing Required

**Please perform manual tests in browser and update this file with results:**

```bash
# Test 1 Result: 
# Date: 
# Tester: 
# Result: ✅ PASS / ❌ FAIL
# Notes: 

# Test 2 Result:
# Date: 
# Tester: 
# Result: ✅ PASS / ❌ FAIL
# Notes: 

# Test 3 Result:
# Date: 
# Tester: 
# Result: ✅ PASS / ❌ FAIL
# Notes: 

# Test 4 Result:
# Date: 
# Tester: 
# Result: ✅ PASS / ❌ FAIL
# Notes: 
```

---

## Acceptance Criteria

✅ All 3 redirect scenarios work correctly
✅ Navigation works after page refresh
✅ Browser back button works correctly
✅ No console errors
✅ Navigation is instant (no visible delay)
✅ State is deterministic and testable

