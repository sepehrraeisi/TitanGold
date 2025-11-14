
import React from 'react';
import { useLanguage } from '../../../context/LanguageContext.tsx';

const ColdWalletWidget: React.FC = () => {
    const { t } = useLanguage();
    return (
        <div className="bg-[#1c1e2f] border border-gray-700/50 rounded-lg p-4">
            <h3 className="font-semibold text-white mb-4">{t('cold_wallet_automation')}</h3>
            <div className="space-y-4">
                 <Checkbox label={t('auto_transfer_to_cold')} defaultChecked />
                 <div>
                    <label className="text-sm text-gray-300 block mb-1">{t('transfer_threshold')}</label>
                    <input type="number" defaultValue="50000" className="w-full p-2 bg-gray-800/50 border border-gray-700 rounded-md"/>
                </div>
                <div>
                    <label className="text-sm text-gray-300 block mb-1">{t('transfer_percentage')} (70%)</label>
                    <input type="range" min="0" max="100" defaultValue="70" className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-purple-500" />
                </div>
                <div>
                    <label className="text-sm text-gray-300 block mb-1">{t('check_interval')}</label>
                    <select className="w-full p-2 bg-gray-800/50 border border-gray-700 rounded-md">
                        <option>{t('every_hour')}</option>
                    </select>
                </div>
                 <div className="grid grid-cols-2 gap-4">
                    <StatBox label={t('today_transfers')} value="0" />
                    <StatBox label={t('cold_wallet_balance')} value="$0" />
                 </div>
                 <div className="grid grid-cols-4 gap-2 text-xs">
                     <button className="p-2 bg-gray-700 hover:bg-gray-600 rounded-md">{t('test_cold_wallet_connection')}</button>
                     <button className="p-2 bg-purple-600 hover:bg-purple-700 rounded-md">{t('instant_transfer')}</button>
                     <button className="p-2 bg-gray-700 hover:bg-gray-600 rounded-md">{t('transfer_history')}</button>
                     <button className="p-2 bg-gray-700 hover:bg-gray-600 rounded-md">{t('cold_wallet_report')}</button>
                 </div>
            </div>
        </div>
    );
};

const Checkbox: React.FC<{label: string, defaultChecked?: boolean}> = ({ label, defaultChecked }) => (
    <label className="flex items-center justify-between text-sm">
        <span className="text-gray-300">{label}</span>
        <input type="checkbox" defaultChecked={defaultChecked} className="form-checkbox h-4 w-4 rounded bg-gray-700 border-gray-600 text-purple-500 focus:ring-purple-500" />
    </label>
);

const StatBox: React.FC<{label: string, value: string}> = ({label, value}) => (
    <div className="bg-gray-800/50 p-3 rounded-lg text-center">
        <p className="text-xs text-gray-400">{label}</p>
        <p className="text-lg font-bold text-white">{value}</p>
    </div>
);

export default ColdWalletWidget;
