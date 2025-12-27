import React from 'react';
import { DataSource } from '../../../../../../types.ts';

type Props = {
    source: DataSource;
    data: any;
    isLoading: boolean;
    onClose: () => void;
    onRefresh: () => void;
    t: (key: string) => string;
};

const ViewSourceDataModal: React.FC<Props> = ({ source, data, isLoading, onClose, onRefresh, t }) => {
    const formatData = (data: any): string => {
        if (!data) return t('no_data') || 'No data';
        
        try {
            if (typeof data === 'string') {
                return data;
            }
            return JSON.stringify(data, null, 2);
        } catch (e) {
            return String(data);
        }
    };
    
    const formatPriceData = (data: any) => {
        if (!data) return null;
        if (data.symbol && data.price) {
            return {
                symbol: data.symbol,
                price: typeof data.price === 'number' ? data.price.toFixed(2) : data.price,
                change24h: data.change24h ? `${data.change24h > 0 ? '+' : ''}${data.change24h.toFixed(2)}%` : 'N/A',
                volume: data.volume ? typeof data.volume === 'number' ? data.volume.toLocaleString() : data.volume : 'N/A',
            };
        }
        return null;
    };
    
    const formatNewsData = (data: any) => {
        if (!data) return null;
        // For Telegram sources, prefer articles format (structured for agents)
        if (data.articles && Array.isArray(data.articles)) {
            return data.articles;
        }
        return null;
    };
    
    const priceData = formatPriceData(data);
    const newsData = formatNewsData(data);
    
    // For Telegram sources, check if we have articles (structured format for agents)
    const telegramArticles = source.type === 'telegram' && data?.articles && Array.isArray(data.articles) ? data.articles : null;
    
    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-card border border-border rounded-lg p-6 w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
                <div className="flex justify-between items-center mb-4">
                    <div>
                        <h3 className="text-lg font-semibold text-foreground">
                            {t('view_source_data') || 'View Source Data'}
                        </h3>
                        <p className="text-sm text-muted-foreground mt-1">
                            {source.name} • {source.type}
                        </p>
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={onRefresh}
                            disabled={isLoading}
                            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded text-sm"
                        >
                            {isLoading ? t('loading') || 'Loading...' : t('refresh') || 'Refresh'}
                        </button>
                        <button
                            onClick={onClose}
                            className="px-3 py-1.5 bg-secondary hover:bg-accent text-secondary-foreground rounded text-sm"
                        >
                            {t('close') || 'Close'}
                        </button>
                    </div>
                </div>
                
                <div className="flex-1 overflow-y-auto">
                    {isLoading ? (
                        <div className="flex items-center justify-center h-64">
                            <div className="text-center">
                                <div className="animate-spin text-4xl mb-2">⚙️</div>
                                <p className="text-muted-foreground">{t('loading_data') || 'Loading data...'}</p>
                            </div>
                        </div>
                    ) : !data ? (
                        <div className="text-center p-10 text-muted-foreground">
                            {t('no_data_available') || 'No data available'}
                        </div>
                    ) : data.error ? (
                        <div className="space-y-4">
                            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
                                <h4 className="font-semibold text-red-400 mb-2">{t('error_fetching_data') || 'Error Fetching Data'}</h4>
                                <p className="text-sm text-muted-foreground mb-2">{data.message || data.details || 'Unknown error'}</p>
                                {data.url && data.url !== 'Not configured' && (
                                    <p className="text-xs text-muted-foreground">
                                        {t('source_url') || 'Source URL'}: {data.url}
                                    </p>
                                )}
                                {data.channel && (
                                    <p className="text-xs text-muted-foreground">
                                        {t('channel') || 'Channel'}: @{data.channel}
                                    </p>
                                )}
                                {data.note && (
                                    <div className="mt-3 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded">
                                        <p className="text-sm text-yellow-400">{data.note}</p>
                                    </div>
                                )}
                                {data.suggestion && (
                                    <div className="mt-2 p-2 bg-blue-500/10 border border-blue-500/30 rounded">
                                        <p className="text-xs text-blue-400">{data.suggestion}</p>
                                    </div>
                                )}
                                {data.instructions && Array.isArray(data.instructions) && (
                                    <div className="mt-3 p-3 bg-secondary/50 rounded">
                                        <p className="text-xs font-semibold text-foreground mb-2">{t('instructions') || 'Instructions'}:</p>
                                        <ul className="text-xs text-muted-foreground space-y-1">
                                            {data.instructions.map((instruction: string, idx: number) => (
                                                <li key={idx}>{instruction}</li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                            </div>
                            {data.source && (
                                <div className="bg-secondary/50 rounded-lg p-4">
                                    <h4 className="font-semibold text-foreground mb-2 text-sm">{t('raw_data') || 'Raw Data'}</h4>
                                    <pre className="text-xs text-muted-foreground overflow-x-auto">
                                        {formatData(data)}
                                    </pre>
                                </div>
                            )}
                        </div>
                    ) : telegramArticles && telegramArticles.length > 0 ? (
                        <div className="space-y-4">
                            <div className="bg-secondary/50 rounded-lg p-4">
                                <h4 className="font-semibold text-foreground mb-3">
                                    {t('telegram_articles') || 'Telegram Articles'}
                                    {data.channel && ` - @${data.channel}`}
                                </h4>
                                {data.totalMessages && (
                                    <p className="text-xs text-muted-foreground mb-3">
                                        {t('total_articles') || 'Total Articles'}: {telegramArticles.length}
                                    </p>
                                )}
                                <div className="space-y-3">
                                    {telegramArticles.map((article: any, idx: number) => (
                                        <div key={idx} className="border border-border rounded p-3 hover:bg-secondary/30 transition-colors">
                                            <h5 className="font-semibold text-foreground mb-2">{article.title}</h5>
                                            <p className="text-sm text-muted-foreground mb-3 whitespace-pre-wrap">{article.content}</p>
                                            <div className="flex justify-between items-center text-xs text-muted-foreground">
                                                <div className="flex gap-3">
                                                    {article.author && <span>{article.author}</span>}
                                                    {article.source && <span>{article.source}</span>}
                                                </div>
                                                <div className="flex gap-3">
                                                    {article.link && (
                                                        <a 
                                                            href={article.link} 
                                                            target="_blank" 
                                                            rel="noopener noreferrer"
                                                            className="text-blue-400 hover:text-blue-300"
                                                        >
                                                            {t('view_message') || 'View Message'}
                                                        </a>
                                                    )}
                                                    <span>{new Date(article.publishedAt).toLocaleString()}</span>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                {data.note && (
                                    <div className="mt-3 p-2 bg-blue-500/10 border border-blue-500/30 rounded">
                                        <p className="text-xs text-blue-400">{data.note}</p>
                                    </div>
                                )}
                            </div>
                            <div className="bg-secondary/30 rounded-lg p-4">
                                <h4 className="font-semibold text-foreground mb-2 text-sm">{t('raw_data') || 'Raw Data'}</h4>
                                <pre className="text-xs text-muted-foreground overflow-x-auto max-h-64 overflow-y-auto">
                                    {formatData(data)}
                                </pre>
                            </div>
                        </div>
                    ) : data.messages && Array.isArray(data.messages) ? (
                        <div className="space-y-4">
                            <div className="bg-secondary/50 rounded-lg p-4">
                                <h4 className="font-semibold text-foreground mb-3">
                                    {t('telegram_messages') || 'Telegram Messages'}
                                    {data.channel && ` - @${data.channel}`}
                                </h4>
                                {data.totalMessages && (
                                    <p className="text-xs text-muted-foreground mb-3">
                                        {t('total_messages') || 'Total'}: {data.totalMessages}
                                    </p>
                                )}
                                <div className="space-y-3">
                                    {data.messages.map((msg: any, idx: number) => (
                                        <div key={idx} className="border border-border rounded p-3">
                                            <p className="text-sm text-foreground mb-2">{msg.text}</p>
                                            <div className="flex justify-between items-center text-xs text-muted-foreground">
                                                <span>{msg.chat || data.channel}</span>
                                                <span>{new Date(msg.timestamp).toLocaleString()}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                {data.note && (
                                    <div className="mt-3 p-2 bg-blue-500/10 border border-blue-500/30 rounded">
                                        <p className="text-xs text-blue-400">{data.note}</p>
                                    </div>
                                )}
                            </div>
                            <div className="bg-secondary/30 rounded-lg p-4">
                                <h4 className="font-semibold text-foreground mb-2 text-sm">{t('raw_data') || 'Raw Data'}</h4>
                                <pre className="text-xs text-muted-foreground overflow-x-auto max-h-64 overflow-y-auto">
                                    {formatData(data)}
                                </pre>
                            </div>
                        </div>
                    ) : priceData ? (
                        <div className="space-y-4">
                            <div className="bg-secondary/50 rounded-lg p-4">
                                <h4 className="font-semibold text-foreground mb-3">{t('price_data') || 'Price Data'}</h4>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                    <div>
                                        <p className="text-xs text-muted-foreground mb-1">{t('symbol') || 'Symbol'}</p>
                                        <p className="font-semibold text-foreground">{priceData.symbol}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-muted-foreground mb-1">{t('price') || 'Price'}</p>
                                        <p className="font-semibold text-foreground">${priceData.price}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-muted-foreground mb-1">{t('change_24h') || '24h Change'}</p>
                                        <p className={`font-semibold ${priceData.change24h.startsWith('+') ? 'text-green-400' : priceData.change24h.startsWith('-') ? 'text-red-400' : 'text-foreground'}`}>
                                            {priceData.change24h}
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-muted-foreground mb-1">{t('volume') || 'Volume'}</p>
                                        <p className="font-semibold text-foreground">{priceData.volume}</p>
                                    </div>
                                </div>
                            </div>
                            <div className="bg-secondary/30 rounded-lg p-4">
                                <h4 className="font-semibold text-foreground mb-2 text-sm">{t('raw_data') || 'Raw Data'}</h4>
                                <pre className="text-xs text-muted-foreground overflow-x-auto">
                                    {formatData(data)}
                                </pre>
                            </div>
                        </div>
                    ) : newsData ? (
                        <div className="space-y-4">
                            <div className="bg-secondary/50 rounded-lg p-4">
                                <h4 className="font-semibold text-foreground mb-3">{t('news_articles') || 'News Articles'}</h4>
                                <div className="space-y-3">
                                    {newsData.slice(0, 10).map((article: any, idx: number) => (
                                        <div key={idx} className="border border-border rounded p-3">
                                            <h5 className="font-semibold text-foreground mb-1">{article.title || t('no_title') || 'No Title'}</h5>
                                            {article.content && (
                                                <p className="text-sm text-muted-foreground mb-2 line-clamp-2">{article.content}</p>
                                            )}
                                            {article.timestamp && (
                                                <p className="text-xs text-muted-foreground">
                                                    {new Date(article.timestamp).toLocaleString()}
                                                </p>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                            <div className="bg-secondary/30 rounded-lg p-4">
                                <h4 className="font-semibold text-foreground mb-2 text-sm">{t('raw_data') || 'Raw Data'}</h4>
                                <pre className="text-xs text-muted-foreground overflow-x-auto max-h-64 overflow-y-auto">
                                    {formatData(data)}
                                </pre>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <div className="bg-secondary/50 rounded-lg p-4">
                                <h4 className="font-semibold text-foreground mb-3">{t('data_preview') || 'Data Preview'}</h4>
                                <pre className="text-xs text-muted-foreground overflow-x-auto max-h-96 overflow-y-auto whitespace-pre-wrap break-words">
                                    {formatData(data)}
                                </pre>
                            </div>
                        </div>
                    )}
                </div>
                
                <div className="mt-4 pt-4 border-t border-border text-xs text-muted-foreground">
                    <p>
                        {t('source_url') || 'Source URL'}: {source.url || t('not_configured') || 'Not configured'}
                    </p>
                    {source.endpoint && (
                        <p>
                            {t('endpoint') || 'Endpoint'}: {source.endpoint}
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ViewSourceDataModal;

