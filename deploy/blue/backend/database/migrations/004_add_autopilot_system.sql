-- ============================================================================
-- Autopilot System Tables
-- ============================================================================

-- autopilot_actions: Suggested + Applied Config Adjustments
CREATE TABLE IF NOT EXISTS autopilot_actions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Action details
  action_type VARCHAR(50) NOT NULL, -- 'config_adjustment', 'agent_pause', 'threshold_change', etc.
  status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'approved', 'rejected', 'applied', 'rolled_back'
  
  -- Target
  agent_id UUID REFERENCES ai_agents(id) ON DELETE SET NULL,
  
  -- Config changes
  old_config JSONB,
  new_config JSONB,
  change_summary TEXT, -- Human-readable summary of changes
  
  -- Reasoning
  reason TEXT NOT NULL, -- Why was this adjustment suggested?
  confidence DECIMAL(5,2), -- How confident is autopilot in this suggestion? (0-100)
  
  -- Evidence
  triggering_events JSONB, -- Which learning events triggered this?
  metrics JSONB, -- Relevant metrics (mistake count, success rate, etc.)
  
  -- Approval workflow
  suggested_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  suggested_by VARCHAR(50) DEFAULT 'autopilot', -- 'autopilot' | 'admin'
  approved_by UUID REFERENCES users(id) ON DELETE SET NULL,
  approved_at TIMESTAMP WITH TIME ZONE,
  applied_at TIMESTAMP WITH TIME ZONE,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_autopilot_actions_agent ON autopilot_actions(agent_id);
CREATE INDEX IF NOT EXISTS idx_autopilot_actions_status ON autopilot_actions(status);
CREATE INDEX IF NOT EXISTS idx_autopilot_actions_suggested ON autopilot_actions(suggested_at DESC);
CREATE INDEX IF NOT EXISTS idx_autopilot_actions_type ON autopilot_actions(action_type);

-- Add autopilot fields to artemis_state
ALTER TABLE artemis_state 
  ADD COLUMN IF NOT EXISTS autopilot_enabled BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS autopilot_last_run TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS autopilot_cycle_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS autopilot_fail_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS autopilot_config JSONB DEFAULT '{
    "max_change_percent": 10,
    "min_cycle_interval_minutes": 5,
    "max_consecutive_failures": 3,
    "require_human_approval": true
  }'::jsonb;

-- Safety: Circuit breaker function
-- Auto-disable autopilot if too many failures
CREATE OR REPLACE FUNCTION check_autopilot_circuit_breaker()
RETURNS TRIGGER AS $$
BEGIN
  -- If fail_count exceeds threshold, auto-disable
  IF NEW.autopilot_fail_count >= 3 THEN
    NEW.autopilot_enabled := false;
    -- Log the auto-disable
    RAISE NOTICE 'Autopilot auto-disabled due to circuit breaker (fail_count: %)', NEW.autopilot_fail_count;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_autopilot_breaker ON artemis_state;
CREATE TRIGGER trigger_autopilot_breaker
  BEFORE UPDATE OF autopilot_fail_count
  ON artemis_state
  FOR EACH ROW
  EXECUTE FUNCTION check_autopilot_circuit_breaker();

-- Comments
COMMENT ON TABLE autopilot_actions IS 'Autopilot suggested/applied config adjustments — human approval required in v1';
COMMENT ON COLUMN autopilot_actions.status IS 'pending → approved/rejected → applied/rolled_back';
COMMENT ON COLUMN artemis_state.autopilot_enabled IS 'Master switch for autopilot system';
COMMENT ON COLUMN artemis_state.autopilot_fail_count IS 'Consecutive failures — triggers circuit breaker at 3';
COMMENT ON FUNCTION check_autopilot_circuit_breaker IS 'Auto-disable autopilot if fail_count >= 3';
