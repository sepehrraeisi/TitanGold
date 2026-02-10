# گزارش تحلیل مشکل URL Routing
**URL Routing Issue Analysis Report**

**تاریخ**: ۱۴۰۴/۱۱/۲۱ (2026-02-10)

---

## 🔍 مشکل گزارش شده | Reported Issue

### شرح مشکل:
```
❌ مشکل: URL همیشه ثابت است و تغییر نمی‌کند
📍 URL فعلی: https://titan.zala.ir/?view=dashboard
🔄 رفتار مورد انتظار: URL باید با تغییر صفحات تغییر کند
📤 مشکل اشتراک‌گذاری: نمی‌توان لینک مستقیم به صفحات مختلف share کرد
```

---

## 🔎 تحلیل کد موجود | Code Analysis

### ✅ **کد URL Sync موجود است!**

سیستم TitanGold در حال حاضر دارای یک سیستم کامل URL Sync است:

#### 1️⃣ **فایل `utils/urlSync.ts`**:
```typescript
/**
 * URL Sync Utility - Minimal & Controlled
 * 
 * Syncs navigation state with URL query parameters for:
 * - Browser back/forward support
 * - Deep linking / shareable URLs
 * - Reproducible QA testing
 */

export function readStateFromURL(): URLState | null {
  const params = new URLSearchParams(window.location.search);
  const view = params.get('view') as ViewKey | null;
  
  if (!view) return null;
  
  return {
    view,
    settingsTab: params.get('settingsTab') || undefined,
    settingsSubtab: params.get('settingsSubtab') || undefined,
  };
}

export function writeStateToURL(state: URLState, replace: boolean = false): void {
  const params = new URLSearchParams();
  params.set('view', state.view);
  
  if (state.settingsTab) {
    params.set('settingsTab', state.settingsTab);
  }
  
  if (state.settingsSubtab) {
    params.set('settingsSubtab', state.settingsSubtab);
  }
  
  const newURL = `${window.location.pathname}?${params.toString()}`;
  
  if (replace) {
    window.history.replaceState(state, '', newURL);
  } else {
    window.history.pushState(state, '', newURL);
  }
}
```

#### 2️⃣ **فایل `components/Dashboard.tsx`**:
```typescript
// Hydrate state from URL on mount
useEffect(() => {
  const urlState = readStateFromURL();
  if (urlState) {
    setActiveView(urlState.view);
    // ...
  }
}, []);

// Listen to browser back/forward
useEffect(() => {
  const handlePopState = () => {
    const urlState = readStateFromURL();
    if (urlState) {
      setActiveView(urlState.view);
      // ...
    }
  };
  
  window.addEventListener('popstate', handlePopState);
  return () => window.removeEventListener('popstate', handlePopState);
}, []);

// Navigation handler
const handleNavigation: OnNavigateHandler = target => {
  // ...
  writeStateToURL(newState, false); // 👈 این URL را به‌روز می‌کند
};
```

---

## 🐛 علت مشکل | Root Cause

### **تئوری‌های احتمالی**:

#### 1️⃣ **Navigation Items به درستی `handleNavigation` را صدا نمی‌زنند**
```typescript
// در Dashboard.tsx، Sidebar Items باید این را صدا بزنند:
onClick={() => handleNavigation(item.key)}

// اگر به جای آن setActiveView مستقیم صدا شود، URL به‌روز نمی‌شود!
onClick={() => setActiveView(item.key)} // ❌ WRONG!
```

#### 2️⃣ **Header یا Sidebar مستقیماً state را تغییر می‌دهند**
```typescript
// اگر Header یا Sidebar مستقیماً setActiveView را صدا بزنند:
<Header activeView={activeView} setActiveView={setActiveView} />
// ❌ این URL را به‌روز نمی‌کند!

// باید handleNavigation استفاده شود:
<Header activeView={activeView} onNavigate={handleNavigation} />
// ✅ صحیح
```

#### 3️⃣ **بعضی کامپوننت‌ها هنوز prop قدیمی `setActiveView` دریافت می‌کنند**
```typescript
// مثال:
<Favorites setActiveView={setActiveView} /> // ❌ WRONG
// باید تبدیل شود به:
<Favorites onNavigate={handleNavigation} /> // ✅ CORRECT
```

---

## 🔧 بررسی کد فعلی | Current Code Inspection

### بررسی کد Dashboard.tsx:
```typescript
// خط 183: Header دریافت می‌کند setActiveView مستقیم! ❌
<Header 
  activeView={activeView} 
  setActiveView={setActiveView}  // ❌ این مشکل است!
  onLogout={onLogout} 
/>

// خطوط 142-161: View Components دریافت می‌کنند setActiveView مستقیم! ❌
case 'favorites':
  return <Favorites setActiveView={setActiveView} />;  // ❌
case 'gold':
  return <GoldPage onNavigate={handleNavigation} />;   // ✅ این درست است!
```

### **🎯 مشکل پیدا شد!**

**مشکل اصلی**: 
- ✅ سیستم URL Sync موجود و کامل است
- ❌ اما اکثر کامپوننت‌ها `setActiveView` مستقیم دریافت می‌کنند
- ❌ فقط چند کامپوننت (مثل GoldPage) از `onNavigate` استفاده می‌کنند
- ❌ Header و Sidebar احتمالاً مستقیماً `setActiveView` را صدا می‌زنند

---

## ✅ راه‌حل | Solution

### مرحله 1: به‌روزرسانی Dashboard.tsx
```typescript
// ❌ BEFORE:
<Header 
  activeView={activeView} 
  setActiveView={setActiveView} 
  onLogout={onLogout} 
/>

// ✅ AFTER:
<Header 
  activeView={activeView} 
  onNavigate={handleNavigation}  // 👈 تغییر یافته
  onLogout={onLogout} 
/>
```

### مرحله 2: به‌روزرسانی همه View Components
```typescript
// ❌ BEFORE:
case 'favorites':
  return <Favorites setActiveView={setActiveView} />;
case 'trades':
  return <Trades />;
case 'portfolio':
  return <Portfolio />;

// ✅ AFTER:
case 'favorites':
  return <Favorites onNavigate={handleNavigation} />;
case 'trades':
  return <Trades onNavigate={handleNavigation} />;
case 'portfolio':
  return <Portfolio onNavigate={handleNavigation} />;
```

### مرحله 3: به‌روزرسانی Header.tsx
```typescript
// ❌ BEFORE (if exists):
interface HeaderProps {
  activeView: ViewKey;
  setActiveView: (view: ViewKey) => void;  // ❌ مستقیم state را تغییر می‌دهد
  onLogout: () => void;
}

// ✅ AFTER:
interface HeaderProps {
  activeView: ViewKey;
  onNavigate: OnNavigateHandler;  // ✅ از navigation handler استفاده می‌کند
  onLogout: () => void;
}

// در کد Header:
// ❌ BEFORE:
onClick={() => props.setActiveView('dashboard')}

// ✅ AFTER:
onClick={() => props.onNavigate('dashboard')}
```

### مرحله 4: به‌روزرسانی Sidebar/Navigation Items
```typescript
// در Dashboard.tsx، sidebar items:
{navItems.map(item => (
  <button
    key={item.key}
    // ❌ BEFORE:
    onClick={() => setActiveView(item.key)}
    
    // ✅ AFTER:
    onClick={() => handleNavigation(item.key)}
    
    className={activeView === item.key ? 'active' : ''}
  >
    {item.icon} {item.label[language]}
  </button>
))}
```

---

## 📋 لیست فایل‌های نیازمند تغییر | Files to Modify

1. **components/Dashboard.tsx** ✅ (اولویت بالا)
   - تغییر prop `setActiveView` به `onNavigate` در Header
   - تغییر تمام view components به استفاده از `handleNavigation`
   - تغییر sidebar navigation items

2. **components/Header.tsx** ⚠️ (نیاز به بررسی)
   - تغییر interface: `setActiveView` → `onNavigate`
   - تغییر تمام navigation clicks

3. **components/Favorites.tsx** ⚠️
   - تغییر prop: `setActiveView` → `onNavigate`

4. **components/Trades.tsx** ⚠️
   - اضافه کردن prop `onNavigate` (اگر navigation داخلی دارد)

5. **components/Portfolio.tsx** ⚠️
   - اضافه کردن prop `onNavigate` (اگر navigation داخلی دارد)

6. **components/Analysis.tsx** ⚠️
7. **components/News.tsx** ⚠️
8. **components/Settings.tsx** ⚠️
9. **components/AICenter.tsx** ⚠️
10. **components/ProfilePage.tsx** ⚠️
11. **components/WalletManagement.tsx** ⚠️
12. **components/Chatbot.tsx** ⚠️

---

## 🧪 نحوه تست | How to Test

### قبل از رفع:
```bash
1. باز کردن https://titan.zala.ir
2. کلیک روی "Portfolio" در sidebar
3. بررسی URL → همچنان ?view=dashboard است ❌
4. F5 (Refresh) → برمی‌گردد به dashboard ❌
5. کپی کردن URL و باز کردن در tab جدید → dashboard باز می‌شود ❌
```

### بعد از رفع:
```bash
1. باز کردن https://titan.zala.ir
2. کلیک روی "Portfolio" در sidebar
3. بررسی URL → تغییر به ?view=portfolio ✅
4. F5 (Refresh) → همچنان در portfolio است ✅
5. کپی کردن URL و باز کردن در tab جدید → portfolio باز می‌شود ✅
6. Back button مرورگر → برمی‌گردد به صفحه قبل ✅
```

### تست Settings Deep Link:
```bash
# باید این URL‌ها کار کنند:
https://titan.zala.ir/?view=settings
https://titan.zala.ir/?view=settings&settingsTab=profile
https://titan.zala.ir/?view=settings&settingsTab=appearance&settingsSubtab=theme
```

---

## 📊 مثال‌های URL صحیح | Correct URL Examples

پس از رفع مشکل، URL‌ها باید به این شکل باشند:

```
Dashboard:     https://titan.zala.ir/?view=dashboard
Portfolio:     https://titan.zala.ir/?view=portfolio
Trades:        https://titan.zala.ir/?view=trades
Favorites:     https://titan.zala.ir/?view=favorites
Wallet:        https://titan.zala.ir/?view=wallet
Analysis:      https://titan.zala.ir/?view=analysis
AI Center:     https://titan.zala.ir/?view=ai
News:          https://titan.zala.ir/?view=news
Gold Market:   https://titan.zala.ir/?view=gold
Settings:      https://titan.zala.ir/?view=settings
Profile:       https://titan.zala.ir/?view=profile

# Settings with tabs:
Settings > Profile:     ?view=settings&settingsTab=profile
Settings > Security:    ?view=settings&settingsTab=security
Settings > Appearance:  ?view=settings&settingsTab=appearance
Settings > Cache:       ?view=settings&settingsTab=cache
```

---

## 🎯 خلاصه | Summary

### مشکل:
- URL ثابت می‌ماند و تغییر نمی‌کند
- نمی‌توان لینک‌های مستقیم share کرد
- Refresh صفحه، کاربر را به dashboard برمی‌گرداند

### علت:
- ✅ سیستم URL Sync کامل و صحیح وجود دارد
- ❌ اما کامپوننت‌ها `setActiveView` مستقیم دریافت می‌کنند
- ❌ به جای استفاده از `handleNavigation`

### راه‌حل:
1. تبدیل تمام `setActiveView` props به `onNavigate`
2. به‌روزرسانی Header.tsx
3. به‌روزرسانی همه View Components
4. به‌روزرسانی Sidebar navigation items

### مزایای پس از رفع:
- ✅ URL با navigation sync می‌شود
- ✅ Deep linking کار می‌کند
- ✅ Share کردن لینک‌های مستقیم
- ✅ Browser back/forward
- ✅ Refresh حفظ می‌شود
- ✅ QA testing راحت‌تر

---

## 🚀 مراحل بعدی | Next Steps

1. ✅ **تحلیل**: مشکل شناسایی شد
2. ⏭️ **رفع**: تغییر کدها (در انتظار تأیید)
3. ⏭️ **تست**: تست کامل تمام views
4. ⏭️ **مستندات**: آپدیت documentation
5. ⏭️ **دیپلوی**: Build و deploy

---

**گزارش توسط**: TitanGold DevOps  
**تاریخ**: ۱۴۰۴/۱۱/۲۱  
**وضعیت**: 🔍 تحلیل تکمیل شد - منتظر تأیید برای رفع
