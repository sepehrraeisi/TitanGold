import React, { useState, useEffect } from 'react';
import { useLanguage } from '../../context/LanguageContext.tsx';
import * as api from '../../services/api.ts';

const SettingsCard: React.FC<{ title: string, children: React.ReactNode }> = ({ title, children }) => (
    <div className="bg-[#161B22] border border-gray-800 rounded-lg">
        <div className="p-6 border-b border-gray-800">
            <h3 className="text-lg font-semibold text-white">{title}</h3>
        </div>
        <div className="p-6 space-y-4">
            {children}
        </div>
    </div>
);

const InputField: React.FC<{ label: string, id: string, type: string, placeholder?: string, value: string, onChange: (e: React.ChangeEvent<HTMLInputElement>) => void }> = ({ label, id, type, placeholder, value, onChange }) => (
    <div>
        <label htmlFor={id} className="block text-sm font-medium text-gray-300 mb-1">{label}</label>
        <input
            type={type}
            id={id}
            placeholder={placeholder}
            value={value}
            onChange={onChange}
            className="w-full p-2 bg-[#0D111C] border border-gray-700 rounded-md focus:ring-blue-500 focus:border-blue-500"
        />
    </div>
);

const ConnectionsSettings: React.FC = () => {
    const { t } = useLanguage();
    const [apiKey, setApiKey] = useState('');
    const [apiSecret, setApiSecret] = useState('');
    const [isConnected, setIsConnected] = useState(false);
    const [isTesting, setIsTesting] = useState(false);
    const [testMessage, setTestMessage] = useState('');

    useEffect(() => {
        const fetchConnection = async () => {
            const connection = await api.fetchConnectionSettings();
            setApiKey(connection.apiKey);
            setApiSecret(connection.apiSecret);
            setIsConnected(connection.isConnected);
        };
        fetchConnection();
    }, []);

    const handleTestConnection = async () => {
        setIsTesting(true);
        setTestMessage('Testing...');
        const result = await api.testMexcConnection(apiKey, apiSecret);
        setTestMessage(result.message);
        setIsConnected(result.success);
        setIsTesting(false);
    };

    const handleSaveChanges = async () => {
        await api.saveConnectionSettings({apiKey, apiSecret, isConnected});
        // You could add a success message here
    }

    return (
        <div className="space-y-6">
            <SettingsCard title={t('exchange_api_keys')}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <InputField label={t('mexc_api_key')} id="mexc_api_key" type="text" placeholder="******************" value={apiKey} onChange={e => setApiKey(e.target.value)} />
                    <InputField label={t('api_secret')} id="api_secret" type="password" placeholder="******************" value={apiSecret} onChange={e => setApiSecret(e.target.value)} />
                </div>
                <div className="flex gap-4 items-center">
                    <button onClick={handleSaveChanges} className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-md transition-colors whitespace-nowrap">
                        {t('save_changes')}
                    </button>
                     <button onClick={handleTestConnection} disabled={isTesting} className="bg-gray-700 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded-md transition-colors whitespace-nowrap disabled:opacity-50">
                        {isTesting ? '...' : t('test_connection')}
                    </button>
                </div>
                 {testMessage && 
                    <div className={`text-sm ${isConnected ? 'text-green-400' : 'text-red-400'}`}>
                        {testMessage}
                    </div>
                 }
            </SettingsCard>

            <SettingsCard title={t('wallet_connections')}>
                <p className="text-sm text-gray-400">Connect your wallets to track your portfolio seamlessly.</p>
                <button className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-md transition-colors">
                    {t('connect_wallet')}
                </button>
            </SettingsCard>
        </div>
    );
};

export default ConnectionsSettings;