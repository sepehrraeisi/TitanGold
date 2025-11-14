import React, { useState } from 'react';
import Modal from './Modal.tsx';
import { useLanguage } from '../../context/LanguageContext.tsx';
import { CryptoAsset, FavoriteItem } from '../../types.ts';

interface AddFavoriteModalProps {
  onClose: () => void;
  onAddFavorite: (asset: CryptoAsset) => void;
  existingFavorites: FavoriteItem[];
}

const allAssets: CryptoAsset[] = [
    { id: 'solana', symbol: 'SOLUSDT', name: 'Solana' },
    { id: 'cardano', symbol: 'ADAUSDT', name: 'Cardano' },
    { id: 'avalanche', symbol: 'AVAXUSDT', name: 'Avalanche' },
    { id: 'chainlink', symbol: 'LINKUSDT', name: 'Chainlink' },
    { id: 'polkadot', symbol: 'DOTUSDT', name: 'Polkadot' },
    { id: 'shiba-inu', symbol: 'SHIBUSDT', name: 'Shiba Inu' },
    { id: 'dogecoin', symbol: 'DOGEUSDT', name: 'Dogecoin' },
];

const AddFavoriteModal: React.FC<AddFavoriteModalProps> = ({ onClose, onAddFavorite, existingFavorites }) => {
    const { t } = useLanguage();
    const [searchTerm, setSearchTerm] = useState('');
    const [addedIds, setAddedIds] = useState<string[]>([]);

    const existingIds = existingFavorites.map(f => f.id);

    const filteredAssets = allAssets.filter(asset => 
        asset.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
        asset.symbol.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const handleAdd = (asset: CryptoAsset) => {
        onAddFavorite(asset);
        setAddedIds(prev => [...prev, asset.id]);
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
                   {filteredAssets.map(asset => {
                       const isAdded = existingIds.includes(asset.id) || addedIds.includes(asset.id);
                       return (
                           <div key={asset.id} className="flex justify-between items-center p-2 bg-gray-800/30 rounded-lg">
                               <div>
                                   <p className="font-bold text-white">{asset.symbol}</p>
                                   <p className="text-sm text-gray-400">{asset.name}</p>
                               </div>
                               <button 
                                   onClick={() => handleAdd(asset)} 
                                   disabled={isAdded}
                                   className={`text-sm font-semibold py-1 px-3 rounded-md transition-colors ${
                                       isAdded 
                                       ? 'bg-green-500/20 text-green-400 cursor-not-allowed' 
                                       : 'bg-purple-600 hover:bg-purple-700 text-white'
                                   }`}
                               >
                                   {isAdded ? t('added') : t('add_new')}
                               </button>
                           </div>
                       );
                   })}
                </div>
            </div>
        </Modal>
    );
};

export default AddFavoriteModal;
