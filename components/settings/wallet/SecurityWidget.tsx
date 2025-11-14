
import React from 'react';
import { useLanguage } from '../../../context/LanguageContext.tsx';

const SecurityWidget: React.FC = () => {
    const { t } = useLanguage();
    return (
        <div className="bg-[#1c1e2f] border border-gray-700/50 rounded-lg p-4">
            <h3 className="font-semibold text-white mb-4">{t('wallet_security')}</h3>
            <div className="space-y-3">
                <Checkbox label={t('encrypt_private_keys')} defaultChecked />
                <Checkbox label={t('two_step_verification')} />
                <Checkbox label={t('daily_withdrawal_limit')} />
                <Checkbox label={t('suspicious_transaction_alerts')} />
            </div>
            <div className="mt-4 pt-4 border-t border-gray-700/50 space-y-3">
                 <div>
                    <label className="text-sm text-gray-300 block mb-1">{t('max_daily_withdrawal')}</label>
                    <input type="number" defaultValue="10000" className="w-full p-2 bg-gray-800/50 border border-gray-700 rounded-md"/>
                </div>
                <div>
                    <label className="text-sm text-gray-300 block mb-1">{t('authorized_withdrawal_addresses')}</label>
                    <textarea rows={3} placeholder={t('one_address_per_line')} className="w-full p-2 bg-gray-800/50 border border-gray-700 rounded-md"></textarea>
                </div>
                 <button className="w-full bg-orange-600 hover:bg-orange-700 font-semibold py-2 rounded-lg">{t('backup_wallets')}</button>
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

export default SecurityWidget;
