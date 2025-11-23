
import React, { useEffect, useState } from 'react';
import { useLanguage } from '../../context/LanguageContext.tsx';
import * as api from '../../services/api.ts';
import type { ManagedUser, UserManagementData } from '../../types.ts';
import Skeleton from '../ui/skeleton.tsx';
import type { UserActivity } from '../../types.ts';

export interface UserRoleOption {
    roleKey: string;
    descriptionKey: string;
    permissions: string[]; // Add permissions array
    isCustom?: boolean; // Whether this is a custom role or system role
    createdAt?: string; // When custom role was created
    createdBy?: string; // Who created the custom role
}

export interface UserManagementData {
    users: ManagedUser[];
    invitations: UserInvitation[];
    availableRoles: UserRoleOption[];
    defaultRoleKey: string;
    lastUpdated: string;
    activityLog?: UserActivity[];
    registrationEnabled: boolean; // Enable/disable public registration
    registrationDefaultRole: string; // Default role for new registrations
}

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
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'suspended' | 'invited'>('all');
    const [showInviteModal, setShowInviteModal] = useState(false);
    const [editingUser, setEditingUser] = useState<ManagedUser | null>(null);
    const [activeTab, setActiveTab] = useState<'users' | 'activities' | 'roles' | 'settings'>('users');
    const [activities, setActivities] = useState<UserActivity[]>([]);
    const [isLoadingActivities, setIsLoadingActivities] = useState(false);
    const [activityFilters, setActivityFilters] = useState<{
        userId?: string;
        actionType?: UserActivity['actionType'];
        startDate?: string;
        endDate?: string;
        searchQuery?: string;
    }>({});
    const [editingActivity, setEditingActivity] = useState<UserActivity | null>(null);
    const [editDescription, setEditDescription] = useState('');
    const [showCreateUserModal, setShowCreateUserModal] = useState(false);
    const [showCreateRoleModal, setShowCreateRoleModal] = useState(false);
    const [newUser, setNewUser] = useState({ name: '', email: '', password: '', roleKey: '', twoFactorEnabled: false });
    const [newRole, setNewRole] = useState({ roleKey: '', descriptionKey: '', permissions: [] as string[] });
    const [editingRole, setEditingRole] = useState<UserRoleOption | null>(null);
    
    // Available permissions for role creation
    const allPermissions = [
        'manage_users',
        'manage_settings',
        'view_analytics',
        'manage_trading',
        'manage_wallets',
        'view_users',
        'view_portfolio',
        'view_dashboard',
        'view_trading',
    ];

    useEffect(() => {
        const load = async () => {
            setIsLoading(true);
            try {
            const response = await api.fetchUserManagement();
            setData(response);
            setInviteRole(response.defaultRoleKey);
                setError(null);
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Failed to load users');
            } finally {
            setIsLoading(false);
            }
        };
        load();
    }, []);

    const refresh = async () => {
        try {
        const response = await api.fetchUserManagement();
        setData(response);
            setError(null);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to refresh');
        }
    };

    const handleRoleChange = async (userId: string, roleKey: string) => {
        try {
        const updated = await api.updateManagedUserRole(userId, roleKey);
        setData(updated);
            setSuccess(t('user_role_updated'));
            setTimeout(() => setSuccess(null), 3000);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to update role');
        }
    };

    const handleStatusToggle = async (userId: string, status: ManagedUser['status']) => {
        try {
        const updated = await api.toggleManagedUserStatus(userId, status === 'active' ? 'suspended' : 'active');
        setData(updated);
            setSuccess(t('user_status_updated'));
            setTimeout(() => setSuccess(null), 3000);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to update status');
        }
    };

    const handleRemoveUser = async (userId: string) => {
        if (!window.confirm(t('confirm_remove_user'))) {
            return;
        }
        
        try {
        const updated = await api.removeManagedUser(userId);
        setData(updated);
            setSuccess(t('user_removed'));
            setTimeout(() => setSuccess(null), 3000);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to remove user');
        }
    };

    const handleEditUser = (user: ManagedUser) => {
        setEditingUser({ ...user });
    };

    const handleSaveEditUser = async () => {
        if (!editingUser) return;
        
        try {
            const updates: Partial<ManagedUser> = {
                name: editingUser.name,
                email: editingUser.email,
                roleKey: editingUser.roleKey,
                twoFactorEnabled: editingUser.twoFactorEnabled,
            };
            
            const updated = await api.updateManagedUser(editingUser.id, updates);
            setData(updated);
            setEditingUser(null);
            setSuccess(t('user_updated_successfully'));
            setTimeout(() => setSuccess(null), 3000);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to update user');
        }
    };

    const handleInvite = async () => {
        if (!inviteEmail) {
            setError(t('email_required'));
            return;
        }
        
        setIsInviting(true);
        setError(null);
        
        try {
        const updated = await api.inviteManagedUser(inviteEmail, inviteRole);
        setData(updated);
        setInviteEmail('');
            setShowInviteModal(false);
            setSuccess(t('invitation_sent'));
            setTimeout(() => setSuccess(null), 3000);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to send invitation');
        } finally {
        setIsInviting(false);
        }
    };

    const handleResendInvite = async (inviteId: string) => {
        try {
        const result = await api.resendUserInvitation(inviteId);
        if (result.success) {
            setResendStatus(t('invitation_resent'));
                await refresh();
        } else {
                setError(t('invitation_not_found'));
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to resend invitation');
        }
    };

    const handleCancelInvite = async (inviteId: string) => {
        if (!window.confirm(t('confirm_cancel_invitation'))) {
            return;
        }
        
        try {
            const updated = await api.cancelUserInvitation(inviteId);
            setData(updated);
            setSuccess(t('invitation_cancelled'));
            setTimeout(() => setSuccess(null), 3000);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to cancel invitation');
        }
    };

    // Load activities
    useEffect(() => {
        if (activeTab === 'activities') {
            loadActivities();
        }
    }, [activeTab, activityFilters]);

    const loadActivities = async () => {
        setIsLoadingActivities(true);
        try {
            const result = await api.getUserActivities({
                ...activityFilters,
                limit: 100,
            });
            setActivities(result);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load activities');
        } finally {
            setIsLoadingActivities(false);
        }
    };

    const handleEditActivity = (activity: UserActivity) => {
        setEditingActivity(activity);
        setEditDescription(activity.description);
    };

    const handleSaveEdit = async () => {
        if (!editingActivity) return;
        
        try {
            await api.editUserActivity(editingActivity.id, {
                description: editDescription,
            });
            setEditingActivity(null);
            setEditDescription('');
            await loadActivities();
            setSuccess(t('activity_updated'));
            setTimeout(() => setSuccess(null), 3000);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to update activity');
        }
    };

    const handleDeleteActivity = async (activityId: string) => {
        if (!window.confirm(t('confirm_delete_activity'))) {
            return;
        }
        
        try {
            await api.deleteUserActivity(activityId);
            await loadActivities();
            setSuccess(t('activity_deleted'));
            setTimeout(() => setSuccess(null), 3000);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to delete activity');
        }
    };

    const handleClearActivities = async () => {
        if (!window.confirm(t('confirm_clear_activities'))) {
            return;
        }
        
        try {
            await api.clearUserActivities(activityFilters);
            await loadActivities();
            setSuccess(t('activities_cleared'));
            setTimeout(() => setSuccess(null), 3000);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to clear activities');
        }
    };

    const handleCreateUser = async () => {
        if (!newUser.name || !newUser.email || !newUser.password || !newUser.roleKey) {
            setError(t('fill_all_fields'));
            return;
        }
        
        try {
            const updated = await api.createUserAccount(newUser);
            setData(updated);
            setShowCreateUserModal(false);
            setNewUser({ name: '', email: '', password: '', roleKey: '', twoFactorEnabled: false });
            setSuccess(t('user_created_successfully'));
            setTimeout(() => setSuccess(null), 3000);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to create user');
        }
    };

    const handleCreateRole = async () => {
        if (!newRole.roleKey || !newRole.descriptionKey) {
            setError(t('fill_all_fields'));
            return;
        }
        
        try {
            const updated = await api.createCustomRole(newRole);
            setData(updated);
            setShowCreateRoleModal(false);
            setNewRole({ roleKey: '', descriptionKey: '', permissions: [] });
            setSuccess(t('role_created_successfully'));
            setTimeout(() => setSuccess(null), 3000);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to create role');
        }
    };

    const handleDeleteRole = async (roleKey: string) => {
        if (!window.confirm(t('confirm_delete_role'))) {
            return;
        }
        
        try {
            const updated = await api.deleteCustomRole(roleKey);
            setData(updated);
            setSuccess(t('role_deleted_successfully'));
            setTimeout(() => setSuccess(null), 3000);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to delete role');
        }
    };

    const handleToggleRegistration = async (enabled: boolean) => {
        try {
            const defaultRole = data?.registrationDefaultRole || data?.defaultRoleKey || 'role_viewer';
            const updated = await api.toggleRegistration(enabled, defaultRole);
            setData(updated);
            setSuccess(enabled ? t('registration_enabled') : t('registration_disabled'));
            setTimeout(() => setSuccess(null), 3000);
            
            // Dispatch custom event to notify Login component
            window.dispatchEvent(new CustomEvent('titan_registration_toggled', { 
                detail: { enabled } 
            }));
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to update registration settings');
        }
    };

    // Filter users
    const filteredUsers = data?.users.filter(user => {
        const matchesSearch = !searchQuery || 
            user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            user.email.toLowerCase().includes(searchQuery.toLowerCase());
        
        const matchesFilter = filterStatus === 'all' || user.status === filterStatus;
        
        return matchesSearch && matchesFilter;
    }) || [];

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

    const actionTypeColors: Record<UserActivity['actionType'], string> = {
        login: 'bg-blue-500/20 text-blue-400',
        trade: 'bg-green-500/20 text-green-400',
        settings: 'bg-purple-500/20 text-purple-400',
        user_management: 'bg-orange-500/20 text-orange-400',
        wallet: 'bg-yellow-500/20 text-yellow-400',
        analysis: 'bg-cyan-500/20 text-cyan-400',
        other: 'bg-gray-500/20 text-gray-400',
    };

    return (
        <div className="space-y-6">
            {/* Success/Error Messages */}
            {success && (
                <div className="bg-green-500/20 border border-green-500/50 rounded-lg p-4 text-green-300 text-sm">
                    {success}
                </div>
            )}
            {error && (
                <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-4 text-red-300 text-sm">
                    {error}
                </div>
            )}

            {/* Tabs */}
            <div className="bg-[#161B22] border border-gray-800 rounded-xl">
                <div className="flex border-b border-gray-800 overflow-x-auto">
                    <button
                        onClick={() => setActiveTab('users')}
                        className={`px-6 py-4 text-sm font-semibold transition-colors whitespace-nowrap ${
                            activeTab === 'users'
                                ? 'text-blue-400 border-b-2 border-blue-400'
                                : 'text-gray-400 hover:text-white'
                        }`}
                    >
                        {t('users')}
                    </button>
                    <button
                        onClick={() => setActiveTab('roles')}
                        className={`px-6 py-4 text-sm font-semibold transition-colors whitespace-nowrap ${
                            activeTab === 'roles'
                                ? 'text-blue-400 border-b-2 border-blue-400'
                                : 'text-gray-400 hover:text-white'
                        }`}
                    >
                        {t('roles')}
                    </button>
                    <button
                        onClick={() => setActiveTab('activities')}
                        className={`px-6 py-4 text-sm font-semibold transition-colors whitespace-nowrap ${
                            activeTab === 'activities'
                                ? 'text-blue-400 border-b-2 border-blue-400'
                                : 'text-gray-400 hover:text-white'
                        }`}
                    >
                        {t('activity_log')} ({activities.length})
                    </button>
                    <button
                        onClick={() => setActiveTab('settings')}
                        className={`px-6 py-4 text-sm font-semibold transition-colors whitespace-nowrap ${
                            activeTab === 'settings'
                                ? 'text-blue-400 border-b-2 border-blue-400'
                                : 'text-gray-400 hover:text-white'
                        }`}
                    >
                        {t('settings')}
                    </button>
                </div>

                {activeTab === 'users' ? (
                    <>
                        {/* Stats Overview */}
            <div className="bg-[#161B22] border border-gray-800 rounded-xl">
                <div className="p-6 border-b border-gray-800">
                    <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                        <div>
                            <h3 className="text-lg font-semibold text-white">{t('settings_users')}</h3>
                            <p className="text-sm text-gray-400">{t('user_management_overview')}</p>
                        </div>
                        <div className="flex flex-wrap gap-3 text-sm">
                                        <span className="px-3 py-1 rounded-full bg-blue-500/10 text-blue-300 font-semibold">
                                            {t('total_users', { count: data.users.length })}
                                        </span>
                                        <span className="px-3 py-1 rounded-full bg-green-500/10 text-green-300 font-semibold">
                                            {t('active_users', { count: data.users.filter(user => user.status === 'active').length })}
                                        </span>
                                        <span className="px-3 py-1 rounded-full bg-yellow-500/10 text-yellow-300 font-semibold">
                                            {t('pending_invites', { count: data.invitations.length })}
                                        </span>
                        </div>
                    </div>
                </div>

                            {/* Search and Filter */}
                            <div className="p-6 border-b border-gray-800 flex flex-col md:flex-row gap-4">
                                <div className="flex-1">
                                    <input
                                        type="text"
                                        placeholder={t('search_users')}
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        className="w-full p-2 bg-[#0D111C] border border-gray-700 rounded-md text-white"
                                    />
                                </div>
                                <select
                                    value={filterStatus}
                                    onChange={(e) => setFilterStatus(e.target.value as any)}
                                    className="p-2 bg-[#0D111C] border border-gray-700 rounded-md text-white"
                                >
                                    <option value="all">{t('all_statuses')}</option>
                                    <option value="active">{t('user_status_active')}</option>
                                    <option value="suspended">{t('user_status_suspended')}</option>
                                    <option value="invited">{t('user_status_invited')}</option>
                                </select>
                                <button
                                    onClick={() => setShowCreateUserModal(true)}
                                    className="bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-6 rounded-md"
                                >
                                    {t('create_user')}
                                </button>
                                <button
                                    onClick={() => setShowInviteModal(true)}
                                    className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-6 rounded-md"
                                >
                                    {t('invite_user')}
                                </button>
                                <button
                                    onClick={refresh}
                                    className="bg-gray-700 hover:bg-gray-600 text-white font-semibold py-2 px-4 rounded-md"
                                >
                                    {t('refresh')}
                                </button>
                            </div>

                            {/* Users Table */}
                <div className="p-6 overflow-x-auto">
                    <table className="w-full text-sm text-left text-gray-300">
                        <thead className="text-xs uppercase text-gray-400 border-b border-gray-800">
                            <tr>
                                <th className="px-6 py-3">{t('user')}</th>
                                <th className="px-6 py-3">{t('role')}</th>
                                <th className="px-6 py-3">{t('status')}</th>
                                <th className="px-6 py-3">{t('last_active')}</th>
                                            <th className="px-6 py-3">{t('2fa')}</th>
                                <th className="px-6 py-3 text-right">{t('action')}</th>
                            </tr>
                        </thead>
                        <tbody>
                                        {filteredUsers.length === 0 ? (
                                            <tr>
                                                <td colSpan={6} className="px-6 py-8 text-center text-gray-400">
                                                    {t('no_users_found')}
                                                </td>
                                            </tr>
                                        ) : (
                                            filteredUsers.map(user => (
                                                <tr key={user.id} className="border-b border-gray-900/60 last:border-b-0 hover:bg-gray-900/20">
                                    <td className="px-6 py-4">
                                        <div className="font-semibold text-white">{user.name}</div>
                                        <div className="text-xs text-gray-400">{user.email}</div>
                                        <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-gray-400">
                                                            {user.permissions.slice(0, 3).map(permission => (
                                                                <span key={permission} className="px-2 py-0.5 rounded-full bg-[#0d111c] border border-gray-700">
                                                                    {t(permission)}
                                                                </span>
                                                            ))}
                                                            {user.permissions.length > 3 && (
                                                                <span className="px-2 py-0.5 rounded-full bg-[#0d111c] border border-gray-700">
                                                                    +{user.permissions.length - 3}
                                                                </span>
                                                            )}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <select
                                            value={user.roleKey}
                                                            onChange={(event) => handleRoleChange(user.id, event.target.value)}
                                                            className="bg-[#0D111C] border border-gray-700 rounded-md px-2 py-1 text-sm text-white"
                                        >
                                            {data.availableRoles.map(role => (
                                                                <option key={role.roleKey} value={role.roleKey}>
                                                                    {t(role.roleKey)}
                                                                </option>
                                            ))}
                                        </select>
                                                        <p className="text-xs text-gray-500 mt-1">
                                                            {t(data.availableRoles.find(role => role.roleKey === user.roleKey)?.descriptionKey ?? '')}
                                                        </p>
                                    </td>
                                    <td className="px-6 py-4">
                                                        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${statusBadgeClasses[user.status]}`}>
                                                            {t(`user_status_${user.status}`)}
                                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-xs text-gray-400">
                                        {user.lastActiveAt ? new Date(user.lastActiveAt).toLocaleString() : t('never_logged_in')}
                                    </td>
                                                    <td className="px-6 py-4">
                                                        {user.twoFactorEnabled ? (
                                                            <span className="text-green-400 text-xs">✓ {t('enabled')}</span>
                                                        ) : (
                                                            <span className="text-gray-500 text-xs">✗ {t('disabled')}</span>
                                                        )}
                                                    </td>
                                    <td className="px-6 py-4 text-right space-x-3">
                                                        <button
                                                            className="text-green-400 hover:underline text-xs"
                                                            onClick={() => handleEditUser(user)}
                                                        >
                                                            {t('edit')}
                                                        </button>
                                                        <button
                                                            className="text-blue-400 hover:underline text-xs"
                                                            onClick={() => handleStatusToggle(user.id, user.status)}
                                                        >
                                            {user.status === 'active' ? t('suspend_user') : t('activate_user')}
                                        </button>
                                                        <button
                                                            className="text-red-400 hover:underline text-xs"
                                                            onClick={() => handleRemoveUser(user.id)}
                                                        >
                                            {t('remove_user')}
                                        </button>
                                    </td>
                                </tr>
                                            ))
                                        )}
                        </tbody>
                    </table>
                </div>
            </div>

                        {/* Invite Modal */}
                        {showInviteModal && (
                            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                                <div className="bg-[#161B22] border border-gray-800 rounded-xl p-6 max-w-md w-full mx-4">
                                    <h4 className="text-lg font-semibold text-white mb-4">{t('invite_user')}</h4>
                                    <div className="space-y-4">
                                        <div>
                        <label className="block text-sm text-gray-400 mb-1">{t('email_address')}</label>
                        <input
                            type="email"
                            value={inviteEmail}
                                                onChange={(event) => setInviteEmail(event.target.value)}
                            placeholder={t('invite_email_placeholder')}
                                                className="w-full p-2 bg-[#0D111C] border border-gray-700 rounded-md text-white"
                        />
                    </div>
                    <div>
                        <label className="block text-sm text-gray-400 mb-1">{t('role')}</label>
                        <select
                            value={inviteRole}
                                                onChange={(event) => setInviteRole(event.target.value)}
                                                className="w-full p-2 bg-[#0D111C] border border-gray-700 rounded-md text-white"
                        >
                            {data.availableRoles.map(role => (
                                                    <option key={role.roleKey} value={role.roleKey}>
                                                        {t(role.roleKey)}
                                                    </option>
                            ))}
                        </select>
                                            <p className="text-xs text-gray-500 mt-1">
                                                {t(data.availableRoles.find(role => role.roleKey === inviteRole)?.descriptionKey ?? '')}
                                            </p>
                    </div>
                                        <div className="flex gap-3">
                    <button
                        onClick={handleInvite}
                        disabled={isInviting || !inviteEmail}
                                                className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold py-2 px-6 rounded-md"
                    >
                        {isInviting ? t('sending') : t('send_invite')}
                    </button>
                                            <button
                                                onClick={() => {
                                                    setShowInviteModal(false);
                                                    setInviteEmail('');
                                                    setError(null);
                                                }}
                                                className="bg-gray-700 hover:bg-gray-600 text-white font-semibold py-2 px-6 rounded-md"
                                            >
                                                {t('cancel')}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Edit User Modal */}
                        {editingUser && (
                            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                                <div className="bg-[#161B22] border border-gray-800 rounded-xl p-6 max-w-md w-full mx-4">
                                    <h4 className="text-lg font-semibold text-white mb-4">{t('edit_user')}</h4>
                                    <div className="space-y-4">
                                        <div>
                                            <label className="block text-sm text-gray-400 mb-1">{t('full_name')}</label>
                                            <input
                                                type="text"
                                                value={editingUser.name}
                                                onChange={(e) => setEditingUser({ ...editingUser, name: e.target.value })}
                                                placeholder={t('enter_full_name')}
                                                className="w-full p-2 bg-[#0D111C] border border-gray-700 rounded-md text-white"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm text-gray-400 mb-1">{t('email_address')}</label>
                                            <input
                                                type="email"
                                                value={editingUser.email}
                                                onChange={(e) => setEditingUser({ ...editingUser, email: e.target.value })}
                                                placeholder={t('enter_email')}
                                                className="w-full p-2 bg-[#0D111C] border border-gray-700 rounded-md text-white"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm text-gray-400 mb-1">{t('role')}</label>
                                            <select
                                                value={editingUser.roleKey}
                                                onChange={(e) => setEditingUser({ ...editingUser, roleKey: e.target.value })}
                                                className="w-full p-2 bg-[#0D111C] border border-gray-700 rounded-md text-white"
                                            >
                                                {data?.availableRoles.map(role => (
                                                    <option key={role.roleKey} value={role.roleKey}>
                                                        {t(role.roleKey)}
                                                    </option>
                                                ))}
                                            </select>
                                            {editingUser.roleKey && (
                                                <p className="text-xs text-gray-500 mt-1">
                                                    {t(data?.availableRoles.find(role => role.roleKey === editingUser.roleKey)?.descriptionKey ?? '')}
                                                </p>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <input
                                                type="checkbox"
                                                id="editTwoFactor"
                                                checked={editingUser.twoFactorEnabled}
                                                onChange={(e) => setEditingUser({ ...editingUser, twoFactorEnabled: e.target.checked })}
                                                className="rounded"
                                            />
                                            <label htmlFor="editTwoFactor" className="text-sm text-gray-400">{t('enable_2fa')}</label>
                                        </div>
                                        <div className="flex gap-3">
                                            <button
                                                onClick={handleSaveEditUser}
                                                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-6 rounded-md"
                                            >
                                                {t('save')}
                                            </button>
                                            <button
                                                onClick={() => {
                                                    setEditingUser(null);
                                                    setError(null);
                                                }}
                                                className="bg-gray-700 hover:bg-gray-600 text-white font-semibold py-2 px-6 rounded-md"
                                            >
                                                {t('cancel')}
                                            </button>
                                        </div>
                                    </div>
                </div>
            </div>
                        )}

                        {/* Pending Invitations */}
            <div className="bg-[#161B22] border border-gray-800 rounded-xl p-6 space-y-4">
                <h4 className="text-lg font-semibold text-white">{t('pending_invitations')}</h4>
                {data.invitations.length === 0 ? (
                    <p className="text-sm text-gray-400">{t('no_invitations')}</p>
                ) : (
                    <ul className="space-y-3">
                        {data.invitations.map(invite => (
                                        <li key={invite.id} className="flex items-center justify-between text-sm p-3 bg-[#0D111C] rounded-lg border border-gray-800">
                                <div>
                                    <p className="font-semibold text-white">{invite.email}</p>
                                                <p className="text-xs text-gray-500">
                                                    {t(invite.roleKey)} • {t('invited_by', { name: invite.invitedBy })}
                                                </p>
                                                <p className="text-xs text-gray-500">
                                                    {t('invited_at', { time: new Date(invite.invitedAt).toLocaleString() })}
                                                </p>
                                </div>
                                            <div className="flex gap-2">
                                                <button
                                                    className="text-blue-400 hover:underline text-xs"
                                                    onClick={() => handleResendInvite(invite.id)}
                                                >
                                    {t('resend_invite')}
                                </button>
                                                <button
                                                    className="text-red-400 hover:underline text-xs"
                                                    onClick={() => handleCancelInvite(invite.id)}
                                                >
                                                    {t('cancel_invite')}
                                                </button>
                                            </div>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
                    </>
                ) : activeTab === 'roles' ? (
                    /* Roles Tab */
                    <div className="p-6 space-y-4">
                        <div className="flex justify-between items-center">
                            <h4 className="text-lg font-semibold text-white">{t('manage_roles')}</h4>
                            <button
                                onClick={() => setShowCreateRoleModal(true)}
                                className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-6 rounded-md"
                            >
                                {t('create_role')}
                            </button>
                        </div>
                        
                        {!data ? (
                            <div className="text-center py-8 text-gray-400">{t('loading')}</div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {data.availableRoles && data.availableRoles.length > 0 ? (
                                    data.availableRoles.map(role => {
                                        // Ensure permissions array exists
                                        const rolePermissions = role.permissions || [];
                                        
                                        return (
                                            <div key={role.roleKey} className="p-4 bg-[#0D111C] border border-gray-800 rounded-lg">
                                                <div className="flex justify-between items-start mb-2">
                                                    <div>
                                                        <h5 className="font-semibold text-white">{t(role.roleKey)}</h5>
                                                        <p className="text-xs text-gray-400">{t(role.descriptionKey || '')}</p>
                                                    </div>
                                                    {role.isCustom && (
                                                        <button
                                                            onClick={() => handleDeleteRole(role.roleKey)}
                                                            className="text-red-400 hover:text-red-300 text-xs"
                                                        >
                                                            {t('delete')}
                                                        </button>
                                                    )}
                                                </div>
                                                <div className="mt-3 space-y-1">
                                                    <p className="text-xs text-gray-500">{t('permissions')}:</p>
                                                    <div className="flex flex-wrap gap-1">
                                                        {rolePermissions.length > 0 ? (
                                                            <>
                                                                {rolePermissions.slice(0, 3).map(perm => (
                                                                    <span key={perm} className="px-2 py-0.5 rounded bg-gray-800 text-xs text-gray-300">
                                                                        {t(perm)}
                                                                    </span>
                                                                ))}
                                                                {rolePermissions.length > 3 && (
                                                                    <span className="px-2 py-0.5 rounded bg-gray-800 text-xs text-gray-300">
                                                                        +{rolePermissions.length - 3}
                                                                    </span>
                                                                )}
                                                            </>
                                                        ) : (
                                                            <span className="text-xs text-gray-500">{t('no_permissions')}</span>
                                                        )}
                                                    </div>
                                                </div>
                                                {role.isCustom && role.createdBy && (
                                                    <p className="text-xs text-gray-500 mt-2">
                                                        {t('created_by')}: {role.createdBy}
                                                    </p>
                                                )}
                                            </div>
                                        );
                                    })
                                ) : (
                                    <div className="col-span-full text-center py-8 text-gray-400">
                                        {t('no_roles_found')}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                ) : activeTab === 'settings' ? (
                    /* Settings Tab */
                    <div className="p-6 space-y-4">
                        <h4 className="text-lg font-semibold text-white">{t('registration_settings')}</h4>
                        
                        <div className="p-4 bg-[#0D111C] border border-gray-800 rounded-lg">
                            <div className="flex items-center justify-between mb-4">
                                <div>
                                    <h5 className="font-semibold text-white">{t('public_registration')}</h5>
                                    <p className="text-sm text-gray-400">{t('public_registration_desc')}</p>
                                </div>
                                <button
                                    onClick={() => handleToggleRegistration(!data?.registrationEnabled)}
                                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                                        data?.registrationEnabled ? 'bg-blue-600' : 'bg-gray-600'
                                    }`}
                                >
                                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                        data?.registrationEnabled ? 'translate-x-6' : 'translate-x-1'
                                    }`} />
                                </button>
                            </div>
                            
                            {data?.registrationEnabled && (
                                <div className="mt-4">
                                    <label className="block text-sm text-gray-400 mb-2">{t('default_role_for_registrations')}</label>
                                    <select
                                        value={data.registrationDefaultRole || data.defaultRoleKey}
                                        onChange={async (e) => {
                                            try {
                                                const updated = await api.toggleRegistration(true, e.target.value);
                                                setData(updated);
                                                // Dispatch custom event to notify Login component
                                                window.dispatchEvent(new CustomEvent('titan_registration_toggled', { 
                                                    detail: { enabled: true } 
                                                }));
                                            } catch (err) {
                                                setError(err instanceof Error ? err.message : 'Failed to update default role');
                                            }
                                        }}
                                        className="w-full p-2 bg-[#0D111C] border border-gray-700 rounded-md text-white"
                                    >
                                        {data.availableRoles.map(role => (
                                            <option key={role.roleKey} value={role.roleKey}>
                                                {t(role.roleKey)}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            )}
                        </div>
                    </div>
                ) : (
                    /* Activity Log Tab */
                    <div className="p-6 space-y-4">
                        {/* Filters */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                            <div>
                                <label className="block text-xs text-gray-400 mb-1">{t('search')}</label>
                                <input
                                    type="text"
                                    placeholder={t('search_activities')}
                                    value={activityFilters.searchQuery || ''}
                                    onChange={(e) => setActivityFilters({ ...activityFilters, searchQuery: e.target.value })}
                                    className="w-full p-2 bg-[#0D111C] border border-gray-700 rounded-md text-white text-sm"
                                />
                            </div>
                            <div>
                                <label className="block text-xs text-gray-400 mb-1">{t('user')}</label>
                                <select
                                    value={activityFilters.userId || ''}
                                    onChange={(e) => setActivityFilters({ ...activityFilters, userId: e.target.value || undefined })}
                                    className="w-full p-2 bg-[#0D111C] border border-gray-700 rounded-md text-white text-sm"
                                >
                                    <option value="">{t('all_users')}</option>
                                    {data?.users.map(user => (
                                        <option key={user.id} value={user.id}>{user.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs text-gray-400 mb-1">{t('action_type')}</label>
                                <select
                                    value={activityFilters.actionType || ''}
                                    onChange={(e) => setActivityFilters({ ...activityFilters, actionType: e.target.value as any || undefined })}
                                    className="w-full p-2 bg-[#0D111C] border border-gray-700 rounded-md text-white text-sm"
                                >
                                    <option value="">{t('all_types')}</option>
                                    <option value="login">{t('login')}</option>
                                    <option value="trade">{t('trade')}</option>
                                    <option value="settings">{t('settings')}</option>
                                    <option value="user_management">{t('user_management')}</option>
                                    <option value="wallet">{t('wallet')}</option>
                                    <option value="analysis">{t('analysis')}</option>
                                    <option value="other">{t('other')}</option>
                                </select>
                            </div>
                            <div className="flex items-end gap-2">
                                <button
                                    onClick={handleClearActivities}
                                    className="bg-red-600 hover:bg-red-700 text-white font-semibold py-2 px-4 rounded-md text-sm"
                                >
                                    {t('clear_filtered')}
                                </button>
                            </div>
                        </div>

                        {/* Activities List */}
                        {isLoadingActivities ? (
                            <div className="space-y-2">
                                {[1, 2, 3].map(i => (
                                    <Skeleton key={i} className="h-20 w-full" />
                                ))}
                            </div>
                        ) : activities.length === 0 ? (
                            <p className="text-sm text-gray-400 text-center py-8">{t('no_activities')}</p>
                        ) : (
                            <div className="space-y-2">
                                {activities.map(activity => (
                                    <div
                                        key={activity.id}
                                        className="p-4 bg-[#0D111C] border border-gray-800 rounded-lg hover:border-gray-700 transition-colors"
                                    >
                                        <div className="flex items-start justify-between">
                                            <div className="flex-1">
                                                <div className="flex items-center gap-2 mb-2">
                                                    <span className={`px-2 py-1 rounded text-xs font-semibold ${actionTypeColors[activity.actionType]}`}>
                                                        {t(activity.actionType)}
                                                    </span>
                                                    <span className="text-sm font-semibold text-white">{activity.userName}</span>
                                                    <span className="text-xs text-gray-400">{activity.userEmail}</span>
                                                    {activity.edited && (
                                                        <span className="text-xs text-yellow-400">({t('edited')})</span>
                                                    )}
                                                </div>
                                                <p className="text-sm text-gray-300 mb-1">{activity.description}</p>
                                                <div className="flex items-center gap-4 text-xs text-gray-500">
                                                    <span>{new Date(activity.timestamp).toLocaleString()}</span>
                                                    {activity.ipAddress && <span>IP: {activity.ipAddress}</span>}
                                                    {activity.edited && activity.editedBy && (
                                                        <span>{t('edited_by')}: {activity.editedBy}</span>
                                                    )}
                                                </div>
                                                {activity.originalDescription && activity.edited && (
                                                    <div className="mt-2 p-2 bg-gray-900/50 rounded text-xs text-gray-400">
                                                        <span className="font-semibold">{t('original')}:</span> {activity.originalDescription}
                                                    </div>
                                                )}
                                            </div>
                                            <div className="flex gap-2 ml-4">
                                                <button
                                                    onClick={() => handleEditActivity(activity)}
                                                    className="text-blue-400 hover:text-blue-300 text-xs"
                                                >
                                                    {t('edit')}
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteActivity(activity.id)}
                                                    className="text-red-400 hover:text-red-300 text-xs"
                                                >
                                                    {t('delete')}
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Create User Modal */}
            {showCreateUserModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-[#161B22] border border-gray-800 rounded-xl p-6 max-w-md w-full mx-4">
                        <h4 className="text-lg font-semibold text-white mb-4">{t('create_user')}</h4>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm text-gray-400 mb-1">{t('full_name')}</label>
                                <input
                                    type="text"
                                    value={newUser.name}
                                    onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                                    placeholder={t('enter_full_name')}
                                    className="w-full p-2 bg-[#0D111C] border border-gray-700 rounded-md text-white"
                                />
                            </div>
                            <div>
                                <label className="block text-sm text-gray-400 mb-1">{t('email_address')}</label>
                                <input
                                    type="email"
                                    value={newUser.email}
                                    onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                                    placeholder={t('enter_email')}
                                    className="w-full p-2 bg-[#0D111C] border border-gray-700 rounded-md text-white"
                                />
                            </div>
                            <div>
                                <label className="block text-sm text-gray-400 mb-1">{t('password')}</label>
                                <input
                                    type="password"
                                    value={newUser.password}
                                    onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                                    placeholder={t('enter_password')}
                                    className="w-full p-2 bg-[#0D111C] border border-gray-700 rounded-md text-white"
                                />
                                <p className="text-xs text-gray-500 mt-1">{t('password_min_length')}</p>
                            </div>
                            <div>
                                <label className="block text-sm text-gray-400 mb-1">{t('role')}</label>
                                <select
                                    value={newUser.roleKey}
                                    onChange={(e) => setNewUser({ ...newUser, roleKey: e.target.value })}
                                    className="w-full p-2 bg-[#0D111C] border border-gray-700 rounded-md text-white"
                                >
                                    <option value="">{t('select_role')}</option>
                                    {data?.availableRoles.map(role => (
                                        <option key={role.roleKey} value={role.roleKey}>
                                            {t(role.roleKey)}
                                        </option>
                                    ))}
                                </select>
                                {newUser.roleKey && (
                                    <p className="text-xs text-gray-500 mt-1">
                                        {t(data?.availableRoles.find(role => role.roleKey === newUser.roleKey)?.descriptionKey ?? '')}
                                    </p>
                                )}
                            </div>
                            <div className="flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    id="twoFactor"
                                    checked={newUser.twoFactorEnabled}
                                    onChange={(e) => setNewUser({ ...newUser, twoFactorEnabled: e.target.checked })}
                                    className="rounded"
                                />
                                <label htmlFor="twoFactor" className="text-sm text-gray-400">{t('enable_2fa')}</label>
                            </div>
                            <div className="flex gap-3">
                                <button
                                    onClick={handleCreateUser}
                                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-6 rounded-md"
                                >
                                    {t('create')}
                                </button>
                                <button
                                    onClick={() => {
                                        setShowCreateUserModal(false);
                                        setNewUser({ name: '', email: '', password: '', roleKey: '', twoFactorEnabled: false });
                                        setError(null);
                                    }}
                                    className="bg-gray-700 hover:bg-gray-600 text-white font-semibold py-2 px-6 rounded-md"
                                >
                                    {t('cancel')}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Create Role Modal */}
            {showCreateRoleModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-[#161B22] border border-gray-800 rounded-xl p-6 max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto">
                        <h4 className="text-lg font-semibold text-white mb-4">{t('create_role')}</h4>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm text-gray-400 mb-1">{t('role_key')} (e.g., role_custom)</label>
                                <input
                                    type="text"
                                    value={newRole.roleKey}
                                    onChange={(e) => setNewRole({ ...newRole, roleKey: e.target.value.toLowerCase().replace(/\s+/g, '_') })}
                                    placeholder="role_custom"
                                    className="w-full p-2 bg-[#0D111C] border border-gray-700 rounded-md text-white"
                                />
                            </div>
                            <div>
                                <label className="block text-sm text-gray-400 mb-1">{t('description')}</label>
                                <input
                                    type="text"
                                    value={newRole.descriptionKey}
                                    onChange={(e) => setNewRole({ ...newRole, descriptionKey: e.target.value })}
                                    placeholder="role_custom_desc"
                                    className="w-full p-2 bg-[#0D111C] border border-gray-700 rounded-md text-white"
                                />
                            </div>
                            <div>
                                <label className="block text-sm text-gray-400 mb-2">{t('permissions')}</label>
                                <div className="space-y-2 max-h-48 overflow-y-auto">
                                    {allPermissions.map(perm => (
                                        <label key={perm} className="flex items-center gap-2 text-sm text-gray-300">
                                            <input
                                                type="checkbox"
                                                checked={newRole.permissions.includes(perm)}
                                                onChange={(e) => {
                                                    if (e.target.checked) {
                                                        setNewRole({ ...newRole, permissions: [...newRole.permissions, perm] });
                                                    } else {
                                                        setNewRole({ ...newRole, permissions: newRole.permissions.filter(p => p !== perm) });
                                                    }
                                                }}
                                                className="rounded"
                                            />
                                            {t(perm)}
                                        </label>
                                    ))}
                                </div>
                            </div>
                            <div className="flex gap-3">
                                <button
                                    onClick={handleCreateRole}
                                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-6 rounded-md"
                                >
                                    {t('create')}
                                </button>
                                <button
                                    onClick={() => {
                                        setShowCreateRoleModal(false);
                                        setNewRole({ roleKey: '', descriptionKey: '', permissions: [] });
                                    }}
                                    className="bg-gray-700 hover:bg-gray-600 text-white font-semibold py-2 px-6 rounded-md"
                                >
                                    {t('cancel')}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Edit Activity Modal */}
            {editingActivity && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-[#161B22] border border-gray-800 rounded-xl p-6 max-w-md w-full mx-4">
                        <h4 className="text-lg font-semibold text-white mb-4">{t('edit_activity')}</h4>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm text-gray-400 mb-1">{t('description')}</label>
                                <textarea
                                    value={editDescription}
                                    onChange={(e) => setEditDescription(e.target.value)}
                                    rows={4}
                                    className="w-full p-2 bg-[#0D111C] border border-gray-700 rounded-md text-white"
                                />
                            </div>
                            <div className="flex gap-3">
                                <button
                                    onClick={handleSaveEdit}
                                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-6 rounded-md"
                                >
                                    {t('save')}
                                </button>
                                <button
                                    onClick={() => {
                                        setEditingActivity(null);
                                        setEditDescription('');
                                    }}
                                    className="bg-gray-700 hover:bg-gray-600 text-white font-semibold py-2 px-6 rounded-md"
                                >
                                    {t('cancel')}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default UsersSettings;