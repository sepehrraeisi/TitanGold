-- Create source_access_controls table for granular access management
-- TASK-DF-009

CREATE TABLE IF NOT EXISTS source_access_controls (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    source_id UUID NOT NULL REFERENCES data_sources(id) ON DELETE CASCADE,
    allowed_agents TEXT[] DEFAULT '{}', -- Array of agent_keys, empty = all allowed
    blocked_agents TEXT[] DEFAULT '{}',
    allowed_data_types TEXT[] DEFAULT '{}', -- e.g. market_data, news, etc.
    blocked_data_types TEXT[] DEFAULT '{}',
    require_auth BOOLEAN DEFAULT FALSE,
    max_requests_per_minute INTEGER DEFAULT 0, -- 0 = unlimited
    max_requests_per_day INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
    
    UNIQUE(source_id)
);

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_source_access_controls_updated_at
    BEFORE UPDATE ON source_access_controls
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
