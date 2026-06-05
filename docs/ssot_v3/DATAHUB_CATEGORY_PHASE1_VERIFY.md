# DataHub Category Phase 1 — DH-CATEGORIES-PHASE1-VERIFY

> **Date:** 2026-06-05  
> **Policy:** Normalize unknown `data_sources.category` → `uncategorized`; seed registry row; no auto-create.

---

## Taxonomy policy implemented

| Rule | Behavior |
|------|----------|
| Registry | `data_categories` remains admin/trader CRUD only |
| Canonical fallback | `uncategorized` seeded idempotently |
| Unknown on write | Stored as `uncategorized` (logged warn) |
| Approved on write | Canonical registry `name` preserved |
| Telegram empty channel | Still defaults to `signals` then normalized |
| Read list API | `effective_category`, `category_needs_review` enriched |
| Create Source modal | `<option value={cat.name}>` not UUID |

---

## Migration

`backend/database/migrations/034_seed_uncategorized_category.sql`

- `INSERT uncategorized ON CONFLICT DO NOTHING`
- `UPDATE data_sources` orphan strings → `uncategorized` (bounded; reported via row count)

---

## Before / after drift (local DB)

| | Before | After |
|---|--------|-------|
| Registry | announcements, news, signals | + **uncategorized** |
| Orphan source categories | price_data (1), uncategorized string (1) | **0** orphans |
| price_data source | `price_data` | `uncategorized` |

---

## API verification

| Test | Result |
|------|--------|
| POST source `category: price_data` | **201** → stored `uncategorized` |
| POST source `category: signals` | **201** → stored `signals` |
| GET list enrichment | `effective_category: uncategorized` |
| Orphan count SQL | **0** |

---

## Build

`npm run build` — **Pass**

## Browser

Categories tab shows **uncategorized** card and **Needs review** metric — `test-results/dh-categories-phase1/categories-phase1.png`

---

## Rollback

- Revert code; seed row harmless.
- Optional: restore pre-migration source categories from backup if needed (only 1 row was remapped: price_data → uncategorized).
