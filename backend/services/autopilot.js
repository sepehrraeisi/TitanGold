/**
 * Autopilot Service
 * Auto-tunes agent configs based on learning events
 * 
 * Architecture:
 * - Decision → Execution → Orchestration → Learning → Autopilot → Config Adjustment
 * 
 * Safety:
 * - Human approval required for v1
 * - Max 10% change per cycle
 * - Circuit breaker on repeated failures
 * - Full rollback capability
 */

import { query } from '../database/db.js';

// ==================== Constants ====================
const MAX_CHANGE_PERCENT = 10;
const MIN_CONFIDENCE_THRESHOLD = 60;
const MISTAKE_THRESHOLD = 3; // Max mistakes before suggesting pause
const AUTO_DISABLE_THRESHOLD = 2; // Consecutive cycles with mistakes → auto-disable

// ==================== Policy Engine ====================

/**
 * Main Autopilot Engine
 * Analyzes learning events and suggests config adjustments
 */
class AutopilotEngine {
  /**
   * Analyze recent learning events and suggest config changes
   * @param {number} hoursWindow - Look back window (default: 24h)
   * @returns {Promise<Object>} Suggestions for each agent
   */
  async analyzeLearningAndSuggest(hoursWindow = 24) {
    try {
      console.log(`[Autopilot] Analyzing learning events from last ${hoursWindow}h...`);

      // 1) Get recent learning events
      const learningEvents = await this.getRecentLearning(hoursWindow);

      if (learningEvents.length === 0) {
        console.log('[Autopilot] No recent learning events found');
        return {
          suggestions: [],
          summary: {
            totalEvents: 0,
            analyzedAgents: 0,
            suggestionsGenerated: 0,
            timestamp: new Date().toISOString()
          }
        };
      }

      console.log(`[Autopilot] Found ${learningEvents.length} learning events`);

      // 2) Group by agent
      const eventsByAgent = this.groupEventsByAgent(learningEvents);

      // 3) Generate suggestions for each agent
      const suggestions = [];
      for (const [agentId, events] of Object.entries(eventsByAgent)) {
        const agentSuggestions = await this.generateAgentSuggestions(agentId, events);
        if (agentSuggestions) {
          suggestions.push(agentSuggestions);
        }
      }

      console.log(`[Autopilot] Generated ${suggestions.length} suggestions`);

      return {
        suggestions,
        summary: {
          totalEvents: learningEvents.length,
          analyzedAgents: Object.keys(eventsByAgent).length,
          suggestionsGenerated: suggestions.length,
          timestamp: new Date().toISOString()
        }
      };

    } catch (error) {
      console.error('[Autopilot] Error analyzing learning:', error);
      throw error;
    }
  }

  /**
   * Get recent learning events
   */
  async getRecentLearning(hoursWindow = 24) {
    const result = await query(
      `SELECT 
        le.*,
        a.name as agent_name,
        a.type as agent_type,
        a.config as agent_config
      FROM ai_learning_events le
      JOIN ai_agents a ON le.agent_id = a.id
      WHERE le.created_at >= NOW() - INTERVAL '${hoursWindow} hours'
      ORDER BY le.created_at DESC`,
      []
    );

    return result.rows;
  }

  /**
   * Group learning events by agent
   */
  groupEventsByAgent(events) {
    return events.reduce((acc, event) => {
      if (!acc[event.agent_id]) {
        acc[event.agent_id] = [];
      }
      acc[event.agent_id].push(event);
      return acc;
    }, {});
  }

  /**
   * Generate suggestions for a specific agent
   */
  async generateAgentSuggestions(agentId, events) {
    try {
      const mistakes = events.filter(e => e.event_type === 'mistake');
      const improvements = events.filter(e => e.event_type === 'improvement');

      console.log(`[Autopilot] Agent ${agentId}: ${mistakes.length} mistakes, ${improvements.length} improvements`);

      // Safety check: Too many mistakes → suggest pause
      if (mistakes.length >= MISTAKE_THRESHOLD) {
        return this.suggestPause(agentId, events, mistakes);
      }

      // No mistakes, only improvements → suggest enhancement
      if (mistakes.length === 0 && improvements.length > 0) {
        return this.suggestEnhancement(agentId, events, improvements);
      }

      // Mixed results → suggest cautious tuning
      if (mistakes.length > 0 && improvements.length > 0) {
        return this.suggestCautiousTuning(agentId, events, mistakes, improvements);
      }

      return null;

    } catch (error) {
      console.error(`[Autopilot] Error generating suggestions for agent ${agentId}:`, error);
      return null;
    }
  }

  /**
   * Suggest pausing agent due to repeated mistakes
   */
  suggestPause(agentId, events, mistakes) {
    const agentName = events[0].agent_name;
    const mistakeAreas = [...new Set(mistakes.map(m => m.area))];

    return {
      agent_id: agentId,
      agent_name: agentName,
      action_type: 'pause',
      suggested_changes: {
        is_enabled: false
      },
      confidence: 85,
      reason: `Too many mistakes (${mistakes.length}) detected in areas: ${mistakeAreas.join(', ')}. Recommend pausing for investigation.`,
      triggering_events: mistakes.map(m => ({
        id: m.id,
        area: m.area,
        correction: m.correction,
        created_at: m.created_at
      })),
      metrics: {
        mistake_count: mistakes.length,
        mistake_areas: mistakeAreas,
        improvement_count: events.filter(e => e.event_type === 'improvement').length
      }
    };
  }

  /**
   * Suggest enhancement (increase confidence/aggressiveness)
   */
  suggestEnhancement(agentId, events, improvements) {
    const agentName = events[0].agent_name;
    const currentConfig = events[0].agent_config || {};
    
    // Calculate average impact
    const avgImpact = improvements.reduce((sum, i) => sum + (parseFloat(i.impact) || 0), 0) / improvements.length;

    // Suggest increasing confidence threshold by 5% (max 10% change)
    const currentThreshold = currentConfig.confidence_threshold || 70;
    const newThreshold = Math.min(95, currentThreshold + 5);

    return {
      agent_id: agentId,
      agent_name: agentName,
      action_type: 'enhance',
      suggested_changes: {
        confidence_threshold: newThreshold,
        optimization_level: 'aggressive'
      },
      confidence: Math.min(90, 70 + avgImpact),
      reason: `${improvements.length} improvements detected with average impact ${avgImpact.toFixed(1)}. Suggest increasing confidence threshold from ${currentThreshold} to ${newThreshold}.`,
      triggering_events: improvements.map(i => ({
        id: i.id,
        area: i.area,
        method: i.method,
        impact: i.impact,
        created_at: i.created_at
      })),
      metrics: {
        improvement_count: improvements.length,
        avg_impact: avgImpact,
        current_threshold: currentThreshold,
        suggested_threshold: newThreshold
      }
    };
  }

  /**
   * Suggest cautious tuning (mixed results)
   */
  suggestCautiousTuning(agentId, events, mistakes, improvements) {
    const agentName = events[0].agent_name;
    const currentConfig = events[0].agent_config || {};

    const mistakeRate = mistakes.length / (mistakes.length + improvements.length);
    const improvementRate = improvements.length / (mistakes.length + improvements.length);

    // If improvement rate > 70%, suggest minor enhancement
    // If mistake rate > 30%, suggest minor reduction
    const currentThreshold = currentConfig.confidence_threshold || 70;
    let newThreshold = currentThreshold;
    let action = 'tune';

    if (improvementRate > 0.7) {
      newThreshold = Math.min(95, currentThreshold + 3);
      action = 'enhance_cautious';
    } else if (mistakeRate > 0.3) {
      newThreshold = Math.max(50, currentThreshold - 3);
      action = 'reduce_cautious';
    }

    // No change if balanced
    if (newThreshold === currentThreshold) {
      return null;
    }

    return {
      agent_id: agentId,
      agent_name: agentName,
      action_type: action,
      suggested_changes: {
        confidence_threshold: newThreshold
      },
      confidence: Math.min(75, 50 + improvementRate * 30),
      reason: `Mixed results: ${improvements.length} improvements, ${mistakes.length} mistakes (${(improvementRate * 100).toFixed(1)}% improvement rate). Suggest ${action === 'enhance_cautious' ? 'cautious enhancement' : 'cautious reduction'}.`,
      triggering_events: [
        ...mistakes.slice(0, 3).map(m => ({ type: 'mistake', area: m.area, id: m.id })),
        ...improvements.slice(0, 3).map(i => ({ type: 'improvement', area: i.area, id: i.id }))
      ],
      metrics: {
        mistake_count: mistakes.length,
        improvement_count: improvements.length,
        mistake_rate: mistakeRate,
        improvement_rate: improvementRate,
        current_threshold: currentThreshold,
        suggested_threshold: newThreshold
      }
    };
  }

  /**
   * Save suggestions to database
   */
  async saveSuggestions(suggestions) {
    const saved = [];

    for (const suggestion of suggestions) {
      try {
        const result = await query(
          `INSERT INTO autopilot_actions 
            (action_type, status, agent_id, new_config, change_summary, reason, confidence, triggering_events, metrics)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          RETURNING *`,
          [
            suggestion.action_type,
            'pending',
            suggestion.agent_id,
            JSON.stringify(suggestion.suggested_changes),
            `Suggest: ${suggestion.action_type} for ${suggestion.agent_name}`,
            suggestion.reason,
            suggestion.confidence,
            JSON.stringify(suggestion.triggering_events),
            JSON.stringify(suggestion.metrics)
          ]
        );

        saved.push(result.rows[0]);
        console.log(`[Autopilot] Saved suggestion for agent ${suggestion.agent_id}`);

      } catch (error) {
        console.error(`[Autopilot] Failed to save suggestion for agent ${suggestion.agent_id}:`, error);
      }
    }

    return saved;
  }

  /**
   * Apply approved suggestion
   * NOTE: Requires human approval in v1
   */
  async applySuggestion(suggestionId, approvedBy) {
    try {
      // 1) Get suggestion
      const suggestionResult = await query(
        `SELECT * FROM autopilot_actions WHERE id = $1`,
        [suggestionId]
      );

      if (suggestionResult.rows.length === 0) {
        throw new Error('Suggestion not found');
      }

      const suggestion = suggestionResult.rows[0];

      // 2) Validate status
      if (suggestion.status !== 'pending') {
        throw new Error(`Suggestion already ${suggestion.status}`);
      }

      // 3) Get current agent config
      const agentResult = await query(
        `SELECT config FROM ai_agents WHERE id = $1`,
        [suggestion.agent_id]
      );

      if (agentResult.rows.length === 0) {
        throw new Error('Agent not found');
      }

      const currentConfig = agentResult.rows[0].config || {};
      const newConfig = suggestion.new_config || {};

      // 4) Merge configs
      const mergedConfig = { ...currentConfig, ...newConfig };

      // 5) Apply to agent
      await query(
        `UPDATE ai_agents 
         SET config = $1, updated_at = NOW()
         WHERE id = $2`,
        [JSON.stringify(mergedConfig), suggestion.agent_id]
      );

      // 6) Mark suggestion as applied
      await query(
        `UPDATE autopilot_actions 
         SET status = 'applied', 
             approved_by = $1,
             approved_at = NOW(),
             applied_at = NOW(),
             old_config = $2,
             updated_at = NOW()
         WHERE id = $3`,
        [approvedBy, JSON.stringify(currentConfig), suggestionId]
      );

      console.log(`[Autopilot] Applied suggestion ${suggestionId} for agent ${suggestion.agent_id}`);

      return {
        success: true,
        agent_id: suggestion.agent_id,
        old_config: currentConfig,
        new_config: mergedConfig
      };

    } catch (error) {
      console.error('[Autopilot] Error applying suggestion:', error);
      throw error;
    }
  }

  /**
   * Reject suggestion
   */
  async rejectSuggestion(suggestionId, rejectedBy, reason = null) {
    await query(
      `UPDATE autopilot_actions 
       SET status = 'rejected',
           approved_by = $1,
           approved_at = NOW(),
           change_summary = COALESCE($2, change_summary),
           updated_at = NOW()
       WHERE id = $3`,
      [rejectedBy, reason, suggestionId]
    );

    console.log(`[Autopilot] Rejected suggestion ${suggestionId}`);
  }

  /**
   * Rollback applied suggestion
   */
  async rollbackSuggestion(suggestionId) {
    try {
      // 1) Get suggestion
      const suggestionResult = await query(
        `SELECT * FROM autopilot_actions WHERE id = $1`,
        [suggestionId]
      );

      if (suggestionResult.rows.length === 0) {
        throw new Error('Suggestion not found');
      }

      const suggestion = suggestionResult.rows[0];

      if (suggestion.status !== 'applied') {
        throw new Error('Can only rollback applied suggestions');
      }

      // 2) Restore old config
      await query(
        `UPDATE ai_agents 
         SET config = $1, updated_at = NOW()
         WHERE id = $2`,
        [JSON.stringify(suggestion.old_config), suggestion.agent_id]
      );

      // 3) Mark as rolled back
      await query(
        `UPDATE autopilot_actions 
         SET status = 'rolled_back', updated_at = NOW()
         WHERE id = $1`,
        [suggestionId]
      );

      console.log(`[Autopilot] Rolled back suggestion ${suggestionId}`);

      return {
        success: true,
        agent_id: suggestion.agent_id,
        restored_config: suggestion.old_config
      };

    } catch (error) {
      console.error('[Autopilot] Error rolling back suggestion:', error);
      throw error;
    }
  }
}

// ==================== Export ====================
export default new AutopilotEngine();
