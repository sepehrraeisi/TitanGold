/**
 * Configuration Management Routes
 * Manage API integrations, provider settings, and Artemis configuration
 */

import express from 'express';
import { query } from '../database/db.js';
import { authenticate } from '../middleware/auth.js';
import { encryptSecret, decryptSecret, isEncrypted, maskSecret } from '../utils/crypto.js';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// ============================================================================
// API Integrations Management
// ============================================================================

/**
 * GET /api/config/integrations
 * List all API integrations with runtime status
 */
router.get('/integrations', async (req, res) => {
  try {
    const sql = `
      SELECT
        i.id,
        i.provider,
        i.name,
        i.base_url,
        i.model,
        i.weight,
        i.enabled,
        i.rate_limit_per_min,
        i.daily_budget,
        i.monthly_budget,
        i.metadata,
        i.updated_at,
        r.status,
        r.cooldown_until,
        r.last_error,
        r.fail_count,
        r.success_count,
        r.total_requests,
        r.total_cost,
        r.last_used_at,
        -- Mask API key (show only last 4 chars)
        CASE
          WHEN i.api_key_encrypted IS NOT NULL
          THEN '***' || RIGHT(i.api_key_encrypted, 4)
          ELSE NULL
        END AS api_key_masked
      FROM api_integrations i
      LEFT JOIN api_integration_runtime r ON r.integration_id = i.id
      WHERE i.created_by = $1
      ORDER BY i.provider, i.name
    `;

    const result = await query(sql, [req.user.id]);

    res.json({
      success: true,
      integrations: result.rows,
    });
  } catch (error) {
    console.error('GET /api/config/integrations error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch integrations',
    });
  }
});

/**
 * POST /api/config/integrations
 * Create new API integration
 */
router.post('/integrations', async (req, res) => {
  try {
    const {
      provider,
      name,
      api_key,
      base_url,
      model,
      weight,
      rate_limit_per_min,
      daily_budget,
      monthly_budget,
      metadata,
    } = req.body;

    // Validation
    if (!provider || !name || !api_key) {
      return res.status(400).json({
        success: false,
        error: 'provider, name, and api_key are required',
      });
    }

    const validProviders = ['gemini', 'openai', 'anthropic', 'deepseek', 'openrouter'];
    if (!validProviders.includes(provider)) {
      return res.status(400).json({
        success: false,
        error: `Invalid provider. Must be one of: ${validProviders.join(', ')}`,
      });
    }

    // Encrypt API key
    const encryptedKey = encryptSecret(api_key);

    // Insert integration
    const sqlInsert = `
      INSERT INTO api_integrations (
        provider, name, api_key_encrypted, base_url, model, weight,
        rate_limit_per_min, daily_budget, monthly_budget, metadata, created_by
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING id
    `;

    const result = await query(sqlInsert, [
      provider,
      name,
      encryptedKey, // ✅ Encrypted with AES-256-GCM
      base_url,
      model,
      weight || 1.0,
      rate_limit_per_min,
      daily_budget,
      monthly_budget,
      metadata ? JSON.stringify(metadata) : null,
      req.user.id,
    ]);

    const integrationId = result.rows[0].id;

    // Initialize runtime
    const sqlRuntime = `
      INSERT INTO api_integration_runtime (integration_id, status)
      VALUES ($1, 'healthy')
    `;
    await query(sqlRuntime, [integrationId]);

    res.json({
      success: true,
      integration_id: integrationId,
      message: 'Integration created successfully',
    });
  } catch (error) {
    console.error('POST /api/config/integrations error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create integration',
    });
  }
});

/**
 * PATCH /api/config/integrations/:id
 * Update existing integration
 */
router.patch('/integrations/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name,
      api_key,
      base_url,
      model,
      weight,
      enabled,
      rate_limit_per_min,
      daily_budget,
      monthly_budget,
      metadata,
    } = req.body;

    // Build update query
    const updates = [];
    const values = [];
    let paramIndex = 1;

    if (name !== undefined) {
      updates.push(`name = $${paramIndex++}`);
      values.push(name);
    }
    if (api_key !== undefined) {
      updates.push(`api_key_encrypted = $${paramIndex++}`);
      values.push(encryptSecret(api_key)); // ✅ Encrypt before storing
    }
    if (base_url !== undefined) {
      updates.push(`base_url = $${paramIndex++}`);
      values.push(base_url);
    }
    if (model !== undefined) {
      updates.push(`model = $${paramIndex++}`);
      values.push(model);
    }
    if (weight !== undefined) {
      updates.push(`weight = $${paramIndex++}`);
      values.push(weight);
    }
    if (enabled !== undefined) {
      updates.push(`enabled = $${paramIndex++}`);
      values.push(enabled);
    }
    if (rate_limit_per_min !== undefined) {
      updates.push(`rate_limit_per_min = $${paramIndex++}`);
      values.push(rate_limit_per_min);
    }
    if (daily_budget !== undefined) {
      updates.push(`daily_budget = $${paramIndex++}`);
      values.push(daily_budget);
    }
    if (monthly_budget !== undefined) {
      updates.push(`monthly_budget = $${paramIndex++}`);
      values.push(monthly_budget);
    }
    if (metadata !== undefined) {
      updates.push(`metadata = $${paramIndex++}`);
      values.push(JSON.stringify(metadata));
    }

    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No fields to update',
      });
    }

    updates.push(`updated_at = NOW()`);
    values.push(id);
    values.push(req.user.id);

    const sql = `
      UPDATE api_integrations
      SET ${updates.join(', ')}
      WHERE id = $${paramIndex++} AND created_by = $${paramIndex++}
      RETURNING id
    `;

    const result = await query(sql, values);

    if (result.rowCount === 0) {
      return res.status(404).json({
        success: false,
        error: 'Integration not found or access denied',
      });
    }

    res.json({
      success: true,
      message: 'Integration updated successfully',
    });
  } catch (error) {
    console.error('PATCH /api/config/integrations/:id error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update integration',
    });
  }
});

/**
 * POST /api/config/integrations/:id/test
 * Test integration with actual API call
 */
router.post('/integrations/:id/test', async (req, res) => {
  try {
    const { id } = req.params;

    // Fetch integration
    const sqlIntegration = `
      SELECT id, provider, name, api_key_encrypted, base_url, model
      FROM api_integrations
      WHERE id = $1 AND created_by = $2
    `;
    const result = await query(sqlIntegration, [id, req.user.id]);

    if (result.rowCount === 0) {
      return res.status(404).json({
        success: false,
        error: 'Integration not found',
      });
    }

    const integration = result.rows[0];

    // Decrypt API key for testing
    let decryptedKey;
    try {
      decryptedKey = isEncrypted(integration.api_key_encrypted)
        ? decryptSecret(integration.api_key_encrypted)
        : integration.api_key_encrypted; // Fallback for plaintext (migration)
    } catch (decryptError) {
      return res.status(500).json({
        success: false,
        error: 'Failed to decrypt API key',
      });
    }

    // Real API test call (use decrypted key)
    try {
      const testIntegration = {
        ...integration,
        api_key_encrypted: decryptedKey, // Use plaintext for API call
      };
      
      const testResult = await testProviderConnection(testIntegration);
      
      res.json({
        success: testResult.success,
        provider: integration.provider,
        name: integration.name,
        healthy: testResult.success,
        message: testResult.message,
        responseTime: testResult.responseTime,
      });
    } catch (testError) {
      res.json({
        success: false,
        provider: integration.provider,
        name: integration.name,
        healthy: false,
        error: testError.message,
      });
    }
  } catch (error) {
    console.error('POST /api/config/integrations/:id/test error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to test integration',
    });
  }
});

/**
 * Test provider connection with real API call
 */
async function testProviderConnection(integration) {
  const startTime = Date.now();
  
  try {
    let response;
    
    if (integration.provider === 'gemini') {
      // Test Gemini
      const model = integration.model || 'gemini-2.0-flash';
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${integration.api_key_encrypted}`;
      
      response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: 'Return JSON: {"status":"ok"}' }] }],
          generationConfig: { maxOutputTokens: 20 },
        }),
      });
      
    } else if (integration.provider === 'anthropic') {
      // Test Claude
      response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': integration.api_key_encrypted,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: integration.model || 'claude-3-5-sonnet-latest',
          max_tokens: 20,
          messages: [{ role: 'user', content: 'Return JSON: {"status":"ok"}' }],
        }),
      });
      
    } else {
      // Test OpenAI-compatible (OpenAI, DeepSeek, OpenRouter)
      let baseUrl = integration.base_url;
      if (!baseUrl) {
        if (integration.provider === 'deepseek') {
          baseUrl = 'https://api.deepseek.com/v1';
        } else if (integration.provider === 'openrouter') {
          baseUrl = 'https://openrouter.ai/api/v1';
        } else {
          baseUrl = 'https://api.openai.com/v1';
        }
      }
      
      response = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${integration.api_key_encrypted}`,
        },
        body: JSON.stringify({
          model: integration.model || 'gpt-4o-mini',
          messages: [{ role: 'user', content: 'Return JSON: {"status":"ok"}' }],
          max_tokens: 20,
        }),
      });
    }
    
    const responseTime = Date.now() - startTime;
    
    if (response.ok) {
      return {
        success: true,
        message: 'API connection successful',
        responseTime: `${responseTime}ms`,
      };
    } else {
      const errorText = await response.text().catch(() => '');
      return {
        success: false,
        message: `API returned ${response.status}: ${errorText.slice(0, 200)}`,
        responseTime: `${responseTime}ms`,
      };
    }
    
  } catch (error) {
    const responseTime = Date.now() - startTime;
    return {
      success: false,
      message: `Connection failed: ${error.message}`,
      responseTime: `${responseTime}ms`,
    };
  }
}

/**
 * POST /api/config/integrations/:id/disable
 * Temporarily disable integration (set status=disabled)
 */
router.post('/integrations/:id/disable', async (req, res) => {
  try {
    const { id } = req.params;

    // Verify ownership
    const verify = await query(
      'SELECT 1 FROM api_integrations WHERE id = $1 AND created_by = $2',
      [id, req.user.id]
    );

    if (verify.rowCount === 0) {
      return res.status(404).json({
        success: false,
        error: 'Integration not found',
      });
    }

    // Update runtime status
    const sql = `
      UPDATE api_integration_runtime
      SET status = 'disabled', updated_at = NOW()
      WHERE integration_id = $1
    `;
    await query(sql, [id]);

    res.json({
      success: true,
      message: 'Integration disabled',
    });
  } catch (error) {
    console.error('POST /api/config/integrations/:id/disable error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to disable integration',
    });
  }
});

/**
 * POST /api/config/integrations/:id/reset-runtime
 * Reset runtime state (clear cooldown, reset fail count)
 */
router.post('/integrations/:id/reset-runtime', async (req, res) => {
  try {
    const { id } = req.params;

    // Verify ownership
    const verify = await query(
      'SELECT 1 FROM api_integrations WHERE id = $1 AND created_by = $2',
      [id, req.user.id]
    );

    if (verify.rowCount === 0) {
      return res.status(404).json({
        success: false,
        error: 'Integration not found',
      });
    }

    // Reset runtime
    const sql = `
      UPDATE api_integration_runtime
      SET
        status = 'healthy',
        cooldown_until = NULL,
        last_error = NULL,
        fail_count = 0,
        updated_at = NOW()
      WHERE integration_id = $1
    `;
    await query(sql, [id]);

    res.json({
      success: true,
      message: 'Runtime state reset',
    });
  } catch (error) {
    console.error('POST /api/config/integrations/:id/reset-runtime error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to reset runtime',
    });
  }
});

// ============================================================================
// Artemis Decision Engine Configuration
// ============================================================================

/**
 * GET /api/config/artemis
 * Get Artemis Decision Engine configuration
 */
router.get('/artemis', async (req, res) => {
  try {
    const result = await query(
      `SELECT value, description, updated_at, updated_by 
       FROM system_config 
       WHERE key = $1`,
      ['artemis.decision_engine']
    );

    if (result.rows.length === 0) {
      // Return default config if not found
      return res.json({
        success: true,
        config: {
          strategy: 'mixture_of_experts',
          quorum: { type: 'percent', value: 40, min: 2 },
          timeoutMs: 12000,
          maxRetries: 2,
          maxConcurrency: 6,
          providersToUse: ['openrouter', 'openai', 'deepseek', 'gemini'],
          degradedMode: 'best_effort',
          aggregation: { method: 'weighted_vote', finalSummarizer: true }
        },
        description: 'Default configuration (not persisted yet)',
        updated_at: null,
        updated_by: null,
      });
    }

    const row = result.rows[0];
    res.json({
      success: true,
      config: row.value,
      description: row.description,
      updated_at: row.updated_at,
      updated_by: row.updated_by,
    });
  } catch (error) {
    console.error('GET /api/config/artemis error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch Artemis configuration',
    });
  }
});

/**
 * PUT /api/config/artemis
 * Update Artemis Decision Engine configuration (Admin only)
 */
router.put('/artemis', async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Only admins can update Artemis configuration',
      });
    }

    const config = req.body;

    // Validation
    const errors = [];

    // Validate strategy
    const validStrategies = ['mixture_of_experts', 'weighted_vote', 'majority'];
    if (config.strategy && !validStrategies.includes(config.strategy)) {
      errors.push(`Invalid strategy. Must be one of: ${validStrategies.join(', ')}`);
    }

    // Validate quorum
    if (config.quorum) {
      if (config.quorum.type && !['percent', 'absolute'].includes(config.quorum.type)) {
        errors.push('Quorum type must be "percent" or "absolute"');
      }
      if (config.quorum.value !== undefined) {
        if (config.quorum.type === 'percent' && (config.quorum.value < 0 || config.quorum.value > 100)) {
          errors.push('Quorum percent must be between 0 and 100');
        }
        if (config.quorum.type === 'absolute' && config.quorum.value < 1) {
          errors.push('Quorum absolute must be at least 1');
        }
      }
      if (config.quorum.min !== undefined && config.quorum.min < 1) {
        errors.push('Quorum minimum must be at least 1');
      }
    }

    // Validate timeouts
    if (config.timeoutMs !== undefined && (config.timeoutMs < 1000 || config.timeoutMs > 60000)) {
      errors.push('Timeout must be between 1000ms and 60000ms');
    }

    // Validate retries
    if (config.maxRetries !== undefined && (config.maxRetries < 0 || config.maxRetries > 10)) {
      errors.push('Max retries must be between 0 and 10');
    }

    // Validate concurrency
    if (config.maxConcurrency !== undefined && (config.maxConcurrency < 1 || config.maxConcurrency > 20)) {
      errors.push('Max concurrency must be between 1 and 20');
    }

    // Validate providers
    const validProviders = ['gemini', 'openai', 'anthropic', 'deepseek', 'openrouter'];
    if (config.providersToUse && Array.isArray(config.providersToUse)) {
      const invalidProviders = config.providersToUse.filter(p => !validProviders.includes(p));
      if (invalidProviders.length > 0) {
        errors.push(`Invalid providers: ${invalidProviders.join(', ')}. Valid: ${validProviders.join(', ')}`);
      }
    }

    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        errors,
      });
    }

    // Update configuration
    await query(
      `INSERT INTO system_config (key, value, description, updated_by)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (key) DO UPDATE SET
         value = EXCLUDED.value,
         updated_at = NOW(),
         updated_by = EXCLUDED.updated_by`,
      [
        'artemis.decision_engine',
        JSON.stringify(config),
        'Artemis Decision Engine configuration: strategy, quorum, timeouts, provider selection',
        req.user.id,
      ]
    );

    res.json({
      success: true,
      message: 'Artemis configuration updated successfully',
      config,
    });
  } catch (error) {
    console.error('PUT /api/config/artemis error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update Artemis configuration',
    });
  }
});

export default router;
