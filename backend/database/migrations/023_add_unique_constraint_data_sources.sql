-- Up Migration
CREATE UNIQUE INDEX idx_data_sources_name_type ON data_sources(name, type) WHERE is_active = TRUE;

-- Down Migration
DROP INDEX IF EXISTS idx_data_sources_name_type;
