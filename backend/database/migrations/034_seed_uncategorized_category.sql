-- Migration: 034_seed_uncategorized_category.sql
-- DH-CATEGORIES-PHASE1: canonical fallback category for unclassified sources
-- Idempotent — no schema changes

INSERT INTO data_categories (name, description, color, icon, created_at, updated_at)
VALUES (
    'uncategorized',
    'Sources or data that do not yet match an approved category',
    '#64748b',
    'HelpCircle',
    NOW(),
    NOW()
)
ON CONFLICT (name) DO NOTHING;

-- Bounded data fix: remap orphan source category strings to registry-backed uncategorized
UPDATE data_sources
SET category = 'uncategorized',
    updated_at = NOW()
WHERE category IS NOT NULL
  AND TRIM(category) <> ''
  AND category NOT IN (SELECT name FROM data_categories);
