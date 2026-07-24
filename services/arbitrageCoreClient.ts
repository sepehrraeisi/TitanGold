/**
 * ARBITRAGE-CORE — Single frontend owner for Arbitrage core API contracts.
 * Unwraps backend envelopes, validates safe shapes, never fabricates zero data on failure.
 */

import type {
    ArbitrageCoreCandidatesResponse,
    ArbitrageCoreIntegrations,
    ArbitrageCoreOverview,
    ArbitrageCoreRunDetail,
    ArbitrageCoreRunsResponse,
    ArbitrageCoreSettings,
} from './api.ts';
import type { ArbitrageSpreadCandidate } from '../types.ts';

export class ArbitrageContractError extends Error {
    readonly code = 'ARBITRAGE_CONTRACT_ERROR';

    constructor(message: string) {
        super(message);
        this.name = 'ArbitrageContractError';
    }
}

function asNumber(value: unknown, fallback = 0): number {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
}

function asStringArray(value: unknown): string[] {
    return Array.isArray(value) ? value.map(v => String(v)) : [];
}

function safePagination(raw: unknown, page: number, pageSize: number) {
    const p = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
    const total = asNumber(p.total, 0);
    const safePage = asNumber(p.page, page);
    const safeSize = asNumber(p.pageSize, pageSize);
    const totalPages = Math.max(1, asNumber(p.totalPages, Math.ceil(total / safeSize) || 1));
    return {
        page: safePage,
        pageSize: safeSize,
        total,
        totalPages,
        hasMore: Boolean(p.hasMore ?? safePage * safeSize < total),
        hasNext: Boolean(p.hasNext ?? safePage < totalPages),
        hasPrevious: Boolean(p.hasPrevious ?? safePage > 1),
    };
}

function mapCandidateDto(raw: Record<string, unknown>): ArbitrageSpreadCandidate {
    const rejectionReasons = asStringArray(raw.rejectionReasons);
    const grossBps = raw.grossSpreadBps;
    const netBps = raw.netSpreadBps;
    return {
        id: String(raw.candidateId ?? raw.id ?? raw.symbol ?? 'unknown'),
        symbol: raw.symbol ? String(raw.symbol) : null,
        path: raw.symbol ? [String(raw.symbol)] : [],
        expectedProfitBps:
            grossBps != null ? asNumber(grossBps) : netBps != null ? asNumber(netBps) : null,
        netProfitUSDT: raw.estimatedProfit != null ? asNumber(raw.estimatedProfit) : null,
        riskScore: raw.riskScore != null ? asNumber(raw.riskScore) : null,
        spreadPct: grossBps != null ? asNumber(grossBps) / 100 : null,
        netSpreadPct: netBps != null ? asNumber(netBps) / 100 : null,
        bidPrice: raw.bid != null ? asNumber(raw.bid) : null,
        askPrice: raw.ask != null ? asNumber(raw.ask) : null,
        rejectionReason: rejectionReasons[0] ?? (raw.rejectionReason ? String(raw.rejectionReason) : null),
        rejectionReasons,
        lifecycle: raw.lifecycleState ? String(raw.lifecycleState) : undefined,
        timestamp: raw.observedAt ? String(raw.observedAt) : raw.sourceTimestamp ? String(raw.sourceTimestamp) : null,
        classification:
            raw.lifecycleState === 'rejected'
                ? 'rejected_candidate'
                : 'spread_candidate',
    };
}

function groupCandidates(
    items: ArbitrageSpreadCandidate[],
    runId: string | null = null,
): ArbitrageCoreCandidatesResponse {
    const spreadCandidates: ArbitrageSpreadCandidate[] = [];
    const rejectedCandidates: ArbitrageSpreadCandidate[] = [];
    const qualifiedCandidates: ArbitrageSpreadCandidate[] = [];

    for (const item of items) {
        const lifecycle = item.lifecycle || (item.classification === 'rejected_candidate' ? 'rejected' : 'candidate');
        if (lifecycle === 'qualified') qualifiedCandidates.push(item);
        else if (lifecycle === 'rejected' || lifecycle === 'blocked' || lifecycle === 'expired') {
            rejectedCandidates.push(item);
        } else {
            spreadCandidates.push(item);
        }
    }

    return { runId, spreadCandidates, rejectedCandidates, qualifiedCandidates };
}

export function parseArbitrageOverviewEnvelope(raw: unknown): ArbitrageCoreOverview {
    if (!raw || typeof raw !== 'object') {
        throw new ArbitrageContractError('Overview response is not an object');
    }
    const body = raw as Record<string, unknown>;
    const overview = (body.overview ?? body) as Record<string, unknown>;
    if (!overview || typeof overview !== 'object') {
        throw new ArbitrageContractError('Overview payload missing');
    }

    const settings = (overview.settings ?? {}) as Record<string, unknown>;
    const product = (overview.product ?? {}) as Record<string, unknown>;

    return {
        product: {
            agentKey: String(product.agentKey ?? 'arbitrage'),
            displayName: String(product.displayName ?? 'MEXC Spot Spread Monitor'),
            description: String(product.description ?? ''),
            activeMode: String(product.activeMode ?? 'single_venue_spread_monitoring'),
            activeModeLabel: String(product.activeModeLabel ?? product.displayName ?? 'MEXC Spot Spread Monitor'),
            unavailableModes: Array.isArray(product.unavailableModes)
                ? (product.unavailableModes as ArbitrageCoreOverview['product']['unavailableModes'])
                : [],
            executionSupported: false,
            executionEligible: false,
        },
        settings: parseArbitrageSettingsEnvelope({ settings }),
        totalScanRuns: asNumber(overview.totalScanRuns, -1),
        latestRun: overview.latestRun ? parseRunSummary(overview.latestRun as Record<string, unknown>) : null,
        recentRuns: Array.isArray(overview.recentRuns)
            ? overview.recentRuns.map(r => parseRunSummary(r as Record<string, unknown>))
            : [],
        interpretation: overview.interpretation != null ? String(overview.interpretation) : null,
    };
}

function parseRunSummary(raw: Record<string, unknown>) {
    return {
        runId: String(raw.runId ?? raw.id ?? ''),
        startedAt: raw.startedAt ? String(raw.startedAt) : null,
        completedAt: raw.completedAt ? String(raw.completedAt) : null,
        status: raw.status ? String(raw.status) : 'completed',
        trigger: raw.trigger ? String(raw.trigger) : 'scheduled',
        durationMs: raw.durationMs != null ? asNumber(raw.durationMs) : null,
        dryRun: raw.dryRun !== false,
        runtimeMode: raw.runtimeMode ? String(raw.runtimeMode) : 'demo',
        funnel: raw.funnel && typeof raw.funnel === 'object' ? (raw.funnel as Record<string, number>) : {},
        rejectionSummary:
            raw.rejectionSummary && typeof raw.rejectionSummary === 'object'
                ? (raw.rejectionSummary as Record<string, number>)
                : {},
        symbolsRequested: asStringArray(raw.symbolsRequested),
        symbolsEvaluated: asStringArray(raw.symbolsEvaluated),
        failureReason: raw.failureReason ? String(raw.failureReason) : null,
    };
}

export function parseArbitrageRunsEnvelope(raw: unknown, page: number, pageSize: number): ArbitrageCoreRunsResponse {
    if (!raw || typeof raw !== 'object') {
        throw new ArbitrageContractError('Runs response is not an object');
    }
    const body = raw as Record<string, unknown>;
    const itemsRaw = body.runs ?? body.items ?? [];
    if (!Array.isArray(itemsRaw)) {
        throw new ArbitrageContractError('Runs items must be an array');
    }
    return {
        items: itemsRaw.map(item => parseRunSummary(item as Record<string, unknown>)),
        pagination: safePagination(body.pagination, page, pageSize),
    };
}

export function parseArbitrageCandidatesEnvelope(
    raw: unknown,
    runId?: string | null,
): ArbitrageCoreCandidatesResponse {
    if (!raw || typeof raw !== 'object') {
        throw new ArbitrageContractError('Candidates response is not an object');
    }
    const body = raw as Record<string, unknown>;

    if (body.spreadCandidates || body.rejectedCandidates || body.qualifiedCandidates) {
        return {
            runId: body.runId ? String(body.runId) : runId ?? null,
            spreadCandidates: Array.isArray(body.spreadCandidates)
                ? body.spreadCandidates.map(c => mapCandidateDto(c as Record<string, unknown>))
                : [],
            rejectedCandidates: Array.isArray(body.rejectedCandidates)
                ? body.rejectedCandidates.map(c => mapCandidateDto(c as Record<string, unknown>))
                : [],
            qualifiedCandidates: Array.isArray(body.qualifiedCandidates)
                ? body.qualifiedCandidates.map(c => mapCandidateDto(c as Record<string, unknown>))
                : [],
        };
    }

    const flat = body.candidates ?? body.items ?? [];
    if (!Array.isArray(flat)) {
        throw new ArbitrageContractError('Candidates items must be an array');
    }
    return groupCandidates(
        flat.map(c => mapCandidateDto(c as Record<string, unknown>)),
        body.runId ? String(body.runId) : runId ?? null,
    );
}

export function parseArbitrageRunDetailEnvelope(raw: unknown): ArbitrageCoreRunDetail {
    if (!raw || typeof raw !== 'object') {
        throw new ArbitrageContractError('Run detail response is not an object');
    }
    const body = raw as Record<string, unknown>;
    const scanRun = (body.scanRun ?? body) as Record<string, unknown>;
    return parseRunSummary(scanRun);
}

export function parseArbitrageSettingsEnvelope(raw: unknown): ArbitrageCoreSettings {
    if (!raw || typeof raw !== 'object') {
        throw new ArbitrageContractError('Settings response is not an object');
    }
    const body = raw as Record<string, unknown>;
    const settings = (body.settings ?? body) as Record<string, unknown>;

    return {
        monitoredSymbols: asStringArray(settings.monitoredSymbols ?? settings.symbols),
        minimumGrossSpreadBps:
            settings.minimumGrossSpreadBps != null ? asNumber(settings.minimumGrossSpreadBps) : null,
        minimumNetSpreadBps:
            settings.minimumNetSpreadBps != null ? asNumber(settings.minimumNetSpreadBps) : 20,
        assumedFeesBps: settings.assumedFeesBps != null ? asNumber(settings.assumedFeesBps) : 10,
        assumedSlippageBps:
            settings.assumedSlippageBps != null ? asNumber(settings.assumedSlippageBps) : 10,
        minimumLiquidity:
            settings.minimumLiquidity != null ? asNumber(settings.minimumLiquidity) : 100000,
        maximumDataAgeMs:
            settings.maximumDataAgeMs != null ? asNumber(settings.maximumDataAgeMs) : 30000,
        scanIntervalSeconds:
            settings.scanIntervalSeconds != null ? asNumber(settings.scanIntervalSeconds) : 300,
        monitoringState:
            settings.monitoringState === 'paused' || settings.monitoringState === 'active'
                ? settings.monitoringState
                : 'active',
        notificationPreference: Boolean(settings.notificationPreference),
        notificationDeliveryAvailable: Boolean(settings.notificationDeliveryAvailable),
        version: asNumber(settings.version, 1),
        updatedAt: settings.updatedAt ? String(settings.updatedAt) : null,
        updatedBy: settings.updatedBy ? String(settings.updatedBy) : null,
        executionSupported: false,
        executionEligible: false,
        legacyExecutionPreferenceIgnored: Boolean(settings.legacyExecutionPreferenceIgnored),
        isDefault: Boolean(settings.isDefault),
    };
}

export type ArbitrageIntegrationItem = {
    id: string;
    label: string;
    state: 'available' | 'limited' | 'unavailable';
    lastSuccess?: string | null;
    lastAttempt?: string | null;
    safeReason?: string | null;
    owner?: string | null;
};

export function parseArbitrageIntegrationsEnvelope(raw: unknown): ArbitrageCoreIntegrations & {
    items: ArbitrageIntegrationItem[];
} {
    if (!raw || typeof raw !== 'object') {
        throw new ArbitrageContractError('Integrations response is not an object');
    }
    const body = raw as Record<string, unknown>;
    const integrations = (body.integrations ?? body) as Record<string, unknown>;

    const items: ArbitrageIntegrationItem[] = [];

    const pushItem = (
        id: string,
        label: string,
        block: Record<string, unknown> | undefined,
        mapState: (b: Record<string, unknown>) => ArbitrageIntegrationItem['state'],
    ) => {
        if (!block) {
            items.push({ id, label, state: 'unavailable', safeReason: 'Status unavailable', owner: null });
            return;
        }
        items.push({
            id,
            label,
            state: mapState(block),
            lastSuccess: block.lastSuccess ? String(block.lastSuccess) : block.lastTickAt ? String(block.lastTickAt) : null,
            lastAttempt: block.lastAttempt ? String(block.lastAttempt) : null,
            safeReason: block.note ? String(block.note) : block.safeReason ? String(block.safeReason) : null,
            owner: block.owner ? String(block.owner) : null,
        });
    };

    pushItem('mexc_public', 'MEXC public market data', integrations.mexcPublicMarketData as Record<string, unknown>, b =>
        b.status === 'available' ? 'available' : 'unavailable',
    );
    pushItem('market_proxy', 'Internal market proxy', integrations.marketProxy as Record<string, unknown>, b =>
        b.status === 'operational' || b.status === 'available' ? 'available' : 'limited',
    );
    pushItem('scheduler', 'Scheduler', integrations.scheduler as Record<string, unknown>, b =>
        b.isRunning ? 'available' : b.stale ? 'limited' : 'limited',
    );
    pushItem('redis_lock', 'Redis scan lock', integrations.redisScanLock as Record<string, unknown>, b =>
        b.available ? 'available' : 'limited',
    );
    pushItem('database', 'Database persistence', integrations.database as Record<string, unknown>, b =>
        b.status === 'connected' ? 'available' : 'unavailable',
    );
    pushItem('notifications', 'Notification delivery', integrations.notifications as Record<string, unknown>, b =>
        b.deliveryAvailable ? 'available' : 'unavailable',
    );
    pushItem('execution', 'Financial execution', integrations.execution as Record<string, unknown>, () => 'unavailable');

    return {
        dataSources: ['MEXC spot (public market data)'],
        executionSupported: false,
        executionEligible: false,
        unavailableIntegrations: items.filter(i => i.state !== 'available').map(i => i.label),
        items,
    };
}

export function isOverviewLoadFailure(overview: ArbitrageCoreOverview | null): boolean {
    return overview != null && overview.totalScanRuns < 0;
}
