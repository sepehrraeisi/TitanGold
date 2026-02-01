/**
 * GraphQL Resolvers for TitanGold AI Agents
 * API-007: GraphQL API Implementation
 * Date: 2026-01-31
 * 
 * Resolves GraphQL queries and mutations for AI agent operations
 */

import { query } from '../database/db.js';
import agentRegistry from '../services/agents/registry.js';
import { logger } from '../services/logger.js';
import { GraphQLError } from 'graphql';
import { 
  checkAgentHealth, 
  checkAllAgentsHealth,
  getAgentHealthStatus,
  getAllAgentHealthStatus
} from '../services/agents/registry.js';

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Transform agent result to GraphQL-compatible format
 */
function transformAgentResult(agent_key, rawResult) {
  const { symbol, timeframe, confidence, signal, indicators, timestamp, _meta } = rawResult;
  
  // Handle different agent types
  if (agent_key === 'arbitrage') {
    return {
      agent_key,
      symbol: symbol || null,
      timeframe: timeframe || null,
      signal: null,
      confidence: typeof confidence === 'number' ? confidence : 0.5,
      timestamp: timestamp || new Date().toISOString(),
      indicators: [],
      summary: rawResult.summary || {},
      opportunities: rawResult.opportunities || [],
      riskAlerts: rawResult.riskAlerts || [],
      _meta: _meta || { source: 'real', version: '1.0.0' }
    };
  }
  
  if (agent_key === 'fundamental') {
    return {
      agent_key,
      symbol: symbol || null,
      timeframe: timeframe || null,
      signal: signal || 'NEUTRAL',
      confidence: typeof confidence === 'number' ? confidence : 0.5,
      timestamp: timestamp || new Date().toISOString(),
      indicators: [],
      summary: rawResult.summary || {},
      _meta: _meta || { source: 'real', version: '1.0.0' }
    };
  }
  
  // Standard agent format
  const indicatorsArray = indicators
    ? (Array.isArray(indicators) ? indicators : Object.entries(indicators).map(([name, data]) => ({
        name,
        value: typeof data === 'object' ? data.value : data,
        signal: typeof data === 'object' ? data.signal : null,
        metadata: typeof data === 'object' ? data : null
      })))
    : [];
  
  return {
    agent_key,
    symbol: symbol || null,
    timeframe: timeframe || null,
    signal: signal || 'NEUTRAL',
    confidence: typeof confidence === 'number' ? confidence : 0.5,
    timestamp: timestamp || new Date().toISOString(),
    indicators: indicatorsArray,
    _meta: _meta || { source: 'real', version: '1.0.0' }
  };
}

/**
 * Execute with timeout
 */
async function withTimeout(promise, ms, errorMessage, agentKey) {
  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(() => {
      const error = new Error(errorMessage);
      error.agentKey = agentKey;
      logger.error(`⏱️ TIMEOUT: Agent ${agentKey} exceeded ${ms}ms limit`);
      reject(error);
    }, ms);
  });
  return Promise.race([promise, timeoutPromise]);
}

/**
 * Log decision to database
 */
async function logDecision(agentId, userId, decisionType, inputData, outputData, executionTimeMs, wasSuccessful = true) {
  try {
    const confidence = outputData?.confidence || null;
    await query(`
      INSERT INTO ai_decisions 
      (agent_id, user_id, decision_type, input_data, output_data, confidence, was_successful, execution_time_ms, created_at, metadata)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), $9::jsonb)
    `, [
      agentId,
      userId || null,
      decisionType,
      JSON.stringify(inputData),
      JSON.stringify(outputData),
      confidence,
      wasSuccessful,
      executionTimeMs,
      JSON.stringify({ source: 'graphql' })
    ]);
  } catch (err) {
    logger.error('Failed to log decision:', err);
  }
}

// ============================================================================
// Resolvers
// ============================================================================

export const resolvers = {
  Query: {
    /**
     * Get all AI agents
     */
    agents: async (_, __, context) => {
      try {
        const result = await query(`
          SELECT * FROM ai_agents 
          ORDER BY name ASC
        `);
        
        return result.rows.map(agent => ({
          ...agent,
          config: typeof agent.config === 'string' 
            ? JSON.parse(agent.config) 
            : agent.config
        }));
      } catch (error) {
        logger.error('GraphQL: Failed to fetch agents:', error);
        throw new GraphQLError('Failed to fetch agents', {
          extensions: { code: 'DATABASE_ERROR', details: error.message }
        });
      }
    },

    /**
     * Get agent by ID
     */
    agent: async (_, { id }) => {
      try {
        const result = await query(`
          SELECT * FROM ai_agents 
          WHERE id = $1
        `, [id]);
        
        if (result.rows.length === 0) {
          throw new GraphQLError('Agent not found', {
            extensions: { code: 'NOT_FOUND', agentId: id }
          });
        }
        
        const agent = result.rows[0];
        return {
          ...agent,
          config: typeof agent.config === 'string' 
            ? JSON.parse(agent.config) 
            : agent.config
        };
      } catch (error) {
        if (error instanceof GraphQLError) throw error;
        logger.error('GraphQL: Failed to fetch agent:', error);
        throw new GraphQLError('Failed to fetch agent', {
          extensions: { code: 'DATABASE_ERROR', details: error.message }
        });
      }
    },

    /**
     * Get agent by key
     */
    agentByKey: async (_, { agent_key }) => {
      try {
        const result = await query(`
          SELECT * FROM ai_agents 
          WHERE agent_key = $1
        `, [agent_key]);
        
        if (result.rows.length === 0) {
          return null;
        }
        
        const agent = result.rows[0];
        return {
          ...agent,
          config: typeof agent.config === 'string' 
            ? JSON.parse(agent.config) 
            : agent.config
        };
      } catch (error) {
        logger.error('GraphQL: Failed to fetch agent by key:', error);
        throw new GraphQLError('Failed to fetch agent', {
          extensions: { code: 'DATABASE_ERROR', details: error.message }
        });
      }
    },

    /**
     * Get agent details
     */
    agentDetails: async (_, { agent_key }, context) => {
      try {
        const agentService = agentRegistry.getAgentService(agent_key);
        
        if (!agentService || !agentService.getDetails) {
          throw new GraphQLError('Agent not found or does not support getDetails', {
            extensions: { code: 'AGENT_NOT_FOUND', agent_key }
          });
        }
        
        const details = await agentService.getDetails({ userId: context.userId });
        return details;
      } catch (error) {
        if (error instanceof GraphQLError) throw error;
        logger.error('GraphQL: Failed to get agent details:', error);
        throw new GraphQLError('Failed to get agent details', {
          extensions: { code: 'AGENT_ERROR', details: error.message }
        });
      }
    },

    /**
     * Get agent default configuration
     */
    agentDefaultConfig: async (_, { agent_key }) => {
      try {
        const agentService = agentRegistry.getAgentService(agent_key);
        
        if (!agentService || !agentService.defaultConfig) {
          throw new GraphQLError('Agent not found or does not support defaultConfig', {
            extensions: { code: 'AGENT_NOT_FOUND', agent_key }
          });
        }
        
        const config = agentService.defaultConfig();
        return config;
      } catch (error) {
        if (error instanceof GraphQLError) throw error;
        logger.error('GraphQL: Failed to get default config:', error);
        throw new GraphQLError('Failed to get default config', {
          extensions: { code: 'AGENT_ERROR', details: error.message }
        });
      }
    },

    /**
     * Get agent health status
     */
    agentHealth: async (_, { agent_key }) => {
      try {
        const health = await checkAgentHealth(agent_key);
        
        if (!health) {
          throw new GraphQLError('Agent not found', {
            extensions: { code: 'AGENT_NOT_FOUND', agent_key }
          });
        }
        
        return {
          status: health.status,
          checks: health.checks || [],
          metadata: health.metadata || {},
          timestamp: health.timestamp || new Date().toISOString()
        };
      } catch (error) {
        if (error instanceof GraphQLError) throw error;
        logger.error('GraphQL: Failed to check agent health:', error);
        throw new GraphQLError('Failed to check agent health', {
          extensions: { code: 'HEALTH_CHECK_ERROR', details: error.message }
        });
      }
    },

    /**
     * Get agent decisions with pagination
     */
    agentDecisions: async (_, { agent_id, user_id, pagination = {} }) => {
      try {
        const { page = 1, limit = 20 } = pagination;
        const offset = (page - 1) * limit;
        
        let whereClause = [];
        let params = [];
        let paramIndex = 1;
        
        if (agent_id) {
          whereClause.push(`agent_id = $${paramIndex++}`);
          params.push(agent_id);
        }
        
        if (user_id) {
          whereClause.push(`user_id = $${paramIndex++}`);
          params.push(user_id);
        }
        
        const whereSQL = whereClause.length > 0 ? `WHERE ${whereClause.join(' AND ')}` : '';
        
        // Get total count
        const countResult = await query(`
          SELECT COUNT(*) as total FROM ai_decisions ${whereSQL}
        `, params);
        const total = parseInt(countResult.rows[0].total);
        
        // Get paginated results
        const result = await query(`
          SELECT * FROM ai_decisions 
          ${whereSQL}
          ORDER BY created_at DESC
          LIMIT $${paramIndex++} OFFSET $${paramIndex++}
        `, [...params, limit, offset]);
        
        return {
          decisions: result.rows.map(d => ({
            ...d,
            input_data: typeof d.input_data === 'string' ? JSON.parse(d.input_data) : d.input_data,
            output_data: typeof d.output_data === 'string' ? JSON.parse(d.output_data) : d.output_data,
            metadata: typeof d.metadata === 'string' ? JSON.parse(d.metadata) : d.metadata
          })),
          total,
          page,
          limit,
          hasMore: (page * limit) < total
        };
      } catch (error) {
        logger.error('GraphQL: Failed to fetch decisions:', error);
        throw new GraphQLError('Failed to fetch decisions', {
          extensions: { code: 'DATABASE_ERROR', details: error.message }
        });
      }
    },

    /**
     * Get decisions by version (BACKEND-017)
     */
    agentDecisionsByVersion: async (_, { agent_key, version, pagination = {} }) => {
      try {
        const { page = 1, limit = 20 } = pagination;
        const offset = (page - 1) * limit;
        
        // Get agent by key
        const agentResult = await query(`
          SELECT id FROM ai_agents WHERE agent_key = $1 AND version = $2
        `, [agent_key, version]);
        
        if (agentResult.rows.length === 0) {
          return { decisions: [], total: 0, page, limit, hasMore: false };
        }
        
        const agent_id = agentResult.rows[0].id;
        
        // Get total
        const countResult = await query(`
          SELECT COUNT(*) as total FROM ai_decisions WHERE agent_id = $1
        `, [agent_id]);
        const total = parseInt(countResult.rows[0].total);
        
        // Get paginated results
        const result = await query(`
          SELECT * FROM ai_decisions 
          WHERE agent_id = $1
          ORDER BY created_at DESC
          LIMIT $2 OFFSET $3
        `, [agent_id, limit, offset]);
        
        return {
          decisions: result.rows.map(d => ({
            ...d,
            input_data: typeof d.input_data === 'string' ? JSON.parse(d.input_data) : d.input_data,
            output_data: typeof d.output_data === 'string' ? JSON.parse(d.output_data) : d.output_data,
            metadata: typeof d.metadata === 'string' ? JSON.parse(d.metadata) : d.metadata
          })),
          total,
          page,
          limit,
          hasMore: (page * limit) < total
        };
      } catch (error) {
        logger.error('GraphQL: Failed to fetch decisions by version:', error);
        throw new GraphQLError('Failed to fetch decisions by version', {
          extensions: { code: 'DATABASE_ERROR', details: error.message }
        });
      }
    },

    /**
     * Get all agent versions
     */
    agentVersions: async () => {
      try {
        const result = await query(`
          SELECT agent_key, version, COUNT(*) as decision_count
          FROM ai_agents a
          LEFT JOIN ai_decisions d ON a.id = d.agent_id
          WHERE a.version IS NOT NULL
          GROUP BY agent_key, version
          ORDER BY agent_key, version DESC
        `);
        
        return result.rows;
      } catch (error) {
        logger.error('GraphQL: Failed to fetch agent versions:', error);
        throw new GraphQLError('Failed to fetch agent versions', {
          extensions: { code: 'DATABASE_ERROR', details: error.message }
        });
      }
    },

    /**
     * Health check for all agents
     */
    agentsHealth: async () => {
      try {
        const healthStatuses = await checkAllAgentsHealth();
        
        return Object.entries(healthStatuses).map(([agent_key, health]) => ({
          agent_key,
          status: health.status,
          checks: health.checks || [],
          metadata: health.metadata || {},
          timestamp: health.timestamp || new Date().toISOString()
        }));
      } catch (error) {
        logger.error('GraphQL: Failed to check all agents health:', error);
        throw new GraphQLError('Failed to check agents health', {
          extensions: { code: 'HEALTH_CHECK_ERROR', details: error.message }
        });
      }
    }
  },

  Mutation: {
    /**
     * Run an AI agent
     */
    runAgent: async (_, { agent_key, input }, context) => {
      const startTime = Date.now();
      
      try {
        const agentService = agentRegistry.getAgentService(agent_key);
        
        if (!agentService || !agentService.run) {
          throw new GraphQLError('Agent not found or does not support run', {
            extensions: { code: 'AGENT_NOT_FOUND', agent_key }
          });
        }
        
        // Prepare run parameters
        const runParams = {
          userId: input.userId || context.userId,
          symbol: input.symbol,
          timeframe: input.timeframe || '1h',
          config: input.config || {}
        };
        
        // Execute with timeout (30s)
        const rawResult = await withTimeout(
          agentService.run(runParams),
          30000,
          `Agent ${agent_key} execution timed out`,
          agent_key
        );
        
        const executionTimeMs = Date.now() - startTime;
        
        // Transform result
        const result = transformAgentResult(agent_key, rawResult);
        
        // Log decision
        const agentRecord = await query(`
          SELECT id FROM ai_agents WHERE agent_key = $1
        `, [agent_key]);
        
        if (agentRecord.rows.length > 0) {
          await logDecision(
            agentRecord.rows[0].id,
            runParams.userId,
            'analysis',
            runParams,
            result,
            executionTimeMs,
            true
          );
        }
        
        return result;
      } catch (error) {
        if (error instanceof GraphQLError) throw error;
        logger.error('GraphQL: Agent run failed:', error);
        throw new GraphQLError('Agent execution failed', {
          extensions: { 
            code: 'AGENT_EXECUTION_ERROR', 
            agent_key,
            details: error.message 
          }
        });
      }
    },

    /**
     * Execute agent command
     */
    executeAgentCommand: async (_, { input }) => {
      try {
        const { agent_key, command, params } = input;
        const agentService = agentRegistry.getAgentService(agent_key);
        
        if (!agentService || !agentService.command) {
          throw new GraphQLError('Agent not found or does not support commands', {
            extensions: { code: 'AGENT_NOT_FOUND', agent_key }
          });
        }
        
        const result = await agentService.command({ command, ...params });
        return result;
      } catch (error) {
        if (error instanceof GraphQLError) throw error;
        logger.error('GraphQL: Command execution failed:', error);
        throw new GraphQLError('Command execution failed', {
          extensions: { code: 'COMMAND_ERROR', details: error.message }
        });
      }
    },

    /**
     * Update agent
     */
    updateAgent: async (_, { id, input }) => {
      try {
        const updates = [];
        const values = [];
        let paramIndex = 1;
        
        if (input.name !== undefined) {
          updates.push(`name = $${paramIndex++}`);
          values.push(input.name);
        }
        
        if (input.status !== undefined) {
          updates.push(`status = $${paramIndex++}`);
          values.push(input.status);
        }
        
        if (input.config !== undefined) {
          updates.push(`config = $${paramIndex++}::jsonb`);
          values.push(JSON.stringify(input.config));
        }
        
        updates.push(`last_update = NOW()`);
        values.push(id);
        
        const result = await query(`
          UPDATE ai_agents 
          SET ${updates.join(', ')}
          WHERE id = $${paramIndex}
          RETURNING *
        `, values);
        
        if (result.rows.length === 0) {
          throw new GraphQLError('Agent not found', {
            extensions: { code: 'NOT_FOUND', agentId: id }
          });
        }
        
        const agent = result.rows[0];
        return {
          ...agent,
          config: typeof agent.config === 'string' ? JSON.parse(agent.config) : agent.config
        };
      } catch (error) {
        if (error instanceof GraphQLError) throw error;
        logger.error('GraphQL: Failed to update agent:', error);
        throw new GraphQLError('Failed to update agent', {
          extensions: { code: 'DATABASE_ERROR', details: error.message }
        });
      }
    },

    /**
     * Update agent config
     */
    updateAgentConfig: async (_, { id, config }) => {
      try {
        const result = await query(`
          UPDATE ai_agents 
          SET config = $1::jsonb, last_update = NOW()
          WHERE id = $2
          RETURNING *
        `, [JSON.stringify(config), id]);
        
        if (result.rows.length === 0) {
          throw new GraphQLError('Agent not found', {
            extensions: { code: 'NOT_FOUND', agentId: id }
          });
        }
        
        const agent = result.rows[0];
        return {
          ...agent,
          config: typeof agent.config === 'string' ? JSON.parse(agent.config) : agent.config
        };
      } catch (error) {
        if (error instanceof GraphQLError) throw error;
        logger.error('GraphQL: Failed to update agent config:', error);
        throw new GraphQLError('Failed to update agent config', {
          extensions: { code: 'DATABASE_ERROR', details: error.message }
        });
      }
    },

    /**
     * Toggle agent status
     */
    toggleAgentStatus: async (_, { id }) => {
      try {
        const result = await query(`
          UPDATE ai_agents 
          SET status = CASE 
            WHEN status = 'active' THEN 'inactive'
            ELSE 'active'
          END,
          last_update = NOW()
          WHERE id = $1
          RETURNING *
        `, [id]);
        
        if (result.rows.length === 0) {
          throw new GraphQLError('Agent not found', {
            extensions: { code: 'NOT_FOUND', agentId: id }
          });
        }
        
        const agent = result.rows[0];
        return {
          ...agent,
          config: typeof agent.config === 'string' ? JSON.parse(agent.config) : agent.config
        };
      } catch (error) {
        if (error instanceof GraphQLError) throw error;
        logger.error('GraphQL: Failed to toggle agent status:', error);
        throw new GraphQLError('Failed to toggle agent status', {
          extensions: { code: 'DATABASE_ERROR', details: error.message }
        });
      }
    },

    /**
     * Reset agent
     */
    resetAgent: async (_, { agent_key }) => {
      try {
        const agentService = agentRegistry.getAgentService(agent_key);
        
        if (!agentService) {
          throw new GraphQLError('Agent not found', {
            extensions: { code: 'AGENT_NOT_FOUND', agent_key }
          });
        }
        
        // Call reset command if available
        if (agentService.command) {
          await agentService.command({ command: 'reset' });
        }
        
        logger.info(`Agent ${agent_key} reset via GraphQL`);
        
        return {
          ok: true,
          message: `Agent ${agent_key} has been reset successfully`
        };
      } catch (error) {
        if (error instanceof GraphQLError) throw error;
        logger.error('GraphQL: Failed to reset agent:', error);
        throw new GraphQLError('Failed to reset agent', {
          extensions: { code: 'AGENT_ERROR', details: error.message }
        });
      }
    },

    /**
     * Train agent with message
     */
    trainAgent: async (_, { agent_key, message }, context) => {
      try {
        // This would integrate with the training service
        // For now, return a placeholder response
        logger.info(`Training agent ${agent_key} with message (GraphQL)`);
        
        return {
          ok: true,
          message: 'Training request received',
          agent_key,
          timestamp: new Date().toISOString()
        };
      } catch (error) {
        logger.error('GraphQL: Failed to train agent:', error);
        throw new GraphQLError('Failed to train agent', {
          extensions: { code: 'TRAINING_ERROR', details: error.message }
        });
      }
    },

    /**
     * Validate agent configuration
     */
    validateAgentConfig: async (_, { agent_key, config }) => {
      try {
        const agentService = agentRegistry.getAgentService(agent_key);
        
        if (!agentService || !agentService.validateConfig) {
          return {
            valid: true,
            message: 'Agent does not provide config validation'
          };
        }
        
        const validation = agentService.validateConfig(config);
        return validation;
      } catch (error) {
        logger.error('GraphQL: Config validation failed:', error);
        throw new GraphQLError('Config validation failed', {
          extensions: { code: 'VALIDATION_ERROR', details: error.message }
        });
      }
    }
  },

  // Custom scalar resolver for JSON
  JSON: {
    __parseValue(value) {
      return value; // Value from client
    },
    __serialize(value) {
      return value; // Value sent to client
    },
    __parseLiteral(ast) {
      // Parse literal value from query
      return ast.value;
    }
  }
};

export default resolvers;
