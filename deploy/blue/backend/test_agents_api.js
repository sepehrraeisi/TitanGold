// Test GET /api/ai-agents endpoint
import pool from './database/db.js';
import { logger } from './services/logger.js';

async function testAgentsAPI() {
    logger.info('🧪 Testing GET /api/ai-agents mapping...\n');
    
    try {
        const result = await pool.query(`
            SELECT 
                id, 
                agent_key, 
                name, 
                type,
                status,
                config,
                metadata,
                COALESCE(accuracy::float8, 0) AS accuracy,
                COALESCE(performance_score::float8, 0) AS performance_score,
                COALESCE(total_decisions, 0) AS total_decisions,
                COALESCE(successful_decisions, 0) AS successful_decisions,
                is_enabled,
                created_at,
                updated_at,
                last_active_at
            FROM ai_agents 
            ORDER BY agent_key
            LIMIT 3
        `);
        
        logger.info(`📊 Found ${result.rows.length} agents\n`);
        
        result.rows.forEach((agent, idx) => {
            // Safe JSON parse
            const safeParse = (value) => {
                if (!value) return {};
                if (typeof value === 'object') return value;
                try { return JSON.parse(value); } catch { return {}; }
            };
            
            const config = safeParse(agent.config);
            const metadata = safeParse(agent.metadata);
            
            // Status mapping: idle/error -> inactive
            let mappedStatus = agent.status;
            if (agent.status === 'idle' || agent.status === 'error') {
                mappedStatus = 'inactive';
            }
            
            const capabilities = metadata.capabilities || [];
            const role = metadata.role || 'AI Agent';
            
            const uiAgent = {
                id: agent.id,
                agent_key: agent.agent_key,
                name: agent.name,
                role,
                status: mappedStatus,
                accuracy: parseFloat(agent.accuracy) || 0,
                trainingProgress: 100,
                decisions: parseInt(agent.total_decisions, 10) || 0,
                learningTime: metadata.learning_time || '0h',
                knowledgeSize: metadata.knowledge_size || 'N/A',
                capabilities,
                lastUpdate: agent.updated_at || agent.created_at
            };
            
            logger.info(`${idx + 1}. ${agent.agent_key}`);
            logger.info(`   Name: ${uiAgent.name}`);
            logger.info(`   Role: ${uiAgent.role}`);
            logger.info(`   Status: ${agent.status} → ${uiAgent.status}`);
            logger.info(`   Capabilities: ${capabilities.length > 0 ? capabilities.slice(0, 3).join(', ') : 'None'}`);
            logger.info(`   Decisions: ${uiAgent.decisions}`);
            logger.info('');
        });
        
        logger.info('✅ API mapping test successful!');
        process.exit(0);
    } catch (error) {
        logger.error('❌ Test failed:', error.message);
        process.exit(1);
    }
}

testAgentsAPI();
