import React, { useState, useEffect } from 'react';
import { useLanguage } from '../context/LanguageContext.tsx';
import { NewsArticle, EconomicEvent } from '../types.ts';
import SummaryCard from './news/SummaryCard.tsx';
import NewsCard from './news/NewsCard.tsx';
import MarketSentimentWidget from './news/MarketSentimentWidget.tsx';
import EconomicCalendarWidget from './news/EconomicCalendarWidget.tsx';
import AIAnalysisModal from './modals/AIAnalysisModal.tsx';
import * as api from '../services/api.ts';

interface NewsData {
    articles: NewsArticle[];
    events: EconomicEvent[];
}

const News: React.FC = () => {
    const { t } = useLanguage();
    const [isLoading, setIsLoading] = useState(true);
    const [data, setData] = useState<NewsData | null>(null);
    const [filter, setFilter] = useState('All News');
    const [selectedArticle, setSelectedArticle] = useState<NewsArticle | null>(null);

    useEffect(() => {
        const fetchData = async () => {
            const newsData = await api.fetchNewsPageData();
            setData(newsData);
            setIsLoading(false);
        };
        fetchData();
    }, []);

    const filteredNews = !data ? [] : filter === 'All News' ? data.articles : data.articles.filter(n => n.category === filter);

    if (isLoading) {
        return <div className="text-center p-10">{t('loading')}</div>;
    }

    if (!data) {
        return <div className="text-center p-10 text-red-500">{t('error_occurred')}</div>
    }

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-white">{t('market_news_page_title')}</h1>
                <p className="text-gray-400 mt-1">{t('market_news_page_desc')}</p>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <SummaryCard title={t('total_news')} value={data.articles.length} />
                <SummaryCard title={t('important_events')} value={data.events.filter(e => e.importance === 'high').length} />
                <SummaryCard title={t('positive_news')} value={data.articles.filter(a => a.sentiment === 'Bullish').length} />
                <SummaryCard title={t('negative_news')} value={data.articles.filter(a => a.sentiment === 'Bearish').length} />
            </div>

            <div className="bg-red-600/20 border border-red-500/30 rounded-lg p-4 flex items-center gap-4">
                <span className="bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-md">{t('breaking_news')}</span>
                <p className="text-sm text-red-200">{data.articles[0].headline}</p>
            </div>
            
            <div className="flex flex-col lg:flex-row gap-6">
                <div className="w-full lg:w-2/3">
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="font-semibold text-white">{t('main_feed')}</h2>
                         <div className="flex items-center gap-2 text-xs">
                             {['All News', 'Crypto', 'Economy', 'Politics'].map(f => (
                                 <button key={f} onClick={() => setFilter(f)} className={`px-3 py-1 rounded-md ${filter === f ? 'bg-purple-600 text-white' : 'bg-gray-700/50 hover:bg-gray-700'}`}>{t(f.toLowerCase().replace(' ', '_'))}</button>
                             ))}
                        </div>
                    </div>
                    <div className="space-y-4">
                        {filteredNews.map(article => (
                            <NewsCard key={article.id} article={article} onReadAnalysis={() => setSelectedArticle(article)} />
                        ))}
                    </div>
                </div>
                <aside className="w-full lg:w-1/3 space-y-6">
                    <MarketSentimentWidget />
                    <EconomicCalendarWidget events={data.events} />
                </aside>
            </div>
            
            {selectedArticle && (
                <AIAnalysisModal
                    isOpen={!!selectedArticle}
                    onClose={() => setSelectedArticle(null)}
                    article={selectedArticle}
                />
            )}
        </div>
    );
};

export default News;