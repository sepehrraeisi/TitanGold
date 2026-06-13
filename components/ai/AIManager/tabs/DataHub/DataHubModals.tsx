import React from 'react';
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
    handleCreateSource: (
        source: Omit<DataSource, 'id' | 'createdAt' | 'lastUpdate'>,
        options?: { allowDuplicateUrl?: boolean },
    ) => Promise<void>;
    handleUpdateSource: (
        id: string,
        updates: Partial<DataSource>,
        options?: { allowDuplicateUrl?: boolean },
    ) => Promise<void>;
    onSaveCategory: (categoryData: Omit<DataCategory, 'id' | 'createdAt'>) => Promise<void>;
    onUpdateCategory: (id: string, updates: Partial<DataCategory>) => Promise<void>;
}

const DataHubModals: React.FC<ModalsProps> = ({
    t,
    dataHub,
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
    handleCreateSource,
    handleUpdateSource,
    onSaveCategory,
    onUpdateCategory,
}) => {
    if (!dataHub) return null;

    return (
        <>
            {showCreateSourceModal && (
                <CreateSourceModal
                    source={editingSource}
                    categories={dataHub.categories}
                    onClose={() => {
                        setShowCreateSourceModal(false);
                        setEditingSource(null);
                    }}
                    onSave={async (sourceData, options) => {
                        if (editingSource) {
                            await handleUpdateSource(editingSource.id, sourceData, options);
                        } else {
                            await handleCreateSource(sourceData, options);
                        }
                        setShowCreateSourceModal(false);
                        setEditingSource(null);
                    }}
                    t={t}
                    setActiveView={setActiveView}
                />
            )}

            {showCreateCategoryModal && (
                <CreateCategoryModal
                    category={editingCategory}
                    onClose={() => {
                        setShowCreateCategoryModal(false);
                        setEditingCategory(null);
                    }}
                    onSave={async (categoryData) => {
                        if (editingCategory) {
                            await onUpdateCategory(editingCategory.id, categoryData);
                        } else {
                            await onSaveCategory(categoryData);
                        }
                        setShowCreateCategoryModal(false);
                        setEditingCategory(null);
                    }}
                    t={t}
                />
            )}

            {viewingSourceData && (
                <ViewSourceDataModal
                    source={viewingSourceData}
                    onClose={() => setViewingSourceData(null)}
                    t={t}
                />
            )}
        </>
    );
};

export default DataHubModals;
