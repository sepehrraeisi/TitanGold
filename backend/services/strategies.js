import { query } from '../database/db.js';
import { logger } from '../services/logger.js';

class StrategyService {
  /**
   * Return all strategies for a user.
   * If user has no strategies yet, create a small default set based on the existing UI.
   */
  async getStrategies(userId) {
    try {
      const result = await query(
        `SELECT id,
                name,
                type,
                agents,
                status,
                roi,
                win_rate    AS "winRate",
                trades,
                sharpe,
                max_drawdown AS "maxDrawdown",
                rank,
                COALESCE(chart_data, '[]'::jsonb) AS "chartData"
         FROM strategies
         WHERE user_id = $1
         ORDER BY created_at ASC`,
        [userId],
      ).catch(dbError => {
        // If database is unavailable or table doesn't exist, return empty array
        const isDbError = 
          dbError.code === 'ECONNREFUSED' || 
          dbError.code === 'ETIMEDOUT' ||
          dbError.code === 'ENOTFOUND' ||
          dbError.code === '42P01' || // PostgreSQL: relation does not exist
          dbError.code === '3D000' || // PostgreSQL: database does not exist
          dbError.code === '28P01' || // PostgreSQL: invalid password
          dbError.message?.includes('ECONNREFUSED') ||
          dbError.message?.includes('connection') ||
          dbError.message?.includes('relation') ||
          dbError.message?.includes('does not exist') ||
          dbError.message?.includes('timeout');
        
        if (isDbError) {
          logger.warn('⚠️ Database error (unavailable or table does not exist), returning empty strategies array:', dbError.message);
          return { rows: [] };
        }
        throw dbError; // Re-throw other database errors
      });

      if (result.rows.length > 0) {
        return result.rows.map(row => ({
          ...row,
          chartData: Array.isArray(row.chartData) ? row.chartData : row.chartData || [],
        }));
      }

      // No strategies yet – try to create defaults, but catch DB errors gracefully
      try {
        const defaultStrategies = [
          {
            name: 'AI Prediction Pro',
            type: 'AI',
            agents: 3,
            status: 'active',
            roi: 45.2,
            winRate: 89.3,
            trades: 234,
            sharpe: 3.47,
            maxDrawdown: 3.2,
            rank: 'A',
            chartData: [5, 10, 15, 25, 30, 40, 45],
          },
          {
            name: 'BTC Scalping Master',
            type: 'Scalping',
            agents: 1,
            status: 'active',
            roi: 38.7,
            winRate: 82.1,
            trades: 567,
            sharpe: 2.89,
            maxDrawdown: 4.7,
            rank: 'B',
            chartData: [10, 12, 18, 22, 28, 35, 38],
          },
          {
            name: 'Trend Following ETH',
            type: 'Trend',
            agents: 2,
            status: 'active',
            roi: 31.4,
            winRate: 75.6,
            trades: 189,
            sharpe: 2.34,
            maxDrawdown: 6.1,
            rank: 'T',
            chartData: [5, 8, 14, 20, 21, 25, 31],
          },
          {
            name: 'Swing Trading Altcoins',
            type: 'Swing',
            agents: 4,
            status: 'active',
            roi: 28.9,
            winRate: 71.2,
            trades: 145,
            sharpe: 2.12,
            maxDrawdown: 8.3,
            rank: 'S',
            chartData: [8, 10, 15, 18, 20, 25, 29],
          },
          {
            name: 'Arbitrage Multi-Exchange',
            type: 'Arbitrage',
            agents: 5,
            status: 'active',
            roi: 22.1,
            winRate: 94.7,
            trades: 891,
            sharpe: 1.87,
            maxDrawdown: 1.8,
            rank: 'A',
            chartData: [15, 16, 18, 20, 21, 22, 22],
          },
          {
            name: 'DCA Bitcoin Strategy',
            type: 'Trend',
            agents: 2,
            status: 'inactive',
            roi: 18.5,
            winRate: 68.3,
            trades: 78,
            sharpe: 1.65,
            maxDrawdown: 12.4,
            rank: 'D',
            chartData: [5, 6, 8, 10, 12, 15, 18],
          },
        ];

        const inserted = [];
        for (const s of defaultStrategies) {
          const insert = await query(
            `INSERT INTO strategies
               (user_id, name, type, agents, status, roi, win_rate, trades, sharpe, max_drawdown, rank, chart_data)
             VALUES
               ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
             RETURNING id,
                       name,
                       type,
                       agents,
                       status,
                       roi,
                       win_rate    AS "winRate",
                       trades,
                       sharpe,
                       max_drawdown AS "maxDrawdown",
                       rank,
                       chart_data  AS "chartData"`,
            [
              userId,
              s.name,
              s.type,
              s.agents,
              s.status,
              s.roi,
              s.winRate,
              s.trades,
              s.sharpe,
              s.maxDrawdown,
              s.rank,
              JSON.stringify(s.chartData),
            ],
          ).catch(insertError => {
            // If table doesn't exist or DB is unavailable, skip this insert
            if (insertError.code === 'ECONNREFUSED' || insertError.message?.includes('ECONNREFUSED') || insertError.message?.includes('relation') || insertError.message?.includes('does not exist')) {
              logger.warn(`⚠️ Cannot insert strategy "${s.name}": database unavailable or table does not exist`);
              return null;
            }
            throw insertError;
          });

          if (insert && insert.rows && insert.rows.length > 0) {
            inserted.push({
              ...insert.rows[0],
              chartData: insert.rows[0].chartData || [],
            });
          }
        }

        // If we couldn't insert any strategies due to DB issues, return empty array
        if (inserted.length === 0) {
          logger.warn('⚠️ Could not create default strategies, database may be unavailable');
          return [];
        }

        return inserted;
      } catch (createError) {
        // If creating defaults fails, return empty array instead of crashing
        logger.warn('⚠️ Error creating default strategies, returning empty array:', createError.message);
        return [];
      }
    } catch (error) {
      logger.error('Error loading strategies:', error);
      // On hard DB failure, fall back to an empty list rather than crashing the page
      return [];
    }
  }

  /**
   * Toggle active/inactive state of a strategy for the current user.
   */
  async toggleStrategy(userId, strategyId) {
    const result = await query(
      `UPDATE strategies
       SET status = CASE
                      WHEN status = 'active' THEN 'inactive'
                      ELSE 'active'
                    END,
           updated_at = NOW()
       WHERE id = $1 AND user_id = $2
       RETURNING id`,
      [strategyId, userId],
    );

    if (result.rowCount === 0) {
      throw new Error('Strategy not found');
    }

    // Return updated list to keep UI in sync
    return this.getStrategies(userId);
  }

  /**
   * Create a simple new strategy with default metrics.
   */
  async createStrategy(userId, { name, type }) {
    const baseName = name && name.trim().length > 0 ? name.trim() : 'New Strategy';
    const baseType = type && type.trim().length > 0 ? type.trim() : 'Custom';

    const result = await query(
      `INSERT INTO strategies
         (user_id, name, type, agents, status, roi, win_rate, trades, sharpe, max_drawdown, rank, chart_data)
       VALUES
         ($1, $2, $3, 0, 'inactive', 0, 0, 0, 0, 0, 'N', '[]'::jsonb)
       RETURNING id`,
      [userId, baseName, baseType],
    ).catch(err => {
      if (err.code === 'ECONNREFUSED' || err.message?.includes('ECONNREFUSED') || err.message?.includes('relation') || err.message?.includes('does not exist')) {
        throw new Error('Database unavailable. Please ensure database is running and schema is initialized.');
      }
      throw err;
    });

    if (result.rowCount === 0) {
      throw new Error('Failed to create strategy');
    }

    return this.getStrategies(userId);
  }

  /**
   * Generate an AI-powered strategy using AI service
   */
  async generateAIStrategy(userId) {
    try {
      // Import AI service dynamically to avoid circular dependencies
      const { aiService } = await import('./ai.js');
      
      // Ask AI to generate a strategy
      const prompt = `Generate a new trading strategy for cryptocurrency trading. 
      Return a JSON object with:
      {
        "name": "strategy name",
        "type": "AI" | "Scalping" | "Trend" | "Swing" | "Arbitrage",
        "description": "brief description",
        "agents": number (1-5),
        "riskLevel": "conservative" | "balanced" | "aggressive"
      }`;

      const aiResponse = await aiService.askArtemis(prompt);
      
      // Try to parse JSON from AI response
      let strategyData;
      try {
        // Extract JSON from response if it's wrapped in markdown or text
        const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          strategyData = JSON.parse(jsonMatch[0]);
        } else {
          strategyData = JSON.parse(aiResponse);
        }
      } catch (parseError) {
        // If AI doesn't return valid JSON, create a default AI strategy
        strategyData = {
          name: `AI Strategy ${new Date().toLocaleDateString()}`,
          type: 'AI',
          description: 'AI-generated strategy optimized for current market conditions',
          agents: 3,
          riskLevel: 'balanced',
        };
      }

      // Create strategy with AI-generated data
      const result = await query(
        `INSERT INTO strategies
           (user_id, name, type, agents, status, roi, win_rate, trades, sharpe, max_drawdown, rank, chart_data)
         VALUES
           ($1, $2, $3, $4, 'inactive', 0, 0, 0, 0, 0, 'N', '[]'::jsonb)
         RETURNING id`,
        [
          userId,
          strategyData.name || `AI Strategy ${Date.now()}`,
          strategyData.type || 'AI',
          strategyData.agents || 3,
        ],
      ).catch(err => {
        if (err.code === 'ECONNREFUSED' || err.message?.includes('ECONNREFUSED') || err.message?.includes('relation') || err.message?.includes('does not exist')) {
          throw new Error('Database unavailable. Please ensure database is running and schema is initialized.');
        }
        throw err;
      });

      if (result.rowCount === 0) {
        throw new Error('Failed to create AI strategy');
      }

      return this.getStrategies(userId);
    } catch (error) {
      logger.error('Error generating AI strategy:', error);
      // Fallback: create a default AI strategy if AI service fails
      return this.createStrategy(userId, { name: `AI Strategy ${new Date().toLocaleDateString()}`, type: 'AI' });
    }
  }

  /**
   * Duplicate/Copy a strategy
   */
  async copyStrategy(userId, strategyId) {
    const original = await query(
      `SELECT name, type, agents, status, roi, win_rate, trades, sharpe, max_drawdown, rank, chart_data
       FROM strategies
       WHERE id = $1 AND user_id = $2`,
      [strategyId, userId],
    ).catch(err => {
      if (err.code === 'ECONNREFUSED' || err.message?.includes('ECONNREFUSED') || err.message?.includes('relation') || err.message?.includes('does not exist')) {
        throw new Error('Database unavailable');
      }
      throw err;
    });

    if (original.rows.length === 0) {
      throw new Error('Strategy not found');
    }

    const orig = original.rows[0];
    const result = await query(
      `INSERT INTO strategies
         (user_id, name, type, agents, status, roi, win_rate, trades, sharpe, max_drawdown, rank, chart_data)
       VALUES
         ($1, $2, $3, $4, 'inactive', $5, $6, $7, $8, $9, $10, $11)
       RETURNING id`,
      [
        userId,
        `${orig.name} (Copy)`,
        orig.type,
        orig.agents,
        0, // roi
        orig.win_rate || 0,
        0, // trades
        orig.sharpe || 0,
        orig.max_drawdown || 0,
        'N', // rank
        orig.chart_data || '[]',
      ],
    );

    if (result.rowCount === 0) {
      throw new Error('Failed to copy strategy');
    }

    return this.getStrategies(userId);
  }

  /**
   * Update strategy name and type
   */
  async updateStrategy(userId, strategyId, { name, type }) {
    const updates = [];
    const values = [];
    let paramIndex = 1;

    if (name !== undefined && name.trim().length > 0) {
      updates.push(`name = $${paramIndex++}`);
      values.push(name.trim());
    }

    if (type !== undefined && type.trim().length > 0) {
      updates.push(`type = $${paramIndex++}`);
      values.push(type.trim());
    }

    if (updates.length === 0) {
      return this.getStrategies(userId);
    }

    values.push(strategyId, userId);
    const result = await query(
      `UPDATE strategies
       SET ${updates.join(', ')}, updated_at = NOW()
       WHERE id = $${paramIndex++} AND user_id = $${paramIndex++}
       RETURNING id`,
      values,
    ).catch(err => {
      if (err.code === 'ECONNREFUSED' || err.message?.includes('ECONNREFUSED') || err.message?.includes('relation') || err.message?.includes('does not exist')) {
        throw new Error('Database unavailable');
      }
      throw err;
    });

    if (result.rowCount === 0) {
      throw new Error('Strategy not found');
    }

    return this.getStrategies(userId);
  }
}

export const strategyService = new StrategyService();


