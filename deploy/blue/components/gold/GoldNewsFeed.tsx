import React from 'react';
import { useLanguage } from '../../context/LanguageContext.tsx';
import type { GoldNewsArticle, GoldPublishItem } from '../../types.ts';
import Button from '../ui/button.tsx';

interface GoldNewsFeedProps {
    news: GoldNewsArticle[];
    onPublish: (item: GoldPublishItem) => void;
    onVerify: (articleId: string, status: GoldNewsArticle['verificationStatus']) => void;
    onToggleWatchlist: (articleId: string) => void;
    onTogglePin: (articleId: string) => void;
    verifyingId?: string | null;
    watchlistUpdatingId?: string | null;
    pinningId?: string | null;
}

const GoldNewsFeed: React.FC<GoldNewsFeedProps> = ({
    news,
    onPublish,
    onVerify,
    onToggleWatchlist,
    onTogglePin,
    verifyingId,
    watchlistUpdatingId,
    pinningId,
}) => {
    const { t } = useLanguage();

    const handlePublish = (article: GoldNewsArticle) => {
        onPublish({
            id: `news-${article.id}`,
            type: 'News',
            content: `${article.headline}\n\n${t('source')}: ${article.source}\n${t('ai_analysis')}: ${article.aiAnalysis}`,
        });
    };

    return (
        <div className="bg-card border border-border rounded-lg">
            <div className="flex items-center justify-between border-b border-border p-4">
                <h3 className="text-lg font-semibold text-foreground">{t('gold_news_feed')}</h3>
                <span className="text-xs text-muted-foreground">{t('gold_news_items', { count: news.length })}</span>
            </div>
            <div className="space-y-3 p-4">
                {news.map(article => (
                    <NewsItem
                        key={article.id}
                        article={article}
                        onPublish={() => handlePublish(article)}
                        onVerify={status => onVerify(article.id, status)}
                        onToggleWatchlist={() => onToggleWatchlist(article.id)}
                        onTogglePin={() => onTogglePin(article.id)}
                        isVerifying={verifyingId === article.id}
                        isWatchlistUpdating={watchlistUpdatingId === article.id}
                        isPinning={pinningId === article.id}
                    />
                ))}
            </div>
        </div>
    );
};

const NewsItem: React.FC<{
    article: GoldNewsArticle;
    onPublish: () => void;
    onVerify: (status: GoldNewsArticle['verificationStatus']) => void;
    onToggleWatchlist: () => void;
    onTogglePin: () => void;
    isVerifying: boolean;
    isWatchlistUpdating: boolean;
    isPinning: boolean;
}> = ({ article, onPublish, onVerify, onToggleWatchlist, onTogglePin, isVerifying, isWatchlistUpdating, isPinning }) => {
    const { t, language } = useLanguage();
    const isVerified = article.verificationStatus === 'Verified';
    const impactColor = article.impactScore > 75 ? 'bg-red-500' : article.impactScore > 50 ? 'bg-yellow-500' : 'bg-blue-500';
    const publishedAt = new Date(article.publishedAt).toLocaleString(language === 'fa' ? 'fa-IR' : 'en-US', { hour12: false });

    return (
        <div className="rounded-lg border border-border/70 bg-secondary/50 p-4">
            <div className="flex items-start justify-between gap-4">
                <div>
                    <p className="font-semibold text-foreground">{article.headline}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                        {t('source')}: {article.source} · {t('published_at', { time: publishedAt })}
                    </p>
                </div>
                <Button variant="ghost" onClick={onTogglePin} disabled={isPinning} className="h-7 px-2 text-[11px]">
                    {article.pinned ? t('unpin_article') : t('pin_article')}
                </Button>
            </div>

            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-2 text-xs text-muted-foreground">
                    <p>{t('ai_analysis')}: {article.aiAnalysis}</p>
                    <div className="flex flex-wrap gap-2">
                        <span className={`px-2 py-1 rounded-full font-semibold ${isVerified ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'}`}>
                            {t(article.verificationStatus === 'Verified' ? 'verified' : 'unverified')}
                        </span>
                        <span className="px-2 py-1 rounded-full bg-purple-500/20 text-purple-300 font-semibold">
                            {t(`gold_category_${article.category}`)}
                        </span>
                        <span className={`px-2 py-1 rounded-full font-semibold ${article.sentiment === 'Bullish' ? 'bg-green-500/20 text-green-400' : article.sentiment === 'Bearish' ? 'bg-red-500/20 text-red-400' : 'bg-blue-500/20 text-blue-300'}`}>
                            {t(`sentiment_${article.sentiment.toLowerCase()}`)}
                        </span>
                    </div>
                    <div className="flex flex-wrap gap-2 text-[11px]">
                        {article.tags.map(tag => (
                            <span key={tag} className="rounded bg-background px-2 py-1">#{tag}</span>
                        ))}
                    </div>
                </div>
                <div className="flex flex-col justify-between gap-3 text-xs">
                    <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">{t('impact')}:</span>
                        <div className="h-2 flex-1 rounded-full bg-border">
                            <div className={`${impactColor} h-2 rounded-full`} style={{ width: `${article.impactScore}%` }} />
                        </div>
                        <span className="font-semibold">{article.impactScore}%</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <Button
                            variant="ghost"
                            onClick={() => onVerify(isVerified ? 'Unverified' : 'Verified')}
                            disabled={isVerifying}
                            className="h-7 px-2 text-[11px]"
                        >
                            {isVerified ? t('mark_unverified') : t('mark_verified')}
                        </Button>
                        <Button
                            variant="ghost"
                            onClick={onToggleWatchlist}
                            disabled={isWatchlistUpdating}
                            className="h-7 px-2 text-[11px]"
                        >
                            {article.watchlisted ? t('remove_from_watchlist') : t('add_to_watchlist')}
                        </Button>
                        <Button variant="outline" onClick={onPublish} className="h-7 px-3 text-[11px]">
                            {t('publish')}
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default GoldNewsFeed;