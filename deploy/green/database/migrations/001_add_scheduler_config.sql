-- Add scheduler_config table for 24/7 automation settings

CREATE TABLE IF NOT EXISTS scheduler_config (
    id INTEGER PRIMARY KEY DEFAULT 1,
    config JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT single_row CHECK (id = 1)
);

-- Insert default configuration
INSERT INTO scheduler_config (id, config) 
VALUES (1, '{
    "agents": {
        "enabled": true,
        "interval": 300000,
        "agents": []
    },
    "dataHub": {
        "enabled": true,
        "interval": 120000,
        "autoRefresh": true,
        "autoNormalize": true
    },
    "training": {
        "enabled": true,
        "interval": 1800000,
        "autoSchedule": false
    },
    "analytics": {
        "enabled": true,
        "interval": 600000,
        "autoRefresh": true
    },
    "artemis": {
        "enabled": true,
        "interval": 60000,
        "autoDecisions": true
    }
}'::jsonb)
ON CONFLICT (id) DO NOTHING;

