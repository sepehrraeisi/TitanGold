import React, { useEffect, useState } from 'react';
import * as api from '../../../../../../services/api';
import { useDataHubQuery } from '../../../../../../hooks/useDataHubState';
import { DataSource, DataCategory, DetectedSourceType } from '../../../../../../types';
import { dataSourceSchema } from '../../../../../../utils/validation';
import { ZodError } from 'zod';

type Props = {
    source?: DataSource | null;
    categories: DataCategory[];
    onClose: () => void;
    onSave: (source: Omit<DataSource, 'id' | 'createdAt' | 'updatedAt' | 'errorCount' | 'successRate' | 'reliabilityScore'>) => Promise<void>;
    t: (key: string) => string;
};

const CreateSourceModal: React.FC<Props> = ({ source, categories, onClose, onSave, t }) => {
    const [name, setName] = useState(source?.name || '');
    const [type, setType] = useState<DataSource['type']>(source?.type || 'api');
    const [url, setUrl] = useState(source?.url || '');
    const [endpoint, setEndpoint] = useState(source?.endpoint || '');
    const [category, setCategory] = useState(source?.category || '');
    const [tags, setTags] = useState(source?.tags.join(', ') || '');
    const [priority, setPriority] = useState<DataSource['priority']>(source?.priority || 'medium');
    const [updateInterval, setUpdateInterval] = useState<DataSource['updateInterval']>(source?.updateInterval || '5min');
    const [isSaving, setIsSaving] = useState(false);
    const [isDetectingType, setIsDetectingType] = useState(false);
    const [autoDetection, setAutoDetection] = useState<DetectedSourceType | null>(null);
    const [detectionError, setDetectionError] = useState<string | null>(null);
    const [autoFields, setAutoFields] = useState<Record<string, boolean>>({});
    const [errors, setErrors] = useState<Record<string, string>>({});

    // Test Connection state
    const [isTesting, setIsTesting] = useState(false);
    const [testResult, setTestResult] = useState<{
        success: boolean;
        message: string;
        sampleData?: any;
        responseTime?: number;
    } | null>(null);
    const [showSampleData, setShowSampleData] = useState(false);

    // Telegram specific fields
    const [telegramUsername, setTelegramUsername] = useState(source?.credentials?.username || '');
    const [telegramToken, setTelegramToken] = useState(source?.credentials?.token || '');

    // API credentials
    const [apiKey, setApiKey] = useState(source?.credentials?.apiKey || '');
    const [apiSecret, setApiSecret] = useState(source?.credentials?.secret || '');

    // Webhook specific
    const [webhookUrl, setWebhookUrl] = useState(source?.url || '');

    // Web crawler specific (TASK-FE-020)
    const [webMaxDepth, setWebMaxDepth] = useState(source?.config?.maxDepth ?? 1);
    const [webSelector, setWebSelector] = useState(source?.config?.selector || '');
    const [webDelay, setWebDelay] = useState(source?.config?.delay ?? 1000);
    const [webRenderJS, setWebRenderJS] = useState(source?.config?.renderJS ?? false);

    // Visibility toggles
    const [showTelegramToken, setShowTelegramToken] = useState(false);
    const [showApiKey, setShowApiKey] = useState(false);
    const [showApiSecret, setShowApiSecret] = useState(false);

    // Duplicate detection
    const { data: dataHubState } = useDataHubQuery();
    const [duplicateWarning, setDuplicateWarning] = useState<{
        isOpen: boolean;
        message: string;
    }>({ isOpen: false, message: '' });

    useEffect(() => {
        if (!url || url.length < 6) {
            setAutoDetection(null);
            setDetectionError(null);
            return;
        }
        if (source && url === source.url) {
            return;
        }
        const handle = setTimeout(() => {
            detectTypeForUrl(url, 'ui-auto-detect');
        }, 800);
        return () => clearTimeout(handle);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [url]);

    const markAutoField = (field: string) => {
        setAutoFields(prev => ({ ...prev, [field]: true }));
    };

    const detectTypeForUrl = async (targetUrl?: string, context: string = 'ui-auto-detect') => {
        const value = targetUrl || url;
        if (!value || value.length < 4) return;
        setIsDetectingType(true);
        setDetectionError(null);
        try {
            const result = await api.detectSourceType(value, [context]);
            setAutoDetection(result);
            if (!source) {
                applyDetectionSuggestion(result, false);
            }
        } catch (err: any) {
            setAutoDetection(null);
            setDetectionError(err?.message || 'Failed to detect type');
        } finally {
            setIsDetectingType(false);
        }
    };

    const defaultCategoryForType = (detType: DataSource['type']): string => {
        switch (detType) {
            case 'rss':
                return 'news';
            case 'telegram':
                return 'social_feeds';
            case 'api':
                return 'price_data';
            case 'third_party':
                return 'third_party';
            case 'aggregator':
                return 'aggregators';
            case 'webhook':
                return 'automation';
            case 'web':
                return 'news';
            default:
                return category || 'fundamental';
        }
    };

    const defaultTagsForType = (detType: DataSource['type'], metaTags?: string[]) => {
        if (metaTags && metaTags.length > 0) return metaTags.join(', ');
        switch (detType) {
            case 'rss':
                return 'rss,news';
            case 'telegram':
                return 'telegram,social';
            case 'api':
                return 'api,json,data';
            case 'aggregator':
                return 'aggregator,multi-source';
            case 'webhook':
                return 'webhook,push';
            case 'third_party':
                return 'third-party,data';
            case 'web':
                return 'web,crawler,html';
            default:
                return 'website,html';
        }
    };

    const defaultPriorityForType = (detType: DataSource['type'], metaPriority?: DataSource['priority']): DataSource['priority'] => {
        if (metaPriority) return metaPriority;
        switch (detType) {
            case 'rss':
            case 'telegram':
            case 'api':
            case 'aggregator':
                return 'high';
            case 'webhook':
            case 'third_party':
                return 'medium';
            default:
                return 'medium';
        }
    };

    const defaultIntervalForType = (detType: DataSource['type'], metaInterval?: DataSource['updateInterval']): DataSource['updateInterval'] => {
        if (metaInterval) return metaInterval;
        switch (detType) {
            case 'telegram':
            case 'webhook':
                return 'realtime';
            case 'api':
            case 'aggregator':
                return '1min';
            case 'rss':
            case 'web':
                return '15min';
            default:
                return '30min';
        }
    };

    const deriveNameFromDetection = (result: DetectedSourceType): string => {
        if (result.meta?.suggestedName) return result.meta.suggestedName;
        if (result.meta?.host) return result.meta.host;
        try {
            const parsed = new URL(result.normalizedUrl);
            return parsed.hostname.replace(/^www\./, '');
        } catch {
            return result.normalizedUrl;
        }
    };

    const autoBadge = (field: string) => (
        autoFields[field]
            ? <span className="ml-2 inline-flex items-center px-1.5 py-0.5 text-[10px] font-semibold rounded border border-purple-500/40 bg-purple-500/15 text-purple-200">
                {t('auto') || 'Auto'}
            </span>
            : null
    );

    const applyDetectionSuggestion = (result: DetectedSourceType | null, manual = true) => {
        if (!result) return;
        if (type !== result.type) {
            setType(result.type);
            markAutoField('type');
        }
        if (!source && result.normalizedUrl && (!url || url.length < 6 || manual) && url !== result.normalizedUrl) {
            setUrl(result.normalizedUrl);
            markAutoField('url');
        }
        if (!source && !category) {
            const suggestedCategory = defaultCategoryForType(result.type);
            if (suggestedCategory && suggestedCategory !== category) {
                setCategory(suggestedCategory);
                markAutoField('category');
            }
        } else if (!source && manual && result.meta?.suggestedCategory && category !== result.meta.suggestedCategory) {
            setCategory(result.meta.suggestedCategory);
            markAutoField('category');
        }
        const derivedName = deriveNameFromDetection(result);
        if (!source && (!name || manual) && name !== derivedName) {
            setName(derivedName);
            markAutoField('name');
        }
        const suggestedTags = defaultTagsForType(result.type, result.meta?.suggestedTags);
        if (!source && (!tags || manual) && tags !== suggestedTags) {
            setTags(suggestedTags);
            markAutoField('tags');
        }
        const suggestedPriority = defaultPriorityForType(result.type, result.meta?.suggestedPriority);
        if (!source && (manual || !priority) && priority !== suggestedPriority) {
            setPriority(suggestedPriority);
            markAutoField('priority');
        }
        const suggestedInterval = defaultIntervalForType(result.type, result.meta?.suggestedInterval);
        if (!source && (manual || !updateInterval) && updateInterval !== suggestedInterval) {
            setUpdateInterval(suggestedInterval);
            markAutoField('updateInterval');
        }
        if (result.type === 'telegram' && result.meta?.telegramUsername && telegramUsername !== result.meta.telegramUsername) {
            setTelegramUsername(result.meta.telegramUsername);
            markAutoField('telegramUsername');
        }
    };

    // Initialize fields from source when editing
    useEffect(() => {
        if (source) {
            setName(source.name || '');
            setType(source.type || 'api');
            setUrl(source.url || '');
            setEndpoint(source.endpoint || '');
            setCategory(source.category || '');
            setTags(source.tags.join(', ') || '');
            setPriority(source.priority || 'medium');
            setUpdateInterval(source.updateInterval || '5min');
            setTelegramUsername(source.credentials?.username || '');
            setTelegramToken(source.credentials?.token || '');
            setApiKey(source.credentials?.apiKey || '');
            setApiSecret(source.credentials?.secret || '');
            setWebhookUrl(source.url || '');
            // Web crawler config
            setWebMaxDepth(source.config?.maxDepth ?? 1);
            setWebSelector(source.config?.selector || '');
            setWebDelay(source.config?.delay ?? 1000);
            setWebRenderJS(source.config?.renderJS ?? false);
        }
    }, [source]);

    useEffect(() => {
        setAutoFields({});
    }, [source?.id]);

    // Reset fields when type changes (only for new sources)
    useEffect(() => {
        if (!source) {
            // Reset type-specific fields when type changes
            if (type !== 'telegram') {
                setTelegramUsername('');
                setTelegramToken('');
            }
            if (type !== 'api') {
                setApiKey('');
                setApiSecret('');
                setEndpoint('');
            }
            if (type !== 'webhook') {
                setWebhookUrl('');
            }
            if (type === 'telegram') {
                setUrl('');
                setEndpoint('');
            }
        }
    }, [type, source]);

    const handleTestConnection = async () => {
        setIsTesting(true);
        setTestResult(null);
        setShowSampleData(false);

        try {
            const credentials: DataSource['credentials'] = {};
            if (type === 'telegram') {
                credentials.username = telegramUsername;
                if (telegramToken) credentials.token = telegramToken;
            } else if (type === 'api') {
                if (apiKey) credentials.apiKey = apiKey;
                if (apiSecret) credentials.secret = apiSecret;
            }

            let finalUrl = url;
            if (type === 'telegram') {
                finalUrl = `https://t.me/${telegramUsername.replace('@', '')}`;
            } else if (type === 'webhook') {
                finalUrl = webhookUrl;
            }

            const config: any = {};
            if (type === 'web') {
                config.maxDepth = webMaxDepth;
                if (webSelector) config.selector = webSelector;
                config.delay = webDelay;
                config.renderJS = webRenderJS;
            }

            const result = await api.testDataSourceConfiguration({
                type,
                url: finalUrl || undefined,
                endpoint: (type === 'api' && endpoint) ? endpoint : undefined,
                credentials,
                config
            });
            setTestResult(result);
            if (result.success && result.sampleData) {
                setShowSampleData(true);
            }
        } catch (err: any) {
            setTestResult({
                success: false,
                message: err.message || 'Connection test failed'
            });
        } finally {
            setIsTesting(false);
        }
    };

    const handleSubmit = async () => {
        setErrors({});

        // Prepare data for validation
        const formData = {
            name,
            type,
            url,
            category,
            tags,
            priority,
            updateInterval,
            telegramUsername,
            telegramToken,
            apiKey,
            apiSecret,
            endpoint,
            webhookUrl
        };

        try {
            dataSourceSchema.parse(formData);
        } catch (err) {
            if (err instanceof ZodError) {
                const newErrors: Record<string, string> = {};
                (err as ZodError).errors.forEach(e => {
                    if (e.path[0]) newErrors[e.path[0].toString()] = e.message;
                });
                setErrors(newErrors);
                return;
            }
        }

        if (type === 'telegram') {
            alert(t('telegram_source_manage_in_collector') || 'Telegram sources are managed via Telegram Collector.');
            return;
        }

        // Check for duplicates
        if (!duplicateWarning.isOpen && dataHubState?.sources) {
            const isDuplicate = dataHubState.sources.some(s => {
                if (s.id === source?.id) return false; // Ignore self when editing

                if (type === 'webhook' && s.type === 'webhook') {
                    return s.url === webhookUrl;
                }

                if (['api', 'rss', 'web', 'website', 'aggregator', 'third_party'].includes(type) &&
                    ['api', 'rss', 'web', 'website', 'aggregator', 'third_party'].includes(s.type)) {
                    // Normalize URLs for comparison (basic)
                    const normalize = (u: string) => u.replace(/\/$/, '').toLowerCase();
                    return normalize(s.url || '') === normalize(url);
                }

                return false;
            });

            if (isDuplicate) {
                setDuplicateWarning({
                    isOpen: true,
                    message: t('duplicate_source_warning') || 'A data source with this URL or configuration already exists. Do you want to create a duplicate?'
                });
                return;
            }
        }

        setIsSaving(true);
        try {
            const credentials: DataSource['credentials'] = {};

            // Set credentials based on type
            if (type === 'telegram') {
                credentials.username = telegramUsername;
                if (telegramToken) credentials.token = telegramToken;
            } else if (type === 'api') {
                if (apiKey) credentials.apiKey = apiKey;
                if (apiSecret) credentials.secret = apiSecret;
            }

            // Set URL based on type
            let finalUrl = url;
            if (type === 'telegram') {
                // For telegram, construct URL from username
                finalUrl = `https://t.me/${telegramUsername.replace('@', '')}`;
            } else if (type === 'webhook') {
                finalUrl = webhookUrl;
            }

            // Build config object for web crawler
            const config: any = {};
            if (type === 'web') {
                config.maxDepth = webMaxDepth;
                if (webSelector) config.selector = webSelector;
                config.delay = webDelay;
                config.renderJS = webRenderJS;
            }

            await onSave({
                name,
                type,
                url: finalUrl || undefined,
                endpoint: (type === 'api' && endpoint) ? endpoint : undefined,
                category,
                tags: tags.split(',').map(t => t.trim()).filter(t => t),
                status: source?.status || 'active',
                priority,
                updateInterval,
                credentials: Object.keys(credentials).length > 0 ? credentials : undefined,
                config: Object.keys(config).length > 0 ? config : undefined,
            });
        } catch (e) {
            console.error('Failed to save source:', e);
        } finally {
            setIsSaving(false);
        }
    };

    const isExistingTelegram = source?.type === 'telegram';
    const canCreateTelegram = !source;
    const availableTypes: DataSource['type'][] = source
        ? (source.type === 'telegram'
            ? ['telegram']
            : ['api', 'webhook', 'rss', 'web', 'website', 'aggregator', 'third_party'])
        : ['api', 'webhook', 'rss', 'web', 'website', 'aggregator', 'third_party'];

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-card border border-border rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                <h3 className="text-lg font-semibold text-foreground mb-4">
                    {source ? t('edit_source') || 'Edit Source' : t('create_source') || 'Create Data Source'}
                </h3>

                {duplicateWarning.isOpen && (
                    <div className="mb-4 bg-yellow-500/10 border border-yellow-500/30 rounded p-4">
                        <div className="flex items-start gap-3">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-yellow-400 mt-0.5 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                            </svg>
                            <div className="flex-1">
                                <h4 className="text-sm font-medium text-yellow-400 mb-1">
                                    {t('possible_duplicate') || 'Possible Duplicate Detected'}
                                </h4>
                                <p className="text-xs text-muted-foreground mb-3">
                                    {duplicateWarning.message}
                                </p>
                                <div className="flex gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setDuplicateWarning({ isOpen: false, message: '' })}
                                        className="px-3 py-1.5 text-xs font-medium text-foreground bg-secondary hover:bg-secondary/80 rounded transition-colors"
                                    >
                                        {t('cancel') || 'Cancel'}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handleSubmit}
                                        className="px-3 py-1.5 text-xs font-medium text-white bg-yellow-600 hover:bg-yellow-700 rounded transition-colors"
                                    >
                                        {t('confirm_duplicate') || 'Create Anyway'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {canCreateTelegram && (
                    <div className="mb-4 text-xs text-yellow-400 bg-yellow-500/10 border border-yellow-500/30 rounded p-3">
                        {t('telegram_source_hint') || 'Telegram channels are managed via Telegram Collector. Use that tab to add or edit Telegram data sources.'}
                    </div>
                )}
                {isExistingTelegram && (
                    <div className="mb-4 text-xs text-yellow-400 bg-yellow-500/10 border border-yellow-500/30 rounded p-3">
                        {t('telegram_source_edit_hint') || 'This Telegram source is read-only. Manage details through the Telegram Collector tab.'}
                    </div>
                )}

                <div className="space-y-4">
                    <div>
                        <label className="block text-sm text-muted-foreground mb-1">{t('name') || 'Name'} *</label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => {
                                setName(e.target.value);
                                if (errors.name) setErrors(prev => { const n = { ...prev }; delete n.name; return n; });
                            }}
                            className={`w-full p-2 bg-secondary border rounded text-foreground ${errors.name ? 'border-red-500' : 'border-border'}`}
                            placeholder={t('enter_source_name') || 'Enter source name'}
                        />
                        {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name}</p>}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm text-muted-foreground mb-1">
                                {t('type') || 'Type'} * {autoBadge('type')}
                            </label>
                            <select
                                value={type}
                                onChange={(e) => setType(e.target.value as DataSource['type'])}
                                className="w-full p-2 bg-secondary border border-border rounded text-foreground"
                                disabled={isExistingTelegram}
                            >
                                {availableTypes.map(opt => (
                                    <option key={opt} value={opt}>
                                        {opt.charAt(0).toUpperCase() + opt.slice(1).replace('_', ' ')}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm text-muted-foreground mb-1">
                                {t('category') || 'Category'} * {autoBadge('category')}
                            </label>
                            <select
                                value={category}
                                onChange={(e) => {
                                    setCategory(e.target.value);
                                    if (errors.category) setErrors(prev => { const n = { ...prev }; delete n.category; return n; });
                                }}
                                className={`w-full p-2 bg-secondary border rounded text-foreground ${errors.category ? 'border-red-500' : 'border-border'}`}
                            >
                                <option value="">{t('select_category') || 'Select category'}</option>
                                {categories.map(cat => (
                                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                                ))}
                            </select>
                            {errors.category && <p className="text-xs text-red-500 mt-1">{errors.category}</p>}
                        </div>
                    </div>

                    {/* Dynamic fields based on type */}
                    {type === 'telegram' && (
                        <>
                            <div>
                                <label className="block text-sm text-muted-foreground mb-1">
                                    {t('telegram_channel_username') || 'Telegram Channel Username'} * {autoBadge('telegramUsername')}
                                </label>
                                <div className="flex items-center gap-2">
                                    <span className="text-muted-foreground">@</span>
                                    <input
                                        type="text"
                                        value={telegramUsername.replace('@', '')}
                                        onChange={(e) => setTelegramUsername(e.target.value)}
                                        className="flex-1 p-2 bg-secondary border border-border rounded text-foreground"
                                        placeholder="channel_username"
                                    />
                                </div>
                                <p className="text-xs text-muted-foreground mt-1">
                                    {t('telegram_username_hint') || 'Enter channel username without @'}
                                </p>
                            </div>
                            <div>
                                <label className="block text-sm text-muted-foreground mb-1">
                                    {t('telegram_bot_token') || 'Telegram Bot Token'} (Optional)
                                </label>
                                <div className="relative">
                                    <input
                                        type={showTelegramToken ? 'text' : 'password'}
                                        value={telegramToken}
                                        onChange={(e) => setTelegramToken(e.target.value)}
                                        className="w-full p-2 pr-10 bg-secondary border border-border rounded text-foreground"
                                        placeholder="1234567890:ABCdefGHIjklMNOpqrsTUVwxyz"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowTelegramToken(!showTelegramToken)}
                                        className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                                        title={showTelegramToken ? t('hide') : t('show')}
                                    >
                                        {showTelegramToken ? (
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" />
                                            </svg>
                                        ) : (
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                            </svg>
                                        )}
                                    </button>
                                </div>
                                <p className="text-xs text-muted-foreground mt-1">
                                    {t('telegram_token_hint') || 'Required if you want to read messages from private channels'}
                                </p>
                            </div>
                        </>
                    )}

                    {type === 'webhook' && (
                        <div>
                            <label className="block text-sm text-muted-foreground mb-1">
                                {t('webhook_url') || 'Webhook URL'} *
                            </label>
                            <input
                                type="url"
                                value={webhookUrl}
                                onChange={(e) => setWebhookUrl(e.target.value)}
                                className="w-full p-2 bg-secondary border border-border rounded text-foreground"
                                placeholder="https://your-domain.com/webhook"
                            />
                            <p className="text-xs text-muted-foreground mt-1">
                                {t('webhook_url_hint') || 'URL where data will be sent via POST request'}
                            </p>
                        </div>
                    )}

                    {(type === 'api' || type === 'rss' || type === 'web' || type === 'website' || type === 'aggregator' || type === 'third_party') && (
                        <>
                            <div>
                                <label className="block text-sm text-muted-foreground mb-1">
                                    {t('url') || 'URL'} {type === 'api' || type === 'rss' || type === 'website' ? '*' : ''} {autoBadge('url')}
                                </label>
                                <div className="flex gap-2">
                                    <input
                                        type="url"
                                        value={url}
                                        onChange={(e) => setUrl(e.target.value)}
                                        className="flex-1 p-2 bg-secondary border border-border rounded text-foreground"
                                        placeholder={
                                            type === 'api' ? 'https://api.example.com' :
                                                type === 'rss' ? 'https://example.com/feed.xml' :
                                                    type === 'web' ? 'https://example.com' :
                                                        type === 'website' ? 'https://example.com' :
                                                            'https://example.com'
                                        }
                                    />
                                    <button
                                        type="button"
                                        onClick={() => detectTypeForUrl(url, 'ui-manual-detect')}
                                        disabled={isDetectingType || !url}
                                        className="px-3 py-2 text-xs bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded"
                                    >
                                        {isDetectingType ? (t('detecting') || 'Detecting...') : t('auto_detect') || 'Auto Detect'}
                                    </button>
                                </div>
                                {autoDetection && (
                                    <div className="mt-2 text-xs border border-border rounded-md p-2 bg-secondary/40">
                                        <div className="flex justify-between items-center">
                                            <div>
                                                <p className="font-semibold">
                                                    {t('suggested_type') || 'Suggested type'}: <span className="text-purple-300">{autoDetection.type}</span>
                                                </p>
                                                <p className="text-muted-foreground">
                                                    {(t('confidence') || 'Confidence')}: {(autoDetection.confidence * 100).toFixed(0)}% • {autoDetection.reason}
                                                </p>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => applyDetectionSuggestion(autoDetection)}
                                                className="text-xs px-2 py-1 bg-purple-600 hover:bg-purple-700 text-white rounded"
                                            >
                                                {t('apply') || 'Apply'}
                                            </button>
                                        </div>
                                        {autoDetection.meta?.contentType && (
                                            <p className="text-muted-foreground mt-1">
                                                {t('content_type') || 'Content'}: {autoDetection.meta.contentType}
                                            </p>
                                        )}
                                    </div>
                                )}
                                {detectionError && (
                                    <p className="text-xs text-red-400 mt-1">{detectionError}</p>
                                )}

                                {/* Test Connection Button */}
                                <div className="mt-3 flex items-center justify-between">
                                    <button
                                        type="button"
                                        onClick={handleTestConnection}
                                        disabled={isTesting || !url}
                                        className={`flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded border transition-colors ${testResult?.success ? 'border-green-500/50 text-green-400 bg-green-500/10' : 'border-purple-500/50 text-purple-300 bg-purple-500/10 hover:bg-purple-500/20'
                                            } disabled:opacity-50`}
                                    >
                                        {isTesting ? (
                                            <>
                                                <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24">
                                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                                </svg>
                                                {t('testing') || 'Testing...'}
                                            </>
                                        ) : (
                                            <>
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                                </svg>
                                                {t('test_connection') || 'Test Connection'}
                                            </>
                                        )}
                                    </button>

                                    {testResult && (
                                        <div className={`text-[11px] font-medium ${testResult.success ? 'text-green-400' : 'text-red-400'}`}>
                                            {testResult.success ? '✓' : '✗'} {testResult.message}
                                            {testResult.responseTime && (
                                                <span className="ml-2 opacity-70 text-muted-foreground">({testResult.responseTime}ms)</span>
                                            )}
                                        </div>
                                    )}
                                </div>

                                {testResult?.success && testResult.sampleData && (
                                    <div className="mt-2 border border-border rounded-md bg-secondary/20 overflow-hidden">
                                        <button
                                            type="button"
                                            onClick={() => setShowSampleData(!showSampleData)}
                                            className="w-full flex items-center justify-between px-3 py-2 text-xs font-medium bg-secondary/40 hover:bg-secondary/60 transition-colors"
                                        >
                                            <span>📊 {t('sample_data') || 'Sample Data Preview'}</span>
                                            <svg xmlns="http://www.w3.org/2000/svg" className={`h-3.5 w-3.5 transition-transform ${showSampleData ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                            </svg>
                                        </button>
                                        {showSampleData && (
                                            <div className="p-2 bg-black/40">
                                                <pre className="text-[10px] text-green-300 font-mono overflow-x-auto max-h-[150px] p-2 custom-scrollbar">
                                                    {JSON.stringify(testResult.sampleData, null, 2)}
                                                </pre>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            {type === 'api' && (
                                <>
                                    <div>
                                        <label className="block text-sm text-muted-foreground mb-1">
                                            {t('endpoint') || 'Endpoint'} (Optional)
                                        </label>
                                        <input
                                            type="text"
                                            value={endpoint}
                                            onChange={(e) => setEndpoint(e.target.value)}
                                            className="w-full p-2 bg-secondary border border-border rounded text-foreground"
                                            placeholder="/api/v1/data"
                                        />
                                        <p className="text-xs text-muted-foreground mt-1">
                                            {t('endpoint_hint') || 'API endpoint path (will be appended to base URL)'}
                                        </p>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm text-muted-foreground mb-1">
                                                {t('api_key') || 'API Key'} (Optional)
                                            </label>
                                            <div className="relative">
                                                <input
                                                    type={showApiKey ? 'text' : 'password'}
                                                    value={apiKey}
                                                    onChange={(e) => setApiKey(e.target.value)}
                                                    className="w-full p-2 pr-10 bg-secondary border border-border rounded text-foreground"
                                                    placeholder="Your API Key"
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => setShowApiKey(!showApiKey)}
                                                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                                                    title={showApiKey ? t('hide') : t('show')}
                                                >
                                                    {showApiKey ? (
                                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" />
                                                        </svg>
                                                    ) : (
                                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                                        </svg>
                                                    )}
                                                </button>
                                            </div>
                                        </div>
                                        <div>
                                            <label className="block text-sm text-muted-foreground mb-1">
                                                {t('api_secret') || 'API Secret'} (Optional)
                                            </label>
                                            <div className="relative">
                                                <input
                                                    type={showApiSecret ? 'text' : 'password'}
                                                    value={apiSecret}
                                                    onChange={(e) => setApiSecret(e.target.value)}
                                                    className="w-full p-2 pr-10 bg-secondary border border-border rounded text-foreground"
                                                    placeholder="Your API Secret"
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => setShowApiSecret(!showApiSecret)}
                                                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                                                    title={showApiSecret ? t('hide') : t('show')}
                                                >
                                                    {showApiSecret ? (
                                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" />
                                                        </svg>
                                                    ) : (
                                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                                        </svg>
                                                    )}
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </>
                            )}

                            {/* Web Crawler Config (TASK-FE-020) */}
                            {type === 'web' && (
                                <div className="border border-border rounded-lg p-4 space-y-4 bg-secondary/30">
                                    <h4 className="text-sm font-semibold text-foreground mb-2">🕷️ Web Crawler Settings</h4>

                                    <div>
                                        <label className="block text-sm text-muted-foreground mb-1">
                                            Max Depth: {webMaxDepth}
                                        </label>
                                        <input
                                            type="range"
                                            min="0"
                                            max="5"
                                            value={webMaxDepth}
                                            onChange={(e) => setWebMaxDepth(parseInt(e.target.value))}
                                            className="w-full"
                                        />
                                        <p className="text-xs text-muted-foreground mt-1">
                                            How many link levels to follow (0 = only starting page)
                                        </p>
                                    </div>

                                    <div>
                                        <label className="block text-sm text-muted-foreground mb-1">
                                            CSS Selector (Optional)
                                        </label>
                                        <input
                                            type="text"
                                            value={webSelector}
                                            onChange={(e) => setWebSelector(e.target.value)}
                                            className="w-full p-2 bg-background border border-border rounded text-foreground font-mono text-sm"
                                            placeholder="article, .content, #main"
                                        />
                                        <p className="text-xs text-muted-foreground mt-1">
                                            Extract specific content using CSS selector
                                        </p>
                                    </div>

                                    <div>
                                        <label className="block text-sm text-muted-foreground mb-1">
                                            Crawl Delay: {webDelay}ms
                                        </label>
                                        <input
                                            type="range"
                                            min="100"
                                            max="5000"
                                            step="100"
                                            value={webDelay}
                                            onChange={(e) => setWebDelay(parseInt(e.target.value))}
                                            className="w-full"
                                        />
                                        <p className="text-xs text-muted-foreground mt-1">
                                            Rate limiting delay between requests (100-5000ms)
                                        </p>
                                    </div>

                                    <div className="flex items-center gap-3 p-2 bg-background/40 rounded border border-border/50">
                                        <input
                                            type="checkbox"
                                            id="renderJS"
                                            checked={webRenderJS}
                                            onChange={(e) => setWebRenderJS(e.target.checked)}
                                            className="w-4 h-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                                        />
                                        <div>
                                            <label htmlFor="renderJS" className="text-sm font-medium text-foreground cursor-pointer">
                                                Render JavaScript
                                            </label>
                                            <p className="text-[10px] text-muted-foreground">
                                                Enable for sites that require JS (e.g. React, Vue, dynamic content). Slower but more thorough.
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </>
                    )}

                    <div>
                        <label className="block text-sm text-muted-foreground mb-1">
                            {t('tags') || 'Tags'} (comma-separated) {autoBadge('tags')}
                        </label>
                        <input
                            type="text"
                            value={tags}
                            onChange={(e) => setTags(e.target.value)}
                            className="w-full p-2 bg-secondary border border-border rounded text-foreground"
                            placeholder="price, real-time, market"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm text-muted-foreground mb-1">
                                {t('priority') || 'Priority'} {autoBadge('priority')}
                            </label>
                            <select
                                value={priority}
                                onChange={(e) => setPriority(e.target.value as DataSource['priority'])}
                                className="w-full p-2 bg-secondary border border-border rounded text-foreground"
                            >
                                <option value="low">{t('low') || 'Low'}</option>
                                <option value="medium">{t('medium') || 'Medium'}</option>
                                <option value="high">{t('high') || 'High'}</option>
                                <option value="critical">{t('critical') || 'Critical'}</option>
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm text-muted-foreground mb-1">
                                {t('update_interval') || 'Update Interval'} {autoBadge('updateInterval')}
                            </label>
                            <select
                                value={updateInterval}
                                onChange={(e) => setUpdateInterval(e.target.value as DataSource['updateInterval'])}
                                className="w-full p-2 bg-secondary border border-border rounded text-foreground"
                            >
                                <option value="realtime">{t('realtime') || 'Real-time'}</option>
                                <option value="1min">{t('1min') || '1 Minute'}</option>
                                <option value="5min">{t('5min') || '5 Minutes'}</option>
                                <option value="15min">{t('15min') || '15 Minutes'}</option>
                                <option value="30min">{t('30min') || '30 Minutes'}</option>
                                <option value="1hour">{t('1hour') || '1 Hour'}</option>
                                <option value="daily">{t('daily') || 'Daily'}</option>
                            </select>
                        </div>
                    </div>
                </div>

                <div className="flex justify-end gap-2 mt-6">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 bg-secondary hover:bg-accent text-secondary-foreground rounded-lg text-sm"
                        disabled={isSaving}
                    >
                        {t('cancel') || 'Cancel'}
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={isSaving}
                        className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded-lg text-sm"
                    >
                        {isSaving ? t('saving') || 'Saving...' : t('save') || 'Save'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default CreateSourceModal;

