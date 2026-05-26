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
        pipelineError,
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
        setPipelineError,
        categoriesError,
        setCategoriesError,
        logsError,
        setLogsError,
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
                {/* Overview Stats Skeletons */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    {[1, 2, 3, 4].map((i) => (
                        <Card key={i}>
                            <div className="text-center">
                                <div className="flex justify-center mb-1">
                                    <SkeletonLoader width="60%" height="0.75rem" />
                                </div>
                                <div className="flex justify-center">
                                    <SkeletonLoader width="40%" height="2rem" />
                                </div>
                            </div>
                        </Card>
                    ))}
                </div>

                {/* Navigation Tabs Skeletons */}
                <div className="flex gap-2 border-b border-border overflow-x-auto no-scrollbar">
                    {[1, 2, 3, 4, 5, 6].map((i) => (
                        <div key={i} className="px-4 py-2">
                            <SkeletonLoader width="4rem" height="1.25rem" />
                        </div>
                    ))}
                </div>

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
                        onClose={clearError}
                    />
                )}

                {/* Overview Stats — backend: GET /stats + GET /health (not IndexedDB / mock cache) */}
                <Card>
                    <DataHubSummaryCards t={t} />
                </Card>

                {/* Navigation Tabs (redesigned to match DESIGN_SYSTEM_DATAHUB.md §۱۴/§۶) */}
                <div className="border border-white/5 bg-slate-950/70 rounded-xl p-2 overflow-x-auto no-scrollbar">
                    <div className="flex gap-2 whitespace-nowrap">
                        {[
                            { id: 'sources', label: t('data_sources') },
                            { id: 'categories', label: t('categories') },
                            { id: 'pipeline', label: t('data_pipeline') },
                            { id: 'health', label: t('health_monitoring') },
                            { id: 'logs', label: t('access_logs') },
                            { id: 'advanced', label: t('advanced_features') },
                            { id: 'telegram', label: t('telegram_collector'), icon: '📱' },
                        ].map(view => {
                            const isActive = activeView === view.id;
                            const base =
                                'px-3 py-1.5 rounded-full text-xs font-medium border border-white/5 bg-slate-900/60 text-muted-foreground hover:bg-slate-900/90 hover:text-foreground transition-colors whitespace-nowrap';
                            const active =
                                view.id === 'telegram'
                                    ? 'bg-sky-500/15 border-sky-500/60 text-sky-300'
                                    : 'bg-purple-600/20 border-purple-500/60 text-purple-300';
                            return (
                                <button
                                    key={view.id}
                                    type="button"
                                    onClick={() => setActiveView(view.id as any)}
                                    className={`${base} ${isActive ? active : ''}`}
                                >
                                    <span className="inline-flex items-center gap-1.5">
                                        {view.icon ? <span>{view.icon}</span> : null}
                                        {view.label}
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                </div>

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
                            error={logsError}
                            setError={setLogsError}
                            onRetry={() => {
                                setLogsError(null);
                                onRefresh();
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
                            pipelineError={pipelineError}
                            setPipelineError={setPipelineError}
                            formatTimeAgo={formatTimeAgo}
                            selectedSnapshotId={selectedSnapshotId}
                            setSelectedSnapshotId={setSelectedSnapshotId}
                        />
                    )}

                    {activeView === 'health' && (
                        <HealthPanel
                            t={t}
                            formatTimeAgo={formatTimeAgo}
                            telegramCollector={dataHub.telegramCollector || null}
                        />
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
                                channelsRefreshTrigger={channelsRefreshTrigger}
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
