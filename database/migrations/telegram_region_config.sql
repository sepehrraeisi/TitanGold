-- Telegram Region Configuration
-- Standardized taxonomy and mapping for Geographic Map and related analytics.
-- This migration is additive and safe to run multiple times.

CREATE TABLE IF NOT EXISTS telegram_region_config (
    id SERIAL PRIMARY KEY,
    region_key VARCHAR(64) NOT NULL UNIQUE, -- e.g. 'MIDDLE_EAST', 'EUROPE'
    display_name VARCHAR(128) NOT NULL,     -- Human-readable name
    countries TEXT[] DEFAULT ARRAY[]::TEXT[], -- Canonical country names associated with this region
    description TEXT,
    priority INTEGER DEFAULT 100,           -- Lower = higher priority
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_telegram_region_config_active
    ON telegram_region_config(is_active);

-- Seed initial regions to align with GeographicHeatMap buckets.
INSERT INTO telegram_region_config (region_key, display_name, countries, description, priority)
VALUES
    ('NORTH_AMERICA', 'North America', ARRAY['USA', 'Canada', 'Mexico'],
     'North American macro region (US, Canada, Mexico).', 10),
    ('SOUTH_AMERICA', 'South America', ARRAY['Brazil', 'Argentina', 'Chile', 'Colombia'],
     'South American macro region.', 20),
    ('EUROPE', 'Europe', ARRAY['Europe', 'UK', 'Germany', 'France', 'Italy', 'Spain'],
     'European macro region including UK and EU core economies.', 30),
    ('MIDDLE_EAST', 'Middle East', ARRAY['Iran', 'Iraq', 'Syria', 'Israel', 'Turkey', 'UAE', 'Saudi Arabia', 'Qatar'],
     'Middle East geopolitically relevant region.', 40),
    ('ASIA', 'Asia', ARRAY['China', 'Russia', 'Japan', 'South Korea', 'India'],
     'Broad Asia bucket for now (can be split later).', 50),
    ('AFRICA', 'Africa', ARRAY['South Africa', 'Nigeria', 'Egypt'],
     'African macro region.', 60),
    ('OCEANIA', 'Oceania', ARRAY['Australia', 'New Zealand'],
     'Oceania macro region.', 70),
    ('CENTRAL_ASIA', 'Central Asia', ARRAY['Afghanistan', 'Kazakhstan', 'Uzbekistan'],
     'Central Asia macro region.', 80),
    ('SOUTHEAST_ASIA', 'Southeast Asia', ARRAY['Singapore', 'Malaysia', 'Indonesia', 'Thailand', 'Vietnam'],
     'Southeast Asia macro region.', 90),
    ('EAST_ASIA', 'East Asia', ARRAY['China', 'Japan', 'South Korea'],
     'East Asia macro region.', 95)
ON CONFLICT (region_key) DO NOTHING;

