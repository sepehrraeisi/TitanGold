-- Backfill regions in telegram_news_events based on existing countries and telegram_region_config
-- Safe to run multiple times; only fills missing regions where a clear mapping exists.

WITH mapped AS (
    SELECT 
        ne.id,
        ARRAY(
            SELECT DISTINCT trc.region_key
            FROM telegram_region_config trc
            WHERE trc.is_active = TRUE
              AND trc.countries && ne.countries
        ) AS regions
    FROM telegram_news_events ne
    WHERE (ne.regions IS NULL OR array_length(ne.regions, 1) = 0)
      AND ne.countries IS NOT NULL
      AND array_length(ne.countries, 1) > 0
)
UPDATE telegram_news_events ne
SET regions = mapped.regions
FROM mapped
WHERE ne.id = mapped.id
  AND array_length(mapped.regions, 1) > 0;

