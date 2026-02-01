import { query } from '../database/db.js';

const runMigration = async () => {
  try {
    console.log('🚀 Running learning system migration...');
    
    // Step 1: Create table
    await query(`
      CREATE TABLE IF NOT EXISTS ai_learning_events (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        event_type VARCHAR(50) NOT NULL,
        decision_id UUID REFERENCES ai_decisions(id) ON DELETE SET NULL,
        agent_id UUID REFERENCES ai_agents(id) ON DELETE SET NULL,
        area VARCHAR(100),
        method TEXT,
        impact DECIMAL(5,2),
        correction TEXT,
        learned BOOLEAN DEFAULT false,
        source VARCHAR(50) DEFAULT 'auto',
        metadata JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);
    console.log('✅ Table created');
    
    // Step 2: Create indexes
    await query(`CREATE INDEX IF NOT EXISTS idx_learning_events_type ON ai_learning_events(event_type)`);
    await query(`CREATE INDEX IF NOT EXISTS idx_learning_events_agent ON ai_learning_events(agent_id)`);
    await query(`CREATE INDEX IF NOT EXISTS idx_learning_events_decision ON ai_learning_events(decision_id)`);
    await query(`CREATE INDEX IF NOT EXISTS idx_learning_events_created ON ai_learning_events(created_at DESC)`);
    await query(`CREATE INDEX IF NOT EXISTS idx_learning_events_source ON ai_learning_events(source)`);
    await query(`CREATE INDEX IF NOT EXISTS idx_learning_events_learned ON ai_learning_events(learned) WHERE event_type = 'mistake'`);
    console.log('✅ Indexes created');
    
    // Step 3: Create function (as single statement)
    await query(`
      CREATE OR REPLACE FUNCTION auto_generate_learning_event()
      RETURNS TRIGGER AS $$
      BEGIN
        IF NEW.was_successful IS NOT NULL THEN
          IF NEW.was_successful = false THEN
            INSERT INTO ai_learning_events (
              event_type, decision_id, agent_id, area, method, impact, correction, source, metadata
            ) VALUES (
              'mistake', NEW.id, NEW.agent_id, NEW.decision_type, 'ai_decision_analysis', -10.0,
              'Analysis needed for correction', 'auto',
              jsonb_build_object('confidence', NEW.confidence, 'execution_time_ms', NEW.execution_time_ms, 'input_summary', COALESCE(NEW.input_data->>'symbol', 'unknown'))
            ) ON CONFLICT DO NOTHING;
          END IF;
          
          IF NEW.was_successful = true AND NEW.confidence >= 75 THEN
            INSERT INTO ai_learning_events (
              event_type, decision_id, agent_id, area, method, impact, source, metadata
            ) VALUES (
              'improvement', NEW.id, NEW.agent_id, NEW.decision_type, 'successful_high_confidence_decision', NEW.confidence / 10, 'auto',
              jsonb_build_object('confidence', NEW.confidence, 'execution_time_ms', NEW.execution_time_ms, 'input_summary', COALESCE(NEW.input_data->>'symbol', 'unknown'))
            ) ON CONFLICT DO NOTHING;
          END IF;
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql
    `);
    console.log('✅ Function created');
    
    // Step 4: Create trigger
    await query(`DROP TRIGGER IF EXISTS trigger_auto_learning ON ai_decisions`);
    await query(`
      CREATE TRIGGER trigger_auto_learning
        AFTER INSERT OR UPDATE OF was_successful
        ON ai_decisions
        FOR EACH ROW
        EXECUTE FUNCTION auto_generate_learning_event()
    `);
    console.log('✅ Trigger created');
    
    console.log('✅ Migration completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
};

runMigration();
