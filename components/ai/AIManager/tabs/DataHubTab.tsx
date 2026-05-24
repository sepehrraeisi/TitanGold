import React from 'react';
import { ArtemisState } from '../../../../types';
import CategoriesPanel from './DataHub/CategoriesPanel';
import LogsPanel from './DataHub/LogsPanel';
import PipelinePanel from './DataHub/PipelinePanel';
import HealthPanel from './DataHub/HealthPanel';
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
        handleCheckHealth,
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
        formatTimeAgo,
        downloadCSV,
        categoryMetricsById,
        logStatusCounts,
        combinedCollectorHealth,
        setCollectorError,
        setCollectorMessage,
        setPipelineError,
        categoriesError,
        setCategoriesError,
        healthError,
        setHealthError,
        logsError,
        setLogsError,
        isLoadingHealth,
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
        return <div className="text-center p-10">{t('data_hub_not_available') || 'Data Hub not available'}</div>;
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

                {/* Overview Stats */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <Card>
                        <div className="text-center">
                            <p className="text-xs text-muted-foreground mb-1">{t('total_sources') || 'Total Sources'}</p>
                            <p className="text-2xl font-bold text-foreground">{dataHub?.totalSources ?? 0}</p>
                        </div>
                    </Card>
                    <Card>
                        <div className="text-center">
                            <p className="text-xs text-muted-foreground mb-1">{t('active_sources') || 'Active Sources'}</p>
                            <p className="text-2xl font-bold text-green-400">{dataHub?.activeSources ?? 0}</p>
                        </div>
                    </Card>
                    <Card>
                        <div className="text-center">
                            <p className="text-xs text-muted-foreground mb-1">{t('cache_hit_rate') || 'Cache Hit Rate'}</p>
                            <p className="text-2xl font-bold text-purple-400">
                                {typeof dataHub?.cache?.hitRate === 'number'
                                    ? dataHub.cache.hitRate.toFixed(1)
                                    : '0.0'
                                }%
                            </p>
                        </div>
                    </Card>
                    <Card>
                        <div className="text-center">
                            <p className="text-xs text-muted-foreground mb-1">{t('health_status') || 'Health Status'}</p>
                            <p className={`text-2xl font-bold ${
                                dataHub?.health?.overall === 'healthy' ? 'text-green-400' :
                                dataHub?.health?.overall === 'degraded' ? 'text-yellow-400' : 'text-red-400'
                                }`}>
                                {dataHub?.health?.overall ? (t(dataHub.health.overall) || dataHub.health.overall) : 'Unknown'}
                            </p>
                        </div>
                    </Card>
                </div>

                {/* Navigation Tabs */}
                <div className="flex gap-2 border-b border-border overflow-x-auto no-scrollbar">
                    {[
                        { id: 'sources', label: t('data_sources') || 'Sources' },
                        { id: 'categories', label: t('categories') || 'Categories' },
                        { id: 'pipeline', label: t('data_pipeline') || 'Pipeline' },
                        { id: 'health', label: t('health_monitoring') || 'Health' },
                        { id: 'logs', label: t('access_logs') || 'Logs' },
                        { id: 'advanced', label: t('advanced_features') || 'Advanced' },
                        { id: 'telegram', label: t('telegram_collector') || 'Telegram' }
                    ].map(view => (
                        <button
                            key={view.id}
                            onClick={() => setActiveView(view.id as any)}
                            className={`px-4 py-2 text-sm font-medium transition-colors whitespace-nowrap ${activeView === view.id
                                ? 'border-b-2 border-purple-500 text-purple-400'
                                : 'text-muted-foreground hover:text-foreground'
                                }`}
                        >
                            {view.label}
                        </button>
                    ))}
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
                            Card={Card}
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
                            Card={Card}
                            isLoading={isFetchingCategories}
                            apiError={categoriesApiError}
                            dataHub={dataHub}
                        />
                    )}

                    {activeView === 'logs' && (
                        <LogsPanel
                            t={t}
                            accessLogs={dataHub.accessLogs}
                            logStatusCounts={logStatusCounts}
                            downloadCSV={downloadCSV}
                            Card={Card}
                            isLoading={isLoading}
                            error={logsError}
                            setError={setLogsError}
                        />
                    )}

                    {activeView === 'pipeline' && (
                        <PipelinePanel
                            t={t}
                            pipelineSnapshot={dataHub.pipelineSnapshot}
                            pipelineHistory={dataHub.pipelineHistory || []}
                            normalizationSummary={dataHub.normalizationSummary}
                            normalizedData={dataHub.normalizedData || []}
                            handleRefreshPipelineSnapshot={handleRefreshPipelineSnapshot}
                            isLoadingPipeline={isLoadingPipeline}
                            pipelineError={pipelineError}
                            setPipelineError={setPipelineError}
                            formatTimeAgo={formatTimeAgo}
                            selectedSnapshotId={selectedSnapshotId}
                            setSelectedSnapshotId={setSelectedSnapshotId}
                            Card={Card}
                        />
                    )}

                    {activeView === 'health' && (
                        <HealthPanel
                            t={t}
                            health={dataHub.health}
                            handleCheckHealth={handleCheckHealth}
                            isLoading={isLoadingHealth}
                            error={healthError}
                            setError={setHealthError}
                            Card={Card}
                            telegramCollector={dataHub.telegramCollector || null}
                            dataHub={dataHub}
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
