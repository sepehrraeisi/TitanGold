
import React from 'react';
import { useLanguage } from '../../../context/LanguageContext.tsx';

const GeneralConfigWidget: React.FC = () => {
    const { t } = useLanguage();
    return (
        <div className="bg-[#1c1e2f] border border-gray-700/50 rounded-lg p-4 h-full">
            <h3 className="font-semibold text-white mb-4">{t('general_wallet_config')}</h3>
            <div className="space-y-4">
                <div>
                    <label className="text-sm text-gray-300 block mb-1">{t('base_currency')}</label>
                    <select className="w-full p-2 bg-gray-800/50 border border-gray-700 rounded-md">
                        <option>USD</option>
                        <option>EUR</option>
                    </select>
                </div>
                <div>
                    <label className="text-sm text-gray-300 block mb-1">{t('auto_refresh_balance')}</label>
                    <input type="number" defaultValue="30" className="w-full p-2 bg-gray-800/50 border border-gray-700 rounded-md"/>
                </div>
                 <div>
                    <label className="text-sm text-gray-300 block mb-1">{t('low_balance_threshold')}</label>
                    <input type="number" defaultValue="1000" className="w-full p-2 bg-gray-800/50 border border-gray-700 rounded-md"/>
                </div>
                <label className="flex items-center justify-between text-sm">
                    <span className="text-gray-300">{t('show_zero_balance')}</span>
                    <input type="checkbox" className="form-checkbox h-4 w-4 rounded bg-gray-700 border-gray-600 text-purple-500" />
                </label>
            </div>
        </div>
    );
};

export default GeneralConfigWidget;
