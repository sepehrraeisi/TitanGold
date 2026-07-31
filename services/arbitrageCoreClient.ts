/**
 * ARBITRAGE-CORE — Single frontend owner for Arbitrage core API contracts.
 * Unwraps backend envelopes, validates safe shapes, never fabricates zero data on failure.
 */

import type {
    ArbitrageCoreCandidate,
    ArbitrageCoreCandidatesFunnel,
    ArbitrageCoreCandidatesResponse,
    ArbitrageCoreIntegrations,
    ArbitrageCoreOverview,
    ArbitrageCoreRunDetail,
    ArbitrageCoreRunsResponse,
    ArbitrageCoreSettings,
    ArbitrageSettingsFieldMeta,
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

function mapCandidateRecord(raw: Record<string, unknown>): ArbitrageCoreCandidate {
    const rejectionReasons = asStringArray(raw.rejectionReasons);
    return {
        candidateId: String(raw.candidateId ?? raw.id ?? raw.symbol ?? 'unknown'),
        runId: raw.runId ? String(raw.runId) : null,
        lifecycleState: String(raw.lifecycleState ?? raw.lifecycle ?? 'candidate'),
        symbol: String(raw.symbol ?? ''),
        baseAsset: String(raw.baseAsset ?? ''),
        quoteAsset: String(raw.quoteAsset ?? ''),
        bid: raw.bid != null ? asNumber(raw.bid) : null,
        ask: raw.ask != null ? asNumber(raw.ask) : null,
        sourceTimestamp: raw.sourceTimestamp ? String(raw.sourceTimestamp) : null,
        observedAt: raw.observedAt ? String(raw.observedAt) : null,
        ageMs: raw.ageMs != null ? asNumber(raw.ageMs) : null,
        grossSpreadBps: raw.grossSpreadBps != null ? asNumber(raw.grossSpreadBps) : null,
        assumedFeesBps: raw.assumedFeesBps != null ? asNumber(raw.assumedFeesBps) : null,
        estimatedSlippageBps:
            raw.estimatedSlippageBps != null ? asNumber(raw.estimatedSlippageBps) : null,
        netSpreadBps: raw.netSpreadBps != null ? asNumber(raw.netSpreadBps) : null,
        estimatedNotional: raw.estimatedNotional != null ? asNumber(raw.estimatedNotional) : null,
        estimatedProfit: raw.estimatedProfit != null ? asNumber(raw.estimatedProfit) : null,
        estimatedProfitUnavailableReason: raw.estimatedProfitUnavailableReason
            ? String(raw.estimatedProfitUnavailableReason)
            : null,
        liquidityState: String(raw.liquidityState ?? 'unknown'),
        freshnessState: String(raw.freshnessState ?? 'unknown'),
        riskScore: raw.riskScore != null ? asNumber(raw.riskScore) : null,
        riskScoreUnavailableReason: raw.riskScoreUnavailableReason
            ? String(raw.riskScoreUnavailableReason)
            : null,
        rejectionReasons,
        mode: String(raw.mode ?? 'single_venue_spread_monitoring'),
        source: String(raw.source ?? 'mexc_public'),
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
        timestamp: raw.observedAt ? String(raw.observedAt) : raw.sourceTimestamp ? String(raw.sourceTimestamp) : '',
        classification:
            raw.lifecycleState === 'rejected'
                ? 'rejected_candidate'
                : 'spread_candidate',
        strategy: 'mexc_spot_spread_monitor',
    };
}

function parseFunnel(raw: unknown): ArbitrageCoreCandidatesFunnel {
    const f = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
    return {
        observed: asNumber(f.observed, 0),
        analyticalCandidates: asNumber(f.analyticalCandidates, 0),
        rejected: asNumber(f.rejected, 0),
        qualified: asNumber(f.qualified, 0),
        expired: asNumber(f.expired, 0),
        blocked: asNumber(f.blocked, 0),
    };
}

function parseAvailableFilters(raw: unknown) {
    const f = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
    return {
        lifecycles: asStringArray(f.lifecycles),
        symbols: asStringArray(f.symbols),
        rejectionReasons: asStringArray(f.rejectionReasons),
        freshnessStates: asStringArray(f.freshnessStates),
    };
}

function groupCandidatesFromRecords(
    items: ArbitrageCoreCandidate[],
    runId: string | null = null,
): Pick<
    ArbitrageCoreCandidatesResponse,
    'spreadCandidates' | 'rejectedCandidates' | 'qualifiedCandidates'
> {
    const spreadCandidates: ArbitrageSpreadCandidate[] = [];
    const rejectedCandidates: ArbitrageSpreadCandidate[] = [];
    const qualifiedCandidates: ArbitrageSpreadCandidate[] = [];

    for (const item of items) {
        const mapped = mapCandidateDto(item as unknown as Record<string, unknown>);
        const lifecycle = item.lifecycleState;
        if (lifecycle === 'qualified') qualifiedCandidates.push(mapped);
        else if (lifecycle === 'rejected' || lifecycle === 'blocked' || lifecycle === 'expired') {
            rejectedCandidates.push(mapped);
        } else {
            spreadCandidates.push(mapped);
        }
    }

    return { spreadCandidates, rejectedCandidates, qualifiedCandidates };
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

function parseHistoricalSummary(raw: unknown) {
    const h = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
    return {
        totalScanRuns: asNumber(h.totalScanRuns, -1),
        successfulRuns: asNumber(h.successfulRuns, 0),
        failedRuns: asNumber(h.failedRuns, 0),
        scheduledRuns: asNumber(h.scheduledRuns, 0),
        manualRuns: asNumber(h.manualRuns, 0),
        latestSuccessfulRunAt: h.latestSuccessfulRunAt ? String(h.latestSuccessfulRunAt) : null,
        latestFailedRunAt: h.latestFailedRunAt ? String(h.latestFailedRunAt) : null,
        latestRunAt: h.latestRunAt ? String(h.latestRunAt) : null,
        latestCompletedRunAt: h.latestCompletedRunAt ? String(h.latestCompletedRunAt) : null,
    };
}

function parseRunTiming(raw: unknown) {
    const r = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
    return {
        latestRunAt: r.latestRunAt ? String(r.latestRunAt) : null,
        latestCompletedRunAt: r.latestCompletedRunAt ? String(r.latestCompletedRunAt) : null,
        latestSuccessfulRunAt: r.latestSuccessfulRunAt ? String(r.latestSuccessfulRunAt) : null,
    };
}

function parseConfigurationSummary(raw: unknown) {
    const c = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
    return {
        monitoredSymbolCount: asNumber(c.monitoredSymbolCount, 0),
        minimumGrossSpreadBps: c.minimumGrossSpreadBps != null ? asNumber(c.minimumGrossSpreadBps) : null,
        minimumNetSpreadBps: c.minimumNetSpreadBps != null ? asNumber(c.minimumNetSpreadBps) : null,
        assumedFeesBps: c.assumedFeesBps != null ? asNumber(c.assumedFeesBps) : null,
        assumedSlippageBps: c.assumedSlippageBps != null ? asNumber(c.assumedSlippageBps) : null,
        maximumDataAgeMs: c.maximumDataAgeMs != null ? asNumber(c.maximumDataAgeMs) : null,
        settingsVersion: asNumber(c.settingsVersion, 1),
        settingsUpdatedAt: c.settingsUpdatedAt ? String(c.settingsUpdatedAt) : null,
    };
}

function parseProductState(raw: unknown) {
    const p = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
    return {
        productMode: String(p.productMode ?? 'single_venue_spread_monitoring'),
        productName: String(p.productName ?? 'MEXC Spot Spread Monitor'),
        monitoringState: String(p.monitoringState ?? 'active'),
        agentStatus: String(p.agentStatus ?? 'inactive'),
        schedulerState: String(p.schedulerState ?? 'unknown'),
        runtimeMode: String(p.runtimeMode ?? 'demo'),
        emergencyStop: Boolean(p.emergencyStop),
        executionSupported: false as const,
    };
}

function parseInterpretation(raw: unknown): string | import('./api.ts').ArbitrageCoreInterpretation | null {
    if (raw == null) return null;
    if (typeof raw === 'string') return raw;
    if (typeof raw !== 'object') return null;
    const i = raw as Record<string, unknown>;
    return {
        primaryMessage: String(i.primaryMessage ?? ''),
        safeReasonCodes: asStringArray(i.safeReasonCodes),
        rejectionSummary:
            i.rejectionSummary && typeof i.rejectionSummary === 'object'
                ? (i.rejectionSummary as Record<string, number>)
                : {},
    };
}

function parseLatestRun(raw: unknown) {
    if (!raw || typeof raw !== 'object') return null;
    const latest = raw as Record<string, unknown>;
    if (latest.latestRunId || latest.runId) {
        const funnel =
            latest.funnel && typeof latest.funnel === 'object'
                ? (latest.funnel as Record<string, number>)
                : {
                      symbolsRequested: asNumber(latest.symbolsRequested, 0),
                      symbolsEvaluated: asNumber(latest.symbolsEvaluated, 0),
                      rawObservations: asNumber(latest.rawObservations, 0),
                      analyticalCandidates: asNumber(latest.spreadCandidates, 0),
                      rejected: asNumber(latest.rejectedCandidates, 0),
                      qualified: asNumber(latest.qualifiedCandidates, 0),
                      expired: asNumber(latest.expiredCandidates, 0),
                      blocked: asNumber(latest.blockedCandidates, 0),
                  };
        return {
            runId: String(latest.latestRunId ?? latest.runId ?? ''),
            startedAt: latest.startedAt ? String(latest.startedAt) : null,
            completedAt: latest.completedAt ? String(latest.completedAt) : null,
            status: latest.latestRunStatus
                ? String(latest.latestRunStatus)
                : latest.status
                  ? String(latest.status)
                  : 'completed',
            trigger: latest.latestRunTrigger
                ? String(latest.latestRunTrigger)
                : latest.trigger
                  ? String(latest.trigger)
                  : 'scheduled',
            durationMs: latest.durationMs != null ? asNumber(latest.durationMs) : null,
            durationAvailability:
                latest.durationAvailability === 'measured' ||
                latest.durationAvailability === 'sub_ms' ||
                latest.durationAvailability === 'unavailable'
                    ? latest.durationAvailability
                    : undefined,
            dryRun: latest.dryRun !== false,
            runtimeMode: latest.runtimeMode ? String(latest.runtimeMode) : 'demo',
            funnel,
            rejectionSummary:
                latest.rejectionSummary && typeof latest.rejectionSummary === 'object'
                    ? (latest.rejectionSummary as Record<string, number>)
                    : {},
            symbolsRequested: asStringArray(latest.symbolsRequested),
            symbolsEvaluated: asStringArray(latest.symbolsEvaluated),
            sourceFreshnessMs:
                latest.dataFreshnessMs != null ? asNumber(latest.dataFreshnessMs) : null,
            dataFreshnessState:
                latest.dataFreshnessState === 'measured' || latest.dataFreshnessState === 'unavailable'
                    ? latest.dataFreshnessState
                    : latest.dataFreshnessMs != null
                      ? 'measured'
                      : 'unavailable',
            dataFreshnessMs:
                latest.dataFreshnessMs != null ? asNumber(latest.dataFreshnessMs) : null,
            dataFreshnessReason: latest.dataFreshnessReason ? String(latest.dataFreshnessReason) : null,
            durationReason: latest.durationReason ? String(latest.durationReason) : null,
            failureReason: latest.failureReason ? String(latest.failureReason) : null,
        };
    }
    return parseRunSummary(latest);
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
    const historicalSummary = parseHistoricalSummary(overview.historicalSummary);
    const totalFromHistory =
        historicalSummary.totalScanRuns >= 0 ? historicalSummary.totalScanRuns : asNumber(overview.totalScanRuns, -1);

    return {
        generatedAt: overview.generatedAt ? String(overview.generatedAt) : overview.snapshotAt ? String(overview.snapshotAt) : null,
        snapshotAt: overview.snapshotAt ? String(overview.snapshotAt) : overview.generatedAt ? String(overview.generatedAt) : null,
        runTiming: overview.runTiming ? parseRunTiming(overview.runTiming) : undefined,
        productState: overview.productState ? parseProductState(overview.productState) : undefined,
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
        totalScanRuns: totalFromHistory,
        historicalSummary,
        configurationSummary: overview.configurationSummary
            ? parseConfigurationSummary(overview.configurationSummary)
            : undefined,
        latestRun: overview.latestRun ? parseLatestRun(overview.latestRun) : null,
        recentRuns: Array.isArray(overview.recentRuns)
            ? overview.recentRuns.map(r => parseRunSummary(r as Record<string, unknown>))
            : [],
        interpretation: parseInterpretation(overview.interpretation),
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
        durationAvailability:
            raw.durationAvailability === 'measured' ||
            raw.durationAvailability === 'sub_ms' ||
            raw.durationAvailability === 'unavailable'
                ? raw.durationAvailability
                : undefined,
        durationReason: raw.durationReason ? String(raw.durationReason) : null,
        durationState:
            raw.durationState === 'measured' ||
            raw.durationState === 'sub_ms' ||
            raw.durationState === 'unavailable'
                ? raw.durationState
                : undefined,
        dataFreshnessState:
            raw.dataFreshnessState === 'measured' || raw.dataFreshnessState === 'unavailable'
                ? raw.dataFreshnessState
                : raw.dataFreshnessMs != null || raw.sourceFreshnessMs != null
                  ? 'measured'
                  : 'unavailable',
        dataFreshnessMs:
            raw.dataFreshnessMs != null
                ? asNumber(raw.dataFreshnessMs)
                : raw.sourceFreshnessMs != null
                  ? asNumber(raw.sourceFreshnessMs)
                  : null,
        dataFreshnessReason: raw.dataFreshnessReason ? String(raw.dataFreshnessReason) : null,
        funnel: raw.funnel && typeof raw.funnel === 'object' ? (raw.funnel as Record<string, number>) : {},
        rejectionSummary:
            raw.rejectionSummary && typeof raw.rejectionSummary === 'object'
                ? (raw.rejectionSummary as Record<string, number>)
                : {},
        rejectionDistribution:
            raw.rejectionDistribution && typeof raw.rejectionDistribution === 'object'
                ? (raw.rejectionDistribution as Record<string, number>)
                : undefined,
        primaryRejectionReasons: Array.isArray(raw.primaryRejectionReasons)
            ? raw.primaryRejectionReasons.map(String)
            : undefined,
        evaluatedSymbols: raw.evaluatedSymbols != null ? asNumber(raw.evaluatedSymbols) : undefined,
        rejectedCount: raw.rejectedCount != null ? asNumber(raw.rejectedCount) : undefined,
        qualifiedCount: raw.qualifiedCount != null ? asNumber(raw.qualifiedCount) : undefined,
        symbolsRequested: asStringArray(raw.symbolsRequested),
        symbolsEvaluated: asStringArray(raw.symbolsEvaluated),
        sourceFreshnessMs: raw.sourceFreshnessMs != null ? asNumber(raw.sourceFreshnessMs) : raw.dataFreshnessMs != null ? asNumber(raw.dataFreshnessMs) : null,
        failureReason: raw.failureReason ? String(raw.failureReason) : null,
        failureCode: raw.failureCode ? String(raw.failureCode) : null,
        failureMessage: raw.failureMessage ? String(raw.failureMessage) : null,
        schedulerOwner: raw.schedulerOwner ? String(raw.schedulerOwner) : undefined,
        sideEffectsSuppressed: raw.sideEffectsSuppressed !== false,
        executionSupported: raw.executionSupported === true ? true : false,
        createdAt: raw.createdAt ? String(raw.createdAt) : null,
        source: raw.source ? String(raw.source) : undefined,
        dataContractVersion: raw.dataContractVersion ? String(raw.dataContractVersion) : undefined,
        malformed: raw.malformed === true,
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
    const availableFiltersRaw = body.availableFilters;
    const availableFilters =
        availableFiltersRaw && typeof availableFiltersRaw === 'object'
            ? {
                  triggers: Array.isArray((availableFiltersRaw as Record<string, unknown>).triggers)
                      ? ((availableFiltersRaw as Record<string, unknown>).triggers as unknown[]).map(String)
                      : ['manual', 'scheduled'],
                  statuses: Array.isArray((availableFiltersRaw as Record<string, unknown>).statuses)
                      ? ((availableFiltersRaw as Record<string, unknown>).statuses as unknown[]).map(String)
                      : ['completed', 'failed'],
              }
            : undefined;

    return {
        items: itemsRaw.map(item => parseRunSummary(item as Record<string, unknown>)),
        summary: parseHistoricalSummary(body.summary),
        availableFilters,
        generatedAt: body.generatedAt ? String(body.generatedAt) : null,
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

    const itemsRaw = body.items ?? body.candidates ?? [];
    const items = Array.isArray(itemsRaw)
        ? itemsRaw.map(c => mapCandidateRecord(c as Record<string, unknown>))
        : [];

    const grouped =
        body.spreadCandidates || body.rejectedCandidates || body.qualifiedCandidates
            ? {
                  spreadCandidates: Array.isArray(body.spreadCandidates)
                      ? body.spreadCandidates.map(c => mapCandidateDto(c as Record<string, unknown>))
                      : [],
                  rejectedCandidates: Array.isArray(body.rejectedCandidates)
                      ? body.rejectedCandidates.map(c => mapCandidateDto(c as Record<string, unknown>))
                      : [],
                  qualifiedCandidates: Array.isArray(body.qualifiedCandidates)
                      ? body.qualifiedCandidates.map(c => mapCandidateDto(c as Record<string, unknown>))
                      : [],
              }
            : groupCandidatesFromRecords(items, body.runId ? String(body.runId) : runId ?? null);

    const pagination = safePagination(
        body.pagination ?? {
            page: body.page,
            pageSize: body.pageSize,
            total: body.total,
        },
        asNumber(body.page, 1),
        asNumber(body.pageSize, 20),
    );

    return {
        runId: body.runId ? String(body.runId) : runId ?? null,
        items,
        total: asNumber(body.total, pagination.total),
        page: asNumber(body.page, pagination.page),
        pageSize: asNumber(body.pageSize, pagination.pageSize),
        hasNext: Boolean(body.hasNext ?? pagination.hasNext),
        hasPrevious: Boolean(body.hasPrevious ?? pagination.hasPrevious),
        selectedRun: body.selectedRun
            ? parseRunSummary(body.selectedRun as Record<string, unknown>)
            : null,
        funnel: parseFunnel(body.funnel),
        availableFilters: parseAvailableFilters(body.availableFilters),
        generatedAt: body.generatedAt ? String(body.generatedAt) : null,
        pagination,
        ...grouped,
    };
}

export function parseArbitrageRunDetailEnvelope(raw: unknown): ArbitrageCoreRunDetail {
    if (!raw || typeof raw !== 'object') {
        throw new ArbitrageContractError('Run detail response is not an object');
    }
    const body = raw as Record<string, unknown>;
    const scanRun = (body.scanRun ?? body) as Record<string, unknown>;
    return parseRunSummary(scanRun);
}

export function parseArbitrageProfitRiskEnvelope(raw: unknown) {
    if (!raw || typeof raw !== 'object') {
        throw new ArbitrageContractError('Profit-risk response is not an object');
    }
    const body = raw as Record<string, unknown>;
    const analytics = (body.analytics ?? body) as Record<string, unknown>;
    return {
        analytics: {
            runId: analytics.runId ? String(analytics.runId) : null,
            generatedAt: analytics.generatedAt ? String(analytics.generatedAt) : null,
            grossSpreadBps: analytics.grossSpreadBps != null ? asNumber(analytics.grossSpreadBps) : null,
            assumedFeesBps: analytics.assumedFeesBps != null ? asNumber(analytics.assumedFeesBps) : null,
            assumedSlippageBps: analytics.assumedSlippageBps != null ? asNumber(analytics.assumedSlippageBps) : null,
            estimatedNetSpreadBps: analytics.estimatedNetSpreadBps != null ? asNumber(analytics.estimatedNetSpreadBps) : null,
            estimatedProfitValue: analytics.estimatedProfitValue != null ? asNumber(analytics.estimatedProfitValue) : null,
            estimatedProfitCurrency: analytics.estimatedProfitCurrency ? String(analytics.estimatedProfitCurrency) : null,
            notionalValue: analytics.notionalValue != null ? asNumber(analytics.notionalValue) : null,
            notionalCurrency: analytics.notionalCurrency ? String(analytics.notionalCurrency) : null,
            notionalState: analytics.notionalState ? String(analytics.notionalState) : undefined,
            notionalSource: analytics.notionalSource ? String(analytics.notionalSource) : null,
            notionalDerivation: analytics.notionalDerivation ? String(analytics.notionalDerivation) : null,
            notionalCapValue: analytics.notionalCapValue != null ? asNumber(analytics.notionalCapValue) : null,
            publicMarketVolume24h:
                analytics.publicMarketVolume24h != null ? asNumber(analytics.publicMarketVolume24h) : null,
            uncappedNotionalValue:
                analytics.uncappedNotionalValue != null ? asNumber(analytics.uncappedNotionalValue) : null,
            estimatedAnalyticalProfitValue:
                analytics.estimatedAnalyticalProfitValue != null
                    ? asNumber(analytics.estimatedAnalyticalProfitValue)
                    : analytics.estimatedProfitValue != null
                      ? asNumber(analytics.estimatedProfitValue)
                      : null,
            estimateState: analytics.estimateState ? String(analytics.estimateState) : undefined,
            estimateReason: analytics.estimateReason ? String(analytics.estimateReason) : null,
            selectedCandidateId: analytics.selectedCandidateId ? String(analytics.selectedCandidateId) : null,
            selectedCandidateSymbol: analytics.selectedCandidateSymbol
                ? String(analytics.selectedCandidateSymbol)
                : null,
            selectionBasis: analytics.selectionBasis ? String(analytics.selectionBasis) : null,
            selectionReason: analytics.selectionReason ? String(analytics.selectionReason) : null,
            qualifiedCandidateCount: asNumber(analytics.qualifiedCandidateCount, 0),
            analyticalCandidateCount: asNumber(analytics.analyticalCandidateCount, 0),
            rejectedCandidateCount: asNumber(analytics.rejectedCandidateCount, 0),
            freshnessState: analytics.freshnessState ? String(analytics.freshnessState) : undefined,
            freshnessMs: analytics.freshnessMs != null ? asNumber(analytics.freshnessMs) : null,
            liquidityState: analytics.liquidityState ? String(analytics.liquidityState) : undefined,
            riskScore: analytics.riskScore != null ? asNumber(analytics.riskScore) : null,
            riskScoreState: analytics.riskScoreState ? String(analytics.riskScoreState) : undefined,
            riskScoreReason: analytics.riskScoreReason ? String(analytics.riskScoreReason) : null,
            riskScoreSource: analytics.riskScoreSource ? String(analytics.riskScoreSource) : null,
            riskFactors: Array.isArray(analytics.riskFactors) ? analytics.riskFactors : [],
            rejectionDistribution:
                analytics.rejectionDistribution && typeof analytics.rejectionDistribution === 'object'
                    ? (analytics.rejectionDistribution as Record<string, number>)
                    : {},
            primaryRejectionReasons: Array.isArray(analytics.primaryRejectionReasons)
                ? analytics.primaryRejectionReasons.map(String)
                : [],
            bestObservedCandidate: analytics.bestObservedCandidate ?? null,
            worstObservedCandidate: analytics.worstObservedCandidate ?? null,
            historicalTrend: Array.isArray(analytics.historicalTrend) ? analytics.historicalTrend : [],
            assumptions: analytics.assumptions ?? {},
            executionSupported: analytics.executionSupported === true,
            realizedProfitSupported: analytics.realizedProfitSupported === true,
            capturedProfitSupported: analytics.capturedProfitSupported === true,
            runtimeMode: analytics.runtimeMode ? String(analytics.runtimeMode) : 'demo',
            sideEffectsSuppressed: analytics.sideEffectsSuppressed !== false,
            dataContractVersion: analytics.dataContractVersion ? String(analytics.dataContractVersion) : undefined,
            malformed: analytics.malformed === true,
        },
        selectedRun: body.selectedRun ? parseRunSummary(body.selectedRun as Record<string, unknown>) : null,
        availableRuns: Array.isArray(body.availableRuns)
            ? body.availableRuns.map(r => parseRunSummary(r as Record<string, unknown>))
            : [],
        generatedAt: body.generatedAt ? String(body.generatedAt) : null,
    };
}

function parseSettingsFieldMeta(raw: unknown): ArbitrageSettingsFieldMeta | undefined {
    if (!raw || typeof raw !== 'object') return undefined;
    const field = raw as Record<string, unknown>;
    const source = String(field.source || 'default');
    const allowedSources = new Set([
        'configured',
        'default',
        'legacy_normalized',
        'unavailable',
        'unsupported',
        'blocked',
        'read_only',
    ]);
    return {
        effective: field.effective ?? null,
        configured: field.configured ?? null,
        defaultValue: field.defaultValue ?? null,
        source: (allowedSources.has(source) ? source : 'default') as ArbitrageSettingsFieldMeta['source'],
        supported: field.supported !== false,
        editable: Boolean(field.editable),
        readOnly: Boolean(field.readOnly),
        reasonCode: field.reasonCode ? String(field.reasonCode) : null,
        constraints:
            field.constraints && typeof field.constraints === 'object'
                ? {
                      min: asNumber((field.constraints as Record<string, unknown>).min, 0),
                      max: asNumber((field.constraints as Record<string, unknown>).max, 0),
                  }
                : null,
        unit: field.unit ? String(field.unit) : null,
    };
}

export function parseArbitrageSettingsEnvelope(raw: unknown): ArbitrageCoreSettings {
    if (!raw || typeof raw !== 'object') {
        throw new ArbitrageContractError('Settings response is not an object');
    }
    const body = raw as Record<string, unknown>;
    const settings = (body.settings ?? body) as Record<string, unknown>;
    const fieldsRaw =
        settings.fields && typeof settings.fields === 'object'
            ? (settings.fields as Record<string, unknown>)
            : {};
    const fields: NonNullable<ArbitrageCoreSettings['fields']> = {};
    for (const key of Object.keys(fieldsRaw)) {
        const parsed = parseSettingsFieldMeta(fieldsRaw[key]);
        if (parsed) {
            (fields as Record<string, ArbitrageSettingsFieldMeta>)[key] = parsed;
        }
    }

    return {
        monitoredSymbols: asStringArray(settings.monitoredSymbols ?? settings.symbols),
        minimumGrossSpreadBps:
            settings.minimumGrossSpreadBps != null ? asNumber(settings.minimumGrossSpreadBps) : null,
        minimumNetSpreadBps:
            settings.minimumNetSpreadBps != null ? asNumber(settings.minimumNetSpreadBps) : null,
        assumedFeesBps: settings.assumedFeesBps != null ? asNumber(settings.assumedFeesBps) : null,
        assumedSlippageBps:
            settings.assumedSlippageBps != null ? asNumber(settings.assumedSlippageBps) : null,
        minimumLiquidity:
            settings.minimumLiquidity != null ? asNumber(settings.minimumLiquidity) : null,
        maximumDataAgeMs:
            settings.maximumDataAgeMs != null ? asNumber(settings.maximumDataAgeMs) : null,
        scanIntervalSeconds:
            settings.scanIntervalSeconds != null ? asNumber(settings.scanIntervalSeconds) : null,
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
        fields: Object.keys(fields).length > 0 ? fields : undefined,
        unsupportedCapabilities: Array.isArray(settings.unsupportedCapabilities)
            ? settings.unsupportedCapabilities.map(item => {
                  const row = item as Record<string, unknown>;
                  return {
                      id: String(row.id ?? ''),
                      state: String(row.state ?? 'unsupported'),
                      legacyStoredPreference: Boolean(row.legacyStoredPreference),
                  };
              })
            : undefined,
        dataContractVersion: settings.dataContractVersion
            ? String(settings.dataContractVersion)
            : undefined,
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
