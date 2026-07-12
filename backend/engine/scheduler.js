// 24/7 Scheduler Service for TitanGold AI Center
// Handles automatic execution of all AI components

import { query } from '../database/db.js';
import { logger } from '../services/logger.js';
import { runDataFetchJob } from '../jobs/dataFetchScheduler.js';
import { maintenanceService } from '../services/maintenance.js';
import { transferTelegramMessagesToPipeline, TELEGRAM_TRANSFER_DEFAULT_BATCH } from '../services/telegramPipeline.js';
import {
    processNormalizationBatch,
    NORMALIZATION_DEFAULT_BATCH,
} from '../services/normalizationWorker.js';

class SchedulerService {
    constructor() {
        this.isRunning = false;
        this.intervals = new Map();
        this.jobs = new Map();
        this.config = {
            agents: {
                enabled: true,
                interval: 5 * 60 * 1000, // 5 minutes
                agents: [] // All 15 agents by default
            },
            dataHub: {
                enabled: true,
                interval: parseInt(process.env.DATAHUB_FETCH_INTERVAL_MS) || 2 * 60 * 1000, // 2 minutes default
                autoRefresh: true,
                autoNormalize: true
            },
            training: {
                enabled: true,
                interval: 30 * 60 * 1000, // 30 minutes
                autoSchedule: true // Enable auto-scheduling
            },
            analytics: {
                enabled: true,
                interval: 10 * 60 * 1000, // 10 minutes
                autoRefresh: true
            },
            artemis: {
                enabled: true,
                interval: 1 * 60 * 1000, // 1 minute
                autoDecisions: true
            },
            maintenance: {
                enabled: true,
                interval: 24 * 60 * 60 * 1000, // 24 hours
                autoRun: true
            },
            telegramPipeline: {
                enabled: true,
                interval: parseInt(process.env.TELEGRAM_PIPELINE_INTERVAL_MS) || 5 * 60 * 1000 // 5 minutes default (TASK-TC-003)
            },
            normalization: {
                enabled: true,
                interval: 60 * 1000, // 1 minute (DH-NORMALIZATION-P0-WORKER-1)
                batchSize: NORMALIZATION_DEFAULT_BATCH,
            },
        };
    }

    async start() {
        if (this.isRunning) {
            logger.info('⚠️ Scheduler is already running');
            return;
        }

        try {
            this.isRunning = true;
            logger.info('🚀 24/7 Scheduler Service Started');

            // Load configuration from database
            await this.loadConfig();

            // Start all scheduled jobs
            this.startAgentScheduler();
            this.startDataHubScheduler();
            this.startTelegramPipelineScheduler();
            this.startNormalizationScheduler();
            this.startTrainingScheduler();
            this.startAnalyticsScheduler();
            this.startArtemisScheduler();
            this.startMaintenanceScheduler();

            logger.info('✅ All schedulers initialized');
        } catch (error) {
            this.isRunning = false;
            logger.error('❌ Failed to start scheduler:', error);
            throw error; // Re-throw to let the route handler catch it
        }
    }

    async stop() {
        this.isRunning = false;

        // Clear all intervals
        this.intervals.forEach((intervalId) => {
            clearInterval(intervalId);
        });
        this.intervals.clear();
        this.jobs.clear();

        logger.info('🛑 24/7 Scheduler Service Stopped');
    }

    async loadConfig() {
        try {
            const result = await query(
                'SELECT config FROM scheduler_config WHERE id = 1'
            );

            if (result.rows.length > 0 && result.rows[0].config) {
                this.config = { ...this.config, ...result.rows[0].config };
            }
        } catch (error) {
            logger.error('Failed to load scheduler config:', error);
            // Use default config
        }
    }

    async saveConfig() {
        try {
            await query(
                `INSERT INTO scheduler_config (id, config, updated_at) 
                 VALUES (1, $1, NOW()) 
                 ON CONFLICT (id) DO UPDATE SET config = $1, updated_at = NOW()`,
                [JSON.stringify(this.config)]
            );
        } catch (error) {
            logger.error('Failed to save scheduler config:', error);
        }
    }

    // Agent Scheduler - Auto-execute all 15 agents
    startAgentScheduler() {
        if (!this.config.agents.enabled) {
            logger.info('⏸️ Agent Scheduler is disabled');
            return;
        }

        const agentIds = [
            'agent-1', 'agent-2', 'agent-3', 'agent-4', 'agent-5',
            'agent-6', 'agent-7', 'agent-8', 'agent-9', 'agent-10',
            'agent-11', 'agent-12', 'agent-13', 'agent-14', 'agent-15'
        ];

        const agentFunctions = [
            'runTechnicalAnalysis',
            'runRiskAssessment',
            'runSentimentAnalysis',
            'runPatternRecognitionAnalysis',
            'runPricePredictionAnalysis',
            'runArbitrageAnalysis',
            'runPortfolioAllocationAnalysis',
            'runLiquidityAnalysis',
            'runTrendDetectionAnalysis',
            'runOptimizationCycle',
            'runOrderManagementCycle',
            'runFundamentalAnalysis',
            'runMarketIntelligenceCycle',
            'runVolumeAnalysis',
            'runTimingAnalysis'
        ];

        const intervalId = setInterval(async () => {
            if (!this.isRunning || !this.config.agents.enabled) return;

            try {
                logger.info('🤖 Running scheduled agent executions...');

                for (let i = 0; i < agentIds.length; i++) {
                    const agentId = agentIds[i];
                    const funcName = agentFunctions[i];

                    // Check if agent is enabled
                    if (this.config.agents.agents.length > 0 &&
                        !this.config.agents.agents.includes(agentId)) {
                        continue;
                    }

                    try {
                        // Execute agent function
                        await this.executeAgentFunction(agentId, funcName);

                        // Small delay between agents to avoid overload
                        await new Promise(resolve => setTimeout(resolve, 2000));
                    } catch (error) {
                        logger.error(`❌ Failed to execute ${funcName} for ${agentId}:`, error);
                    }
                }

                logger.info('✅ Agent execution cycle completed');
            } catch (error) {
                logger.error('❌ Agent scheduler error:', error);
            }
        }, this.config.agents.interval);

        this.intervals.set('agents', intervalId);
        logger.info(`✅ Agent Scheduler started (interval: ${this.config.agents.interval / 1000}s)`);
    }

    async executeAgentFunction(agentId, funcName) {
        try {
            const { executeAgentRun } = await import('../services/agentExecutionService.js');

            const result = await executeAgentRun({
                agentId,
                symbol: 'BTCUSDT',
                timeframe: '1h',
                input: { function: funcName },
                identityType: 'system',
                user: null,
                confirmLive: false,
            });

            if (!result.ok) {
                throw new Error(result.message || result.code || 'Agent execution denied');
            }

            logger.info(`✅ Scheduled agent execution complete: ${agentId} (${funcName})`, {
                effective_mode: result.policy?.effectiveMode,
                side_effects_suppressed: result.sideEffectsSuppressed,
            });
        } catch (error) {
            logger.error(`❌ Failed to execute ${funcName} for ${agentId}:`, error.message);
            throw error;
        }
    }

    // Data Hub Scheduler - Auto-refresh all data sources
    startDataHubScheduler() {
        if (!this.config.dataHub.enabled) {
            logger.info('⏸️ Data Hub Scheduler is disabled');
            return;
        }

        const intervalId = setInterval(async () => {
            if (!this.isRunning || !this.config.dataHub.enabled) return;

            try {
                await runDataFetchJob();
            } catch (error) {
                logger.error('❌ Data Hub scheduler error:', error);
            }
        }, this.config.dataHub.interval);

        this.intervals.set('dataHub', intervalId);
        logger.info(`✅ Data Hub Scheduler started (interval: ${this.config.dataHub.interval / 1000}s)`);
    }

    // Telegram Pipeline Scheduler - Transfer telegram_messages → collected_data (TASK-TC-003)
    startTelegramPipelineScheduler() {
        if (!this.config.telegramPipeline?.enabled) {
            logger.info('⏸️ Telegram Pipeline Scheduler is disabled');
            return;
        }

        const intervalId = setInterval(async () => {
            if (!this.isRunning || !this.config.telegramPipeline?.enabled) return;

            try {
                const summary = await transferTelegramMessagesToPipeline(
                    TELEGRAM_TRANSFER_DEFAULT_BATCH,
                );
                if (
                    summary.inserted > 0 ||
                    summary.duplicates > 0 ||
                    summary.skipped_no_source > 0 ||
                    summary.skipped_filtered > 0
                ) {
                    logger.info(
                        `📨 Telegram pipeline: selected=${summary.selected} inserted=${summary.inserted} backlog=${summary.backlogRemaining} durationMs=${summary.durationMs}`,
                    );
                }
            } catch (error) {
                logger.error('❌ Telegram pipeline scheduler error:', error);
            }
        }, this.config.telegramPipeline.interval);

        this.intervals.set('telegramPipeline', intervalId);
        logger.info(`✅ Telegram Pipeline Scheduler started (interval: ${this.config.telegramPipeline.interval / 1000}s)`);
    }

    // Normalization Worker — pending collected_data → processed (no agents/publish)
    startNormalizationScheduler() {
        if (!this.config.normalization?.enabled) {
            logger.info('⏸️ Normalization Worker Scheduler is disabled');
            return;
        }

        const intervalId = setInterval(async () => {
            if (!this.isRunning || !this.config.normalization?.enabled) return;

            try {
                const batchSize =
                    this.config.normalization.batchSize || NORMALIZATION_DEFAULT_BATCH;
                const summary = await processNormalizationBatch(batchSize);
                if (summary.processed > 0 || summary.errors > 0) {
                    logger.info(
                        `📐 Normalization: selected=${summary.selected} processed=${summary.processed} errors=${summary.errors} backlog=${summary.backlogRemaining} durationMs=${summary.durationMs}`,
                    );
                }
            } catch (error) {
                logger.error('❌ Normalization worker scheduler error:', error);
            }
        }, this.config.normalization.interval);

        this.intervals.set('normalization', intervalId);
        logger.info(
            `✅ Normalization Worker Scheduler started (interval: ${this.config.normalization.interval / 1000}s, batch: ${this.config.normalization.batchSize || NORMALIZATION_DEFAULT_BATCH})`,
        );
    }

    // Training Scheduler - Auto-schedule training sessions
    startTrainingScheduler() {
        if (!this.config.training.enabled) {
            logger.info('⏸️ Training Scheduler is disabled');
            return;
        }

        const intervalId = setInterval(async () => {
            if (!this.isRunning || !this.config.training.enabled) return;

            try {
                if (this.config.training.autoSchedule) {
                    logger.info('🎓 Checking for training opportunities...');

                    // Check if any agents need training
                    const trainingData = await this.fetchTrainingData();

                    if (trainingData && trainingData.recommendations) {
                        for (const recommendation of trainingData.recommendations) {
                            if (recommendation.priority === 'high' || recommendation.priority === 'critical') {
                                try {
                                    await this.scheduleTraining(recommendation.agentIds, recommendation.mode);
                                    logger.info(`✅ Auto-scheduled training for agents: ${recommendation.agentIds.join(', ')}`);
                                } catch (error) {
                                    logger.error('Failed to schedule training:', error);
                                }
                            }
                        }
                    }
                }
            } catch (error) {
                logger.error('❌ Training scheduler error:', error);
            }
        }, this.config.training.interval);

        this.intervals.set('training', intervalId);
        logger.info(`✅ Training Scheduler started (interval: ${this.config.training.interval / 1000}s)`);
    }

    async fetchTrainingData() {
        try {
            // Import scheduleAutomaticTraining from artemisOrchestrator
            const { scheduleAutomaticTraining } = await import('../services/artemisOrchestrator.js');
            const result = await scheduleAutomaticTraining();
            return {
                recommendations: result.scheduled ? [{
                    priority: 'high',
                    agentIds: result.agents || [],
                    mode: 'supervised'
                }] : []
            };
        } catch (error) {
            logger.error('Failed to fetch training data:', error);
            return { recommendations: [] };
        }
    }

    async scheduleTraining(agentIds, mode) {
        try {
            // Import triggerTrainingSession from artemisOrchestrator
            const { triggerTrainingSession } = await import('../services/artemisOrchestrator.js');
            await triggerTrainingSession(agentIds, mode);
            logger.info(`✅ Training scheduled for agents: ${agentIds.join(', ')}`);
        } catch (error) {
            logger.error('Failed to schedule training:', error);
        }
    }

    // Analytics Scheduler - Auto-refresh analytics
    startAnalyticsScheduler() {
        if (!this.config.analytics.enabled) {
            logger.info('⏸️ Analytics Scheduler is disabled');
            return;
        }

        const intervalId = setInterval(async () => {
            if (!this.isRunning || !this.config.analytics.enabled) return;

            try {
                if (this.config.analytics.autoRefresh) {
                    logger.info('📈 Refreshing analytics data...');
                    // Analytics data is automatically updated when agents run
                    // This is mainly for UI refresh triggers
                }
            } catch (error) {
                logger.error('❌ Analytics scheduler error:', error);
            }
        }, this.config.analytics.interval);

        this.intervals.set('analytics', intervalId);
        logger.info(`✅ Analytics Scheduler started (interval: ${this.config.analytics.interval / 1000}s)`);
    }

    // Artemis Scheduler - Auto-decision making
    startArtemisScheduler() {
        if (!this.config.artemis.enabled) {
            logger.info('⏸️ Artemis Scheduler is disabled');
            return;
        }

        const intervalId = setInterval(async () => {
            if (!this.isRunning || !this.config.artemis.enabled) return;

            try {
                if (this.config.artemis.autoDecisions) {
                    logger.info('🧠 Artemis decision cycle...');
                    // Artemis makes decisions based on agent signals
                    // This is handled by the decision engine
                }
            } catch (error) {
                logger.error('❌ Artemis scheduler error:', error);
            }
        }, this.config.artemis.interval);

        this.intervals.set('artemis', intervalId);
        logger.info(`✅ Artemis Scheduler started (interval: ${this.config.artemis.interval / 1000}s)`);
    }

    // Maintenance Scheduler - Auto-run daily maintenance
    startMaintenanceScheduler() {
        if (!this.config.maintenance.enabled) {
            logger.info('⏸️ Maintenance Scheduler is disabled');
            return;
        }

        const intervalId = setInterval(async () => {
            if (!this.isRunning || !this.config.maintenance.enabled) return;

            try {
                if (this.config.maintenance.autoRun) {
                    await maintenanceService.runFullSiteMaintenance();
                }
            } catch (error) {
                logger.error('❌ Maintenance scheduler error:', error);
            }
        }, this.config.maintenance.interval);

        this.intervals.set('maintenance', intervalId);
        logger.info(`✅ Maintenance Scheduler started (interval: ${this.config.maintenance.interval / (1000 * 60 * 60)}h)`);

        // Run once on startup after a small delay
        setTimeout(() => {
            if (this.isRunning && this.config.maintenance.autoRun) {
                maintenanceService.runFullSiteMaintenance();
            }
        }, 30000); // 30 seconds after startup
    }

    // Update configuration
    async updateConfig(section, updates) {
        if (this.config[section]) {
            this.config[section] = { ...this.config[section], ...updates };
            await this.saveConfig();

            // Restart affected scheduler
            if (this.intervals.has(section)) {
                clearInterval(this.intervals.get(section));
                this.intervals.delete(section);

                // Restart scheduler
                if (section === 'agents') this.startAgentScheduler();
                else if (section === 'dataHub') this.startDataHubScheduler();
                else if (section === 'training') this.startTrainingScheduler();
                else if (section === 'analytics') this.startAnalyticsScheduler();
                else if (section === 'artemis') this.startArtemisScheduler();
                else if (section === 'maintenance') this.startMaintenanceScheduler();
                else if (section === 'telegramPipeline') this.startTelegramPipelineScheduler();
                else if (section === 'normalization') this.startNormalizationScheduler();
            }
        }
    }

    // Get current status
    getStatus() {
        return {
            isRunning: this.isRunning,
            config: this.config,
            activeJobs: Array.from(this.jobs.keys()),
            intervals: Array.from(this.intervals.keys())
        };
    }
}

export const scheduler = new SchedulerService();

