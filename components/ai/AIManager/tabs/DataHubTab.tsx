import React from 'react';
import { ArtemisState } from '../../../../types';
import CategoriesPanel from './DataHub/CategoriesPanel';
import LogsPanel from './DataHub/LogsPanel';
import PipelinePanel from './DataHub/PipelinePanel';
import HealthPanel from './DataHub/HealthPanel';
import DataHubSummaryCards from './DataHub/DataHubSummaryCards';
import TelegramDataPanel from './DataHub/TelegramDataPanel';
import TelegramPanel from './DataHub/TelegramPanel';
import DataSourcesPanel from './DataHub/DataSourcesPanel';
import AdvancedFeatures from './DataHub/AdvancedFeatures';
import DataHubModals from './DataHub/DataHubModals';
import { useDataHub } from './DataHub/hooks/useDataHub';
import ErrorBoundary from '../../../common/ErrorBoundary';
import SkeletonLoader from '../../../common/SkeletonLoader';
import ApiWrapper from '../../../common/ApiWrapper';
import ErrorNotification from './DataHub/components/ErrorNotification';
import { DATAHUB_SHELL, DataHubTabStrip, DataHubTabStripSkeleton } from './DataHub/dataHubUi';

interface Props {
    artemis: ArtemisState;
    t: (key: string) => string;
    onRefresh: () => void;
    Card: React.FC<{ children: React.ReactNode; className?: string }>;
}

const DataHubTab: React.FC<Props> = ({ artemis, t, onRefresh, Card }) => {
    const {
        dataHub,
        setDataHub,
        isLoading,
        dataHubError,
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
        sourceData,
        setSourceData,
        isLoadingData,
        setIsLoadingData,
        selectedSnapshotId,
        setSelectedSnapshotId,
        isLoadingPipeline,
        isLoadingPipelineBacklog,
        pipelineBacklogError,
        pipelineBacklogPartial,
        pipelineBacklogUnavailableMetrics,
        pipelineBacklogTrend,
        handleRetryPipelineBacklog,
        pipelineNormalizationSummary,
        isLoadingPipelineNormalization,
        pipelineNormalizationError,
        handleRetryPipelineNormalization,
        pipelineCapacity,
        isLoadingPipelineCapacity,
        pipelineCapacityError,
        pipelineApiError,
        agents,
        isLoadingAgents,
        isLoadingCollector,
        collectorMessage,
        collectorError,
        collectorForm,
        collectorAuthId,
        testingChannelId,
        channelTestPreview,
        isRefreshingChannels,
        telegramCollectorUrl,
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
        handleDeleteSource,
        handleRestoreSource,
        handleCreateSource,
        handleUpdateSource,
        handleCreateCategory,
        handleUpdateCategory,
        sourcesPagination,
        sourcesPage,
        setSourcesPage,
        refetchSources,
        isFetchingSources,
        sourcesApiError,
        refetchCategories,
        isFetchingCategories,
        categoriesApiError,
        handleDeleteCategory,
        handleRefreshPipelineSnapshot,
        pipelineSnapshot,
        pipelineHistory,
        normalizationSummary,
        normalizedData,
        formatTimeAgo,
        downloadCSV,
        categoryMetricsById,
        accessLogs,
        logStatusCounts,
        combinedCollectorHealth,
        setCollectorError,
        setCollectorMessage,
        diagnoseChecks,
        setDiagnoseChecks,
        setPipelineError,
        categoriesError,
        setCategoriesError,
        setLogsError,
        accessLogsApiError,
        isLoadingLogs,
        currentError,
        clearError,
        showLoginWizard,
        setShowLoginWizard,
        accountsRefreshTrigger,
        channelsRefreshTrigger,
        collectorCooldownSeconds,
    } = useDataHub(artemis, onRefresh, t);

    if (isLoading && !dataHub) {
        return (
            <div className="space-y-6">
                {/* Overview Stats Skeletons — DATAHUB_SHELL (DESIGN_SYSTEM_DATAHUB.md §5) */}
                <div className={`${DATAHUB_SHELL} space-y-3`}>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {[1, 2, 3, 4].map((i) => (
                            <div
                                key={i}
                                className="rounded-xl border border-white/5 bg-gradient-to-br from-slate-500/10 via-slate-500/5 to-transparent p-3 backdrop-blur-sm"
                            >
                                <div className="flex justify-center mb-2">
                                    <SkeletonLoader width="60%" height="0.75rem" />
                                </div>
                                <div className="flex justify-center">
                                    <SkeletonLoader width="40%" height="1.5rem" />
                                </div>
                            </div>
                    ))}
                    </div>
                    <SkeletonLoader width="70%" height="0.625rem" />
                </div>

                {/* Navigation Tabs Skeletons */}
                <DataHubTabStripSkeleton count={7} />

                {/* Content Panel Skeleton */}
                <Card>
                    <div className="space-y-4">
                        <div className="flex justify-between items-center">
                            <SkeletonLoader width="30%" height="1.5rem" />
                            <SkeletonLoader width="100px" height="2rem" />
                        </div>
                        <div className="space-y-6 mt-6">
                            {[1, 2, 3, 4, 5].map((i) => (
                                <div key={i} className="flex gap-4 items-center border-b border-border/50 pb-4 last:border-0 last:pb-0">
                                    <SkeletonLoader variant="circular" width="2.5rem" height="2.5rem" className="flex-shrink-0" />
                                    <div className="flex-1 space-y-2">
                                        <SkeletonLoader width="40%" height="1rem" />
                                        <SkeletonLoader width="60%" height="0.75rem" />
                                    </div>
                                    <SkeletonLoader width="80px" height="1.5rem" className="flex-shrink-0" />
                                </div>
                            ))}
                        </div>
                    </div>
                </Card>
            </div>
        );
    }

    if (!dataHub) {
        return <div className="text-center p-10">{t('data_hub_not_available')}</div>;
    }

    return (
        <ApiWrapper error={dataHubError} setError={() => { }} isLoading={isLoading}>
            <div className="space-y-6">
                {/* Error Notification */}
                {currentError && (
                    <ErrorNotification
                        error={currentError}
                        onDismiss={clearError}
                    />
                )}

                {/* Overview Stats — backend: GET /stats + GET /health (not IndexedDB / mock cache) */}
                <DataHubSummaryCards t={t} />

                <DataHubTabStrip
                    ariaLabel={t('data_hub_navigation') || 'Data Hub navigation'}
                    activeId={activeView}
                    onChange={id => setActiveView(id as typeof activeView)}
                    items={[
                        { id: 'sources', label: t('data_sources') },
                        { id: 'categories', label: t('categories') },
                        { id: 'pipeline', label: t('data_pipeline') },
                        { id: 'health', label: t('health_monitoring') },
                        { id: 'logs', label: t('access_logs') },
                        { id: 'advanced', label: t('advanced_features') },
                        {
                            id: 'telegram',
                            label: t('telegram_collector'),
                            icon: '📱',
                            activeVariant: 'telegram',
                        },
                    ]}
                />

                {/* Content Views */}
                <div className="mt-4">
                    {activeView === 'sources' && (
                        <DataSourcesPanel
                            t={t}
                            formatTimeAgo={formatTimeAgo}
                            onRefresh={() => {
                                void refetchSources();
                                onRefresh();
                            }}
                            downloadCSV={downloadCSV}
                            setEditingSource={setEditingSource}
                            setShowCreateSourceModal={setShowCreateSourceModal}
                            setViewingSourceData={setViewingSourceData}
                            handleTestSource={handleTestSource}
                            handleDeleteSource={handleDeleteSource}
                            handleRestoreSource={handleRestoreSource}
                            handleUpdateSource={handleUpdateSource}
                            dataHub={dataHub}
                            setActiveView={setActiveView}
                            pagination={sourcesPagination}
                            page={sourcesPage}
                            onPageChange={setSourcesPage}
                            isLoading={isFetchingSources}
                            apiError={sourcesApiError}
                        />
                    )}

                    {activeView === 'categories' && (
                        <CategoriesPanel
                            t={t}
                            categories={dataHub.categories}
                            categoryMetricsById={categoryMetricsById}
                            downloadCSV={downloadCSV}
                            setEditingCategory={setEditingCategory}
                            setShowCreateCategoryModal={setShowCreateCategoryModal}
                            onRefresh={() => {
                                void refetchCategories();
                                onRefresh();
                            }}
                            handleDeleteCategory={handleDeleteCategory}
                            isLoading={isFetchingCategories}
                            apiError={categoriesApiError}
                            dataHub={dataHub}
                        />
                    )}

                    {activeView === 'logs' && (
                        <LogsPanel
                            t={t}
                            accessLogs={accessLogs}
                            logStatusCounts={logStatusCounts}
                            downloadCSV={downloadCSV}
                            isLoading={isLoadingLogs}
                            apiError={accessLogsApiError}
                            onRetry={() => {
                                setLogsError(null);
                                onRefresh();
                            }}
                            onNavigateToSource={sourceId => {
                                const source = dataHub?.sources?.find(s => s.id === sourceId);
                                setActiveView('sources');
                                if (source) {
                                    setEditingSource(source);
                                }
                            }}
                        />
                    )}

                    {activeView === 'pipeline' && (
                        <PipelinePanel
                            t={t}
                            pipelineSnapshot={pipelineSnapshot}
                            pipelineHistory={pipelineHistory}
                            normalizationSummary={normalizationSummary}
                            normalizedData={normalizedData}
                            handleRefreshPipelineSnapshot={handleRefreshPipelineSnapshot}
                            isLoadingPipeline={isLoadingPipeline}
                            isLoadingPipelineBacklog={isLoadingPipelineBacklog}
                            pipelineBacklogError={pipelineBacklogError}
                            pipelineBacklogPartial={pipelineBacklogPartial}
                            pipelineBacklogUnavailableMetrics={pipelineBacklogUnavailableMetrics}
                            pipelineBacklogTrend={pipelineBacklogTrend}
                            onRetryPipelineBacklog={handleRetryPipelineBacklog}
                            pipelineNormalizationSummary={pipelineNormalizationSummary}
                            isLoadingPipelineNormalization={isLoadingPipelineNormalization}
                            pipelineNormalizationError={pipelineNormalizationError}
                            onRetryPipelineNormalization={handleRetryPipelineNormalization}
                            pipelineCapacity={pipelineCapacity}
                            isLoadingPipelineCapacity={isLoadingPipelineCapacity}
                            pipelineCapacityError={pipelineCapacityError}
                            pipelineApiError={pipelineApiError}
                            setPipelineError={setPipelineError}
                            formatTimeAgo={formatTimeAgo}
                            selectedSnapshotId={selectedSnapshotId}
                            setSelectedSnapshotId={setSelectedSnapshotId}
                        />
                    )}

                    {activeView === 'health' && (
                        <HealthPanel t={t} formatTimeAgo={formatTimeAgo} />
                    )}

                    {activeView === 'advanced' && (
                        <AdvancedFeatures
                            dataHub={dataHub}
                            setDataHub={setDataHub}
                            onRefresh={onRefresh}
                            t={t}
                            formatTimeAgo={formatTimeAgo}
                            agents={agents}
                            isLoadingAgents={isLoadingAgents}
                        />
                    )}

                    {activeView === 'telegram' && (
                        <div className="space-y-6">
                            <TelegramPanel
                                t={t}
                                telegramCollectorUrl={telegramCollectorUrl}
                                telegramCollectorState={dataHub.telegramCollector || null}
                                telegramSources={dataHub.sources.filter((s) => s.type === 'telegram')}
                                handleCollectorHealth={handleCollectorHealth}
                                isLoadingCollector={isLoadingCollector}
                                collectorMessage={collectorMessage}
                                collectorError={collectorError}
                                handleStartCollectorLogin={handleStartCollectorLogin}
                                handleConfirmCollectorLogin={handleConfirmCollectorLogin}
                                handleCancelCollectorLogin={handleCancelCollectorLogin}
                                handleRefreshCollectorChannels={handleRefreshCollectorChannels}
                                handleLinkChannelToSource={handleLinkChannelToSource}
                                handleTestCollectorChannel={handleTestCollectorChannel}
                                formatTimeAgo={formatTimeAgo}
                                collectorForm={collectorForm}
                                handleCollectorInputChange={handleCollectorInputChange}
                                collectorAuthId={collectorAuthId}
                                testingChannelId={testingChannelId}
                                channelTestPreview={channelTestPreview}
                                isRefreshingChannels={isRefreshingChannels}
                                combinedCollectorHealth={combinedCollectorHealth}
                                setCollectorError={setCollectorError}
                                setCollectorMessage={setCollectorMessage}
                                Card={Card}
                                collectorCooldownSeconds={collectorCooldownSeconds}
                                handleDiagnoseCollector={handleDiagnoseCollector}
                                showLoginWizard={showLoginWizard}
                                setShowLoginWizard={setShowLoginWizard}
                                accountsRefreshTrigger={accountsRefreshTrigger}
                                diagnoseChecks={diagnoseChecks}
                                setDiagnoseChecks={setDiagnoseChecks}
                            />

                            <TelegramDataPanel
                                t={t}
                                Card={Card}
                                onRefresh={onRefresh}
                            />
                        </div>
                    )}
                </div>

                <DataHubModals
                    t={t}
                    dataHub={dataHub}
                    showCreateSourceModal={showCreateSourceModal}
                    setShowCreateSourceModal={setShowCreateSourceModal}
                    editingSource={editingSource}
                    setEditingSource={setEditingSource}
                    showCreateCategoryModal={showCreateCategoryModal}
                    setShowCreateCategoryModal={setShowCreateCategoryModal}
                    editingCategory={editingCategory}
                    setEditingCategory={setEditingCategory}
                    viewingSourceData={viewingSourceData}
                    setViewingSourceData={setViewingSourceData}
                    setActiveView={setActiveView}
                    handleCreateSource={handleCreateSource}
                    handleUpdateSource={handleUpdateSource}
                    onSaveCategory={handleCreateCategory}
                    onUpdateCategory={handleUpdateCategory}
                />
            </div>
        </ApiWrapper>
    );
};

const DataHubTabWithErrorBoundary: React.FC<Props> = (props) => (
    <ErrorBoundary>
        <DataHubTab {...props} />
    </ErrorBoundary>
);

export default DataHubTabWithErrorBoundary;
