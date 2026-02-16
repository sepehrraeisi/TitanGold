# Design System – Data Hub & Telegram Collector

این سند **مرجع طراحی و استایل** برای بخش‌های Data Hub است.

> **منبع معیار فقط یک تب است:**  
> ریدیزاین **کامل** فقط در **تب Telegram Collector** انجام شده است. تمام جزئیات این سند (رنگ، تایپوگرافی، کارت، دکمه، مودال، جدول و …) **صرفاً از همان تب** استخراج شده است.  
> بقیه تب‌ها (Data Sources, Categories, Data Pipeline, Health, Access Logs, Advanced Features) هنوز ریدیزاین کامل نشده‌اند و ممکن است استایل قدیمی یا ناقص داشته باشند. هنگام ریدیزاین هر تب دیگر، باید از این سند به‌عنوان **مرجع واحد** استفاده شود تا نتیجه با Telegram Collector هماهنگ شود.

---

## ۱. اصول کلی

- **تم تیره (Dark theme)** بر پایه‌ی پالت `slate`.
- **Glassmorphism ملایم**: پس‌زمینه‌های نیمه‌شفاف با `backdrop-blur` برای کارت‌ها و مودال‌ها.
- **کنتراست خوانا**: متن‌ها روی پس‌زمینه‌ی تیره با opacity و رنگ‌های مشخص.
- **رنگ‌های معنادار**: سبز = موفقیت/فعال، قرمز = خطا، زرد/نارنجی = هشدار، آبی/بنفش = اکشن و لینک.

---

## ۲. پالت رنگ و فضای کلی

### ۲.۱ پس‌زمینه‌ی اصلی

| کاربرد | کلاس Tailwind | توضیح |
|--------|----------------|--------|
| کارت اصلی (هدر، پنل) | `bg-gradient-to-br from-slate-950/90 via-slate-950/80 to-slate-900/80` | گرادیان ملایم برای کارت‌های سطح اول |
| کارت ستونی (مثلاً لیست اکانت‌ها) | `bg-slate-950/70` | یکدست، کمی شفاف |
| بلوک داخلی کارت (متریک، آیتم) | `bg-slate-900/60` یا `bg-slate-950/60` | برای جعبه‌های کوچک داخل کارت |
| آیتم لیست (ردیف اکانت/کانال) | `bg-slate-900/60` با `border border-white/5` | هر آیتم یک بلوک جدا با حاشیه نازک |

### ۲.۲ حاشیه (Border)

| کاربرد | کلاس |
|--------|--------|
| کارت و پنل | `border border-white/5` |
| جداکننده و بخش‌بندی | `border-slate-800/60` یا `border-white/5` |
| مودال و هدر مودال | `border-white/10` برای تاکید بیشتر |
| جدول thead / tbody | `border-b border-slate-800` برای thead، `border-b border-slate-900/60` برای ردیف‌ها |

### ۲.۳ رنگ‌های تأکیدی (Semantic)

| معنا | پس‌زمینه | متن | حاشیه (در صورت نیاز) |
|------|----------|-----|----------------------|
| **موفقیت / فعال** | `bg-emerald-500/10` | `text-emerald-300`, `text-emerald-100` | `border-emerald-500/40` |
| **خطا** | `bg-red-500/10` | `text-red-300`, `text-red-100` | `border-red-500/40` |
| **هشدار / Flood** | `bg-amber-500/10` | `text-amber-300`, `text-amber-200` | `border-amber-500/40` |
| **اطلاع / در انتظار** | `bg-blue-500/10` | `text-blue-300`, `text-blue-100` | `border-blue-500/40` |
| **اکشن اصلی (بنفش)** | `bg-purple-600`, `hover:bg-purple-500` | `text-white` | — |
| **تلگرام / لینک** | `bg-sky-500/10` یا فقط border | `text-sky-200`, `text-sky-300` | `border-sky-400/70`, `border-sky-500/60` |
| **غیرفعال / خنثی** | `bg-slate-700` | `text-slate-300` | `border-slate-600` |
| **اصلی (Primary badge)** | `bg-indigo-500/20` | `text-indigo-200` | `border-indigo-400/40` |

### ۲.۴ مینی‌کارت متریک (Health / Status)

الگوی هر خانه در گرید متریک:

- گرادیان رنگی ملایم:  
  `bg-gradient-to-br from-{color}-500/10 via-{color}-500/5 to-transparent`
- حاشیه: `border border-white/5`
- بلور ملایم: `backdrop-blur-sm`
- پد: `p-3`
- گوشه: `rounded-xl`

مثال برای وضعیت (سبز):

```html
<div class="rounded-xl border border-white/5 bg-gradient-to-br from-emerald-500/10 via-emerald-500/5 to-transparent p-3 backdrop-blur-sm">
  <p class="text-[11px] text-emerald-300/80 mb-1">برچسب</p>
  <p class="text-sm font-semibold text-emerald-100">مقدار</p>
</div>
```

برای آبی، بنفش، قرمز همان الگو با جایگزینی `emerald` با `blue`, `purple`, `red`.

---

## ۳. تایپوگرافی

| سطح | کلاس | کاربرد |
|-----|--------|--------|
| عنوان تب / کارت اصلی | `text-sm md:text-base font-semibold text-foreground` | هدر اصلی بخش |
| عنوان کارت فرعی | `text-sm font-semibold text-foreground` | هدر کارت (مثلاً «Telegram Accounts») |
| برچسب متریک / هینت | `text-[11px] text-muted-foreground` یا `text-[11px] text-{color}-300/80` | زیرعنوان، توضیح کوتاه |
| متن بدنه | `text-xs` یا `text-xs text-foreground` | توضیحات، پیام خالی |
| متن کوچک (بدنه دوم) | `text-[11px] text-muted-foreground` | زیرنویس، زمان، شناسه |
| Badge و برچسب وضعیت | `text-[10px] font-medium` یا `text-[9px]` برای badge خیلی کوچک (مثل Primary) | وضعیت‌ها، تعداد |
| مونو (ID، کد، زمان) | `font-mono text-xs` یا `text-[10px] text-muted-foreground font-mono` | فقط برای شناسه، hash، ثانیه‌شمار |
| لینک / اکشن متنی | `text-[10px] text-sky-300 hover:text-sky-200` | لینک «View Media» و مشابه |

---

## ۴. فاصله و چیدمان

- **فاصله بین بخش‌های اصلی**: `space-y-6` برای بلوک‌های بزرگ.
- **فاصله داخل کارت**: `gap-4` برای flex/grid سطح اول، `gap-2` یا `gap-3` برای آیتم‌ها.
- **گرید متریک**: `grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-3 mb-4`.
- **گرید کارت‌های اکانت / خلاصه**: `grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3`.
- **لیست دو ستونه (Accounts | Channels)**: `grid grid-cols-1 lg:grid-cols-3 gap-4` با `lg:col-span-1` و `lg:col-span-2`.
- **پد مودال**: `p-4` یا `px-5 py-4` برای بدنه، `border-b border-white/10` برای جدا کردن هدر از بدنه.

---

## ۵. کارت‌ها (Cards)

- **کارت سطح اول**:  
  `className="bg-gradient-to-br from-slate-950/90 via-slate-950/80 to-slate-900/80 border border-white/5 shadow-lg"`
- **کارت ستونی**:  
  `className="bg-slate-950/70 border border-white/5"`
- **حداقل radius**: `rounded-lg` برای کارت‌های ساده.
- **مودال و پنل مهم**: `rounded-xl` یا `rounded-2xl` یا `rounded-3xl` برای Login Wizard.
- **سایه مودال**: `shadow-2xl` یا `shadow-[0_20px_60px_rgba(0,0,0,0.7)]` برای جداسازی از پس‌زمینه.

---

## ۶. دکمه‌ها

### ۶.۱ دکمه اصلی (Primary)

- کلاس:  
  `px-3 py-1.5 rounded-full text-xs font-medium bg-purple-600 hover:bg-purple-500 text-white shadow-sm disabled:opacity-50 disabled:cursor-not-allowed`
- برای اکشن‌های مهم: «Start Login Wizard», «Add Account».

### ۶.۲ دکمه ثانویه (Secondary – آبی)

- کلاس:  
  `px-3 py-1.5 rounded-full text-xs font-medium bg-blue-600 hover:bg-blue-500 ... text-white disabled:opacity-50 disabled:cursor-not-allowed`

### ۶.۳ دکمه حاشیه‌ای (Outline)

- کلاس:  
  `rounded-full text-xs font-medium border border-sky-400/70 text-sky-200 hover:bg-sky-500/10 disabled:opacity-50 disabled:cursor-not-allowed`
- برای «Sync Data Sources», «Diagnose Endpoints» (با border آبی یا amber).

### ۶.۴ دکمه‌های کوچک داخل لیست (اکشن ردیف)

- الگو:  
  `text-[10px] px-2 py-0.5 rounded-full border border-{color}-500/60 text-{color}-200 hover:bg-{color}-500/10 disabled:opacity-40 disabled:cursor-not-allowed`
- مثال آبی: `border border-blue-500/60 text-blue-200 hover:bg-blue-500/10`
- مثال سبز: `border border-emerald-500/60 text-emerald-200 hover:bg-emerald-500/10`
- مثال قرمز (خروج): `border border-red-500/70 text-red-200 hover:bg-red-500/10`
- دکمه خنثی (Set Primary, Enable/Disable): `border border-slate-600 text-slate-100 hover:border-indigo-400` یا `hover:border-amber-400`

### ۶.۵ دکمه‌های مودال (ثانویه / لغو)

- لغو / بستن:  
  `text-[11px] bg-slate-700 hover:bg-slate-600 text-white rounded px-3 py-1.5`
- تأیید سبز:  
  `text-[11px] bg-emerald-600 hover:bg-emerald-500 text-white rounded px-3 py-1.5 disabled:opacity-50`
- دکمه تمام‌عرض در فرم:  
  `w-full text-xs px-4 py-2 bg-purple-600 hover:bg-purple-700 ... text-white rounded-lg`  
  یا سبز: `bg-emerald-600 hover:bg-emerald-700`, قرمز: `bg-red-600 hover:bg-red-700`.

---

## ۷. Badge وضعیت (Status)

- **پایه**:  
  `inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium`
- **فعال**:  
  `bg-emerald-500/10 text-emerald-300 border border-emerald-500/40`
- **غیرفعال**:  
  `bg-slate-700 text-slate-300 border border-slate-600`
- **هشدار (Flood)**:  
  `bg-amber-500/10 text-amber-300 border border-amber-500/40`
- **خطا**:  
  `bg-red-500/10 text-red-300 border border-red-500/40`
- **در انتظار ورود**:  
  `bg-blue-500/10 text-blue-300 border border-blue-500/40`
- **برچسب کوچک (مثل Primary)**:  
  `text-[9px] px-1.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-200 border border-indigo-400/40`

---

## ۸. فرم: Input و Select و Label

- **Label**:  
  `text-[11px] text-muted-foreground mb-1 block`
- **Input متن/عدد**:  
  `w-full px-3 py-2 bg-slate-950/80 border border-slate-700 rounded-lg text-xs text-foreground`
- **Select**:  
  `text-[11px] bg-slate-900 border border-slate-700 rounded px-2 py-1 text-foreground`
- **Input جستجو (کوچک)**:  
  `text-[11px] bg-slate-900 border border-slate-700 rounded px-2 py-1 text-foreground w-full md:w-40`

---

## ۹. جدول

- **کنتینر**:  
  `overflow-x-auto -mx-3 mt-2`
- **Table**:  
  `min-w-full text-xs text-foreground/90`
- **thead**:  
  `border-b border-slate-800 text-[11px] text-muted-foreground`
- **th**:  
  `px-3 py-2 text-left` (یا `text-center` / `text-right`)
- **tbody tr**:  
  `border-b border-slate-900/60 last:border-0`
- **td**:  
  `px-3 py-2 align-top` و در صورت نیاز `text-[11px] text-muted-foreground`
- **متن سلول عنوان**:  
  `text-xs font-medium` برای عنوان، `text-[11px] text-muted-foreground` برای زیرنویس.

---

## ۱۰. مودال (Modal)

- **Overlay**:  
  `fixed inset-0 z-50 flex items-center justify-center p-4`  
  با لایه پس‌زمینه: `absolute inset-0 bg-black/60 backdrop-blur-sm`
- **پنل مودال**:  
  `relative bg-gradient-to-br from-slate-950/95 via-slate-950/90 to-slate-900/95 border border-white/10 rounded-xl shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col`  
  (برای مودال بزرگ‌تر: `max-w-4xl max-h-[90vh]`)
- **Login Wizard (استایل خاص)**:  
  `rounded-3xl border border-white/10 bg-gradient-to-br from-slate-900/95 via-slate-900/90 to-slate-900/85 backdrop-blur-xl shadow-[0_20px_60px_rgba(0,0,0,0.7)]`
- **هدر مودال**:  
  `flex items-center justify-between p-4 border-b border-white/10`
- **دکمه بستن**:  
  `text-muted-foreground hover:text-foreground text-xl` (نماد × یا ✕)
- **فوتر مودال**:  
  `flex items-center justify-between gap-2 p-4 border-t border-white/10`

---

## ۱۱. پیام موفقیت و خطا (Alert)

- **موفقیت**:  
  `mt-3 p-2 rounded border border-emerald-500/30 bg-emerald-500/10 text-[11px] text-emerald-100`
- **خطا**:  
  `mt-3 p-2 rounded border border-red-500/30 bg-red-500/10 text-[11px] text-red-100`
- **هشدار (مثلاً Flood)**:  
  `text-[11px] text-amber-200 bg-amber-500/10 border border-amber-500/30 rounded px-3 py-2`

---

## ۱۲. Toggle (سوییچ پاور)

- **کنتینر**:  
  `inline-flex items-center justify-center w-8 h-4 rounded-full transition-colors`  
  - روشن: `bg-emerald-500/80`  
  - خاموش: `bg-slate-700`
- **دایره داخلی**:  
  `w-3 h-3 rounded-full bg-white shadow transform transition-transform`  
  - روشن: `translate-x-2`  
  - خاموش: `-translate-x-2`

---

## ۱۳. بلوک‌های داده (پیش‌نمایش، آیتم پیام)

- **کارت پیام / آیتم**:  
  `bg-slate-900/60 border border-white/5 rounded-lg p-3 text-xs`
- **پیش‌نمایش تست**:  
  `text-[11px] text-muted-foreground bg-slate-900/70 border border-slate-800 rounded px-2 py-1`

---

## ۱۴. ریسپانسیو

- **تب و نوار**: در موبایل از `overflow-x-auto` و در صورت نیاز `no-scrollbar` برای اسکرول افقی.
- **جدول**: `overflow-x-auto -mx-3`؛ ستون‌های کم‌اهمیت با `hidden md:table-cell`.
- **گرید**:  
  - متریک: `grid-cols-2 md:grid-cols-4`  
  - کارت‌ها: `grid-cols-1 md:grid-cols-2 lg:grid-cols-3`  
  - layout دو ستونه: `grid-cols-1 lg:grid-cols-3` با col-span.
- **دکمه‌ها**: در موبایل در صورت نیاز `w-full` برای اکشن اصلی.
- **هدر**: `flex flex-col md:flex-row md:items-center md:justify-between gap-4`.

---

## ۱۵. چک‌لیست برای ریدیزاین هر تب

- [ ] پس‌زمینه کارت‌ها از نوع `bg-slate-950/70` یا گرادیان `from-slate-950/90 via-slate-950/80 to-slate-900/80`.
- [ ] حاشیه‌ها `border-white/5` یا `border-slate-800`.
- [ ] تیترها `text-sm font-semibold text-foreground`، توضیحات `text-[11px] text-muted-foreground`.
- [ ] دکمه اصلی بنفش (`bg-purple-600`), ثانویه آبی یا outline با border رنگی.
- [ ] Badge وضعیت با الگوی `bg-{color}-500/10 text-{color}-300 border border-{color}-500/40`.
- [ ] Input/Select با `bg-slate-900` یا `bg-slate-950/80` و `border-slate-700`.
- [ ] جدول با `border-slate-800` و `border-slate-900/60` و `text-xs` / `text-[11px]`.
- [ ] مودال با overlay `bg-black/60 backdrop-blur-sm` و پنل با گرادیان و `rounded-xl` یا `rounded-3xl`.
- [ ] در موبایل: گرید و جدول قابل اسکرول، دکمه‌ها قابل لمس.

---

## ۱۶. فایل مرجع کد

- **کامپوننت نمونه**:  
  `components/ai/AIManager/tabs/DataHub/TelegramPanel.tsx`
- **تسک‌های طراحی در بک‌لاگ**:  
  `DATAHUB_TELEGRAM_TASKS.md` (بخش «یادداشت طراحی – Harmony & Design Language»)

با رعایت این سند، هر تب جدید یا ریدیزاین شده در Data Hub از نظر رنگ، فاصله، تایپوگرافی و کامپوننت با تب Telegram Collector هماهنگ خواهد بود.
