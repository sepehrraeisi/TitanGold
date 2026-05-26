export type PipelineHealthSystemStatus = 'healthy' | 'degraded' | 'unhealthy' | 'unknown';

export function parseFiniteCount(value: unknown): number | null {
    if (value == null || value === '') return null;
    const n = typeof value === 'number' ? value : Number(value);
    if (!Number.isFinite(n) || n < 0) return null;
    return Math.floor(n);
}

export function formatSystemStatus(raw?: string | null): PipelineHealthSystemStatus {
    const s = String(raw ?? '')
        .trim()
        .toLowerCase();
    if (s === 'healthy') return 'healthy';
    if (s === 'degraded') return 'degraded';
    if (s === 'unhealthy' || s === 'critical' || s === 'down') return 'unhealthy';
    return 'unknown';
}

export function formatActiveSourcesLabel(active?: unknown, total?: unknown): string {
    const a = parseFiniteCount(active) ?? 0;
    const t = parseFiniteCount(total) ?? 0;
    return `${a} / ${t}`;
}

export function formatAvgLatency(
    value?: number | null,
): { display: string; available: boolean } {
    if (value == null || !Number.isFinite(value) || value < 0) {
        return { display: 'N/A', available: false };
    }
    return { display: `${Math.round(value)} ms`, available: true };
}

export function systemStatusTextClass(status: PipelineHealthSystemStatus): string {
    switch (status) {
        case 'healthy':
            return 'text-emerald-400';
        case 'degraded':
            return 'text-amber-400';
        case 'unhealthy':
            return 'text-red-400';
        default:
            return 'text-slate-400';
    }
}
