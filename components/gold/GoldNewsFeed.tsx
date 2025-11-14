import React from 'react';
import { useLanguage } from '../../context/LanguageContext.tsx';
import { GoldNewsArticle } from '../../types.ts';
import { PublishableItem } from './TelegramPublisher.tsx';

interface GoldNewsFeedProps {
    news: GoldNewsArticle[];
    onPublish: (item: PublishableItem) => void;
}

const GoldNewsFeed: React.FC<GoldNewsFeedProps> = ({ news, onPublish }) => {
    const { t } = useLanguage();

    const handlePublish = (article: GoldNewsArticle) => {
        onPublish({
            id: `news-${article.id}`,
            type: 'News',
            content: `${article.headline}\n\n${t('source')}: ${article.source}\n${t('ai_analysis')}: ${article.aiAnalysis}`
        });
    };

    return (
        <div className="bg-card border border-border rounded-lg">
            <h3 className="text-lg font-semibold text-foreground p-4 border-b border-border">{t('gold_news_feed')}</h3>
            <div className="space-y-2 p-4">
                {news.map(article => (
                    <NewsItem key={article.id} article={article} onPublish={() => handlePublish(article)} />
                ))}
            </div>
        </div>
    );
};

const NewsItem: React.FC<{ article: GoldNewsArticle; onPublish: () => void; }> = ({ article, onPublish }) => {
    const { t } = useLanguage();
    const isVerified = article.verificationStatus === 'Verified';
    const impactColor = article.impactScore > 75 ? 'bg-red-500' : article.impactScore > 50 ? 'bg-yellow-500' : 'bg-blue-500';

    return (
        <div className="bg-secondary p-3 rounded-lg">
            <p className="font-semibold text-foreground">{article.headline}</p>
            <p className="text-xs text-muted-foreground mt-1">{t('source')}: {article.source}</p>
            <div className="flex flex-wrap items-center gap-4 mt-3 text-xs">
                <span className={`px-2 py-1 rounded-full font-semibold ${isVerified ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'}`}>
                    {t(article.verificationStatus.toLowerCase())}
                </span>
                 <div className="flex items-center gap-2 flex-grow">
                    <span className="text-muted-foreground">{t('impact')}:</span>
                    <div className="w-full bg-border rounded-full h-1.5 flex-grow">
                        <div className={`${impactColor} h-1.5 rounded-full`} style={{ width: `${article.impactScore}%` }}></div>
                    </div>
                     <span className="font-semibold">{article.impactScore}%</span>
                </div>
                <button onClick={onPublish} className="bg-background hover:bg-border text-xs font-semibold py-1 px-2 rounded-md transition-colors ml-auto">{t('publish')}</button>
            </div>
        </div>
    );
};

export default GoldNewsFeed;