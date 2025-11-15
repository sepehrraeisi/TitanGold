
import React, { useEffect, useState } from 'react';
import { useLanguage } from '../../context/LanguageContext.tsx';
import * as api from '../../services/api.ts';
import type { ManagedUser, UserManagementData } from '../../types.ts';
import Skeleton from '../ui/skeleton.tsx';

const statusBadgeClasses: Record<ManagedUser['status'], string> = {
    active: 'bg-green-500/20 text-green-400',
    suspended: 'bg-red-500/20 text-red-400',
    invited: 'bg-yellow-500/20 text-yellow-400',
};

const UsersSettings: React.FC = () => {
    const { t } = useLanguage();
    const [data, setData] = useState<UserManagementData | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [inviteEmail, setInviteEmail] = useState('');
    const [inviteRole, setInviteRole] = useState('');
    const [isInviting, setIsInviting] = useState(false);
    const [resendStatus, setResendStatus] = useState<string | null>(null);

    useEffect(() => {
        const load = async () => {
            setIsLoading(true);
            const response = await api.fetchUserManagement();
            setData(response);
            setInviteRole(response.defaultRoleKey);
            setIsLoading(false);
        };
        load();
    }, []);

    const refresh = async () => {
        const response = await api.fetchUserManagement();
        setData(response);
    };

    const handleRoleChange = async (userId: string, roleKey: string) => {
        const updated = await api.updateManagedUserRole(userId, roleKey);
        setData(updated);
    };

    const handleStatusToggle = async (userId: string, status: ManagedUser['status']) => {
        const updated = await api.toggleManagedUserStatus(userId, status === 'active' ? 'suspended' : 'active');
        setData(updated);
    };

    const handleRemoveUser = async (userId: string) => {
        const updated = await api.removeManagedUser(userId);
        setData(updated);
    };

    const handleInvite = async () => {
        if (!inviteEmail) return;
        setIsInviting(true);
        const updated = await api.inviteManagedUser(inviteEmail, inviteRole);
        setData(updated);
        setInviteEmail('');
        setIsInviting(false);
    };

    const handleResendInvite = async (inviteId: string) => {
        const result = await api.resendUserInvitation(inviteId);
        if (result.success) {
            setResendStatus(t('invitation_resent'));
        } else {
            setResendStatus(t('invitation_not_found'));
        }
        await refresh();
    };

    if (isLoading || !data) {
        return (
            <div className="bg-[#161B22] border border-gray-800 rounded-xl p-6 space-y-4">
                <Skeleton className="h-6 w-48" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-24 w-full" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="bg-[#161B22] border border-gray-800 rounded-xl">
                <div className="p-6 border-b border-gray-800">
                    <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                        <div>
                            <h3 className="text-lg font-semibold text-white">{t('settings_users')}</h3>
                            <p className="text-sm text-gray-400">{t('user_management_overview')}</p>
                        </div>
                        <div className="flex flex-wrap gap-3 text-sm">
                            <span className="px-3 py-1 rounded-full bg-blue-500/10 text-blue-300 font-semibold">{t('total_users', { count: data.users.length })}</span>
                            <span className="px-3 py-1 rounded-full bg-green-500/10 text-green-300 font-semibold">{t('active_users', { count: data.users.filter(user => user.status === 'active').length })}</span>
                            <span className="px-3 py-1 rounded-full bg-yellow-500/10 text-yellow-300 font-semibold">{t('pending_invites', { count: data.invitations.length })}</span>
                        </div>
                    </div>
                </div>
                <div className="p-6 overflow-x-auto">
                    <table className="w-full text-sm text-left text-gray-300">
                        <thead className="text-xs uppercase text-gray-400 border-b border-gray-800">
                            <tr>
                                <th className="px-6 py-3">{t('user')}</th>
                                <th className="px-6 py-3">{t('role')}</th>
                                <th className="px-6 py-3">{t('status')}</th>
                                <th className="px-6 py-3">{t('last_active')}</th>
                                <th className="px-6 py-3 text-right">{t('action')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {data.users.map(user => (
                                <tr key={user.id} className="border-b border-gray-900/60 last:border-b-0">
                                    <td className="px-6 py-4">
                                        <div className="font-semibold text-white">{user.name}</div>
                                        <div className="text-xs text-gray-400">{user.email}</div>
                                        <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-gray-400">
                                            {user.permissions.map(permission => (
                                                <span key={permission} className="px-2 py-0.5 rounded-full bg-[#0d111c] border border-gray-700">{t(permission)}</span>
                                            ))}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <select
                                            value={user.roleKey}
                                            onChange={event => handleRoleChange(user.id, event.target.value)}
                                            className="bg-[#0D111C] border border-gray-700 rounded-md px-2 py-1 text-sm"
                                        >
                                            {data.availableRoles.map(role => (
                                                <option key={role.roleKey} value={role.roleKey}>{t(role.roleKey)}</option>
                                            ))}
                                        </select>
                                        <p className="text-xs text-gray-500 mt-1">{t(data.availableRoles.find(role => role.roleKey === user.roleKey)?.descriptionKey ?? '')}</p>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${statusBadgeClasses[user.status]}`}>{t(`user_status_${user.status}`)}</span>
                                    </td>
                                    <td className="px-6 py-4 text-xs text-gray-400">
                                        {user.lastActiveAt ? new Date(user.lastActiveAt).toLocaleString() : t('never_logged_in')}
                                    </td>
                                    <td className="px-6 py-4 text-right space-x-3">
                                        <button className="text-blue-400 hover:underline text-xs" onClick={() => handleStatusToggle(user.id, user.status)}>
                                            {user.status === 'active' ? t('suspend_user') : t('activate_user')}
                                        </button>
                                        <button className="text-red-400 hover:underline text-xs" onClick={() => handleRemoveUser(user.id)}>
                                            {t('remove_user')}
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            <div className="bg-[#161B22] border border-gray-800 rounded-xl p-6 space-y-4">
                <h4 className="text-lg font-semibold text-white">{t('invite_user')}</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="md:col-span-2">
                        <label className="block text-sm text-gray-400 mb-1">{t('email_address')}</label>
                        <input
                            type="email"
                            value={inviteEmail}
                            onChange={event => setInviteEmail(event.target.value)}
                            placeholder={t('invite_email_placeholder')}
                            className="w-full p-2 bg-[#0D111C] border border-gray-700 rounded-md"
                        />
                    </div>
                    <div>
                        <label className="block text-sm text-gray-400 mb-1">{t('role')}</label>
                        <select
                            value={inviteRole}
                            onChange={event => setInviteRole(event.target.value)}
                            className="w-full p-2 bg-[#0D111C] border border-gray-700 rounded-md"
                        >
                            {data.availableRoles.map(role => (
                                <option key={role.roleKey} value={role.roleKey}>{t(role.roleKey)}</option>
                            ))}
                        </select>
                    </div>
                </div>
                <div className="flex items-center justify-between text-sm text-gray-400">
                    <span>{t(data.availableRoles.find(role => role.roleKey === inviteRole)?.descriptionKey ?? '')}</span>
                    <button
                        onClick={handleInvite}
                        disabled={isInviting || !inviteEmail}
                        className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold py-2 px-6 rounded-md"
                    >
                        {isInviting ? t('sending') : t('send_invite')}
                    </button>
                </div>
                {resendStatus && <p className="text-xs text-gray-500">{resendStatus}</p>}
            </div>

            <div className="bg-[#161B22] border border-gray-800 rounded-xl p-6 space-y-4">
                <h4 className="text-lg font-semibold text-white">{t('pending_invitations')}</h4>
                {data.invitations.length === 0 ? (
                    <p className="text-sm text-gray-400">{t('no_invitations')}</p>
                ) : (
                    <ul className="space-y-3">
                        {data.invitations.map(invite => (
                            <li key={invite.id} className="flex items-center justify-between text-sm">
                                <div>
                                    <p className="font-semibold text-white">{invite.email}</p>
                                    <p className="text-xs text-gray-500">{t(invite.roleKey)} • {t('invited_by', { name: invite.invitedBy })}</p>
                                    <p className="text-xs text-gray-500">{t('invited_at', { time: new Date(invite.invitedAt).toLocaleString() })}</p>
                                </div>
                                <button className="text-blue-400 hover:underline text-xs" onClick={() => handleResendInvite(invite.id)}>
                                    {t('resend_invite')}
                                </button>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </div>
    );
};

export default UsersSettings;