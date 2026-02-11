import { useState, useEffect, useMemo } from 'react';
import * as api from '../../../../../../services/api.ts';
import {
    ArtemisState,
    DataHubState,
    DataSource,
    DataCategory,
    DataPipelineSnapshot,
    DataNormalizationSummary,
    AIAgent,
} from '../../../../../../types.ts';
import {
    useDataHubQuery,
    useAgentsQuery,
    useUpdateSourceMutation,
    useCreateSourceMutation,
    useDeleteSourceMutation,
    useUpdateCategoryMutation,
    useCreateCategoryMutation,
    useDeleteCategoryMutation
} from '../../../../../../hooks/useDataHubState.ts';
import { useAsync } from '../../../../../../hooks/useAsync';
import { createTelegramDataSource, isChannelLinked, type TelegramChannel } from '../utils/telegramIntegration';
import { handleDataHubError, DataHubError, shouldNotifyUser } from '../utils/errorHandler';

export const useDataHub = (artemis: ArtemisState, onRefresh: () => void, t: (key: string) => string) => {
    // React Query Hooks
    const { data: dataHub, isLoading: isLoadingDataHub, error: dataHubErrorObj, refetch: loadDataHub } = useDataHubQuery();
    const { data: agentsData, isLoading: isLoadingAgentsQuery } = useAgentsQuery();

    const updateSourceMutation = useUpdateSourceMutation();
    const createSourceMutation = useCreateSourceMutation();
    const deleteSourceMutation = useDeleteSourceMutation();
    const updateCategoryMutation = useUpdateCategoryMutation();
    const createCategoryMutation = useCreateCategoryMutation();
    const deleteCategoryMutation = useDeleteCategoryMutation();

    // Local Selection & View State
    const [activeView, setActiveView] = useState<'sources' | 'categories' | 'pipeline' | 'health' | 'logs' | 'advanced' | 'telegram'>('sources');

    // Error State
    const [currentError, setCurrentError] = useState<DataHubError | null>(null);

    // Modals & Selection State
    const [showCreateSourceModal, setShowCreateSourceModal] = useState(false);
    const [editingSource, setEditingSource] = useState<DataSource | null>(null);
    const [showCreateCategoryModal, setShowCreateCategoryModal] = useState(false);
    const [editingCategory, setEditingCategory] = useState<DataCategory | null>(null);
    const [viewingSourceData, setViewingSourceData] = useState<DataSource | null>(null);

    // Pipeline State
    const [selectedSnapshotId, setSelectedSnapshotId] = useState<string | null>(null);

    const pipelineAsync = useAsync(api.fetchDataPipelineSnapshot);
    const healthAsync = useAsync(api.checkDataHubHealth);
    const logsAsync = useAsync(async () => {
        // Mocking log refresh for now as there's no direct API in the snippet,
        // but we keep the structure for standardization.
        await new Promise(resolve => setTimeout(resolve, 500));
        return api.fetchDataHubState();
    });

    // Derived State from Query
    const agents = agentsData || [];
    const isLoading = isLoadingDataHub;
    const isLoadingAgents = isLoadingAgentsQuery;
    const dataHubError = dataHubErrorObj instanceof Error ? dataHubErrorObj.message : null;

    // Error handler wrapper
    const handleError = (error: any, context: string, retryFn?: () => void) => {
        const parsedError = handleDataHubError(error, context, retryFn);
        if (shouldNotifyUser(parsedError.type)) {
            setCurrentError(parsedError);
        }
        return parsedError;
    };

    // Handlers
    const handleCheckHealth = async () => {
        try {
            setCurrentError(null);
            await healthAsync.execute();
        } catch (error) {
            handleError(error, 'Health Check', handleCheckHealth);
        }
    };

    const handleCreateSource = async (source: Omit<DataSource, 'id' | 'createdAt' | 'lastUpdate'>) => {
        try {
            setCurrentError(null);
            await createSourceMutation.mutateAsync(source);
            setShowCreateSourceModal(false);
        } catch (error) {
            handleError(error, 'Create Source', () => handleCreateSource(source));
        }
    };

    const handleUpdateSource = async (id: string, updates: Partial<DataSource>) => {
        try {
            setCurrentError(null);
            await updateSourceMutation.mutateAsync({ id, updates });
            setEditingSource(null);
        } catch (error) {
            handleError(error, 'Update Source', () => handleUpdateSource(id, updates));
        }
    };

    const handleDeleteSource = async (id: string) => {
        if (!window.confirm(t('confirm_delete_source') || 'Are you sure you want to delete this source?')) return;
        try {
            setCurrentError(null);
            await deleteSourceMutation.mutateAsync(id);
        } catch (error) {
            handleError(error, 'Delete Source', () => handleDeleteSource(id));
        }
    };

    const handleCreateCategory = async (category: Omit<DataCategory, 'id' | 'createdAt'>) => {
        try {
            setCurrentError(null);
            await createCategoryMutation.mutateAsync(category);
            setShowCreateCategoryModal(false);
        } catch (error) {
            handleError(error, 'Create Category', () => handleCreateCategory(category));
        }
    };

    const handleUpdateCategory = async (id: string, updates: Partial<DataCategory>) => {
        try {
            setCurrentError(null);
            await updateCategoryMutation.mutateAsync({ id, updates });
            setEditingCategory(null);
        } catch (error) {
            handleError(error, 'Update Category', () => handleUpdateCategory(id, updates));
        }
    };

    const handleDeleteCategory = async (id: string) => {
        if (!window.confirm(t('confirm_delete_category') || 'Are you sure you want to delete this category?')) return;
        try {
            setCurrentError(null);
            await deleteCategoryMutation.mutateAsync(id);
        } catch (error) {
            handleError(error, 'Delete Category', () => handleDeleteCategory(id));
        }
    };

    const handleCollectorHealth = async () => {
        setIsLoadingCollector(true);
        setCollectorError(null);
        try {
            const data = await api.getTelegramCollectorHealth();
            setCollectorMessage(`Collector Status: ${data.status}`);
        } catch (error: any) {
            setCollectorError(error?.message || 'Failed to connect to Telegram Collector');
        } finally {
            setIsLoadingCollector(false);
        }
    };

    const handleCollectorInputChange = (field: keyof typeof collectorForm, value: string) => {
        setCollectorForm(prev => ({ ...prev, [field]: value }));
    };

    const handleStartCollectorLogin = async () => {
        if (!collectorForm.phoneNumber.trim()) {
            setCollectorError('Phone number is required');
            return;
        }

        setIsLoadingCollector(true);
        setCollectorError(null);
        setCollectorMessage(null);
        try {
            const payload: any = {
                phoneNumber: collectorForm.phoneNumber.trim(),
            };
            if (collectorForm.apiId) {
                payload.apiId = Number(collectorForm.apiId);
            }
            if (collectorForm.apiHash) {
                payload.apiHash = collectorForm.apiHash.trim();
            }

            const response = await api.startTelegramCollectorLogin(payload);
            setCollectorAuthId(response.authId);
            setCollectorMessage('Verification code sent');
        } catch (error: any) {
            setCollectorError(error?.message || 'Failed to start login');
        } finally {
            setIsLoadingCollector(false);
        }
    };

    const handleConfirmCollectorLogin = async () => {
        if (!collectorAuthId) {
            setCollectorError('No active login request.');
            return;
        }
        if (!collectorForm.code.trim()) {
            setCollectorError('Verification code is required');
            return;
        }

        setIsLoadingCollector(true);
        setCollectorError(null);
        setCollectorMessage(null);
        try {
            await api.confirmTelegramCollectorLogin({
                authId: collectorAuthId,
                code: collectorForm.code.trim(),
                password: collectorForm.password.trim() || undefined,
            });
            setCollectorMessage('Login successful');
            setCollectorAuthId(null);
            setCollectorForm(prev => ({
                ...prev,
                code: '',
                password: '',
            }));
            await loadDataHub();
        } catch (error: any) {
            setCollectorError(error?.message || 'Verification failed');
        } finally {
            setIsLoadingCollector(false);
        }
    };

    const handleCancelCollectorLogin = async () => {
        setIsLoadingCollector(true);
        try {
            if (collectorAuthId) {
                await api.cancelTelegramCollectorLogin(collectorAuthId);
            }
            setCollectorAuthId(null);
            setCollectorForm(prev => ({
                ...prev,
                code: '',
                password: '',
            }));
            setCollectorMessage('Login cancelled');
        } catch (error: any) {
            console.error('Failed to cancel login:', error);
            setCollectorError(error?.message || 'Failed to cancel login');
        } finally {
            setIsLoadingCollector(false);
        }
    };

    const handleRefreshCollectorChannels = async () => {
        setIsRefreshingChannels(true);
        try {
            const response = await fetch(`${telegramCollectorUrl}/channels/refresh`, { method: 'POST' });
            const data = await response.json();
            if (data.success) {
                setCollectorMessage('Channels refreshed');
            } else {
                setCollectorError(data.error || 'Failed to refresh channels');
            }
        } catch (error) {
            setCollectorError('Connection error');
        } finally {
            setIsRefreshingChannels(false);
        }
    };

    const handleLinkChannelToSource = async (channelId: string, sourceId?: string) => {
        try {
            setCollectorMessage(null);
            setCollectorError(null);

            // Find the channel info from telegramCollectorState
            const channel = telegramCollectorState?.channels?.find(ch => ch.id === channelId);
            
            if (!channel) {
                setCollectorError('Channel not found');
                return;
            }

            // Check if already linked
            const existingSources = dataHub?.sources || [];
            if (isChannelLinked(channelId, existingSources)) {
                setCollectorMessage(`Channel "${channel.title}" is already linked as a data source`);
                return;
            }

            // Create the Telegram channel object
            const telegramChannel: TelegramChannel = {
                id: channel.id,
                title: channel.title,
                username: channel.username
            };

            // Create data source
            setCollectorMessage('Creating data source...');
            const createdSource = await createTelegramDataSource({
                channel: telegramChannel,
                refreshInterval: 5, // 5 minutes
                priority: 'medium',
                config: {
                    fetchLimit: 50,
                    includeMedia: true,
                    parseUrls: true,
                    tags: ['telegram', 'news', channel.title.toLowerCase().replace(/\s+/g, '-')]
                }
            });

            setCollectorMessage(`✅ Successfully linked channel "${channel.title}" as data source!`);
            
            // Refresh data hub to show new source
            await loadDataHub();
            
            console.log('✅ Telegram channel linked:', createdSource);
        } catch (error) {
            console.error('❌ Failed to link channel:', error);
            setCollectorError(error instanceof Error ? error.message : 'Failed to link channel to data source');
        }
    };

    const handleTestCollectorChannel = async (channelId: string) => {
        setTestingChannelId(channelId);
        setChannelTestPreview(null);
        try {
            const response = await fetch(`${telegramCollectorUrl}/channels/test/${channelId}`);
            const data = await response.json();
            if (data.success) {
                setChannelTestPreview(data.messages);
            } else {
                setCollectorError(data.error || 'Channel test failed');
            }
        } catch (error) {
            setCollectorError('Connection error');
        } finally {
            setTestingChannelId(null);
        }
    };

    const handleTestSource = async (sourceId: string) => {
        try {
            const result = await api.testDataSourceConnection(sourceId);
            if (result.success) {
                alert(t('connection_test_success') || 'Connection test successful!');
            } else {
                alert(`${t('connection_test_failed') || 'Connection test failed:'} ${result.message}`);
            }
        } catch (e) {
            alert(t('connection_test_error') || 'An error occurred during connection test');
        }
    };

    const handleRefreshPipelineSnapshot = async () => {
        try {
            await pipelineAsync.execute();
        } catch (error) {
            console.error('Failed to refresh pipeline:', error);
        }
    };

    // Utils
    const formatTimeAgo = (timestamp?: string): string => {
        if (!timestamp) return t('never') || 'never';
        const date = new Date(timestamp);
        const now = new Date();
        const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

        if (diffInSeconds < 60) return `${diffInSeconds}s ago`;
        if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
        if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
        return `${Math.floor(diffInSeconds / 86400)}d ago`;
    };

    const downloadCSV = (data: any[], filename: string) => {
        if (!data || data.length === 0) return;
        const headers = Object.keys(data[0]);
        const csvContent = [
            headers.join(','),
            ...data.map(row => headers.map(header => JSON.stringify(row[header])).join(','))
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', filename);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const categoryMetricsById = useMemo(() => {
        if (!dataHub || !dataHub.pipelineSnapshot) return {};
        const metrics: Record<string, { inflow: number; passRate: number }> = {};
        dataHub.pipelineSnapshot.categories.forEach(cat => {
            metrics[cat.categoryId] = {
                inflow: cat.inflow,
                passRate: cat.passRate
            };
        });
        return metrics;
    }, [dataHub]);

    const logStatusCounts = useMemo(() => {
        if (!dataHub) return { success: 0, error: 0, warning: 0 };
        return dataHub.accessLogs.reduce((acc, log) => {
            const status = log.status.toLowerCase();
            if (status.includes('success') || status === 'ok' || status === '200') acc.success++;
            else if (status.includes('error') || status.includes('fail') || status === '500') acc.error++;
            else acc.warning++;
            return acc;
        }, { success: 0, error: 0, warning: 0 });
    }, [dataHub]);

    const combinedCollectorHealth = useMemo(() => {
        if (!dataHub || !dataHub.telegramCollector) return 'unknown';
        return dataHub.telegramCollector.status === 'online' ? 'healthy' : 'degraded';
    }, [dataHub]);

    const [isLoadingCollector, setIsLoadingCollector] = useState(false);
    const [collectorMessage, setCollectorMessage] = useState<string | null>(null);
    const [collectorError, setCollectorError] = useState<string | null>(null);

    const [collectorForm, setCollectorForm] = useState({
        apiId: '',
        apiHash: '',
        phoneNumber: '',
        code: '',
        password: ''
    });
    const [collectorAuthId, setCollectorAuthId] = useState<string | null>(null);
    const [testingChannelId, setTestingChannelId] = useState<string | null>(null);
    const [channelTestPreview, setChannelTestPreview] = useState<any[] | null>(null);
    const [isRefreshingChannels, setIsRefreshingChannels] = useState(false);

    const telegramCollectorUrl = api.getTelegramCollectorBaseUrl();

    return {
        dataHub,
        isLoading,
        dataHubError,
        currentError,
        clearError: () => setCurrentError(null),
        activeView,
        setActiveView,
        showCreateSourceModal,
        setShowCreateSourceModal,
        editingSource,
        setEditingSource,
        showCreateCategoryModal,
        setShowCreateCategoryModal,
        editingCategory,
        setEditingCategory,
        viewingSourceData,
        setViewingSourceData,
        selectedSnapshotId,
        setSelectedSnapshotId,
        isLoadingPipeline: pipelineAsync.isLoading,
        pipelineError: pipelineAsync.error,
        setPipelineError: pipelineAsync.setError,
        agents,
        isLoadingAgents,
        isLoadingCollector,
        collectorError,
        setCollectorError,
        collectorMessage,
        setCollectorMessage,
        categoriesError: null, // Categories use mutation error usually
        setCategoriesError: () => { },
        healthError: healthAsync.error,
        setHealthError: healthAsync.setError,
        logsError: logsAsync.error,
        setLogsError: logsAsync.setError,
        isLoadingHealth: healthAsync.isLoading,
        isLoadingLogs: logsAsync.isLoading,
        collectorForm,
        collectorAuthId,
        testingChannelId,
        channelTestPreview,
        isRefreshingChannels,
        telegramCollectorUrl,
        handleCheckHealth: async () => {
            setIsLoadingHealth(true);
            setHealthError(null);
            try {
                await handleCheckHealth();
            } catch (err: any) {
                setHealthError(err.message || 'Failed to check health');
                throw err;
            } finally {
                setIsLoadingHealth(false);
            }
        },
        handleCollectorHealth,
        handleCollectorInputChange,
        handleStartCollectorLogin,
        handleConfirmCollectorLogin,
        handleCancelCollectorLogin,
        handleRefreshCollectorChannels,
        handleLinkChannelToSource,
        handleTestCollectorChannel,
        handleTestSource,
        handleRefreshPipelineSnapshot,
        formatTimeAgo,
        downloadCSV,
        categoryMetricsById,
        logStatusCounts,
        combinedCollectorHealth,
        onRefresh,
        handleCreateSource,
        handleUpdateSource,
        handleDeleteSource,
        handleCreateCategory,
        handleUpdateCategory,
        handleDeleteCategory,
    };
};
