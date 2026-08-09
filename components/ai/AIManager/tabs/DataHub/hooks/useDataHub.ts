import { useState, useEffect, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { DATA_HUB_KEYS } from '../../../../../../hooks/useDataHubState.ts';
import * as api from '../../../../../../services/api.ts';
import { getCollectorAuthHeaders } from '../../../../../../services/collectorAuth.ts';
import {
    formatCollectorSafeError,
    containsRawHtmlError,
    type CollectorSafeError,
    type DiagnoseCollectorCheck,
} from '../../../../../../services/telegramCollectorErrors.ts';
import { formatDiagnoseSummary } from '../telegram/telegramCollectorLabels';
import {
    ArtemisState,
    DataHubState,
    DataSource,
    DataCategory,
    AIAgent,
} from '../../../../../../types.ts';
import {
    useDataHubQuery,
    useDataSourcesQuery,
    useDataCategoriesQuery,
    useAgentsQuery,
    useUpdateSourceMutation,
    useCreateSourceMutation,
    useDeleteSourceMutation,
    useRestoreSourceMutation,
    useUpdateCategoryMutation,
    useCreateCategoryMutation,
    useDeleteCategoryMutation,
    usePipelineQuery,
    usePipelineBacklogQuery,
    usePipelineNormalizationSummaryQuery,
    usePipelineCapacityQuery,
    useAccessLogsQuery,
} from '../../../../../../hooks/useDataHubState.ts';
import { DataHubApiError } from '../../../../../../services/dataSourcesApi.ts';
import { useAsync } from '../../../../../../hooks/useAsync';
import { createTelegramDataSource, isChannelLinked, type TelegramChannel } from '../utils/telegramIntegration';
import { fetchPipelineNormalizationSummary } from '../../../../../../services/dataPipelineApi.ts';
import { handleDataHubError, DataHubError, shouldNotifyUser } from '../utils/errorHandler';

export const useDataHub = (_artemis: ArtemisState | null | undefined, onRefresh: () => void, t: (key: string) => string) => {
    const queryClient = useQueryClient();
    // React Query Hooks
    const { data: dataHub, isLoading: isLoadingDataHub, error: dataHubErrorObj, refetch: loadDataHub } = useDataHubQuery();
    const [sourcesPage, setSourcesPage] = useState(1);
    const sourcesLimit = 20;
    const {
        data: sourcesResult,
        isLoading: isLoadingSources,
        error: sourcesErrorObj,
        refetch: refetchSources,
        isFetching: isFetchingSources,
    } = useDataSourcesQuery({ page: sourcesPage, limit: sourcesLimit });
    const {
        data: categoriesResult,
        isLoading: isLoadingCategories,
        error: categoriesErrorObj,
        refetch: refetchCategories,
        isFetching: isFetchingCategories,
    } = useDataCategoriesQuery();
    const { data: agentsData, isLoading: isLoadingAgentsQuery } = useAgentsQuery();

    const updateSourceMutation = useUpdateSourceMutation();
    const restoreSourceMutation = useRestoreSourceMutation();
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
    const [selectedSnapshotId, setSelectedSnapshotId] = useState<string>('latest');

    const pipelineEnabled = activeView === 'pipeline';
    const {
        data: pipelineView,
        isLoading: isLoadingPipeline,
        error: pipelineErrorObj,
        refetch: refetchPipeline,
        isFetching: isFetchingPipeline,
    } = usePipelineQuery({ enabled: pipelineEnabled });
    const pipelineMainReady = pipelineEnabled && Boolean(pipelineView?.snapshot);
    const {
        data: pipelineBacklog,
        isLoading: isLoadingPipelineBacklog,
        isFetching: isFetchingPipelineBacklog,
        error: pipelineBacklogErrorObj,
        refetch: refetchPipelineBacklog,
    } = usePipelineBacklogQuery({ enabled: pipelineMainReady });
    const {
        data: pipelineNormalizationSummary,
        isLoading: isLoadingPipelineNormalization,
        isFetching: isFetchingPipelineNormalization,
        error: pipelineNormalizationErrorObj,
        refetch: refetchPipelineNormalization,
    } = usePipelineNormalizationSummaryQuery({ enabled: pipelineMainReady });
    const {
        data: pipelineCapacity,
        isLoading: isLoadingPipelineCapacity,
        isFetching: isFetchingPipelineCapacity,
        error: pipelineCapacityErrorObj,
        refetch: refetchPipelineCapacity,
    } = usePipelineCapacityQuery({ enabled: pipelineMainReady });
    const logsEnabled = activeView === 'logs';
    const {
        data: accessLogsResult,
        isLoading: isLoadingLogs,
        error: accessLogsErrorObj,
        refetch: refetchAccessLogs,
        isFetching: isFetchingAccessLogs,
    } = useAccessLogsQuery({ enabled: logsEnabled });

    const mergedDataHub = useMemo((): DataHubState | null => {
        if (!dataHub) return null;
        // Leak guard: do not present local IndexedDB fallback as implemented backend data.
        const sources = sourcesResult?.data ?? [];
        const categoriesBase = categoriesResult ?? [];
        const categories = api.enrichCategoriesWithSourceCounts(categoriesBase, sources);
        const backendSourcesReady = Array.isArray(sourcesResult?.data);
        return {
            ...dataHub,
            sources,
            categories,
            // Treat collector snapshot as non-authoritative when backend sources are unavailable.
            telegramCollector: backendSourcesReady ? dataHub.telegramCollector : null,
        };
    }, [dataHub, sourcesResult, categoriesResult]);

    const sourcesPagination = sourcesResult?.pagination;
    const sourcesApiError = sourcesErrorObj instanceof DataHubApiError
        ? sourcesErrorObj
        : sourcesErrorObj instanceof Error
          ? sourcesErrorObj
          : null;

    const categoriesApiError = categoriesErrorObj instanceof DataHubApiError
        ? categoriesErrorObj
        : categoriesErrorObj instanceof Error
          ? categoriesErrorObj
          : null;

    // Derived State from Query
    const agents = agentsData || [];
    const isLoading = isLoadingDataHub || isLoadingSources || isLoadingCategories;
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

    // -------------------------------------------------------------------------
    // Real-time-ish Telegram Collector auto-refresh
    // -------------------------------------------------------------------------
    //
    // برای اینکه کارت‌های Telegram Collector (status, tracked channels, latency, errors)
    // همیشه تا حد ممکن نزدیک به وضعیت واقعی باشند، به جای تکیه صرف روی snapshot
    // ذخیره‌شده در IndexedDB، در زمان باز بودن تب DataHub به‌صورت دوره‌ای:
    //   1) از سرویس telegram-collector، لیست کانال‌ها و health را می‌گیریم
    //   2) state محلی DataHub را با refreshTelegramCollectorChannels به‌روزرسانی می‌کنیم
    //   3) React Query را با loadDataHub() ریفرش می‌کنیم تا UI به‌روز شود
    //
    // این کار فقط وقتی DataHub mount است انجام می‌شود و در cleanup متوقف می‌شود.
    // همچنین اگر tab مخفی شود (visibility: hidden)، interval متوقف و با بازگشت دوباره شروع می‌شود.
    useEffect(() => {
        let cancelled = false;
        let timer: number | undefined;

        const intervalMs = 30_000; // هر ۳۰ ثانیه یک‌بار

        const tick = async () => {
            if (cancelled) return;
            // اگر tab مخفی است، refresh نکن (بهینه‌سازی)
            if (typeof document !== 'undefined' && document.hidden) {
                if (!cancelled) {
                    timer = window.setTimeout(tick, intervalMs);
                }
                return;
            }
            try {
                // این تابع از telegram-collector می‌خواند و DataHubState محلی را به‌روزرسانی می‌کند
                await api.refreshTelegramCollectorChannels();
                // React Query cache → دوباره از IndexedDB بخواند و telegramCollectorState را به‌روز کند
                await loadDataHub();
            } catch {
                // در صورت خطا (مثلاً collector down است) بی‌سروصدا رد می‌شویم
            } finally {
                if (!cancelled) {
                    timer = window.setTimeout(tick, intervalMs);
                }
            }
        };

        // اولین اجرا را با کمی تأخیر آغاز می‌کنیم تا initial load تمام شود
        timer = window.setTimeout(tick, intervalMs);

        return () => {
            cancelled = true;
            if (timer) {
                window.clearTimeout(timer);
            }
        };
        // فقط به loadDataHub وابسته است تا refetch همیشه تابع فعلی را استفاده کند
    }, [loadDataHub]);

    // Handlers
    const handleCreateSource = async (
        source: Omit<DataSource, 'id' | 'createdAt' | 'lastUpdate'>,
        options?: { allowDuplicateUrl?: boolean },
    ) => {
        try {
            setCurrentError(null);
            await createSourceMutation.mutateAsync({ source, allowDuplicateUrl: options?.allowDuplicateUrl });
            setShowCreateSourceModal(false);
        } catch (error) {
            handleError(error, 'Create Source', () => handleCreateSource(source));
        }
    };

    const handleUpdateSource = async (
        id: string,
        updates: Partial<DataSource>,
        options?: { allowDuplicateUrl?: boolean },
    ) => {
        try {
            setCurrentError(null);
            await updateSourceMutation.mutateAsync({
                id,
                updates,
                allowDuplicateUrl: options?.allowDuplicateUrl,
            });
            setEditingSource(null);
        } catch (error) {
            handleError(error, 'Update Source', () => handleUpdateSource(id, updates));
        }
    };

    const handleDeleteSource = async (id: string, hard = false) => {
        if (!window.confirm(t('confirm_delete_source') || 'Are you sure you want to delete this source?')) return;
        try {
            setCurrentError(null);
            await deleteSourceMutation.mutateAsync({ id, hard });
        } catch (error) {
            handleError(error, 'Delete Source', () => handleDeleteSource(id, hard));
        }
    };

    const handleRestoreSource = async (id: string) => {
        try {
            setCurrentError(null);
            await restoreSourceMutation.mutateAsync(id);
        } catch (error) {
            handleError(error, 'Restore Source', () => handleRestoreSource(id));
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

    const resolveCollectorMessage = (error: unknown, fallbackKey: string): string => {
        const err = error as Error & { collectorError?: CollectorSafeError };
        if (err?.collectorError) {
            return formatCollectorSafeError(err.collectorError, t);
        }
        const raw = err?.message || t(fallbackKey) || fallbackKey;
        if (containsRawHtmlError(raw)) {
            return t('collector_proxy_unreachable') || 'Telegram Collector proxy is unreachable.';
        }
        return t(raw) || raw;
    };

    const handleCollectorHealth = async () => {
        setIsLoadingCollector(true);
        setCollectorError(null);
        try {
            const data = await api.getTelegramCollectorHealth();
            setCollectorMessage(`Collector Status: ${data.status ?? 'ok'}`);
        } catch (error: unknown) {
            setCollectorError(resolveCollectorMessage(error, 'collector_connect_failed'));
        } finally {
            setIsLoadingCollector(false);
        }
    };

    const handleDiagnoseCollector = async () => {
        setIsLoadingCollector(true);
        setCollectorError(null);
        setDiagnoseChecks(null);
        try {
            const result = await api.diagnoseTelegramCollector();
            setDiagnoseChecks(result.checks);
            const summary = formatDiagnoseSummary(result.checks, t);
            if (result.ok) {
                setCollectorMessage(
                    `${t('collector_diag_all_good') || 'All Telegram Collector endpoints are reachable.'} ${summary}`,
                );
            } else {
                setCollectorError(
                    `${t('collector_diag_has_issues') || 'Some Telegram Collector endpoints are not accessible.'} ${summary}`,
                );
            }
        } catch (e: unknown) {
            console.error('Failed to diagnose collector:', e);
            setCollectorError(resolveCollectorMessage(e, 'collector_diag_failed'));
        } finally {
            setIsLoadingCollector(false);
        }
    };

    const handleCollectorInputChange = (field: keyof typeof collectorForm, value: string) => {
        setCollectorForm(prev => ({ ...prev, [field]: value }));
    };

    const [collectorCooldownUntil, setCollectorCooldownUntil] = useState<number | null>(null);

    const collectorCooldownSeconds = useMemo(() => {
        if (!collectorCooldownUntil) return 0;
        const diff = collectorCooldownUntil - Date.now();
        return diff > 0 ? Math.ceil(diff / 1000) : 0;
    }, [collectorCooldownUntil]);

    const handleStartCollectorLogin = async () => {
        if (collectorCooldownUntil && Date.now() < collectorCooldownUntil) {
            const seconds = Math.ceil((collectorCooldownUntil - Date.now()) / 1000);
            setCollectorError(
                t('telegram_cooldown_wait') ||
                    `Please wait ${seconds} seconds before requesting a new code.`,
            );
            return;
        }
        if (!collectorForm.phoneNumber.trim()) {
            setCollectorError(t('phone_number_required') || 'Phone number is required');
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
            setCollectorMessage(t('verification_code_sent') || 'Verification code sent');

            // اگر بک‌اند FloodWait بدهد و پیغام شامل تعداد ثانیه باشد، از همان استفاده می‌کنیم
            if (typeof response.retry_after_seconds === 'number' && response.retry_after_seconds > 0) {
                setCollectorCooldownUntil(Date.now() + response.retry_after_seconds * 1000);
            } else {
                // Simple client-side cooldown to reduce flood risk (15 minutes)
                setCollectorCooldownUntil(Date.now() + 15 * 60 * 1000);
            }
        } catch (error: any) {
            const message = error?.message || '';
            // نگاشت خطاهای رایج تلگرام به پیام‌های کاربرپسند
            if (message.includes('FLOOD') || message.includes('Flood') || message.includes('FLOOD_WAIT')) {
                setCollectorError(
                    t('telegram_error_flood_wait') ||
                        'Telegram has restricted login attempts for this account. Please try again later.',
                );
                // تلاش برای استخراج مدت انتظار تقریبی از متن خطا
                const match = message.match(/(\d+)\s*seconds?/i);
                if (match) {
                    const seconds = Number(match[1]);
                    if (!Number.isNaN(seconds) && seconds > 0) {
                        setCollectorCooldownUntil(Date.now() + seconds * 1000);
                    }
                }
            } else if (message.includes('PHONE_NUMBER_INVALID')) {
                setCollectorError(
                    t('telegram_error_phone_invalid') ||
                        'The phone number is not valid. Please double-check and try again.',
                );
            } else {
                setCollectorError(message || (t('telegram_login_start_failed') || 'Failed to start login'));
            }
        } finally {
            setIsLoadingCollector(false);
        }
    };

    const handleConfirmCollectorLogin = async () => {
        if (!collectorAuthId) {
            setCollectorError(t('telegram_error_no_active_login') || 'No active login request.');
            return;
        }
        if (!collectorForm.code.trim()) {
            setCollectorError(
                t('telegram_error_code_required') || 'Verification code is required',
            );
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
            setCollectorMessage(t('telegram_login_success') || 'Login successful');
            setCollectorAuthId(null);
            setCollectorForm(prev => ({
                ...prev,
                code: '',
                password: '',
            }));
            // بعد از لاگین موفق، وضعیت Data Hub (از جمله لیست اکانت‌ها) را رفرش می‌کنیم
            await loadDataHub();
            setAccountsRefreshTrigger((prev) => prev + 1);
        } catch (error: any) {
            const message = error?.message || '';
            if (message.includes('PHONE_CODE_INVALID')) {
                setCollectorError(
                    t('telegram_error_code_invalid') ||
                        'The verification code is invalid. Please check and try again.',
                );
            } else if (message.includes('PHONE_CODE_EXPIRED')) {
                setCollectorError(
                    t('telegram_error_code_expired') ||
                        'The verification code has expired. Please request a new code.',
                );
            } else if (message.includes('SESSION_PASSWORD_NEEDED')) {
                setCollectorError(
                    t('telegram_error_password_required') ||
                        'Two-factor password is required for this account.',
                );
            } else if (message.includes('FLOOD') || message.includes('FLOOD_WAIT')) {
                setCollectorError(
                    t('telegram_error_flood_wait') ||
                        'Telegram has restricted login attempts for this account. Please try again later.',
                );
            } else {
                setCollectorError(
                    message || (t('telegram_login_confirm_failed') || 'Verification failed'),
                );
            }
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
            setCollectorMessage(t('login_cancelled') || 'Login cancelled');
        } catch (error: any) {
            console.error('Failed to cancel login:', error);
            setCollectorError(error?.message || (t('login_cancel_failed') || 'Failed to cancel login'));
        } finally {
            setIsLoadingCollector(false);
        }
    };

    const handleRefreshCollectorChannels = async () => {
        setIsRefreshingChannels(true);
        setCollectorError(null);
        try {
            const url = api.buildCollectorUrl('/api/telegram-collector/channels/refresh');
            const response = await fetch(url, {
                method: 'POST',
                credentials: 'include',
                headers: getCollectorAuthHeaders(),
            });
            const data = await response.json();
            if (data.success) {
                const refreshed = data.refreshed ?? 0;
                setCollectorMessage(
                    `${t('channels_refreshed') || 'Channels refreshed'} (${refreshed} ${t('updated') || 'updated'})`,
                );
                setChannelsRefreshTrigger((n) => n + 1);
                await loadDataHub();
            } else {
                setCollectorError(data.error || (t('channels_refresh_failed') || 'Failed to refresh channels'));
            }
        } catch (error) {
            setCollectorError(t('connection_error') || 'Connection error');
        } finally {
            setIsRefreshingChannels(false);
        }
    };

    const handleLinkChannelToSource = async (channelId: string, sourceId?: string, channelInfo?: { id: string; title?: string | null; username?: string | null }) => {
        try {
            setCollectorMessage(null);
            setCollectorError(null);

            // Prefer channelInfo from collector table; fallback to telegramCollectorState
            const channel = channelInfo
                ? { id: channelInfo.id, title: channelInfo.title ?? '', username: channelInfo.username }
                : telegramCollectorState?.channels?.find(ch => ch.id === channelId);

            if (!channel) {
                setCollectorError(t('channel_not_found') || 'Channel not found');
                return;
            }

            const displayTitle = channel.title || channel.username || channelId;

            // Check if already linked
            const existingSources = dataHub?.sources || [];
            if (isChannelLinked(channelId, existingSources)) {
                setCollectorMessage((t('channel_already_linked') || 'Channel is already linked as a data source').replace('{title}', displayTitle));
                return;
            }

            // Create the Telegram channel object
            const telegramChannel: TelegramChannel = {
                id: channel.id,
                title: channel.title || channelId,
                username: channel.username
            };

            // Create data source
            setCollectorMessage(t('creating_data_source') || 'Creating data source...');
            const createdSource = await createTelegramDataSource({
                channel: telegramChannel,
                refreshInterval: 5, // 5 minutes
                priority: 'medium',
                config: {
                    fetchLimit: 50,
                    includeMedia: true,
                    parseUrls: true,
                    tags: ['telegram', 'news', (channel.title || '').toLowerCase().replace(/\s+/g, '-')]
                }
            });

            setCollectorMessage((t('successfully_linked_channel') || 'Successfully linked channel as data source!').replace('{title}', displayTitle));
            
            // Refresh data hub to show new source
            await loadDataHub();
            
            console.log('✅ Telegram channel linked:', createdSource);
        } catch (error) {
            console.error('❌ Failed to link channel:', error);
            setCollectorError(error instanceof Error ? error.message : (t('failed_to_link_channel') || 'Failed to link channel to data source'));
        }
    };

    const handleTestCollectorChannel = async (channelId: string) => {
        setTestingChannelId(channelId);
        setChannelTestPreview(null);
        try {
            const url = api.buildCollectorUrl(`/api/telegram-collector/channels/${channelId}/test`);
            const response = await fetch(url, {
                method: 'POST',
                credentials: 'include',
                headers: getCollectorAuthHeaders(),
            });
            const data = await response.json();
            if (!response.ok) {
                setCollectorError(data?.error || data?.message || (t('channel_test_failed') || 'Channel test failed'));
                return;
            }
            if (data.success) {
                // Backend returns { success, channelId, channelHandle, latency, messages (count), accessible }
                const preview = Array.isArray(data.messages) ? data.messages : [{
                    text: `Latency: ${data.latency ?? '-'} ms | Accessible: ${data.accessible ? 'Yes' : 'No'} | Messages: ${data.messages ?? 0}`,
                }];
                setChannelTestPreview(preview);
            } else {
                setCollectorError(data?.error || (t('channel_test_failed') || 'Channel test failed'));
            }
        } catch (error) {
            setCollectorError(t('connection_error') || 'Connection error');
        } finally {
            setTestingChannelId(null);
        }
    };

    const handleTestSource = async (sourceId: string) => {
        try {
            const result = await api.testDataSourceConnection(sourceId);
            if (result.success) {
                alert(result.message || t('connection_test_success') || 'Connection test successful!');
            } else {
                alert(`${t('connection_test_failed') || 'Connection test failed:'} ${result.message}`);
            }
        } catch (e: any) {
            const parsed = handleError(e, 'Test Connection');
            alert(parsed.userMessage);
        }
    };

    const handleRefreshPipelineSnapshot = async () => {
        try {
            await refetchPipeline();
            if (pipelineMainReady) {
                await Promise.all([
                    refetchPipelineBacklog(),
                    refetchPipelineNormalization(),
                    refetchPipelineCapacity(),
                ]);
            }
        } catch (error) {
            console.error('Failed to refresh pipeline:', error);
        }
    };

    const pipelineSnapshotBase = pipelineView?.snapshot;
    const pipelineSnapshot = useMemo(() => {
        if (!pipelineSnapshotBase) return undefined;
        if (!pipelineBacklog) return pipelineSnapshotBase;
        return {
            ...pipelineSnapshotBase,
            transferThroughput: pipelineBacklog.transferThroughput,
            globalTelegramBacklog: pipelineBacklog.globalTelegramBacklog,
            telegramIngestMetrics: pipelineBacklog.ingestMetrics,
            sources: pipelineSnapshotBase.sources.map((src) => ({
                ...src,
                collectorBacklog:
                    pipelineBacklog.backlogBySourceId[src.sourceId] ?? src.collectorBacklog,
            })),
        };
    }, [pipelineSnapshotBase, pipelineBacklog]);
    const pipelineHistory = pipelineView?.history ?? [];
    const normalizationSummary = pipelineView?.normalizationSummary;
    const normalizedData = pipelineView?.normalizedData ?? [];

    const pipelineApiError =
        pipelineErrorObj instanceof DataHubApiError
            ? pipelineErrorObj
            : pipelineErrorObj instanceof Error
              ? pipelineErrorObj
              : null;
    const pipelineError = pipelineApiError?.message ?? null;
    const setPipelineError = (_err: string | null) => {
        if (_err === null) {
            void refetchPipeline();
        }
    };

    const pipelineBacklogApiError =
        pipelineBacklogErrorObj instanceof DataHubApiError
            ? pipelineBacklogErrorObj
            : pipelineBacklogErrorObj instanceof Error
              ? pipelineBacklogErrorObj
              : null;

    const pipelineNormalizationApiError =
        pipelineNormalizationErrorObj instanceof DataHubApiError
            ? pipelineNormalizationErrorObj
            : pipelineNormalizationErrorObj instanceof Error
              ? pipelineNormalizationErrorObj
              : null;

    const pipelineCapacityApiError =
        pipelineCapacityErrorObj instanceof DataHubApiError
            ? pipelineCapacityErrorObj
            : pipelineCapacityErrorObj instanceof Error
              ? pipelineCapacityErrorObj
              : null;

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
        const categoriesForMetrics = pipelineSnapshot?.categories ?? [];
        if (!categoriesForMetrics.length) return {};
        const metrics: Record<string, { inflow: number; passRate: number }> = {};
        categoriesForMetrics.forEach(cat => {
            metrics[cat.categoryId] = {
                inflow: cat.inflow,
                passRate: cat.passRate,
            };
        });
        return metrics;
    }, [pipelineSnapshot?.categories]);

    const accessLogs = accessLogsResult?.data ?? [];
    const logStatusCounts = accessLogsResult?.statusCounts ?? {
        success: 0,
        cached: 0,
        failed: 0,
        timeout: 0,
    };

    const accessLogsApiError =
        accessLogsErrorObj instanceof DataHubApiError
            ? accessLogsErrorObj
            : accessLogsErrorObj instanceof Error
              ? accessLogsErrorObj
              : null;
    const logsError = accessLogsApiError?.message ?? null;
    const setLogsError = (_err: string | null) => {
        if (_err === null) {
            void refetchAccessLogs();
        }
    };

    const combinedCollectorHealth = useMemo(() => {
        if (!mergedDataHub || !mergedDataHub.telegramCollector) return 'unknown';
        return mergedDataHub.telegramCollector.status === 'online' ? 'healthy' : 'degraded';
    }, [mergedDataHub]);

    const [isLoadingCollector, setIsLoadingCollector] = useState(false);
    const [collectorMessage, setCollectorMessage] = useState<string | null>(null);
    const [diagnoseChecks, setDiagnoseChecks] = useState<DiagnoseCollectorCheck[] | null>(null);
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
    const [showLoginWizard, setShowLoginWizard] = useState(false);
    const [accountsRefreshTrigger, setAccountsRefreshTrigger] = useState(0);
    const [channelsRefreshTrigger, setChannelsRefreshTrigger] = useState(0);

    const telegramCollectorUrl = api.getTelegramCollectorBaseUrl();

    const setDataHub = (hub: DataHubState | null) => {
        if (hub) {
            queryClient.setQueryData(DATA_HUB_KEYS.state(), hub);
        }
    };

    return {
        dataHub: mergedDataHub,
        setDataHub,
        sourcesPagination,
        sourcesPage,
        setSourcesPage,
        refetchSources,
        isFetchingSources,
        sourcesApiError,
        refetchCategories,
        isFetchingCategories,
        categoriesApiError,
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
        pipelineSnapshot,
        pipelineHistory,
        normalizationSummary,
        normalizedData,
        refetchPipeline,
        isFetchingPipeline,
        isLoadingPipeline: isLoadingPipeline || isFetchingPipeline,
        isLoadingPipelineBacklog: isLoadingPipelineBacklog || isFetchingPipelineBacklog,
        pipelineBacklogPartial: pipelineBacklog?.meta?.partial === true,
        pipelineBacklogUnavailableMetrics: pipelineBacklog?.meta?.unavailableMetrics ?? [],
        pipelineBacklogTrend: pipelineBacklog?.meta?.backlogTrend ?? null,
        pipelineBacklogError:
            pipelineBacklogApiError?.message && !pipelineBacklog
                ? pipelineBacklogApiError.message
                : null,
        handleRetryPipelineBacklog: () => {
            void refetchPipelineBacklog();
        },
        pipelineNormalizationSummary,
        isLoadingPipelineNormalization:
            isLoadingPipelineNormalization || isFetchingPipelineNormalization,
        pipelineNormalizationError:
            pipelineNormalizationApiError?.message && !pipelineNormalizationSummary
                ? pipelineNormalizationApiError.message
                : null,
        handleRetryPipelineNormalization: () => {
            void queryClient.fetchQuery({
                queryKey: DATA_HUB_KEYS.pipelineNormalizationSummary(),
                queryFn: fetchPipelineNormalizationSummary,
                staleTime: 0,
            });
        },
        pipelineCapacity,
        isLoadingPipelineCapacity: isLoadingPipelineCapacity || isFetchingPipelineCapacity,
        pipelineCapacityError:
            pipelineCapacityApiError?.message && !pipelineCapacity
                ? pipelineCapacityApiError.message
                : null,
        pipelineError,
        setPipelineError,
        pipelineApiError,
        agents,
        isLoadingAgents,
        isLoadingCollector,
        collectorError,
        setCollectorError,
        collectorMessage,
        setCollectorMessage,
        diagnoseChecks,
        setDiagnoseChecks,
        categoriesError: categoriesApiError instanceof Error ? categoriesApiError.message : null,
        setCategoriesError: () => { },
        accessLogs,
        refetchAccessLogs,
        logsError,
        setLogsError,
        accessLogsApiError,
        isLoadingLogs: isLoadingLogs || isFetchingAccessLogs,
        logStatusCounts,
        collectorForm,
        collectorAuthId,
        testingChannelId,
        channelTestPreview,
        isRefreshingChannels,
        telegramCollectorUrl,
        showLoginWizard,
        setShowLoginWizard,
        accountsRefreshTrigger,
        channelsRefreshTrigger,
        collectorCooldownSeconds,
        handleCollectorHealth,
        handleDiagnoseCollector,
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
        combinedCollectorHealth,
        onRefresh,
        handleCreateSource,
        handleUpdateSource,
        handleDeleteSource,
        handleRestoreSource,
        handleCreateCategory,
        handleUpdateCategory,
        handleDeleteCategory,
    };
};
