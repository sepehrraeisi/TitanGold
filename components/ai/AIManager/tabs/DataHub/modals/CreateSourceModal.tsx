import React, { useEffect, useState } from 'react';
import * as api from '../../../../../../services/api';
import { useDataSourcesQuery } from '../../../../../../hooks/useDataHubState';
import { DataHubApiError } from '../../../../../../services/dataSourcesApi';
import { DataSource, DataCategory, DetectedSourceType } from '../../../../../../types';
import { dataSourceSchema } from '../../../../../../utils/validation';
import { ZodError } from 'zod';
import {
    DataHubModal,
    INPUT_CLASS,
    SELECT_CLASS,
    BTN_PRIMARY,
    BTN_SECONDARY,
    DataHubToggle,
} from '../dataHubUi';

type Props = {
    source?: DataSource | null;
    categories: DataCategory[];
    onClose: () => void;
    onSave: (source: Omit<DataSource, 'id' | 'createdAt' | 'updatedAt' | 'errorCount' | 'successRate' | 'reliabilityScore'>) => Promise<void>;
    t: (key: string) => string;
    setActiveView?: (view: 'sources' | 'categories' | 'pipeline' | 'health' | 'logs' | 'advanced' | 'telegram') => void;
};

const CreateSourceModal: React.FC<Props> = ({ source, categories, onClose, onSave, t, setActiveView }) => {
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
    const { data: sourcesList } = useDataSourcesQuery({ page: 1, limit: 200 });
    const listedSources = sourcesList?.data ?? [];
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
            setDetectionError(err?.message || t('source_type_detect_failed'));
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
                {t('auto')}
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
                message: err.message || t('connection_test_failed')
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
            alert(t('telegram_source_manage_in_collector'));
            return;
        }

        // Check for duplicates
        if (!duplicateWarning.isOpen && listedSources.length > 0) {
            const isDuplicate = listedSources.some(s => {
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
                    message: t('duplicate_source_warning')
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
            if (e instanceof DataHubApiError) {
                if (e.status === 400) {
                    setErrors({ form: e.message });
                } else if (e.status === 409) {
                    setDuplicateWarning({ isOpen: true, message: e.message });
                } else {
                    setErrors({ form: e.message });
                }
            } else if (e instanceof Error) {
                setErrors({ form: e.message });
            }
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

    const modalTitle = source ? t('edit_source') : t('create_source');

    return (
        <DataHubModal
            title={modalTitle}
            onClose={onClose}
            maxWidth="max-w-2xl"
            footer={
                <>
                    {isExistingTelegram && setActiveView && (
                        <button
                            type="button"
                            onClick={() => {
                                onClose();
                                setActiveView('telegram');
                            }}
                            className="text-[11px] px-3 py-1.5 rounded-full border border-sky-500/60 text-sky-200 hover:bg-sky-500/10 mr-auto"
                        >
                            {t('open_in_telegram_collector')}
                        </button>
                    )}
                    <button type="button" onClick={onClose} disabled={isSaving} className={BTN_SECONDARY}>
                        {t('cancel')}
                    </button>
                    <button
                        type="button"
                        onClick={handleSubmit}
                        disabled={isSaving || isExistingTelegram}
                        className={BTN_PRIMARY}
                    >
                        {isSaving ? t('saving') : t('save')}
                    </button>
                </>
            }
        >
                {duplicateWarning.isOpen && (
                    <div className="mb-4 bg-yellow-500/10 border border-yellow-500/30 rounded p-4">
                        <div className="flex items-start gap-3">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-yellow-400 mt-0.5 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                            </svg>
                            <div className="flex-1">
                                <h4 className="text-sm font-medium text-yellow-400 mb-1">
                                    {t('possible_duplicate')}
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
                                        {t('cancel')}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handleSubmit}
                                        className="px-3 py-1.5 text-xs font-medium text-white bg-yellow-600 hover:bg-yellow-700 rounded transition-colors"
                                    >
                                        {t('confirm_duplicate')}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {canCreateTelegram && (
                    <div className="mb-4 text-xs text-yellow-400 bg-yellow-500/10 border border-yellow-500/30 rounded p-3">
                        {t('telegram_source_hint')}
                    </div>
                )}
                {isExistingTelegram && (
                    <div className="mb-4 space-y-2">
                        <div className="text-xs text-yellow-400 bg-yellow-500/10 border border-yellow-500/30 rounded p-3">
                            {t('telegram_source_edit_hint')}
                        </div>
                        {source?.config && (
                            <div className="text-[11px] bg-slate-900/60 border border-slate-700/50 rounded p-3">
                                <p className="text-muted-foreground mb-2">
                                    {t('telegram_channel_settings')}
                                </p>
                                <div className="grid grid-cols-2 gap-2">
                                    {source.config.channelUsername && (
                                        <div>
                                            <p className="text-muted-foreground">
                                                {t('username')}
                                            </p>
                                            <p className="font-mono text-sky-300">
                                                @{source.config.channelUsername}
                                            </p>
                                        </div>
                                    )}
                                    {source.config.fetchLimit !== undefined && (
                                        <div>
                                            <p className="text-muted-foreground">
                                                {t('fetch_limit')}
                                            </p>
                                            <p className="text-foreground">
                                                {source.config.fetchLimit}
                                            </p>
                                        </div>
                                    )}
                                    <div>
                                        <p className="text-muted-foreground">
                                            {t('include_media')}
                                        </p>
                                        <p className="text-foreground">
                                            {source.config.includeMedia !== false
                                                ? t('yes')
                                                : t('no')}
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-muted-foreground">
                                            {t('parse_urls')}
                                        </p>
                                        <p className="text-foreground">
                                            {source.config.parseUrls !== false
                                                ? t('yes')
                                                : t('no')}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                <div className="space-y-4">
                    <div>
                        <label className="block text-sm text-muted-foreground mb-1">{t('name')} *</label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => {
                                setName(e.target.value);
                                if (errors.name) setErrors(prev => { const n = { ...prev }; delete n.name; return n; });
                            }}
                            className={`${INPUT_CLASS} ${errors.name ? 'border-red-500' : ''}`}
                            placeholder={t('enter_source_name')}
                        />
                        {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name}</p>}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm text-muted-foreground mb-1">
                                {t('type')} * {autoBadge('type')}
                            </label>
                            <select
                                value={type}
                                onChange={(e) => setType(e.target.value as DataSource['type'])}
                                className={INPUT_CLASS}
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
                                {t('category')} * {autoBadge('category')}
                            </label>
                            <select
                                value={category}
                                onChange={(e) => {
                                    setCategory(e.target.value);
                                    if (errors.category) setErrors(prev => { const n = { ...prev }; delete n.category; return n; });
                                }}
                                className={`${INPUT_CLASS} ${errors.category ? 'border-red-500' : ''}`}
                            >
                                <option value="">{t('select_category')}</option>
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
                                    {t('telegram_channel_username')} * {autoBadge('telegramUsername')}
                                </label>
                                <div className="flex items-center gap-2">
                                    <span className="text-muted-foreground">@</span>
                                    <input
                                        type="text"
                                        value={telegramUsername.replace('@', '')}
                                        onChange={(e) => setTelegramUsername(e.target.value)}
                                        className={`flex-1 ${INPUT_CLASS}`}
                                        placeholder={t('source_placeholder_channel_username')}
                                    />
                                </div>
                                <p className="text-xs text-muted-foreground mt-1">
                                    {t('telegram_username_hint')}
                                </p>
                            </div>
                            <div>
                                <label className="block text-sm text-muted-foreground mb-1">
                                    {t('telegram_bot_token')} {' '}({t('optional')})
                                </label>
                                <div className="relative">
                                    <input
                                        type={showTelegramToken ? 'text' : 'password'}
                                        value={telegramToken}
                                        onChange={(e) => setTelegramToken(e.target.value)}
                                        className={`w-full pr-10 ${INPUT_CLASS}`}
                                        placeholder={t('source_placeholder_telegram_token')}
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
                                    {t('telegram_token_hint')}
                                </p>
                            </div>
                        </>
                    )}

                    {type === 'webhook' && (
                        <div>
                            <label className="block text-sm text-muted-foreground mb-1">
                                {t('webhook_url')} *
                            </label>
                            <input
                                type="url"
                                value={webhookUrl}
                                onChange={(e) => setWebhookUrl(e.target.value)}
                                className={INPUT_CLASS}
                                placeholder={t('source_placeholder_webhook')}
                            />
                            <p className="text-xs text-muted-foreground mt-1">
                                {t('webhook_url_hint')}
                            </p>
                        </div>
                    )}

                    {(type === 'api' || type === 'rss' || type === 'web' || type === 'website' || type === 'aggregator' || type === 'third_party') && (
                        <>
                            <div>
                                <label className="block text-sm text-muted-foreground mb-1">
                                    {t('url')} {type === 'api' || type === 'rss' || type === 'website' ? '*' : ''} {autoBadge('url')}
                                </label>
                                <div className="flex gap-2">
                                    <input
                                        type="url"
                                        value={url}
                                        onChange={(e) => setUrl(e.target.value)}
                                        className={`flex-1 ${INPUT_CLASS}`}
                                        placeholder={
                                            type === 'api'
                                                ? t('source_placeholder_url_api')
                                                : type === 'rss'
                                                  ? t('source_placeholder_url_rss')
                                                  : type === 'web' || type === 'website'
                                                    ? t('source_placeholder_url_web')
                                                    : t('source_placeholder_url_default')
                                        }
                                    />
                                    <button
                                        type="button"
                                        onClick={() => detectTypeForUrl(url, 'ui-manual-detect')}
                                        disabled={isDetectingType || !url}
                                        className="px-3 py-2 text-xs bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded"
                                    >
                                        {isDetectingType ? (t('detecting')) : t('auto_detect')}
                                    </button>
                                </div>
                                {autoDetection && (
                                    <div className="mt-2 text-xs border border-border rounded-md p-2 bg-secondary/40">
                                        <div className="flex justify-between items-center">
                                            <div>
                                                <p className="font-semibold">
                                                    {t('suggested_type')}: <span className="text-purple-300">{autoDetection.type}</span>
                                                </p>
                                                <p className="text-muted-foreground">
                                                    {(t('confidence'))}: {(autoDetection.confidence * 100).toFixed(0)}% • {autoDetection.reason}
                                                </p>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => applyDetectionSuggestion(autoDetection)}
                                                className="text-xs px-2 py-1 bg-purple-600 hover:bg-purple-700 text-white rounded"
                                            >
                                                {t('apply')}
                                            </button>
                                        </div>
                                        {autoDetection.meta?.contentType && (
                                            <p className="text-muted-foreground mt-1">
                                                {t('content_type')}: {autoDetection.meta.contentType}
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
                                                {t('testing')}
                                            </>
                                        ) : (
                                            <>
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                                </svg>
                                                {t('test_connection')}
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
                                            <span>📊 {t('sample_data')}</span>
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
                                            {t('endpoint')} {' '}({t('optional')})
                                        </label>
                                        <input
                                            type="text"
                                            value={endpoint}
                                            onChange={(e) => setEndpoint(e.target.value)}
                                            className={INPUT_CLASS}
                                            placeholder={t('source_placeholder_endpoint')}
                                        />
                                        <p className="text-xs text-muted-foreground mt-1">
                                            {t('endpoint_hint')}
                                        </p>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm text-muted-foreground mb-1">
                                                {t('api_key')} {' '}({t('optional')})
                                            </label>
                                            <div className="relative">
                                                <input
                                                    type={showApiKey ? 'text' : 'password'}
                                                    value={apiKey}
                                                    onChange={(e) => setApiKey(e.target.value)}
                                                    className={`w-full pr-10 ${INPUT_CLASS}`}
                                                    placeholder={t('source_placeholder_api_key')}
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
                                                {t('api_secret')} {' '}({t('optional')})
                                            </label>
                                            <div className="relative">
                                                <input
                                                    type={showApiSecret ? 'text' : 'password'}
                                                    value={apiSecret}
                                                    onChange={(e) => setApiSecret(e.target.value)}
                                                    className={`w-full pr-10 ${INPUT_CLASS}`}
                                                    placeholder={t('source_placeholder_api_secret')}
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
                                <div className="rounded-xl border border-white/5 bg-slate-950/70 p-4 space-y-4">
                                    <h4 className="text-[11px] font-semibold text-foreground">
                                        {t('web_crawler_settings')}
                                    </h4>

                                    <div>
                                        <label className="block text-[11px] text-muted-foreground mb-1">
                                            {t('web_crawler_max_depth')}: {webMaxDepth}
                                        </label>
                                        <input
                                            type="range"
                                            min="0"
                                            max="5"
                                            value={webMaxDepth}
                                            onChange={(e) => setWebMaxDepth(parseInt(e.target.value))}
                                            className="w-full"
                                        />
                                        <p className="text-[10px] text-muted-foreground mt-1">
                                            {t('web_crawler_max_depth_hint')}
                                        </p>
                                    </div>

                                    <div>
                                        <label className="block text-[11px] text-muted-foreground mb-1">
                                            {t('web_crawler_css_selector')}
                                        </label>
                                        <input
                                            type="text"
                                            value={webSelector}
                                            onChange={(e) => setWebSelector(e.target.value)}
                                            className={`${INPUT_CLASS} font-mono`}
                                            placeholder={t('web_crawler_css_placeholder')}
                                        />
                                        <p className="text-[10px] text-muted-foreground mt-1">
                                            {t('web_crawler_css_selector_hint')}
                                        </p>
                                    </div>

                                    <div>
                                        <label className="block text-[11px] text-muted-foreground mb-1">
                                            {t('web_crawler_delay')}: {webDelay}ms
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
                                        <p className="text-[10px] text-muted-foreground mt-1">
                                            {t('web_crawler_delay_hint')}
                                        </p>
                                    </div>

                                    <DataHubToggle
                                        id="renderJS"
                                        checked={webRenderJS}
                                        onChange={setWebRenderJS}
                                        label={t('web_crawler_render_js')}
                                    />
                                    <p className="text-[10px] text-muted-foreground -mt-2">
                                        {t('web_crawler_render_js_hint')}
                                    </p>
                                </div>
                            )}
                        </>
                    )}

                    <div>
                        <label className="block text-sm text-muted-foreground mb-1">
                            {t('tags')} (comma-separated) {autoBadge('tags')}
                        </label>
                        <input
                            type="text"
                            value={tags}
                            onChange={(e) => setTags(e.target.value)}
                            className={INPUT_CLASS}
                            placeholder={t('source_tags_placeholder')}
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm text-muted-foreground mb-1">
                                {t('priority')} {autoBadge('priority')}
                            </label>
                            <select
                                value={priority}
                                onChange={(e) => setPriority(e.target.value as DataSource['priority'])}
                                className={INPUT_CLASS}
                            >
                                <option value="low">{t('low')}</option>
                                <option value="medium">{t('medium')}</option>
                                <option value="high">{t('high')}</option>
                                <option value="critical">{t('critical')}</option>
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm text-muted-foreground mb-1">
                                {t('update_interval')} {autoBadge('updateInterval')}
                            </label>
                            <select
                                value={updateInterval}
                                onChange={(e) => setUpdateInterval(e.target.value as DataSource['updateInterval'])}
                                className={INPUT_CLASS}
                            >
                                <option value="realtime">{t('realtime')}</option>
                                <option value="1min">{t('1min')}</option>
                                <option value="5min">{t('5min')}</option>
                                <option value="15min">{t('15min')}</option>
                                <option value="30min">{t('30min')}</option>
                                <option value="1hour">{t('1hour')}</option>
                                <option value="daily">{t('daily')}</option>
                            </select>
                        </div>
                    </div>
                </div>
        </DataHubModal>
    );
};

export default CreateSourceModal;

