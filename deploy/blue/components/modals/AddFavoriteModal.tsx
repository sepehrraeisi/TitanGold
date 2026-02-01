import React, { useState, useMemo, useRef } from 'react';
import Modal from './Modal.tsx';
import { useLanguage } from '../../context/LanguageContext.tsx';
import { CryptoAsset, FavoriteItem } from '../../types.ts';
import * as api from '../../services/api.ts';

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
    const [isLoadingAsset, setIsLoadingAsset] = useState(false);
    const [manualAsset, setManualAsset] = useState<CryptoAsset | null>(null);
    
    // Use refs to track state without causing re-renders
    const isLoadingRef = useRef(false);
    const manualAssetRef = useRef<CryptoAsset | null>(null);
    
    // Sync refs with state
    React.useEffect(() => {
        isLoadingRef.current = isLoadingAsset;
    }, [isLoadingAsset]);
    
    React.useEffect(() => {
        manualAssetRef.current = manualAsset;
    }, [manualAsset]);

    // Safe defaults
    const safeExistingFavorites = existingFavorites || [];
    const safeAvailableAssets = availableAssets || [];
    
    const existingIds = safeExistingFavorites.map(f => f.id);

    // Filter assets from catalog (memoized to prevent unnecessary recalculations)
    const filteredCatalogAssets = useMemo(() => {
        return safeAvailableAssets.filter(asset =>
            asset.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            asset.symbol?.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [safeAvailableAssets, searchTerm]);

    // Combine catalog assets and manual asset
    // If no search term, show first 50 assets from catalog
    const filteredAssets = useMemo(() => {
        if (manualAsset) {
            // If manual asset exists, show it first, then catalog assets
            return [manualAsset, ...filteredCatalogAssets];
        }
        // If no search term, show all available assets (or first 50)
        if (!searchTerm && safeAvailableAssets.length > 0) {
            return safeAvailableAssets.slice(0, 50);
        }
        return filteredCatalogAssets;
    }, [manualAsset, filteredCatalogAssets, safeAvailableAssets, searchTerm]);

    // Debug logging (only log when important changes occur)
    React.useEffect(() => {
        if (searchTerm.length > 0) {
            console.log('📋 AddFavoriteModal - Search term:', searchTerm);
            console.log('📋 AddFavoriteModal - Filtered assets:', filteredAssets.length);
            console.log('📋 AddFavoriteModal - Manual asset:', manualAsset?.symbol || 'none');
            console.log('📋 AddFavoriteModal - Loading:', isLoadingAsset);
        }
    }, [searchTerm, filteredAssets.length, manualAsset?.symbol, isLoadingAsset]);

    // Load asset manually from MEXC when search term is entered
    React.useEffect(() => {
        // Clear manual asset if search term is cleared
        if (searchTerm.length < 2) {
            setManualAsset(null);
            setIsLoadingAsset(false);
            return;
        }
        
        // If catalog has matches, clear manual asset and don't load from MEXC
        if (filteredCatalogAssets.length > 0) {
            setManualAsset(null);
            setIsLoadingAsset(false);
            return;
        }
        
        // If already loading, don't start another load
        if (isLoadingRef.current) {
            return;
        }
        
        // If manual asset already exists for this search term, don't reload
        const currentSearchTerm = searchTerm.toUpperCase().replace(/[^A-Z0-9]/g, '');
        if (manualAssetRef.current && manualAssetRef.current.symbol === currentSearchTerm) {
            return;
        }
        
        // Debounce: wait 500ms before loading
        const timeoutId = setTimeout(async () => {
            // Double-check conditions before loading (in case they changed during debounce)
            if (searchTerm.length < 2 || filteredCatalogAssets.length > 0 || isLoadingRef.current) {
                return;
            }
            
            // Don't load if manual asset already exists for this search term
            if (manualAssetRef.current && manualAssetRef.current.symbol === currentSearchTerm) {
                return;
            }
            
            setIsLoadingAsset(true);
            try {
                // Try to fetch from MEXC
                const mexcSymbol = `${currentSearchTerm}USDT`;
                
                // Check if symbol exists in MEXC
                const ticker = await api.fetchMexcTicker24hr(mexcSymbol);
                
                if (ticker && ticker.length > 0) {
                    // Asset exists in MEXC
                    setManualAsset({
                        id: mexcSymbol,
                        symbol: currentSearchTerm,
                        name: `${currentSearchTerm}/USDT`,
                    });
                } else {
                    setManualAsset(null);
                }
            } catch (e) {
                // Asset not found or error
                setManualAsset(null);
            } finally {
                setIsLoadingAsset(false);
            }
        }, 500); // Debounce 500ms
        
        return () => clearTimeout(timeoutId);
    }, [searchTerm, filteredCatalogAssets.length]);

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
                   {isLoadingAsset ? (
                        <p className="text-sm text-gray-400 text-center py-6">{t('loading')}...</p>
                    ) : filteredAssets.length === 0 && safeAvailableAssets.length === 0 && !searchTerm ? (
                        <div className="text-sm text-gray-400 text-center py-6">
                            <p>{t('no_assets_found')}</p>
                            <p className="text-xs mt-2 text-gray-500">
                                {t('type_symbol_to_search')} (e.g., BTC, ETH, DOGE)
                            </p>
                        </div>
                    ) : filteredAssets.length === 0 ? (
                        <div className="text-sm text-gray-400 text-center py-6">
                            <p>{t('no_assets_found')}</p>
                            {searchTerm.length >= 2 && (
                                <p className="text-xs mt-2 text-gray-500">
                                    {t('trying_to_load')} "{searchTerm.toUpperCase()}" {t('from_mexc')}...
                                </p>
                            )}
                        </div>
                    ) : (
                        filteredAssets.map(asset => {
                            if (!asset || !asset.id) return null; // Skip invalid assets
                            const isAdded = existingIds.includes(asset.id) || addedIds.includes(asset.id);
                            const isPending = pendingId === asset.id;
                            const isManual = manualAsset && asset.id === manualAsset.id;
                            return (
                                <div 
                                    key={asset.id} 
                                    className={`flex justify-between items-center p-2 rounded-lg ${
                                        isManual 
                                            ? 'bg-blue-500/10 border border-blue-500/30' 
                                            : 'bg-gray-800/30'
                                    }`}
                                >
                                    <div>
                                        <p className="font-bold text-white">
                                            {asset.symbol || 'N/A'}
                                            {isManual && <span className="text-xs text-blue-400 ml-2">({t('found')})</span>}
                                        </p>
                                        <p className="text-sm text-gray-400">{asset.name || asset.id}</p>
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
