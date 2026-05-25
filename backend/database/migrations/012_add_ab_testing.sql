-- Migration: 012_add_ab_testing.sql
-- Task: BACKEND-022 - Implement Agent A/B Testing
-- Description: Tables for running experiments comparing two agent versions
-- Date: 2026-01-31

-- ============================================================================
-- EXPERIMENTS TABLE
-- ============================================================================
-- Stores A/B test experiment definitions

CREATE TABLE IF NOT EXISTS agent_experiments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  experiment_key VARCHAR(100) UNIQUE NOT NULL,
  agent_key VARCHAR(50) NOT NULL REFERENCES ai_agents(agent_key) ON DELETE CASCADE,
  
  -- Experiment metadata
  name VARCHAR(255) NOT NULL,
  description TEXT,
  hypothesis TEXT,
  
  -- Variant versions
  variant_a_version VARCHAR(20) NOT NULL,
  variant_b_version VARCHAR(20) NOT NULL,
  
  -- Traffic allocation (percentage 0-100)
  variant_a_traffic_percent NUMERIC(5,2) DEFAULT 50.00 CHECK (variant_a_traffic_percent >= 0 AND variant_a_traffic_percent <= 100),
  variant_b_traffic_percent NUMERIC(5,2) DEFAULT 50.00 CHECK (variant_b_traffic_percent >= 0 AND variant_b_traffic_percent <= 100),
  
  -- Experiment status
  status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'running', 'paused', 'completed', 'cancelled')),
  
  -- Statistical significance
  min_sample_size INTEGER DEFAULT 100,
  confidence_level NUMERIC(3,2) DEFAULT 0.95 CHECK (confidence_level > 0 AND confidence_level < 1),
  
  -- Winner determination
  winning_variant VARCHAR(1) CHECK (winning_variant IN ('A', 'B', NULL)),
  statistical_significance BOOLEAN DEFAULT FALSE,
  p_value NUMERIC(10,8),
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_by VARCHAR(255) DEFAULT 'system',
  
  -- Metadata
  metadata JSONB DEFAULT '{}',
  
  -- Constraints
  CONSTRAINT traffic_sum_100 CHECK (variant_a_traffic_percent + variant_b_traffic_percent = 100)
);

-- Indexes
CREATE INDEX idx_agent_experiments_agent_key ON agent_experiments(agent_key);
CREATE INDEX idx_agent_experiments_status ON agent_experiments(status);
CREATE INDEX idx_agent_experiments_experiment_key ON agent_experiments(experiment_key);

COMMENT ON TABLE agent_experiments IS 'A/B test experiments for comparing agent versions';
COMMENT ON COLUMN agent_experiments.experiment_key IS 'Unique identifier for the experiment (e.g., "technical-v1.2-vs-v1.3")';
COMMENT ON COLUMN agent_experiments.variant_a_traffic_percent IS 'Percentage of traffic allocated to variant A (control)';
COMMENT ON COLUMN agent_experiments.variant_b_traffic_percent IS 'Percentage of traffic allocated to variant B (treatment)';
COMMENT ON COLUMN agent_experiments.min_sample_size IS 'Minimum number of samples needed per variant for statistical significance';
COMMENT ON COLUMN agent_experiments.confidence_level IS 'Confidence level for statistical significance (e.g., 0.95 for 95%)';
COMMENT ON COLUMN agent_experiments.p_value IS 'P-value from statistical significance test';

-- ============================================================================
-- EXPERIMENT ASSIGNMENTS TABLE
-- ============================================================================
-- Tracks which variant each user is assigned to for each experiment

CREATE TABLE IF NOT EXISTS experiment_assignments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  experiment_id UUID NOT NULL REFERENCES agent_experiments(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- Assignment details
  variant VARCHAR(1) NOT NULL CHECK (variant IN ('A', 'B')),
  assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Sticky assignment (user always gets same variant)
  is_sticky BOOLEAN DEFAULT TRUE,
  
  -- Metadata
  metadata JSONB DEFAULT '{}',
  
  -- Unique constraint: one assignment per user per experiment
  UNIQUE(experiment_id, user_id)
);

-- Indexes
CREATE INDEX idx_experiment_assignments_experiment_id ON experiment_assignments(experiment_id);
CREATE INDEX idx_experiment_assignments_user_id ON experiment_assignments(user_id);
CREATE INDEX idx_experiment_assignments_variant ON experiment_assignments(variant);

COMMENT ON TABLE experiment_assignments IS 'User assignments to experiment variants (A or B)';
COMMENT ON COLUMN experiment_assignments.variant IS 'Which variant the user was assigned (A=control, B=treatment)';
COMMENT ON COLUMN experiment_assignments.is_sticky IS 'If true, user always gets same variant; if false, can be reassigned';

-- ============================================================================
-- EXPERIMENT METRICS TABLE
-- ============================================================================
-- Tracks performance metrics for each variant

CREATE TABLE IF NOT EXISTS experiment_metrics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  experiment_id UUID NOT NULL REFERENCES agent_experiments(id) ON DELETE CASCADE,
  variant VARCHAR(1) NOT NULL CHECK (variant IN ('A', 'B')),
  
  -- Agent execution reference (optional)
  agent_id VARCHAR(50),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  -- Soft reference only: ai_decisions is RANGE-partitioned with PK (id, created_at) after 006_partition_ai_decisions.sql
  decision_id UUID,
  
  -- Metrics
  execution_time_ms INTEGER NOT NULL,
  success BOOLEAN NOT NULL,
  error_type VARCHAR(50),
  cache_hit BOOLEAN DEFAULT FALSE,
  confidence NUMERIC(5,2),
  
  -- Custom metrics (JSON for flexibility)
  custom_metrics JSONB DEFAULT '{}',
  
  -- Timestamp
  recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Metadata
  metadata JSONB DEFAULT '{}'
);

-- Indexes
CREATE INDEX idx_experiment_metrics_experiment_id ON experiment_metrics(experiment_id);
CREATE INDEX idx_experiment_metrics_variant ON experiment_metrics(variant);
CREATE INDEX idx_experiment_metrics_recorded_at ON experiment_metrics(recorded_at);
CREATE INDEX idx_experiment_metrics_success ON experiment_metrics(success);

COMMENT ON TABLE experiment_metrics IS 'Performance metrics collected for each variant during experiments';
COMMENT ON COLUMN experiment_metrics.variant IS 'Which variant this metric belongs to (A or B)';
COMMENT ON COLUMN experiment_metrics.execution_time_ms IS 'Agent execution time in milliseconds';
COMMENT ON COLUMN experiment_metrics.custom_metrics IS 'Additional custom metrics in JSON format';

-- ============================================================================
-- EXPERIMENT STATISTICS VIEW
-- ============================================================================
-- Aggregated statistics per variant for easy analysis

CREATE OR REPLACE VIEW experiment_statistics AS
SELECT 
  e.id AS experiment_id,
  e.experiment_key,
  e.agent_key,
  e.variant_a_version,
  e.variant_b_version,
  
  -- Variant A statistics
  COUNT(CASE WHEN em.variant = 'A' THEN 1 END) AS variant_a_sample_size,
  AVG(CASE WHEN em.variant = 'A' THEN em.execution_time_ms END) AS variant_a_avg_execution_time_ms,
  AVG(CASE WHEN em.variant = 'A' AND em.success THEN 1.0 ELSE 0.0 END) * 100 AS variant_a_success_rate,
  AVG(CASE WHEN em.variant = 'A' AND em.cache_hit THEN 1.0 ELSE 0.0 END) * 100 AS variant_a_cache_hit_rate,
  STDDEV(CASE WHEN em.variant = 'A' THEN em.execution_time_ms END) AS variant_a_stddev_execution_time,
  
  -- Variant B statistics
  COUNT(CASE WHEN em.variant = 'B' THEN 1 END) AS variant_b_sample_size,
  AVG(CASE WHEN em.variant = 'B' THEN em.execution_time_ms END) AS variant_b_avg_execution_time_ms,
  AVG(CASE WHEN em.variant = 'B' AND em.success THEN 1.0 ELSE 0.0 END) * 100 AS variant_b_success_rate,
  AVG(CASE WHEN em.variant = 'B' AND em.cache_hit THEN 1.0 ELSE 0.0 END) * 100 AS variant_b_cache_hit_rate,
  STDDEV(CASE WHEN em.variant = 'B' THEN em.execution_time_ms END) AS variant_b_stddev_execution_time,
  
  -- Overall experiment info
  e.status,
  e.winning_variant,
  e.statistical_significance,
  e.p_value,
  e.started_at,
  e.completed_at
FROM agent_experiments e
LEFT JOIN experiment_metrics em ON e.id = em.experiment_id
GROUP BY e.id, e.experiment_key, e.agent_key, e.variant_a_version, e.variant_b_version,
         e.status, e.winning_variant, e.statistical_significance, e.p_value,
         e.started_at, e.completed_at;

COMMENT ON VIEW experiment_statistics IS 'Aggregated statistics for each experiment variant';

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Function to get or create user assignment for an experiment
CREATE OR REPLACE FUNCTION get_or_create_assignment(
  p_experiment_id UUID,
  p_user_id UUID
) RETURNS VARCHAR(1) AS $$
DECLARE
  v_variant VARCHAR(1);
  v_random_value NUMERIC;
  v_experiment RECORD;
BEGIN
  -- Check if user already has an assignment
  SELECT variant INTO v_variant
  FROM experiment_assignments
  WHERE experiment_id = p_experiment_id AND user_id = p_user_id;
  
  IF FOUND THEN
    RETURN v_variant;
  END IF;
  
  -- Get experiment details
  SELECT variant_a_traffic_percent INTO v_experiment
  FROM agent_experiments
  WHERE id = p_experiment_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Experiment not found: %', p_experiment_id;
  END IF;
  
  -- Random assignment based on traffic allocation
  v_random_value := random() * 100;
  
  IF v_random_value < v_experiment.variant_a_traffic_percent THEN
    v_variant := 'A';
  ELSE
    v_variant := 'B';
  END IF;
  
  -- Store assignment
  INSERT INTO experiment_assignments (experiment_id, user_id, variant)
  VALUES (p_experiment_id, p_user_id, v_variant);
  
  RETURN v_variant;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_or_create_assignment IS 'Get existing or create new random variant assignment for a user';

-- ============================================================================
-- GRANTS (if using role-based access)
-- ============================================================================

-- Grant appropriate permissions (adjust as needed for your setup)
-- GRANT SELECT, INSERT, UPDATE, DELETE ON agent_experiments TO titangold_backend;
-- GRANT SELECT, INSERT ON experiment_assignments TO titangold_backend;
-- GRANT SELECT, INSERT ON experiment_metrics TO titangold_backend;
-- GRANT SELECT ON experiment_statistics TO titangold_backend;
