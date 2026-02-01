import { query } from '../database/db.js';

const runMigration = async () => {
  try {
    console.log('🚀 Running autopilot system migration...');
    
    // Step 1: Create autopilot_actions table
    await query(`
      CREATE TABLE IF NOT EXISTS autopilot_actions (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        action_type VARCHAR(50) NOT NULL,
        status VARCHAR(50) DEFAULT 'pending',
        agent_id UUID REFERENCES ai_agents(id) ON DELETE SET NULL,
        old_config JSONB,
        new_config JSONB,
        change_summary TEXT,
        reason TEXT NOT NULL,
        confidence DECIMAL(5,2),
        triggering_events JSONB,
        metrics JSONB,
        suggested_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        suggested_by VARCHAR(50) DEFAULT 'autopilot',
        approved_by UUID REFERENCES users(id) ON DELETE SET NULL,
        approved_at TIMESTAMP WITH TIME ZONE,
        applied_at TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);
    console.log('✅ autopilot_actions table created');
    
    // Step 2: Create indexes
    await query(`CREATE INDEX IF NOT EXISTS idx_autopilot_actions_agent ON autopilot_actions(agent_id)`);
    await query(`CREATE INDEX IF NOT EXISTS idx_autopilot_actions_status ON autopilot_actions(status)`);
    await query(`CREATE INDEX IF NOT EXISTS idx_autopilot_actions_suggested ON autopilot_actions(suggested_at DESC)`);
    await query(`CREATE INDEX IF NOT EXISTS idx_autopilot_actions_type ON autopilot_actions(action_type)`);
    console.log('✅ Indexes created');
    
    // Step 3: Add autopilot fields to artemis_state
    await query(`ALTER TABLE artemis_state ADD COLUMN IF NOT EXISTS autopilot_enabled BOOLEAN DEFAULT false`);
    await query(`ALTER TABLE artemis_state ADD COLUMN IF NOT EXISTS autopilot_last_run TIMESTAMP WITH TIME ZONE`);
    await query(`ALTER TABLE artemis_state ADD COLUMN IF NOT EXISTS autopilot_cycle_count INTEGER DEFAULT 0`);
    await query(`ALTER TABLE artemis_state ADD COLUMN IF NOT EXISTS autopilot_fail_count INTEGER DEFAULT 0`);
    await query(`
      ALTER TABLE artemis_state ADD COLUMN IF NOT EXISTS autopilot_config JSONB DEFAULT '{
        "max_change_percent": 10,
        "min_cycle_interval_minutes": 5,
        "max_consecutive_failures": 3,
        "require_human_approval": true
      }'::jsonb
    `);
    console.log('✅ artemis_state autopilot fields added');
    
    // Step 4: Create circuit breaker function
    await query(`
      CREATE OR REPLACE FUNCTION check_autopilot_circuit_breaker()
      RETURNS TRIGGER AS $$
      BEGIN
        IF NEW.autopilot_fail_count >= 3 THEN
          NEW.autopilot_enabled := false;
          RAISE NOTICE 'Autopilot auto-disabled due to circuit breaker (fail_count: %)', NEW.autopilot_fail_count;
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql
    `);
    console.log('✅ Circuit breaker function created');
    
    // Step 5: Create trigger
    await query(`DROP TRIGGER IF EXISTS trigger_autopilot_breaker ON artemis_state`);
    await query(`
      CREATE TRIGGER trigger_autopilot_breaker
        BEFORE UPDATE OF autopilot_fail_count
        ON artemis_state
        FOR EACH ROW
        EXECUTE FUNCTION check_autopilot_circuit_breaker()
    `);
    console.log('✅ Circuit breaker trigger created');
    
    console.log('✅ Autopilot migration completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
};

runMigration();
