import React, { useState, useEffect } from 'react';
import { useLanguage } from '../../context/LanguageContext.tsx';
import { testSMTPConnection, getSMTPPresets, type SMTPConfig } from '../../services/emailService.ts';
import { database } from '../../services/database.ts';
import Button from '../ui/button.tsx';

const SettingsCard: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
    <div className="bg-[#161B22] border border-gray-800 rounded-lg">
        <div className="p-6 border-b border-gray-800">
            <h3 className="text-lg font-semibold text-white">{title}</h3>
        </div>
        <div className="p-6 space-y-4">
            {children}
        </div>
    </div>
);

const InputField: React.FC<{
    label: string;
    id: string;
    type?: string;
    placeholder?: string;
    value: string;
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    disabled?: boolean;
}> = ({ label, id, type = 'text', placeholder, value, onChange, disabled = false }) => (
    <div>
        <label htmlFor={id} className="block text-sm font-medium text-gray-300 mb-1">{label}</label>
        <input
            type={type}
            id={id}
            placeholder={placeholder}
            value={value}
            onChange={onChange}
            disabled={disabled}
            className="w-full p-2 bg-[#0D111C] border border-gray-700 rounded-md text-white focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
        />
    </div>
);

const SelectField: React.FC<{
    label: string;
    id: string;
    value: string;
    onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
    options: { value: string; label: string }[];
}> = ({ label, id, value, onChange, options }) => (
    <div>
        <label htmlFor={id} className="block text-sm font-medium text-gray-300 mb-1">{label}</label>
        <select
            id={id}
            value={value}
            onChange={onChange}
            className="w-full p-2 bg-[#0D111C] border border-gray-700 rounded-md text-white focus:ring-blue-500 focus:border-blue-500"
        >
            {options.map(option => (
                <option key={option.value} value={option.value}>{option.label}</option>
            ))}
        </select>
    </div>
);

const EmailSettings: React.FC = () => {
    const { t } = useLanguage();
    const [config, setConfig] = useState<SMTPConfig>({
        host: '',
        port: 587,
        secure: false,
        auth: {
            user: '',
            password: '',
        },
        from: '',
        fromName: '',
        provider: 'custom',
    });
    const [isTesting, setIsTesting] = useState(false);
    const [testMessage, setTestMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    useEffect(() => {
        loadEmailConfig();
    }, []);

    const loadEmailConfig = async () => {
        try {
            const saved = await database.get<{ key: string; value: SMTPConfig }>('settings', 'email_config');
            if (saved?.value) {
                setConfig(saved.value);
            }
        } catch (error) {
            console.warn('Failed to load email config:', error);
        }
    };

    const handleProviderChange = (provider: string) => {
        const presets = getSMTPPresets();
        const preset = presets[provider as keyof typeof presets];
        
        if (preset) {
            setConfig(prev => ({
                ...prev,
                ...preset,
                provider: provider as SMTPConfig['provider'],
                port: preset.port || prev.port,
                secure: preset.secure !== undefined ? preset.secure : prev.secure,
            }));
        } else {
            setConfig(prev => ({
                ...prev,
                provider: 'custom' as SMTPConfig['provider'],
            }));
        }
    };

    const handleTestConnection = async () => {
        if (!config.host || !config.port || !config.auth.user || !config.auth.password) {
            setTestMessage({ type: 'error', text: t('email_config_required_fields') || 'Please fill in all required fields' });
            return;
        }

        setIsTesting(true);
        setTestMessage(null);

        try {
            const result = await testSMTPConnection(config);
            if (result.success) {
                setTestMessage({
                    type: 'success',
                    text: result.latency 
                        ? `${t('email_connection_success') || 'Connection successful'} (${result.latency}ms)`
                        : t('email_connection_success') || 'Connection successful'
                });
            } else {
                setTestMessage({
                    type: 'error',
                    text: result.error || t('email_connection_failed') || 'Connection failed'
                });
            }
        } catch (error: any) {
            setTestMessage({
                type: 'error',
                text: error.message || t('email_connection_failed') || 'Connection failed'
            });
        } finally {
            setIsTesting(false);
        }
    };

    const handleSave = async () => {
        if (!config.host || !config.port || !config.auth.user || !config.auth.password) {
            setSaveMessage({ type: 'error', text: t('email_config_required_fields') || 'Please fill in all required fields' });
            return;
        }

        setIsSaving(true);
        setSaveMessage(null);

        try {
            await database.save('settings', {
                key: 'email_config',
                value: config,
            });
            setSaveMessage({ type: 'success', text: t('email_config_saved') || 'Email configuration saved successfully' });
        } catch (error: any) {
            setSaveMessage({ type: 'error', text: error.message || t('email_config_save_failed') || 'Failed to save configuration' });
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="space-y-6">
            <SettingsCard title={t('email_configuration') || 'Email Configuration'}>
                <div className="space-y-4">
                    <SelectField
                        label={t('email_provider') || 'Provider'}
                        id="provider"
                        value={config.provider || 'custom'}
                        onChange={(e) => handleProviderChange(e.target.value)}
                        options={[
                            { value: 'custom', label: t('email_provider_custom') || 'Custom SMTP' },
                            { value: 'gmail', label: 'Gmail' },
                            { value: 'outlook', label: 'Outlook' },
                            { value: 'sendgrid', label: 'SendGrid' },
                            { value: 'mailgun', label: 'Mailgun' },
                        ]}
                    />

                    <InputField
                        label={t('email_host') || 'Host'}
                        id="host"
                        placeholder="smtp.example.com"
                        value={config.host}
                        onChange={(e) => setConfig(prev => ({ ...prev, host: e.target.value }))}
                    />

                    <div className="grid grid-cols-2 gap-4">
                        <InputField
                            label={t('email_port') || 'Port'}
                            id="port"
                            type="number"
                            placeholder="587"
                            value={config.port.toString()}
                            onChange={(e) => setConfig(prev => ({ ...prev, port: parseInt(e.target.value) || 587 }))}
                        />

                        <div className="flex items-end">
                            <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={config.secure}
                                    onChange={(e) => setConfig(prev => ({ ...prev, secure: e.target.checked }))}
                                    className="w-4 h-4 rounded border-gray-700 bg-[#0D111C] text-blue-600 focus:ring-blue-500"
                                />
                                <span>{t('email_secure') || 'Secure (SSL/TLS)'}</span>
                            </label>
                        </div>
                    </div>

                    <InputField
                        label={t('email_username') || 'Username'}
                        id="username"
                        placeholder="your-email@example.com"
                        value={config.auth.user}
                        onChange={(e) => setConfig(prev => ({ ...prev, auth: { ...prev.auth, user: e.target.value } }))}
                    />

                    <InputField
                        label={t('email_password') || 'Password'}
                        id="password"
                        type="password"
                        placeholder="••••••••"
                        value={config.auth.password}
                        onChange={(e) => setConfig(prev => ({ ...prev, auth: { ...prev.auth, password: e.target.value } }))}
                    />

                    <InputField
                        label={t('email_from_address') || 'From Address'}
                        id="from"
                        type="email"
                        placeholder="noreply@example.com"
                        value={config.from}
                        onChange={(e) => setConfig(prev => ({ ...prev, from: e.target.value }))}
                    />

                    <InputField
                        label={t('email_from_name') || 'From Name (Optional)'}
                        id="fromName"
                        placeholder="Titan Trading"
                        value={config.fromName || ''}
                        onChange={(e) => setConfig(prev => ({ ...prev, fromName: e.target.value }))}
                    />

                    {testMessage && (
                        <div className={`p-3 rounded-md text-sm ${
                            testMessage.type === 'success' 
                                ? 'bg-green-500/20 text-green-400 border border-green-500/50' 
                                : 'bg-red-500/20 text-red-400 border border-red-500/50'
                        }`}>
                            {testMessage.text}
                        </div>
                    )}

                    {saveMessage && (
                        <div className={`p-3 rounded-md text-sm ${
                            saveMessage.type === 'success' 
                                ? 'bg-green-500/20 text-green-400 border border-green-500/50' 
                                : 'bg-red-500/20 text-red-400 border border-red-500/50'
                        }`}>
                            {saveMessage.text}
                        </div>
                    )}

                    <div className="flex gap-3 pt-4">
                        <Button
                            variant="primary"
                            onClick={handleTestConnection}
                            disabled={isTesting}
                            className="flex-1"
                        >
                            {isTesting ? (t('testing') || 'Testing...') : (t('test_connection') || 'Test Connection')}
                        </Button>
                        <Button
                            variant="outline"
                            onClick={handleSave}
                            disabled={isSaving}
                            className="flex-1"
                        >
                            {isSaving ? (t('saving') || 'Saving...') : (t('save') || 'Save')}
                        </Button>
                    </div>
                </div>
            </SettingsCard>
        </div>
    );
};

export default EmailSettings;

