# Manual Design System Review — 2026-07-14

Reviewer method: visual inspection of Playwright PNG evidence (not generator auto-PASS).
Runtime during capture: global mode=demo, Kill Switch active (header/banners show DEMO).
Roles: admin / trader / user. Viewport default 1280×720 unless noted.

## Gate failure found on first evidence set (pre-fix)

| Finding | Severity | Surfaces | Action |
|---------|----------|----------|--------|
| Preferences Migration modal overlays every captured AI panel/tab | FAIL — blocks DS verification of target surface | all `panel-*`, `artemis-*`, `topic-routing-*`, `agents-banner-*` | Dismiss migration in Playwright `injectDevSession`; replace emoji glyphs in modal with text/CSS |
| Broken emoji/glyph boxes (□) in migration modal benefits | FAIL — typography/icons | overlay on all screenshots | Removed emoji from `PreferencesMigration.tsx` |
| Raw i18n key `create_rule` on Topic Routing CTA | FAIL — i18n | `topic-routing-admin.png` | Added `create_rule` to en/fa locales |

Generator matrix (`design-system-matrix.json`) marked criteria PASS while screenshots were unusable — that automatic PASS is **rejected**.

## Post-fix review criteria

After re-capture, each surface must show the target panel/tab without blocking overlay.

Criteria checked per surface:

1. Layout — single coherent composition for panel
2. Spacing — consistent gaps, no clipped primary CTA
3. Cards — agent cards only where interaction requires container
4. Typography — no raw keys, no tofu □ glyphs on labels
5. Status badges — Demo / Active / Kill Switch readable
6. Loading / Empty / Error — no undefined/null; empty copy human-readable where shown
7. Forms / Actions / Confirmations — enabled vs disabled explained when denied
8. Accessibility — focusable controls; keyboard Escape closes panels (tested in suite)
9. Responsive — mobile screenshots `agents-mobile-*`
10. Dark theme — primary screens dark (`#0*` backgrounds)
11. i18n — no raw keys on primary CTAs
12. Runtime-state clarity — DEMO / kill-switch / requested/effective mode visible in header

## Verdict after re-capture

See `docs/evidence/design-system-manual-review-20260714.json` for per-screenshot PASS/FAIL filled after Playwright re-run.
