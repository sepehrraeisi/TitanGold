-- Topic Routing System (TASK-BE-013)
-- Enables automatic routing of data to agents based on keyword/topic matching

-- Table: topic_routing_rules
-- Stores user-defined routing rules
CREATE TABLE IF NOT EXISTS topic_routing_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    keywords TEXT[] NOT NULL,
    agent_key VARCHAR(100) NOT NULL,
    priority INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Table: topic_routing_logs
-- Logs all routing decisions for audit and analysis
CREATE TABLE IF NOT EXISTS topic_routing_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    data_id UUID NOT NULL REFERENCES collected_data(id) ON DELETE CASCADE,
    rule_id UUID REFERENCES topic_routing_rules(id) ON DELETE SET NULL,
    matched_keywords TEXT[],
    agent_key VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_topic_routing_rules_active ON topic_routing_rules(is_active, priority DESC);
CREATE INDEX IF NOT EXISTS idx_topic_routing_logs_data_id ON topic_routing_logs(data_id);
CREATE INDEX IF NOT EXISTS idx_topic_routing_logs_rule_id ON topic_routing_logs(rule_id);
CREATE INDEX IF NOT EXISTS idx_topic_routing_logs_created_at ON topic_routing_logs(created_at DESC);

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_topic_routing_rules_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_topic_routing_rules_updated_at
    BEFORE UPDATE ON topic_routing_rules
    FOR EACH ROW
    EXECUTE FUNCTION update_topic_routing_rules_updated_at();

-- Insert some default routing rules
INSERT INTO topic_routing_rules (name, keywords, agent_key, priority) VALUES
    ('Bitcoin Market Intelligence', '{"bitcoin", "btc", "bitcoin price"}', 'market_intelligence', 100),
    ('Ethereum Market Intelligence', '{"ethereum", "eth", "ether"}', 'market_intelligence', 90),
    ('Sentiment Analysis - Fear/Greed', '{"fear", "greed", "panic", "fomo", "fud"}', 'sentiment', 80),
    ('Altcoin Tracker', '{"altcoin", "alt season", "defi", "nft"}', 'market_intelligence', 70);
