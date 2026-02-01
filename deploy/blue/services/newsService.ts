// Verified News Grid Service for Titan Trading System
// Supports multiple providers: NewsAPI, CryptoCompare, CoinDesk, CoinTelegraph

export interface NewsConfig {
    provider: 'newsapi' | 'cryptocompare' | 'coindesk' | 'cointelegraph' | 'custom';
    apiKey?: string;
    apiUrl?: string; // For custom provider
    sources?: string[]; // News sources to fetch from
}

export interface NewsArticle {
    id: string;
    title: string;
    description?: string;
    content?: string;
    url: string;
    imageUrl?: string;
    source: string;
    author?: string;
    publishedAt: string;
    category?: string;
    sentiment?: 'positive' | 'negative' | 'neutral';
    relevanceScore?: number;
    verified?: boolean;
}

export interface NewsResult {
    success: boolean;
    articles?: NewsArticle[];
    totalResults?: number;
    error?: string;
}

// Test News API connection
export const testNewsConnection = async (config: NewsConfig): Promise<{ success: boolean; error?: string; latency?: number }> => {
    const startTime = Date.now();
    
    try {
        if (!config.apiKey && config.provider !== 'custom') {
            return { success: false, error: 'API key is required' };
        }
        
        if (config.provider === 'newsapi') {
            const response = await fetch(
                `https://newsapi.org/v2/top-headlines?country=us&category=business&apiKey=${config.apiKey}&pageSize=1`
            );
            
            if (!response.ok) {
                if (response.status === 401) {
                    return { success: false, error: 'Invalid API key' };
                }
                return { success: false, error: `HTTP ${response.status}: ${response.statusText}` };
            }
            
            const data = await response.json();
            if (data.status === 'ok') {
                const latency = Date.now() - startTime;
                return { success: true, latency };
            }
            
            return { success: false, error: data.message || 'NewsAPI error' };
        } else if (config.provider === 'cryptocompare') {
            const response = await fetch(
                `https://min-api.cryptocompare.com/data/v2/news/?lang=EN&api_key=${config.apiKey || ''}`
            );
            
            if (!response.ok) {
                return { success: false, error: `HTTP ${response.status}: ${response.statusText}` };
            }
            
            const data = await response.json();
            if (data.Response === 'Success' || data.Data) {
                const latency = Date.now() - startTime;
                return { success: true, latency };
            }
            
            return { success: false, error: data.Message || 'CryptoCompare API error' };
        } else if (config.provider === 'coindesk' || config.provider === 'cointelegraph') {
            // These are RSS feeds, test by fetching
            const rssUrl = config.provider === 'coindesk' 
                ? 'https://www.coindesk.com/arc/outboundfeeds/rss/'
                : 'https://cointelegraph.com/rss';
            
            const response = await fetch(rssUrl);
            if (response.ok) {
                const latency = Date.now() - startTime;
                return { success: true, latency };
            }
            return { success: false, error: `HTTP ${response.status}: ${response.statusText}` };
        } else if (config.provider === 'custom' && config.apiUrl) {
            const response = await fetch(config.apiUrl);
            if (response.ok) {
                const latency = Date.now() - startTime;
                return { success: true, latency };
            }
            return { success: false, error: `HTTP ${response.status}: ${response.statusText}` };
        }
        
        return { success: false, error: 'Unsupported provider or missing configuration' };
    } catch (e: any) {
        return { success: false, error: e.message || 'News API connection test failed' };
    }
};

// Fetch news articles
export const fetchNewsArticles = async (
    config: NewsConfig,
    query?: string,
    limit: number = 20
): Promise<NewsResult> => {
    try {
        if (config.provider === 'newsapi') {
            const queryParam = query ? `&q=${encodeURIComponent(query)}` : '';
            const sourcesParam = config.sources && config.sources.length > 0 
                ? `&sources=${config.sources.join(',')}` 
                : '&category=business';
            
            const response = await fetch(
                `https://newsapi.org/v2/everything?${queryParam}${sourcesParam}&language=en&sortBy=publishedAt&pageSize=${limit}&apiKey=${config.apiKey}`
            );
            
            if (!response.ok) {
                return { success: false, error: `HTTP ${response.status}` };
            }
            
            const data = await response.json();
            if (data.status === 'ok' && Array.isArray(data.articles)) {
                const articles: NewsArticle[] = data.articles.map((article: any, index: number) => ({
                    id: `newsapi-${index}-${Date.now()}`,
                    title: article.title || '',
                    description: article.description,
                    content: article.content,
                    url: article.url,
                    imageUrl: article.urlToImage,
                    source: article.source?.name || 'Unknown',
                    author: article.author,
                    publishedAt: article.publishedAt,
                    category: 'crypto',
                    verified: false,
                }));
                
                return { success: true, articles, totalResults: data.totalResults };
            }
            
            return { success: false, error: data.message || 'Failed to fetch news' };
        } else if (config.provider === 'cryptocompare') {
            const response = await fetch(
                `https://min-api.cryptocompare.com/data/v2/news/?lang=EN&limit=${limit}${config.apiKey ? `&api_key=${config.apiKey}` : ''}`
            );
            
            if (!response.ok) {
                return { success: false, error: `HTTP ${response.status}` };
            }
            
            const data = await response.json();
            if (data.Response === 'Success' && Array.isArray(data.Data)) {
                const articles: NewsArticle[] = data.Data.map((article: any, index: number) => ({
                    id: `cryptocompare-${index}-${Date.now()}`,
                    title: article.title || '',
                    description: article.body,
                    url: article.url,
                    imageUrl: article.imageurl,
                    source: article.source || 'CryptoCompare',
                    publishedAt: new Date(article.published_on * 1000).toISOString(),
                    category: 'crypto',
                    verified: false,
                }));
                
                return { success: true, articles, totalResults: data.Data.length };
            }
            
            return { success: false, error: data.Message || 'Failed to fetch news' };
        } else if (config.provider === 'coindesk' || config.provider === 'cointelegraph') {
            // For RSS feeds, we would need to parse XML
            // This is a simplified version - in production, use an RSS parser
            return { success: false, error: 'RSS feed parsing not fully implemented. Use NewsAPI or CryptoCompare.' };
        }
        
        return { success: false, error: 'Unsupported provider' };
    } catch (e: any) {
        return { success: false, error: e.message || 'Failed to fetch news articles' };
    }
};

// Search news by keyword
export const searchNews = async (
    config: NewsConfig,
    keyword: string,
    limit: number = 20
): Promise<NewsResult> => {
    return fetchNewsArticles(config, keyword, limit);
};

