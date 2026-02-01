import React, { useState } from 'react';
import Modal from './Modal.tsx';
import { useLanguage } from '../../context/LanguageContext.tsx';
import { FavoriteItem, FavoriteAlertInput } from '../../types.ts';

interface SetAlertModalProps {
  onClose: () => void;
  asset: FavoriteItem;
  onCreateAlert: (input: FavoriteAlertInput) => Promise<void>;
}

const SetAlertModal: React.FC<SetAlertModalProps> = ({ onClose, asset, onCreateAlert }) => {
    const { t } = useLanguage();
    const [condition, setCondition] = useState<'above' | 'below'>('above');
    const [price, setPrice] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        const numericPrice = parseFloat(price);
        if (Number.isNaN(numericPrice) || numericPrice <= 0) {
            setError(t('target_price_required'));
            return;
        }

        setIsSubmitting(true);
        try {
            await onCreateAlert({ condition, targetPrice: numericPrice });
            onClose();
        } catch (err) {
            console.error('Failed to create alert', err);
            setError(t('error_occurred'));
        } finally {
            setIsSubmitting(false);
        }
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
                {error && <p className="text-sm text-red-400">{error}</p>}
                <button
                    type="submit"
                    disabled={isSubmitting}
                    className={`w-full text-white font-bold py-2 px-4 rounded-md transition-colors ${
                        isSubmitting ? 'bg-blue-500/40 cursor-wait' : 'bg-blue-600 hover:bg-blue-700'
                    }`}
                >
                    {isSubmitting ? t('saving') : t('set_alert')}
                </button>
            </form>
        </Modal>
    );
};

export default SetAlertModal;
