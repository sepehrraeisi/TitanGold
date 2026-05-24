# DataHub — Mandatory Delivery Workflow (v3.0+)

> مرجع طراحی: [`/home/ubuntu/webapp/TitanGold/DESIGN_SYSTEM_DATAHUB.md`](../../DESIGN_SYSTEM_DATAHUB.md)  
> الگوی طلایی UI: `components/ai/AIManager/tabs/DataHub/TelegramPanel.tsx`

## قانون پروژه

هر subsection DataHub که وارد فاز پیاده‌سازی می‌شود **فقط backend-first کافی نیست**.  
تا وقتی Design Pass کامل نشود، وضعیت SSOT نهایی **Implemented** نیست (حداکثر: **Implemented (backend)** یا **Partial**).

## Workflow اجباری (ترتیب)

| # | مرحله | خروجی |
|---|--------|--------|
| 1 | Contract (API/DB/UI needs) | `docs/ssot_v3/advanced/*_CONTRACT.md` یا بخش در PR |
| 2 | Backend / migration / API | routes + service + migration |
| 3 | Frontend wiring | `services/*Api.ts` + React Query hooks |
| 4 | **Full Design pass** | کامپوننت‌ها مطابق `DESIGN_SYSTEM_DATAHUB.md` |
| 5 | **i18n** | همه labelها `t('key')` + `en`/`fa` (blue/green parity) |
| 6 | SSOT + Evidence + Demos | `SSOT_v3.0.md`, `EVIDENCE.md`, `DataHub_DEMOS.md` |
| 7 | **Coverage Matrix update** | ستون Design + Backend در `SSOT_v3.0.md` |
| 8 | Environment proof (در صورت blocker) | `audit/ENVIRONMENT.md` |

## چک‌لیست Design Pass (خلاصه)

- [ ] کارت: `bg-gradient-to-br from-slate-950/90 …` یا `bg-slate-950/70` + `border-white/5`
- [ ] متریک: مینی‌کارت‌های `from-{color}-500/10` + `text-[11px]` labels
- [ ] دکمه primary: `rounded-full bg-purple-600` (نه فقط `ActionButton` generic)
- [ ] Badge: `bg-emerald-500/10 text-emerald-300 border border-emerald-500/40`
- [ ] Input/Select: `bg-slate-950/80 border-slate-700 text-xs`
- [ ] Table: `border-slate-800` thead, `border-slate-900/60` rows
- [ ] Modal: overlay `bg-black/60 backdrop-blur-sm` + پنل گرادیان `rounded-xl`
- [ ] Empty/loading/error: الگوی Alert §11 + skeleton/spinner هماهنگ
- [ ] Toggle: §12 (سوییچ emerald/slate)
- [ ] حذف وابستگی بصری به `bg-card` / `border-border` / `bg-secondary` به‌عنوان استایل نهایی

## بدهی طراحی قبلی

بخش‌هایی که backend بسته شده‌اند ولی Design Pass کامل ندارند → [`DATAHUB_DESIGN_BACKLOG.md`](./DATAHUB_DESIGN_BACKLOG.md).

## شروع از اینجا

**`dataHub.advanced.accessControl`** — اولین subsection تحت این workflow یک‌جا (wiring + design + i18n).
