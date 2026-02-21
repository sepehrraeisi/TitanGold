-- Quick QA for Region Intelligence coverage
-- Usage (example):
--   psql -h <host> -p <port> -U <user> -d titangold_db -f scripts/check_telegram_regions.sql

-- 1) Sample recent events that already have regions populated
SELECT 
    id,
    primary_category,
    countries,
    regions,
    market_impact_level,
    is_breaking,
    created_at
FROM telegram_news_events
WHERE created_at > NOW() - INTERVAL '7 days'
  AND regions IS NOT NULL
  AND array_length(regions, 1) > 0
ORDER BY created_at DESC
LIMIT 50;

-- 2) Coverage summary: how many news events have regions vs none (last 7 days)
WITH recent AS (
    SELECT *
    FROM telegram_news_events
    WHERE created_at > NOW() - INTERVAL '7 days'
)
SELECT
    COUNT(*) AS total_events_7d,
    COUNT(*) FILTER (WHERE regions IS NOT NULL AND array_length(regions, 1) > 0) AS events_with_regions_7d,
    COUNT(*) FILTER (WHERE regions IS NULL OR array_length(regions, 1) = 0) AS events_without_regions_7d
FROM recent;

-- 3) Distribution of events by region (last 7 days)
SELECT
    region,
    COUNT(*) AS event_count
FROM (
    SELECT unnest(regions) AS region
    FROM telegram_news_events
    WHERE created_at > NOW() - INTERVAL '7 days'
      AND regions IS NOT NULL
      AND array_length(regions, 1) > 0
) t
GROUP BY region
ORDER BY event_count DESC;

