// 24/7 Scheduler Service for TitanGold AI Center
// AI-FOUNDATION-R2: analytical agent scheduling separated from Live/trading engines

import { query } from '../database/db.js';
import { logger } from '../services/logger.js';
import { runDataFetchJob } from '../jobs/dataFetchScheduler.js';
import { maintenanceService } from '../services/maintenance.js';
import { transferTelegramMessagesToPipeline, TELEGRAM_TRANSFER_DEFAULT_BATCH } from '../services/telegramPipeline.js';
import {
    processNormalizationBatch,
    NORMALIZATION_DEFAULT_BATCH,
} from '../services/normalizationWorker.js';
import {
    normalizeAgentAllowlist,
    resolveScheduledAgent,
    isSafeAnalyticalUnderEmergencyStop,
    logResolutionOutcome,
} from '../services/scheduledAgentResolver.js';
import {
    publishAnalyticalSchedulerStatus,
    buildEmptyStatus,
} from '../services/analyticalSchedulerStatus.js';
import { isKillSwitchActive } from '../services/runtimeExecutionStateService.js';
import { isLiveCapableAgent } from '../services/agentCapabilityRegistry.js';
import {
    classifyTelegramTransferLifecycleOutcome,
    recordTelegramLifecycleEvidence,
    TELEGRAM_LIFECYCLE_OUTCOMES,
} from '../services/pipelineSchedulerRuntime.js';

const DEFAULT_TELEGRAM_PIPELINE_INTERVAL_MS = 5 * 60 * 1000;

class SchedulerService {
    constructor() {
        this.isRunning = false;
        /** Candidate B / B1 — independent of full scheduler isRunning */
        this.telegramBackgroundArmed = false;
        this.intervals = new Map();
        this.jobs = new Map();
        this.inFlight = new Set();
        this.emergencyStopSeparation = false;
        this._lastKillLogAt = 0;
        this._status = buildEmptyStatus();
        this.config = {
            agents: {
                enabled: true,
                interval: 5 * 60 * 1000, // 5 minutes
                agents: [], // explicit allowlist — empty = nobody
            },
            dataHub: {
                enabled: true,
                interval: parseInt(process.env.DATAHUB_FETCH_INTERVAL_MS) || 2 * 60 * 1000,
                autoRefresh: true,
                autoNormalize: true
            },
            training: {
                enabled: true,
                interval: 30 * 60 * 1000,
                autoSchedule: true
            },
            analytics: {
                enabled: true,
                interval: 10 * 60 * 1000,
                autoRefresh: true
            },
            artemis: {
                enabled: true,
                interval: 1 * 60 * 1000,
                autoDecisions: true
            },
            maintenance: {
                enabled: true,
                interval: 24 * 60 * 60 * 1000,
                autoRun: true
            },
            telegramPipeline: {
                enabled: true,
                interval: parseInt(process.env.TELEGRAM_PIPELINE_INTERVAL_MS) || DEFAULT_TELEGRAM_PIPELINE_INTERVAL_MS
            },
            normalization: {
                enabled: true,
                interval: 60 * 1000,
                batchSize: NORMALIZATION_DEFAULT_BATCH,
            },
        };
    }

    async start({ analyticalOnly = false } = {}) {
        if (this.isRunning && this.intervals.has('agents')) {
            logger.info('Scheduler already running (analytical agents active)');
            await this.publishStatus();
            return;
        }

        try {
            this.isRunning = true;
            logger.info('24/7 Scheduler Service Started', { analyticalOnly });

            await this.loadConfig();

            await this.ensureAnalyticalAgentScheduler();

            if (!analyticalOnly) {
                this.startDataHubScheduler();
                this.startTelegramPipelineScheduler();
                this.startNormalizationScheduler();
                if (!this.emergencyStopSeparation) {
                    this.startTrainingScheduler();
                    this.startAnalyticsScheduler();
                    this.startArtemisScheduler();
                    this.startMaintenanceScheduler();
                }
            }

            logger.info('Schedulers initialized', {
                intervals: Array.from(this.intervals.keys()),
                emergencyStopSeparation: this.emergencyStopSeparation,
            });
            await this.publishStatus();
        } catch (error) {
            this.isRunning = false;
            logger.error('Failed to start scheduler:', error);
            throw error;
        }
    }

    /**
     * Emergency Stop: keep safe analytical agent timers; stop Live-adjacent jobs.
     * Idempotent — no stop-log spam.
     */
    async applyEmergencyStopSeparation() {
        const wasSeparated = this.emergencyStopSeparation;
        this.emergencyStopSeparation = true;
        this.isRunning = true;

        // Stop Live-adjacent / auto-decision intervals only
        for (const key of ['artemis', 'training', 'maintenance']) {
            if (this.intervals.has(key)) {
                clearInterval(this.intervals.get(key));
                this.intervals.delete(key);
            }
        }

        // Load config only on transition or when agents timer is missing
        if (!wasSeparated || !this.intervals.has('agents')) {
            await this.loadConfig();
        }
        await this.ensureAnalyticalAgentScheduler();

        // Keep dataHub / telegram / normalization if already running; start if missing and enabled
        if (!wasSeparated) {
            if (this.config.dataHub?.enabled && !this.intervals.has('dataHub')) {
                this.startDataHubScheduler();
            }
            if (this.config.telegramPipeline?.enabled && !this.intervals.has('telegramPipeline')) {
                this.startTelegramPipelineScheduler();
            }
            if (this.config.normalization?.enabled && !this.intervals.has('normalization')) {
                this.startNormalizationScheduler();
            }
            logger.info('Emergency Stop separation applied — analytical agent scheduler preserved');
            await this.publishStatus();
        } else if (!this.intervals.has('agents')) {
            await this.publishStatus();
        }
    }

    /**
     * Ensure exactly one agents interval exists when agents.enabled.
     */
    async ensureAnalyticalAgentScheduler() {
        if (!this.config.agents?.enabled) {
            if (this.intervals.has('agents')) {
                clearInterval(this.intervals.get('agents'));
                this.intervals.delete('agents');
            }
            return;
        }
        if (this.intervals.has('agents')) {
            return;
        }
        this.startAgentScheduler();
    }

    async clearEmergencyStopSeparation() {
        if (!this.emergencyStopSeparation) {
            await this.ensureAnalyticalAgentScheduler();
            await this.publishStatus();
            return;
        }
        this.emergencyStopSeparation = false;
        logger.info('Emergency Stop separation cleared — restoring non-Live schedulers if enabled');
        if (this.isRunning) {
            if (this.config.training?.enabled && !this.intervals.has('training')) {
                this.startTrainingScheduler();
            }
            if (this.config.analytics?.enabled && !this.intervals.has('analytics')) {
                this.startAnalyticsScheduler();
            }
            if (this.config.artemis?.enabled && !this.intervals.has('artemis')) {
                this.startArtemisScheduler();
            }
            if (this.config.maintenance?.enabled && !this.intervals.has('maintenance')) {
                this.startMaintenanceScheduler();
            }
        }
        await this.ensureAnalyticalAgentScheduler();
        await this.publishStatus();
    }

    async stop() {
        this.isRunning = false;
        this.telegramBackgroundArmed = false;
        this.intervals.forEach((intervalId) => {
            clearInterval(intervalId);
        });
        this.intervals.clear();
        this.jobs.clear();
        this.inFlight.clear();
        logger.info('24/7 Scheduler Service Stopped');
        await this.publishStatus();
    }

    /**
     * Load scheduler_config id=1 into this.config.
     * @param {{ throwOnError?: boolean }} [options]
     *   throwOnError=false preserves historical full-scheduler behavior (log + continue).
     *   throwOnError=true is required for Telegram background arming (fail closed).
     */
    async loadConfig({ throwOnError = false } = {}) {
        try {
            const result = await query(
                'SELECT config FROM scheduler_config WHERE id = 1'
            );

            if (result.rows.length > 0 && result.rows[0].config) {
                const dbConfig = result.rows[0].config;
                this.config = { ...this.config, ...dbConfig };
                // Deep-merge agents so defaults remain if partial
                if (dbConfig.agents && typeof dbConfig.agents === 'object') {
                    this.config.agents = { ...this.config.agents, ...dbConfig.agents };
                }
            }
        } catch (error) {
            logger.error('Failed to load scheduler config:', error);
            if (throwOnError) {
                throw error;
            }
        }
    }

    /**
     * Bounded positive Telegram interval — never 0 / NaN / negative (busy-loop guard).
     */
    resolveTelegramPipelineIntervalMs() {
        const fromConfig = Number(this.config.telegramPipeline?.interval);
        if (Number.isFinite(fromConfig) && fromConfig > 0) {
            return fromConfig;
        }
        const fromEnv = parseInt(process.env.TELEGRAM_PIPELINE_INTERVAL_MS, 10);
        if (Number.isFinite(fromEnv) && fromEnv > 0) {
            return fromEnv;
        }
        return DEFAULT_TELEGRAM_PIPELINE_INTERVAL_MS;
    }

    /**
     * Candidate B / B1 — arm Telegram transfer timer without full scheduler start.
     * Does NOT start Data Hub, Normalization, agents, Autopilot, or Trading.
     */
    async ensureTelegramBackgroundLifecycle() {
        if (process.env.SCHEDULER_ENABLED !== 'true') {
            void recordTelegramLifecycleEvidence({
                state: TELEGRAM_LIFECYCLE_OUTCOMES.DISABLED,
                reason: 'SCHEDULER_ENABLED_false',
                pid: process.pid,
            });
            return {
                armed: false,
                disabled: true,
                retryable: false,
                reason: 'SCHEDULER_ENABLED_false',
                intervalMs: null,
                timerCount: this.intervals.has('telegramPipeline') ? 1 : 0,
            };
        }

        if (this.telegramBackgroundArmed && this.intervals.has('telegramPipeline')) {
            const intervalMs = this.resolveTelegramPipelineIntervalMs();
            return {
                armed: true,
                disabled: false,
                retryable: false,
                reason: 'already_armed',
                intervalMs,
                timerCount: 1,
            };
        }

        try {
            await this.loadConfig({ throwOnError: true });
        } catch (error) {
            logger.error('Telegram background config load failed (fail-closed):', error.message);
            return {
                armed: false,
                disabled: false,
                retryable: true,
                reason: 'config_query_failed',
                intervalMs: null,
                timerCount: this.intervals.has('telegramPipeline') ? 1 : 0,
                error: error.message,
            };
        }

        if (this.config.telegramPipeline?.enabled !== true) {
            void recordTelegramLifecycleEvidence({
                state: TELEGRAM_LIFECYCLE_OUTCOMES.DISABLED,
                reason: 'telegramPipeline_disabled',
                pid: process.pid,
            });
            return {
                armed: false,
                disabled: true,
                retryable: false,
                reason: 'telegramPipeline_disabled',
                intervalMs: null,
                timerCount: this.intervals.has('telegramPipeline') ? 1 : 0,
            };
        }

        const intervalMs = this.resolveTelegramPipelineIntervalMs();
        this.config.telegramPipeline.interval = intervalMs;
        this.telegramBackgroundArmed = true;
        this.startTelegramPipelineScheduler();

        const obs = await recordTelegramLifecycleEvidence({
            state: TELEGRAM_LIFECYCLE_OUTCOMES.ARMED,
            intervalMs,
            pid: process.pid,
        });

        logger.info('Telegram background lifecycle armed', {
            intervalMs,
            timerCount: this.intervals.has('telegramPipeline') ? 1 : 0,
            observabilityDegraded: obs.degraded,
        });

        return {
            armed: true,
            disabled: false,
            retryable: false,
            reason: 'armed',
            intervalMs,
            timerCount: this.intervals.has('telegramPipeline') ? 1 : 0,
            observabilityDegraded: obs.degraded,
        };
    }

    /**
     * Stop Telegram background ownership.
     * Idempotent. When full scheduler isRunning, clears telegramBackgroundArmed only
     * and leaves the telegramPipeline interval owned by the full scheduler intact.
     */
    async stopTelegramBackgroundLifecycle() {
        this.telegramBackgroundArmed = false;

        if (this.isRunning) {
            void recordTelegramLifecycleEvidence({
                state: TELEGRAM_LIFECYCLE_OUTCOMES.STOPPED,
                reason: 'full_scheduler_owns_timer',
                pid: process.pid,
            });
            logger.info('Telegram background armed cleared; full scheduler retains timer');
            return {
                stopped: true,
                timerCleared: false,
                reason: 'full_scheduler_owns_timer',
                timerCount: this.intervals.has('telegramPipeline') ? 1 : 0,
            };
        }

        if (this.intervals.has('telegramPipeline')) {
            clearInterval(this.intervals.get('telegramPipeline'));
            this.intervals.delete('telegramPipeline');
        }
        void recordTelegramLifecycleEvidence({
            state: TELEGRAM_LIFECYCLE_OUTCOMES.STOPPED,
            pid: process.pid,
        });
        logger.info('Telegram background lifecycle stopped');
        return {
            stopped: true,
            timerCleared: true,
            reason: 'background_stopped',
            timerCount: this.intervals.has('telegramPipeline') ? 1 : 0,
        };
    }

    async _runTelegramPipelineTick() {
        const telegramEnabled = this.config.telegramPipeline?.enabled === true;
        const gateOpen = this.isRunning || this.telegramBackgroundArmed;
        if (!gateOpen || !telegramEnabled) return;

        try {
            const summary = await transferTelegramMessagesToPipeline(
                TELEGRAM_TRANSFER_DEFAULT_BATCH,
            );
            const outcome = classifyTelegramTransferLifecycleOutcome(summary);
            void recordTelegramLifecycleEvidence({
                state: outcome,
                intervalMs: this.resolveTelegramPipelineIntervalMs(),
                pid: process.pid,
                selected: summary.selected ?? null,
                inserted: summary.inserted ?? null,
                processed: summary.processed ?? null,
                errors: summary.errors ?? null,
                durationMs: summary.durationMs ?? null,
                skipped_run: Boolean(summary.skipped_run),
                skip_reason: summary.skip_reason ?? null,
                backlogRemaining: summary.backlogRemaining ?? null,
            });
            if (
                summary.inserted > 0 ||
                summary.duplicates > 0 ||
                summary.skipped_no_source > 0 ||
                summary.skipped_filtered > 0
            ) {
                logger.info(
                    `Telegram pipeline: selected=${summary.selected} inserted=${summary.inserted} backlog=${summary.backlogRemaining} durationMs=${summary.durationMs}`,
                );
            }
        } catch (error) {
            logger.error('Telegram pipeline scheduler error:', error);
            void recordTelegramLifecycleEvidence({
                state: TELEGRAM_LIFECYCLE_OUTCOMES.TICK_ERROR,
                intervalMs: this.resolveTelegramPipelineIntervalMs(),
                pid: process.pid,
                error: error?.message ?? String(error),
            });
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

    getAllowlistKeys() {
        const normalized = normalizeAgentAllowlist(this.config.agents?.agents);
        if (!normalized.ok) {
            this._status.lastSkipReason = normalized.reason;
            logger.warn('scheduler_allowlist_invalid', { message: normalized.message });
            return [];
        }
        return normalized.keys;
    }

    // Agent Scheduler — allowlisted canonical agents only
    startAgentScheduler() {
        if (!this.config.agents.enabled) {
            logger.info('Agent Scheduler is disabled');
            return;
        }
        if (this.intervals.has('agents')) {
            return;
        }

        const allowlist = this.getAllowlistKeys();
        const intervalMs = Number(this.config.agents.interval) || 5 * 60 * 1000;

        const intervalId = setInterval(() => {
            this.runAgentTick().catch((error) => {
                logger.error('Agent scheduler tick error:', error);
            });
        }, intervalMs);

        this.intervals.set('agents', intervalId);
        logger.info('Agent Scheduler started', {
            intervalSec: intervalMs / 1000,
            allowlist,
            emptyMeansNobody: true,
        });
    }

    async runAgentTick() {
        if (!this.isRunning || !this.config.agents.enabled) return;

        const tickAt = new Date().toISOString();
        this._status.lastTickAt = tickAt;

        const allowlist = this.getAllowlistKeys();
        if (allowlist.length === 0) {
            this._status.lastSkipReason = 'empty_allowlist';
            await this.publishStatus();
            return;
        }

        let killSwitchActive = false;
        try {
            killSwitchActive = await isKillSwitchActive();
        } catch {
            killSwitchActive = this.emergencyStopSeparation;
        }

        logger.info('Running scheduled agent executions', {
            allowlist,
            killSwitchActive,
            emergencyStopSeparation: this.emergencyStopSeparation,
        });

        for (const agentRef of allowlist) {
            await this.executeAllowlistedAgent(agentRef, { killSwitchActive });
        }

        logger.info('Agent execution cycle completed');
        await this.publishStatus();
    }

    async executeAllowlistedAgent(agentRef, { killSwitchActive }) {
        const resolved = await resolveScheduledAgent(agentRef);
        logResolutionOutcome(resolved, { source: 'scheduler_tick' });
        if (!resolved.ok) {
            this._status.lastSkipReason = resolved.reason;
            return;
        }

        if (killSwitchActive && !isSafeAnalyticalUnderEmergencyStop(resolved.agentKey)) {
            this._status.lastSkipReason = 'live_capable_blocked_by_emergency_stop';
            logger.warn('scheduled_agent_skipped_live_capable', {
                agentKey: resolved.agentKey,
                agentId: resolved.agentId,
            });
            return;
        }

        if (this.inFlight.has(resolved.agentKey)) {
            this._status.lastSkipReason = 'overlap_skipped';
            logger.warn('scheduled_agent_overlap_skipped', { agentKey: resolved.agentKey });
            return;
        }

        this.inFlight.add(resolved.agentKey);
        const started = Date.now();
        try {
            const { executeAgentRun } = await import('../services/agentExecutionService.js');
            const result = await executeAgentRun({
                agentId: resolved.agentId,
                symbol: 'BTCUSDT',
                timeframe: '1h',
                input: {
                    function: 'scheduled_analytical_run',
                    trigger: 'scheduler',
                    producer: 'titan-engine-worker',
                    agent_key: resolved.agentKey,
                },
                identityType: 'system',
                user: null,
                confirmLive: false,
            });

            if (!result.ok) {
                this._status.lastFailureAt = new Date().toISOString();
                this._status.lastSkipReason = result.code || 'execution_denied';
                logger.warn('scheduled_agent_execution_denied', {
                    agentKey: resolved.agentKey,
                    code: result.code,
                    message: result.message,
                });
                return;
            }

            this._status.lastSuccessAt = new Date().toISOString();
            this._status.lastSkipReason = null;
            this._status.lastRun = {
                agentKey: resolved.agentKey,
                agentId: resolved.agentId,
                at: this._status.lastSuccessAt,
                durationMs: Date.now() - started,
                decisionType: result.result?.decision_type || null,
                effectiveMode: result.policy?.effectiveMode || null,
                sideEffectsSuppressed: result.sideEffectsSuppressed === true,
                producer: 'scheduler',
            };
            logger.info('Scheduled agent execution complete', {
                agentKey: resolved.agentKey,
                agentId: resolved.agentId,
                durationMs: Date.now() - started,
                effective_mode: result.policy?.effectiveMode,
                side_effects_suppressed: result.sideEffectsSuppressed,
            });
        } catch (error) {
            this._status.lastFailureAt = new Date().toISOString();
            this._status.lastSkipReason = 'execution_error';
            logger.error('Failed scheduled agent execution', {
                agentKey: resolved.agentKey,
                error: error.message,
            });
        } finally {
            this.inFlight.delete(resolved.agentKey);
        }
    }

    // Data Hub Scheduler
    startDataHubScheduler() {
        if (!this.config.dataHub.enabled) {
            logger.info('Data Hub Scheduler is disabled');
            return;
        }
        if (this.intervals.has('dataHub')) return;

        const intervalId = setInterval(async () => {
            if (!this.isRunning || !this.config.dataHub.enabled) return;
            try {
                await runDataFetchJob();
            } catch (error) {
                logger.error('Data Hub scheduler error:', error);
            }
        }, this.config.dataHub.interval);

        this.intervals.set('dataHub', intervalId);
        logger.info(`Data Hub Scheduler started (interval: ${this.config.dataHub.interval / 1000}s)`);
    }

    startTelegramPipelineScheduler() {
        if (!this.config.telegramPipeline?.enabled) {
            logger.info('Telegram Pipeline Scheduler is disabled');
            return;
        }
        if (this.intervals.has('telegramPipeline')) return;

        const intervalMs = this.resolveTelegramPipelineIntervalMs();
        this.config.telegramPipeline.interval = intervalMs;

        const intervalId = setInterval(() => {
            this._runTelegramPipelineTick().catch((error) => {
                logger.error('Telegram pipeline tick fatal:', error);
            });
        }, intervalMs);

        this.intervals.set('telegramPipeline', intervalId);
        logger.info(`Telegram Pipeline Scheduler started (interval: ${intervalMs / 1000}s)`);
    }

    startNormalizationScheduler() {
        if (!this.config.normalization?.enabled) {
            logger.info('Normalization Worker Scheduler is disabled');
            return;
        }
        if (this.intervals.has('normalization')) return;

        const intervalId = setInterval(async () => {
            if (!this.isRunning || !this.config.normalization?.enabled) return;
            try {
                const batchSize =
                    this.config.normalization.batchSize || NORMALIZATION_DEFAULT_BATCH;
                const summary = await processNormalizationBatch(batchSize);
                if (summary.processed > 0 || summary.errors > 0) {
                    logger.info(
                        `Normalization: selected=${summary.selected} processed=${summary.processed} errors=${summary.errors} backlog=${summary.backlogRemaining} durationMs=${summary.durationMs}`,
                    );
                }
            } catch (error) {
                logger.error('Normalization worker scheduler error:', error);
            }
        }, this.config.normalization.interval);

        this.intervals.set('normalization', intervalId);
        logger.info(
            `Normalization Worker Scheduler started (interval: ${this.config.normalization.interval / 1000}s, batch: ${this.config.normalization.batchSize || NORMALIZATION_DEFAULT_BATCH})`,
        );
    }

    startTrainingScheduler() {
        if (!this.config.training.enabled) {
            logger.info('Training Scheduler is disabled');
            return;
        }
        if (this.intervals.has('training')) return;

        const intervalId = setInterval(async () => {
            if (!this.isRunning || !this.config.training.enabled || this.emergencyStopSeparation) return;
            try {
                if (this.config.training.autoSchedule) {
                    logger.info('Checking for training opportunities...');
                    const trainingData = await this.fetchTrainingData();
                    if (trainingData && trainingData.recommendations) {
                        for (const recommendation of trainingData.recommendations) {
                            if (recommendation.priority === 'high' || recommendation.priority === 'critical') {
                                try {
                                    await this.scheduleTraining(recommendation.agentIds, recommendation.mode);
                                } catch (error) {
                                    logger.error('Failed to schedule training:', error);
                                }
                            }
                        }
                    }
                }
            } catch (error) {
                logger.error('Training scheduler error:', error);
            }
        }, this.config.training.interval);

        this.intervals.set('training', intervalId);
        logger.info(`Training Scheduler started (interval: ${this.config.training.interval / 1000}s)`);
    }

    async fetchTrainingData() {
        try {
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
            const { triggerTrainingSession } = await import('../services/artemisOrchestrator.js');
            await triggerTrainingSession(agentIds, mode);
        } catch (error) {
            logger.error('Failed to schedule training:', error);
        }
    }

    startAnalyticsScheduler() {
        if (!this.config.analytics.enabled) {
            logger.info('Analytics Scheduler is disabled');
            return;
        }
        if (this.intervals.has('analytics')) return;

        const intervalId = setInterval(async () => {
            if (!this.isRunning || !this.config.analytics.enabled) return;
            try {
                if (this.config.analytics.autoRefresh) {
                    // UI refresh trigger placeholder
                }
            } catch (error) {
                logger.error('Analytics scheduler error:', error);
            }
        }, this.config.analytics.interval);

        this.intervals.set('analytics', intervalId);
        logger.info(`Analytics Scheduler started (interval: ${this.config.analytics.interval / 1000}s)`);
    }

    startArtemisScheduler() {
        if (!this.config.artemis.enabled) {
            logger.info('Artemis Scheduler is disabled');
            return;
        }
        if (this.intervals.has('artemis')) return;

        const intervalId = setInterval(async () => {
            if (!this.isRunning || !this.config.artemis.enabled || this.emergencyStopSeparation) return;
            try {
                if (this.config.artemis.autoDecisions) {
                    // Decision engine placeholder — no Live side effects here
                }
            } catch (error) {
                logger.error('Artemis scheduler error:', error);
            }
        }, this.config.artemis.interval);

        this.intervals.set('artemis', intervalId);
        logger.info(`Artemis Scheduler started (interval: ${this.config.artemis.interval / 1000}s)`);
    }

    startMaintenanceScheduler() {
        if (!this.config.maintenance.enabled) {
            logger.info('Maintenance Scheduler is disabled');
            return;
        }
        if (this.intervals.has('maintenance')) return;

        const intervalId = setInterval(async () => {
            if (!this.isRunning || !this.config.maintenance.enabled || this.emergencyStopSeparation) return;
            try {
                if (this.config.maintenance.autoRun) {
                    await maintenanceService.runFullSiteMaintenance();
                }
            } catch (error) {
                logger.error('Maintenance scheduler error:', error);
            }
        }, this.config.maintenance.interval);

        this.intervals.set('maintenance', intervalId);
        logger.info(`Maintenance Scheduler started (interval: ${this.config.maintenance.interval / (1000 * 60 * 60)}h)`);

        setTimeout(() => {
            if (this.isRunning && this.config.maintenance.autoRun && !this.emergencyStopSeparation) {
                maintenanceService.runFullSiteMaintenance();
            }
        }, 30000);
    }

    async updateConfig(section, updates) {
        if (this.config[section]) {
            if (section === 'agents' && updates && Object.prototype.hasOwnProperty.call(updates, 'agents')) {
                const normalized = normalizeAgentAllowlist(updates.agents);
                if (!normalized.ok) {
                    const err = new Error(normalized.message);
                    err.code = 'VALIDATION_ERROR';
                    throw err;
                }
                updates = { ...updates, agents: normalized.keys };
            }
            this.config[section] = { ...this.config[section], ...updates };
            await this.saveConfig();

            if (this.intervals.has(section)) {
                clearInterval(this.intervals.get(section));
                this.intervals.delete(section);
                if (section === 'agents') this.startAgentScheduler();
                else if (section === 'dataHub') this.startDataHubScheduler();
                else if (section === 'training') this.startTrainingScheduler();
                else if (section === 'analytics') this.startAnalyticsScheduler();
                else if (section === 'artemis') this.startArtemisScheduler();
                else if (section === 'maintenance') this.startMaintenanceScheduler();
                else if (section === 'telegramPipeline') this.startTelegramPipelineScheduler();
                else if (section === 'normalization') this.startNormalizationScheduler();
            }

            // B1: keep telegramBackgroundArmed consistent with enabled + timer ownership
            if (section === 'telegramPipeline') {
                if (this.config.telegramPipeline?.enabled !== true) {
                    if (this.intervals.has('telegramPipeline')) {
                        clearInterval(this.intervals.get('telegramPipeline'));
                        this.intervals.delete('telegramPipeline');
                    }
                    this.telegramBackgroundArmed = false;
                } else if (
                    (this.isRunning || this.telegramBackgroundArmed) &&
                    !this.intervals.has('telegramPipeline')
                ) {
                    this.startTelegramPipelineScheduler();
                }
            }
            await this.publishStatus();
        }
    }

    async publishStatus() {
        const allowlist = this.getAllowlistKeys();
        this._status = {
            ...this._status,
            ...buildEmptyStatus({
                isRunning: this.isRunning && this.intervals.has('agents'),
                agentsEnabled: this.config.agents?.enabled === true,
                allowlist,
                registeredJobs: allowlist,
                activeIntervals: Array.from(this.intervals.keys()),
                emergencyStopSeparation: this.emergencyStopSeparation,
                lastTickAt: this._status.lastTickAt,
                lastSuccessAt: this._status.lastSuccessAt,
                lastFailureAt: this._status.lastFailureAt,
                lastSkipReason: this._status.lastSkipReason,
                lastRun: this._status.lastRun,
            }),
        };
        await publishAnalyticalSchedulerStatus(this._status);
    }

    getStatus() {
        return {
            isRunning: this.isRunning,
            config: this.config,
            activeJobs: Array.from(this.jobs.keys()),
            intervals: Array.from(this.intervals.keys()),
            emergencyStopSeparation: this.emergencyStopSeparation,
            allowlist: this.getAllowlistKeys(),
            ownerHint: 'local-process-singleton',
            authoritativeOwner: 'titan-engine-worker',
            lastTickAt: this._status.lastTickAt,
            lastSuccessAt: this._status.lastSuccessAt,
            lastFailureAt: this._status.lastFailureAt,
            lastSkipReason: this._status.lastSkipReason,
            lastRun: this._status.lastRun,
        };
    }
}

export const scheduler = new SchedulerService();

// Re-export helpers for tests
export { isLiveCapableAgent };
