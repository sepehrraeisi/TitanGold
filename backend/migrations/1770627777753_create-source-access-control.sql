-- Up Migration
CREATE TABLE IF NOT EXISTS source_access_controls (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    source_id UUID NOT NULL REFERENCES data_sources(id) ON DELETE CASCADE,
    allowed_agents TEXT[] DEFAULT '{}',
    blocked_agents TEXT[] DEFAULT '{}',
    allowed_data_types TEXT[] DEFAULT '{}',
    blocked_data_types TEXT[] DEFAULT '{}',
    require_auth BOOLEAN DEFAULT FALSE,
    max_requests_per_minute INTEGER DEFAULT 0,
    max_requests_per_day INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
    
    UNIQUE(source_id)
);

-- Down Migration
-- DROP TABLE source_access_controls;
