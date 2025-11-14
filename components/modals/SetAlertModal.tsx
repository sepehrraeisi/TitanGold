import React, { useState } from 'react';
import Modal from './Modal.tsx';
import { useLanguage } from '../../context/LanguageContext.tsx';
import { FavoriteItem } from '../../types.ts';

interface SetAlertModalProps {
  onClose: () => void;
  asset: FavoriteItem;
}

const SetAlertModal: React.FC<SetAlertModalProps> = ({ onClose, asset }) => {
    const { t } = useLanguage();
    const [condition, setCondition] = useState<'above' | 'below'>('above');
    const [price, setPrice] = useState('');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        // Here you would typically handle the alert creation logic
        console.log(`Alert set for ${asset.symbol}: Price ${condition} ${price}`);
        onClose();
    };

    return (
        <Modal isOpen={true} onClose={onClose} title={t('set_price_alert_for', { asset: asset.symbol })}>
            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">{t('condition')}</label>
                    <select
                        value={condition}
                        onChange={(e) => setCondition(e.target.value as 'above' | 'below')}
                        className="w-full p-2 bg-[#0D111C] border border-gray-700 rounded-md focus:ring-blue-500 focus:border-blue-500"
                    >
                        <option value="above">{t('price_above')}</option>
                        <option value="below">{t('price_below')}</option>
                    </select>
                </div>
                <div>
                    <label htmlFor="target_price" className="block text-sm font-medium text-gray-300 mb-1">{t('target_price')}</label>
                    <input
                        id="target_price"
                        type="number"
                        step="any"
                        value={price}
                        onChange={(e) => setPrice(e.target.value)}
                        required
                        className="w-full p-2 bg-[#0D111C] border border-gray-700 rounded-md focus:ring-blue-500 focus:border-blue-500"
                        placeholder={`e.g. ${asset.price * 1.05}`}
                    />
                </div>
                <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-md transition-colors">
                    {t('set_alert')}
                </button>
            </form>
        </Modal>
    );
};

export default SetAlertModal;
