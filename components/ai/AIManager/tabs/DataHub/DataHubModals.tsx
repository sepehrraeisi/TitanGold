import React from 'react';
import * as api from '../../../../../services/api';
import {
    DataSource,
    DataCategory,
    DataHubState,
} from '../../../../../types';
import CreateSourceModal from './modals/CreateSourceModal';
import CreateCategoryModal from './modals/CreateCategoryModal';
import ViewSourceDataModal from './modals/ViewSourceDataModal';

interface ModalsProps {
    t: (key: string) => string;
    dataHub: DataHubState | null;
    setDataHub: (data: DataHubState | null) => void;
    onRefresh: () => void;
    showCreateSourceModal: boolean;
    setShowCreateSourceModal: (show: boolean) => void;
    editingSource: DataSource | null;
    setEditingSource: (source: DataSource | null) => void;
    showCreateCategoryModal: boolean;
    setShowCreateCategoryModal: (show: boolean) => void;
    editingCategory: DataCategory | null;
    setEditingCategory: (category: DataCategory | null) => void;
    viewingSourceData: DataSource | null;
    setViewingSourceData: (source: DataSource | null) => void;
    setActiveView?: (view: 'sources' | 'categories' | 'pipeline' | 'health' | 'logs' | 'advanced' | 'telegram') => void;
}

const DataHubModals: React.FC<ModalsProps> = ({
    t,
    dataHub,
    setDataHub,
    onRefresh,
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
    setActiveView,
}) => {
    if (!dataHub) return null;

    return (
        <>
            {/* Create/Edit Source Modal */}
            {showCreateSourceModal && (
                <CreateSourceModal
                    source={editingSource}
                    categories={dataHub.categories}
                    onClose={() => {
                        setShowCreateSourceModal(false);
                        setEditingSource(null);
                    }}
                    onSave={async (sourceData) => {
                        try {
                            if (editingSource) {
                                await api.updateDataHubSource(editingSource.id, sourceData);
                            } else {
                                await api.createDataSource(sourceData);
                            }
                            const updated = await api.fetchDataHubState();
                            setDataHub(updated);
                            onRefresh();
                            setShowCreateSourceModal(false);
                            setEditingSource(null);
                        } catch (e) {
                            alert(t('save_failed') || 'Failed to save source');
                        }
                    }}
                    t={t}
                    setActiveView={setActiveView}
                />
            )}

            {/* Create Category Modal */}
            {showCreateCategoryModal && (
                <CreateCategoryModal
                    category={editingCategory}
                    onClose={() => {
                        setShowCreateCategoryModal(false);
                        setEditingCategory(null);
                    }}
                    onSave={async (categoryData) => {
                        try {
                            if (editingCategory) {
                                await api.updateDataCategory(editingCategory.id, categoryData);
                            } else {
                                await api.createDataCategory(categoryData);
                            }
                            const updated = await api.fetchDataHubState();
                            setDataHub(updated);
                            onRefresh();
                            setShowCreateCategoryModal(false);
                            setEditingCategory(null);
                        } catch (e) {
                            alert(t('save_failed') || 'Failed to save category');
                        }
                    }}
                    t={t}
                />
            )}

            {viewingSourceData && (
                <ViewSourceDataModal
                    source={viewingSourceData}
                    onClose={() => {
                        setViewingSourceData(null);
                    }}
                    t={t}
                />
            )}
        </>
    );
};

export default DataHubModals;
