import React, { useState, useEffect, useMemo } from 'react';
import { useLanguage } from '../context/LanguageContext.tsx';
import { NewsArticle, NewsFilterPreset, NewsPageData } from '../types.ts';
import SummaryCard from './news/SummaryCard.tsx';
import NewsCard from './news/NewsCard.tsx';
import MarketSentimentWidget from './news/MarketSentimentWidget.tsx';
import EconomicCalendarWidget from './news/EconomicCalendarWidget.tsx';
import AIAnalysisModal from './modals/AIAnalysisModal.tsx';
import { Button } from './ui/button.tsx';
import * as api from '../services/api.ts';

const News: React.FC = () => {
    const { t } = useLanguage();
    const [isLoading, setIsLoading] = useState(true);
    const [data, setData] = useState<NewsPageData | null>(null);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [isFilterUpdating, setIsFilterUpdating] = useState(false);
    const [selectedArticle, setSelectedArticle] = useState<NewsArticle | null>(null);

    useEffect(() => {
        const fetchData = async () => {
            const newsData = await api.fetchNewsPageData();
            setData(newsData);
            setIsLoading(false);
        };
        fetchData();
    }, []);

    const activePreset: NewsFilterPreset | undefined = data
        ? data.filterPresets.find(preset => preset.id === data.activeFilterId)
        : undefined;

    const matchesPreset = (article: NewsArticle, preset?: NewsFilterPreset): boolean => {
        if (!preset) {
            return true;
        }

        const inCategory = preset.categories.includes('All') || preset.categories.includes(article.category);
        const inSentiment = preset.sentiments.includes('All') || preset.sentiments.includes(article.sentiment);
        const meetsImpact = preset.minImpact ? article.impactScore >= preset.minImpact : true;
        const sourceId = data?.sources.find(source =>
            article.source.toLowerCase().includes(source.name.toLowerCase()),
        )?.id;
        const sourceMatches = !preset.sources || (sourceId ? preset.sources.includes(sourceId) : false);

        return inCategory && inSentiment && meetsImpact && sourceMatches;
    };

    const filteredNews = useMemo(() => {
        if (!data) {
            return [] as NewsArticle[];
        }
        const subset = data.articles.filter(article => matchesPreset(article, activePreset));
        return subset
            .slice()
            .sort((a, b) => {
                const pinnedDiff = Number(Boolean(b.pinned)) - Number(Boolean(a.pinned));
                if (pinnedDiff !== 0) {
                    return pinnedDiff;
                }
                return (b.priority ?? 0) - (a.priority ?? 0);
            });
    }, [data, activePreset]);

    const handleRefresh = async () => {
        setIsRefreshing(true);
        try {
            const updated = await api.refreshNewsFeed();
            setData(updated);
        } finally {
            setIsRefreshing(false);
        }
    };

    const handleFilterChange = async (presetId: string) => {
        if (!data || data.activeFilterId === presetId) {
            return;
        }

        setIsFilterUpdating(true);
        try {
            const updated = await api.setNewsActiveFilter(presetId);
            setData(updated);
        } finally {
            setIsFilterUpdating(false);
        }
    };

    const breakingArticle = data
        ? (data.breakingArticleId && data.articles.find(article => article.id === data.breakingArticleId))
            ?? data.articles.find(article => article.isBreaking)
            ?? data.articles[0]
        : undefined;

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
                {data.stats.map(stat => (
                    <SummaryCard
                        key={stat.id}
                        title={t(stat.labelKey)}
                        value={stat.value}
                        suffix={stat.suffix}
                        delta={stat.delta}
                        direction={stat.direction}
                    />
                ))}
            </div>

            {breakingArticle && (
                <div className="bg-red-600/20 border border-red-500/30 rounded-lg p-4 flex items-center gap-4">
                    <span className="bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-md">{t('breaking_news')}</span>
                    <p className="text-sm text-red-200">{breakingArticle.headline}</p>
                </div>
            )}

            <div className="flex flex-col lg:flex-row gap-6">
                <div className="w-full lg:w-2/3">
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="font-semibold text-white">{t('main_feed')}</h2>
                        <div className="flex items-center gap-2 text-xs flex-wrap">
                            {data.filterPresets.map(preset => (
                                <button
                                    key={preset.id}
                                    onClick={() => handleFilterChange(preset.id)}
                                    disabled={isFilterUpdating && preset.id !== data.activeFilterId}
                                    className={`px-3 py-1 rounded-md transition-colors ${data.activeFilterId === preset.id
                                        ? 'bg-purple-600 text-white'
                                        : 'bg-gray-700/50 hover:bg-gray-700 text-gray-300'}`}
                                >
                                    {t(preset.nameKey)}
                                </button>
                            ))}
                            <Button
                                variant="outline"
                                onClick={handleRefresh}
                                disabled={isRefreshing}
                                className="h-8 px-3 text-xs"
                            >
                                {isRefreshing ? t('loading') : t('refresh')}
                            </Button>
                        </div>
                    </div>
                    {filteredNews.length === 0 ? (
                        <div className="bg-[#1c1e2f] border border-dashed border-gray-700/70 text-center text-sm text-gray-400 rounded-lg py-10">
                            {t('no_news_available')}
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {filteredNews.map(article => (
                                <NewsCard key={article.id} article={article} onReadAnalysis={() => setSelectedArticle(article)} />
                            ))}
                        </div>
                    )}
                </div>
                <aside className="w-full lg:w-1/3 space-y-6">
                    <MarketSentimentWidget sentiment={data.sentiment} />
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