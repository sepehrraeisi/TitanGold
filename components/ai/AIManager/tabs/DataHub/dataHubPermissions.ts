/** DataHub write access — mirrors backend authorize('admin', 'trader'). */

const WRITE_ROLES = new Set(['admin', 'trader']);

export function normalizeRole(role?: string | null): string | null {
    if (role == null || role === '') return null;
    return String(role).trim().toLowerCase();
}

export function canWriteDataHub(role?: string | null): boolean {
    const normalized = normalizeRole(role);
    return normalized !== null && WRITE_ROLES.has(normalized);
}

export function getDataHubRoleLabel(role?: string | null): string {
    const normalized = normalizeRole(role);
    if (!normalized) return 'unknown';
    return normalized;
}
