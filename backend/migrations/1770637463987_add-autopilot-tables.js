export const up = (pgm) => {
    // 1. Create autopilot_actions table
    pgm.createTable('autopilot_actions', {
        id: { type: 'uuid', primaryKey: true, default: pgm.func('uuid_generate_v4()') },
        action_type: { type: 'varchar(50)', notNull: true },
        status: { type: 'varchar(50)', default: 'pending' },
        agent_id: { type: 'uuid', references: 'ai_agents(id)', onDelete: 'SET NULL' },
        old_config: { type: 'jsonb' },
        new_config: { type: 'jsonb' },
        change_summary: { type: 'text' },
        reason: { type: 'text', notNull: true },
        confidence: { type: 'numeric(5,2)' },
        triggering_events: { type: 'jsonb' },
        metrics: { type: 'jsonb' },
        suggested_at: { type: 'timestamp with time zone', default: pgm.func('current_timestamp') },
        suggested_by: { type: 'varchar(50)', default: 'autopilot' },
        approved_by: { type: 'uuid', references: 'users(id)', onDelete: 'SET NULL' },
        approved_at: { type: 'timestamp with time zone' },
        applied_at: { type: 'timestamp with time zone' },
        created_at: { type: 'timestamp with time zone', default: pgm.func('current_timestamp') },
        updated_at: { type: 'timestamp with time zone', default: pgm.func('current_timestamp') }
    });

    pgm.createIndex('autopilot_actions', 'agent_id');
    pgm.createIndex('autopilot_actions', 'status');
    pgm.createIndex('autopilot_actions', 'suggested_at');

    // 2. Add autopilot columns to artemis_state
    pgm.addColumns('artemis_state', {
        autopilot_enabled: { type: 'boolean', default: false },
        autopilot_last_run: { type: 'timestamp with time zone' },
        autopilot_cycle_count: { type: 'integer', default: 0 },
        autopilot_fail_count: { type: 'integer', default: 0 },
        autopilot_config: {
            type: 'jsonb',
            default: JSON.stringify({
                max_change_percent: 10,
                min_cycle_interval_minutes: 5,
                max_consecutive_failures: 3,
                require_human_approval: true
            })
        }
    });
};

export const down = (pgm) => {
    pgm.dropTable('autopilot_actions');
    pgm.dropColumns('artemis_state', [
        'autopilot_enabled',
        'autopilot_last_run',
        'autopilot_cycle_count',
        'autopilot_fail_count',
        'autopilot_config'
    ]);
};
