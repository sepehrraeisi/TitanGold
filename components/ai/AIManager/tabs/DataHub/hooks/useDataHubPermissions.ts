import { useMemo } from 'react';
import { useAppContext } from '../../../../../../context/AppContext.tsx';
import {
    canWriteDataHub,
    getDataHubRoleLabel,
    normalizeRole,
} from '../dataHubPermissions.ts';

function readStoredUserRole(): string | null {
    try {
        const raw = sessionStorage.getItem('titan_user') || localStorage.getItem('titan_user');
        if (!raw) return null;
        const parsed = JSON.parse(raw) as { role?: string };
        return parsed?.role ?? null;
    } catch {
        return null;
    }
}

export function useDataHubPermissions() {
    const { user } = useAppContext();
    const role = user?.role ?? readStoredUserRole();

    return useMemo(
        () => ({
            role: normalizeRole(role),
            canWrite: canWriteDataHub(role),
            roleLabel: getDataHubRoleLabel(role),
        }),
        [role],
    );
}
