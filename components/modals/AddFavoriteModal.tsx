import React, { useState } from 'react';
import Modal from './Modal.tsx';
import { useLanguage } from '../../context/LanguageContext.tsx';
import { CryptoAsset, FavoriteItem } from '../../types.ts';

interface AddFavoriteModalProps {
  onClose: () => void;
  onAddFavorite: (asset: CryptoAsset) => Promise<void> | void;
  existingFavorites: FavoriteItem[];
  availableAssets: CryptoAsset[];
}

const AddFavoriteModal: React.FC<AddFavoriteModalProps> = ({ onClose, onAddFavorite, existingFavorites, availableAssets }) => {
    const { t } = useLanguage();
    const [searchTerm, setSearchTerm] = useState('');
    const [addedIds, setAddedIds] = useState<string[]>([]);
    const [pendingId, setPendingId] = useState<string | null>(null);

    const existingIds = existingFavorites.map(f => f.id);

    const filteredAssets = availableAssets.filter(asset =>
        asset.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        asset.symbol.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const handleAdd = async (asset: CryptoAsset) => {
        setPendingId(asset.id);
        try {
            await onAddFavorite(asset);
            setAddedIds(prev => [...prev, asset.id]);
        } finally {
            setPendingId(null);
        }
    };

    return (
        <Modal isOpen={true} onClose={onClose} title={t('add_favorite_asset')}>
            <div className="space-y-4">
                <input 
                    type="text"
                    placeholder={t('search_assets')}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full bg-gray-800/50 border border-gray-700 rounded-lg py-2 px-3 focus:ring-purple-500 focus:border-purple-500"
                />
                <div className="max-h-60 overflow-y-auto space-y-2 pr-2">
                   {filteredAssets.length === 0 ? (
                        <p className="text-sm text-gray-400 text-center py-6">{t('no_assets_found')}</p>
                    ) : (
                        filteredAssets.map(asset => {
                            const isAdded = existingIds.includes(asset.id) || addedIds.includes(asset.id);
                            const isPending = pendingId === asset.id;
                            return (
                                <div key={asset.id} className="flex justify-between items-center p-2 bg-gray-800/30 rounded-lg">
                                    <div>
                                        <p className="font-bold text-white">{asset.symbol}</p>
                                        <p className="text-sm text-gray-400">{asset.name}</p>
                                    </div>
                                    <button
                                        onClick={() => handleAdd(asset)}
                                        disabled={isAdded || isPending}
                                        className={`text-sm font-semibold py-1 px-3 rounded-md transition-colors ${
                                            isAdded
                                                ? 'bg-green-500/20 text-green-400 cursor-not-allowed'
                                                : isPending
                                                    ? 'bg-purple-500/40 text-purple-200 cursor-wait'
                                                    : 'bg-purple-600 hover:bg-purple-700 text-white'
                                        }`}
                                    >
                                        {isPending
                                            ? t('saving')
                                            : isAdded
                                                ? t('added')
                                                : t('add_new')}
                                    </button>
                                </div>
                            );
                        })
                    )}
                </div>
            </div>
        </Modal>
    );
};

export default AddFavoriteModal;
