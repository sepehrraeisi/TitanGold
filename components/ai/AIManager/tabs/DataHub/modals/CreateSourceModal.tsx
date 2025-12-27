import React, { useEffect, useState } from 'react';
import * as api from '../../../../../../services/api.ts';
import { DataSource, DataCategory, DetectedSourceType } from '../../../../../../types.ts';

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
    
    // Telegram specific fields
    const [telegramUsername, setTelegramUsername] = useState(source?.credentials?.username || '');
    const [telegramToken, setTelegramToken] = useState(source?.credentials?.token || '');
    
    // API credentials
    const [apiKey, setApiKey] = useState(source?.credentials?.apiKey || '');
    const [apiSecret, setApiSecret] = useState(source?.credentials?.secret || '');
    
    // Webhook specific
    const [webhookUrl, setWebhookUrl] = useState(source?.url || '');
    
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
    
    const handleSubmit = async () => {
        if (!name || !category) {
            alert(t('fill_required_fields') || 'Please fill all required fields');
            return;
        }
        if (type === 'telegram') {
            alert(t('telegram_source_manage_in_collector') || 'Telegram sources are managed via Telegram Collector.');
                return;
            }
        
        // Validate based on type
        if (type === 'api' || type === 'webhook' || type === 'rss' || type === 'website') {
            if (!url && type !== 'webhook') {
                alert(t('url_required') || 'URL is required for this type');
                return;
            }
            if (type === 'webhook' && !webhookUrl) {
                alert(t('webhook_url_required') || 'Webhook URL is required');
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
            : ['api', 'webhook', 'rss', 'website', 'aggregator', 'third_party'])
        : ['api', 'webhook', 'rss', 'website', 'aggregator', 'third_party'];
    
    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-card border border-border rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                <h3 className="text-lg font-semibold text-foreground mb-4">
                    {source ? t('edit_source') || 'Edit Source' : t('create_source') || 'Create Data Source'}
                </h3>
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
                            onChange={(e) => setName(e.target.value)}
                            className="w-full p-2 bg-secondary border border-border rounded text-foreground"
                            placeholder={t('enter_source_name') || 'Enter source name'}
                        />
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
                                onChange={(e) => setCategory(e.target.value)}
                                className="w-full p-2 bg-secondary border border-border rounded text-foreground"
                            >
                                <option value="">{t('select_category') || 'Select category'}</option>
                                {categories.map(cat => (
                                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                                ))}
                            </select>
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
                                <input
                                    type="password"
                                    value={telegramToken}
                                    onChange={(e) => setTelegramToken(e.target.value)}
                                    className="w-full p-2 bg-secondary border border-border rounded text-foreground"
                                    placeholder="1234567890:ABCdefGHIjklMNOpqrsTUVwxyz"
                                />
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
                    
                    {(type === 'api' || type === 'rss' || type === 'website' || type === 'aggregator' || type === 'third_party') && (
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
                                            <input
                                                type="password"
                                                value={apiKey}
                                                onChange={(e) => setApiKey(e.target.value)}
                                                className="w-full p-2 bg-secondary border border-border rounded text-foreground"
                                                placeholder="Your API Key"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm text-muted-foreground mb-1">
                                                {t('api_secret') || 'API Secret'} (Optional)
                                            </label>
                                            <input
                                                type="password"
                                                value={apiSecret}
                                                onChange={(e) => setApiSecret(e.target.value)}
                                                className="w-full p-2 bg-secondary border border-border rounded text-foreground"
                                                placeholder="Your API Secret"
                                            />
                                        </div>
                                    </div>
                                </>
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

