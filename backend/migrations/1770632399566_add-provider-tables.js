export const up = (pgm) => {
    // 1. system_config table
    pgm.createTable('system_config', {
        key: { type: 'varchar(255)', primaryKey: true },
        value: { type: 'jsonb', notNull: true },
        description: { type: 'text' },
        updated_at: { type: 'timestamp', default: pgm.func('current_timestamp') },
        updated_by: { type: 'uuid', references: 'users(id)', onDelete: 'SET NULL' }
    });

    // 2. api_integrations table
    pgm.createTable('api_integrations', {
        id: { type: 'uuid', primaryKey: true, default: pgm.func('uuid_generate_v4()') },
        provider: { type: 'varchar(50)', notNull: true },
        name: { type: 'varchar(100)', notNull: true },
        api_key_encrypted: { type: 'text' },
        base_url: { type: 'text' },
        model: { type: 'varchar(100)' },
        weight: { type: 'numeric(5,2)', default: 1.0 },
        enabled: { type: 'boolean', default: true },
        rate_limit_per_min: { type: 'integer' },
        daily_budget: { type: 'numeric(20,8)' },
        monthly_budget: { type: 'numeric(20,8)' },
        metadata: { type: 'jsonb' },
        created_by: { type: 'uuid', references: 'users(id)', onDelete: 'CASCADE' },
        created_at: { type: 'timestamp', default: pgm.func('current_timestamp') },
        updated_at: { type: 'timestamp', default: pgm.func('current_timestamp') }
    });

    pgm.createIndex('api_integrations', ['provider', 'name']);
    pgm.createIndex('api_integrations', 'created_by');

    // 3. api_integration_runtime table
    pgm.createTable('api_integration_runtime', {
        integration_id: {
            type: 'uuid',
            primaryKey: true,
            references: 'api_integrations(id)',
            onDelete: 'CASCADE'
        },
        status: { type: 'varchar(50)', default: 'healthy' },
        cooldown_until: { type: 'timestamp' },
        last_error: { type: 'text' },
        fail_count: { type: 'integer', default: 0 },
        success_count: { type: 'integer', default: 0 },
        total_requests: { type: 'integer', default: 0 },
        total_cost: { type: 'numeric(20,8)', default: 0 },
        last_used_at: { type: 'timestamp' },
        updated_at: { type: 'timestamp', default: pgm.func('current_timestamp') }
    });

    // Insert default Artemis config
    pgm.sql(`
    INSERT INTO system_config (key, value, description)
    VALUES (
      'artemis.decision_engine',
      '{"strategy": "mixture_of_experts", "quorum": {"type": "percent", "value": 40, "min": 2}, "timeoutMs": 12000, "maxRetries": 2, "maxConcurrency": 6, "providersToUse": ["openrouter", "openai", "deepseek", "gemini"], "degradedMode": "best_effort", "aggregation": {"method": "weighted_vote", "finalSummarizer": true}}'::jsonb,
      'Artemis Decision Engine configuration'
    ) ON CONFLICT (key) DO NOTHING
  `);
};

export const down = (pgm) => {
    pgm.dropTable('api_integration_runtime');
    pgm.dropTable('api_integrations');
    pgm.dropTable('system_config');
};
