import {
    createIngestionFilterEvaluator,
    evaluateFilterRules,
} from './datahubFilterRulesService.js';
import { query } from '../database/db.js';
import { logger } from './logger.js';

const FILTER_BLOCKED_CODE = 'FILTER_RULE_BLOCKED';

function firstRule(decision) {
    return decision?.matched_rules?.[0] || null;
}

function stringifyMaybe(value) {
    if (value == null) return '';
    if (typeof value === 'string') return value;
    try {
        return JSON.stringify(value);
    } catch {
        return String(value);
    }
}

function resolveText({ text, message, rawData, metadata } = {}) {
    return (
        text ||
        message ||
        metadata?.title ||
        metadata?.content ||
        metadata?.message ||
        rawData?.content ||
        rawData?.text ||
        rawData?.message ||
        rawData?.title ||
        stringifyMaybe(rawData)
    );
}

function normalizeDecision(decision, applyTarget) {
    return {
        allowed: decision.allowed,
        blocked: !decision.allowed,
        decision: decision.decision,
        reason: decision.reason,
        apply_target: applyTarget,
        matched_rules: decision.matched_rules || [],
        rule: firstRule(decision),
    };
}

async function logFilterBlocked({
    sourceId,
    decision,
    applyTarget,
    enforcementPath,
    dataType,
    url,
    text,
    userId,
}) {
    const rule = firstRule(decision);
    try {
        await query(
            `INSERT INTO data_hub_logs (source_id, action, message, metadata, status)
             VALUES ($1, 'filter_blocked', $2, $3, 'failure')`,
            [
                sourceId || null,
                `${applyTarget} blocked by filter rule`,
                JSON.stringify({
                    source_id: sourceId || null,
                    rule_id: rule?.id || null,
                    rule_type: rule?.rule_type || null,
                    scope: rule?.scope || null,
                    pattern: rule?.pattern || null,
                    apply_target: applyTarget,
                    enforcement_path: enforcementPath,
                    data_type: dataType || null,
                    url: url ? String(url).slice(0, 500) : null,
                    text_preview: text ? String(text).slice(0, 200) : null,
                    reason: decision.reason,
                    user_id: userId || null,
                }),
            ],
        );
    } catch (error) {
        logger.warn('Failed to write filter_blocked audit log', {
            error: error.message,
            sourceId,
            enforcementPath,
        });
    }
}

function buildBlockedError({ message, decision, applyTarget }) {
    const err = new Error(message);
    err.status = 403;
    err.code = FILTER_BLOCKED_CODE;
    err.reason = decision.reason;
    err.details = normalizeDecision(decision, applyTarget);
    err.rule = firstRule(decision);
    return err;
}

export function isFilterRuleBlockedError(error) {
    return error?.code === FILTER_BLOCKED_CODE || error?.code === 'FILTER_BLOCKED';
}

async function enforcePolicy({
    applyTarget,
    sourceId,
    url,
    text,
    dataType,
    rawData,
    metadata,
    userId,
    enforcementPath,
    errorMessage,
}) {
    const resolvedText = resolveText({ text, rawData, metadata });
    const resolvedUrl = url || metadata?.url || metadata?.source_url || rawData?.url || rawData?.link;
    const decision = await evaluateFilterRules({
        source_id: sourceId,
        url: resolvedUrl,
        text: resolvedText,
        apply_target: applyTarget,
    });

    if (!decision.allowed) {
        await logFilterBlocked({
            sourceId,
            decision,
            applyTarget,
            enforcementPath,
            dataType,
            url: resolvedUrl,
            text: resolvedText,
            userId,
        });
        throw buildBlockedError({ message: errorMessage, decision, applyTarget });
    }

    return normalizeDecision(decision, applyTarget);
}

export async function enforceIngestionPolicy({
    sourceId,
    url,
    text,
    dataType,
    rawData,
    metadata,
    userId,
    enforcementPath = 'ingestion',
} = {}) {
    return enforcePolicy({
        applyTarget: 'ingestion',
        sourceId,
        url,
        text,
        dataType,
        rawData,
        metadata,
        userId,
        enforcementPath,
        errorMessage: 'Ingestion blocked by filter rule',
    });
}

export async function enforcePublishingPolicy({
    sourceId,
    url,
    text,
    dataType,
    message,
    metadata,
    userId,
    enforcementPath = 'publishing',
} = {}) {
    return enforcePolicy({
        applyTarget: 'publishing',
        sourceId,
        url,
        text: text || message,
        dataType,
        metadata,
        userId,
        enforcementPath,
        errorMessage: 'Publishing blocked by filter rule',
    });
}

export async function filterAllowedForIngestionBatch(items = []) {
    const evaluator = await createIngestionFilterEvaluator();
    const allowed = [];
    const blocked = [];

    for (const item of items) {
        const text = resolveText(item);
        const url = item.url || item.metadata?.url || item.metadata?.source_url || item.rawData?.url || item.rawData?.link;
        const decision = evaluator({
            source_id: item.sourceId,
            url,
            text,
        });

        if (decision.allowed) {
            allowed.push({ ...item, filterDecision: normalizeDecision(decision, 'ingestion') });
        } else {
            await logFilterBlocked({
                sourceId: item.sourceId,
                decision,
                applyTarget: 'ingestion',
                enforcementPath: item.enforcementPath || 'ingestion_batch',
                dataType: item.dataType,
                url,
                text,
                userId: item.userId,
            });
            blocked.push({ ...item, filterDecision: normalizeDecision(decision, 'ingestion') });
        }
    }

    return { allowed, blocked };
}

export async function filterAllowedForPublishingBatch(items = []) {
    const allowed = [];
    const blocked = [];

    for (const item of items) {
        try {
            const decision = await enforcePublishingPolicy({
                sourceId: item.sourceId,
                url: item.url,
                text: item.text,
                dataType: item.dataType,
                message: item.message,
                metadata: item.metadata,
                userId: item.userId,
                enforcementPath: item.enforcementPath || 'publishing_batch',
            });
            allowed.push({ ...item, filterDecision: decision });
        } catch (error) {
            if (!isFilterRuleBlockedError(error)) throw error;
            blocked.push({ ...item, filterDecision: error.details, error });
        }
    }

    return { allowed, blocked };
}

export async function evaluateFilterPolicy(input = {}) {
    const applyTarget = input.apply_target || input.applyTarget || 'ingestion';
    const decision = await evaluateFilterRules({
        source_id: input.source_id || input.sourceId,
        url: input.url || input.metadata?.url || input.metadata?.source_url,
        text: resolveText({
            text: input.text,
            message: input.message,
            rawData: input.rawData,
            metadata: input.metadata,
        }),
        apply_target: applyTarget,
    });
    return normalizeDecision(decision, applyTarget);
}

export { FILTER_BLOCKED_CODE };
