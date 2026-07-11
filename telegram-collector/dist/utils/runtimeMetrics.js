"use strict";
/**
 * Fast runtime metrics for /api/telegram-collector/health (P7.4).
 */
const pg_1 = require("pg");
const metricsCollector_1 = require("./metricsCollector");

let pool = null;

function getPool() {
    if (!pool) {
        pool = new pg_1.Pool({
            host: process.env.DB_HOST || 'localhost',
            port: parseInt(process.env.DB_PORT || '5433', 10),
            database: process.env.DB_NAME || 'titangold_db',
            user: process.env.DB_USER || 'postgres',
            password: process.env.DB_PASSWORD || '',
            max: 2,
            idleTimeoutMillis: 10_000,
        });
    }
    return pool;
}

function averageFromMetricsCollector() {
    const metrics = metricsCollector_1.default.getMetrics();
    const latencies = (metrics.channels || [])
        .map((c) => c.avgLatency)
        .filter((v) => typeof v === 'number' && Number.isFinite(v) && v > 0);
    if (latencies.length === 0) {
        return null;
    }
    return Math.round(latencies.reduce((sum, v) => sum + v, 0) / latencies.length);
}

async function loadRuntimeMetrics() {
    const inMemoryAvg = averageFromMetricsCollector();
    let averageLatencyMs = inMemoryAvg;
    let averageLatencySource = inMemoryAvg != null ? 'collector_sync_metrics' : null;

    let lastProcessedAt = null;
    let lastProcessedSource = null;

    try {
        const client = getPool();
        const [pipelineRes, processedRes, messagesRes] = await Promise.all([
            client.query('SELECT avg_processing_time_ms FROM telegram_pipeline_stats LIMIT 1'),
            client.query('SELECT MAX(created_at) AS ts FROM processed_telegram_messages'),
            client.query(`
                SELECT MAX(processed_at) AS ts
                FROM telegram_messages
                WHERE processed_at IS NOT NULL
            `),
        ]);

        if (averageLatencyMs == null) {
            const pipelineAvg = parseFloat(pipelineRes.rows[0]?.avg_processing_time_ms);
            if (Number.isFinite(pipelineAvg) && pipelineAvg > 0) {
                averageLatencyMs = Math.round(pipelineAvg);
                averageLatencySource = 'telegram_pipeline_stats';
            }
        }

        const processedTs = processedRes.rows[0]?.ts;
        const messageTs = messagesRes.rows[0]?.ts;
        if (processedTs) {
            lastProcessedAt = new Date(processedTs).toISOString();
            lastProcessedSource = 'processed_telegram_messages';
        } else if (messageTs) {
            lastProcessedAt = new Date(messageTs).toISOString();
            lastProcessedSource = 'telegram_messages';
        }
    } catch (err) {
        console.error('⚠️  runtimeMetrics DB lookup failed:', err.message);
    }

    if (!lastProcessedAt) {
        const pollingLast = metricsCollector_1.default.getMetrics()?.polling?.lastCycle;
        if (pollingLast) {
            lastProcessedAt = new Date(pollingLast).toISOString();
            lastProcessedSource = 'polling_cycle';
        }
    }

    let lastProcessedLabel = null;
    if (lastProcessedAt) {
        lastProcessedLabel = new Date(lastProcessedAt).toISOString();
    }

    return {
        averageLatencyMs: averageLatencyMs ?? null,
        averageLatencySource,
        lastProcessedAt,
        lastProcessedLabel,
        lastProcessedSource,
    };
}

module.exports = { loadRuntimeMetrics };
