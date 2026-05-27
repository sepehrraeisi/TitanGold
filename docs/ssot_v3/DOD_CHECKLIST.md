## SSOT v3.0 – Definition of Done Checklist

این فایل چک‌لیست نهایی DOD برای SSOT v3.0 است و باید در پایان هر فاز مطابق واقعیت کد/زیرساخت به‌روز شود.

- [x] Every AI tab & subtab classified در Coverage Matrix.
- [x] No UNKNOWN remains در `SSOT_v3.0.md`.
- [x] Confidence unified to 0–100 در تمام مسیرها (Agents ↔ Artemis ↔ Trading ↔ UI ↔ DB).
- [x] No UI multiplies confidence (تمام ضرب‌های `* 100` غیرضروری حذف شده‌اند).
- [x] Artemis threshold consistent و بر اساس ۰–۱۰۰ پیاده‌سازی شده است.
- [x] Training fully wired (UI ↔ API ↔ DB؛ بدون UI-only ناخواسته).
- [x] Analytics fully wired (UI ↔ API ↔ DB؛ بدون mockهای اصلی).
- [x] Trading engine verified (Start/Stop, Queue, DB writes, Artemis integration).
- [x] Single migration path (فقط مسیر node-pg-migrate / `npm run migrate`).
- [x] Greenfield DB works (Bootstrap migration تست‌شده روی DB خالی).
- [x] SSOT has evidence lines (برای همه claimهای مهم).
- [x] No active mock/local fallback leakage on implemented DataHub surfaces (local fallback neutralized; backend-fed or explicit degraded/N/A semantics).

