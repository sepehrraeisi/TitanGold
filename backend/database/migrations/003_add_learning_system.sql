-- ============================================================================
-- Learning System Tables
-- ============================================================================

-- ai_learning_events: Auto-generated from ai_decisions + manual annotations
CREATE TABLE IF NOT EXISTS ai_learning_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_type VARCHAR(50) NOT NULL, -- 'improvement' | 'mistake'
  
  -- Link to decision/agent
  decision_id UUID REFERENCES ai_decisions(id) ON DELETE SET NULL,
  agent_id UUID REFERENCES ai_agents(id) ON DELETE SET NULL,
  
  -- Event details
  area VARCHAR(100), -- 'prediction', 'risk_assessment', 'timing', etc.
  method TEXT, -- What method was used
  impact DECIMAL(5,2), -- Impact score (-100 to +100)
  
  -- For mistakes
  correction TEXT, -- What should have been done
  learned BOOLEAN DEFAULT false, -- Has the system adapted?
  
  -- Metadata
  source VARCHAR(50) DEFAULT 'auto', -- 'auto' | 'manual' | 'annotation'
  metadata JSONB DEFAULT '{}'::jsonb,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_learning_events_type ON ai_learning_events(event_type);
CREATE INDEX IF NOT EXISTS idx_learning_events_agent ON ai_learning_events(agent_id);
CREATE INDEX IF NOT EXISTS idx_learning_events_decision ON ai_learning_events(decision_id);
CREATE INDEX IF NOT EXISTS idx_learning_events_created ON ai_learning_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_learning_events_source ON ai_learning_events(source);
CREATE INDEX IF NOT EXISTS idx_learning_events_learned ON ai_learning_events(learned) WHERE event_type = 'mistake';

-- Function to auto-generate learning events from decisions
CREATE OR REPLACE FUNCTION auto_generate_learning_event()
RETURNS TRIGGER AS $$
BEGIN
  -- Only process completed decisions (not running/pending)
  IF NEW.was_successful IS NOT NULL THEN
    
    -- Generate mistake event for failures
    IF NEW.was_successful = false THEN
      INSERT INTO ai_learning_events (
        event_type,
        decision_id,
        agent_id,
        area,
        method,
        impact,
        correction,
        source,
        metadata
      ) VALUES (
        'mistake',
        NEW.id,
        NEW.agent_id,
        NEW.decision_type,
        'ai_decision_analysis',
        -10.0, -- Negative impact for mistakes
        'Analysis needed for correction',
        'auto',
        jsonb_build_object(
          'confidence', NEW.confidence,
          'execution_time_ms', NEW.execution_time_ms,
          'input_summary', COALESCE(NEW.input_data->>'symbol', 'unknown')
        )
      )
      ON CONFLICT DO NOTHING;
    END IF;
    
    -- Generate improvement event for high-confidence successes
    IF NEW.was_successful = true AND NEW.confidence >= 75 THEN
      INSERT INTO ai_learning_events (
        event_type,
        decision_id,
        agent_id,
        area,
        method,
        impact,
        source,
        metadata
      ) VALUES (
        'improvement',
        NEW.id,
        NEW.agent_id,
        NEW.decision_type,
        'successful_high_confidence_decision',
        NEW.confidence / 10, -- Impact proportional to confidence
        'auto',
        jsonb_build_object(
          'confidence', NEW.confidence,
          'execution_time_ms', NEW.execution_time_ms,
          'input_summary', COALESCE(NEW.input_data->>'symbol', 'unknown')
        )
      )
      ON CONFLICT DO NOTHING;
    END IF;
    
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger: Auto-generate learning events when decisions are inserted/updated
DROP TRIGGER IF EXISTS trigger_auto_learning ON ai_decisions;
CREATE TRIGGER trigger_auto_learning
  AFTER INSERT OR UPDATE OF was_successful
  ON ai_decisions
  FOR EACH ROW
  EXECUTE FUNCTION auto_generate_learning_event();

-- Comment
COMMENT ON TABLE ai_learning_events IS 'Auto-generated + manual learning events from AI agent decisions';
COMMENT ON COLUMN ai_learning_events.source IS 'auto = trigger-generated, manual = API-created, annotation = human override';
COMMENT ON FUNCTION auto_generate_learning_event IS 'Automatically creates learning events from successful/failed ai_decisions';
