import React from 'react';
import { useLanguage } from '../../context/LanguageContext.tsx';
import { NewsArticle } from '../../types.ts';

interface NewsCardProps {
    article: NewsArticle;
    onReadAnalysis: () => void;
}

const NewsCard: React.FC<NewsCardProps> = ({ article, onReadAnalysis }) => {
    const { t } = useLanguage();

    const verificationStyles = {
        'Verified': 'bg-green-500/20 text-green-300',
        'Unverified': 'bg-yellow-500/20 text-yellow-300',
        'Disputed': 'bg-red-500/20 text-red-300',
    };
    
    const sentimentStyles = {
        'Bullish': 'text-green-400',
        'Bearish': 'text-red-400',
        'Neutral': 'text-gray-400',
    };

    const impactColor = article.impactScore > 75 ? 'bg-red-500' : article.impactScore > 50 ? 'bg-yellow-500' : 'bg-blue-500';

    return (
        <div className="bg-[#1c1e2f] border border-gray-700/50 rounded-lg p-4">
            <div className="flex justify-between items-start">
                <div>
                    <span className="text-xs text-purple-400 font-semibold">{article.source}</span>
                    <h3 className="font-bold text-white mt-1">{article.headline}</h3>
                </div>
                <span className="text-xs text-gray-500 whitespace-nowrap ml-4">{article.timestamp}</span>
            </div>
            <p className="text-sm text-gray-400 mt-2">{article.snippet}</p>
            <div className="flex flex-wrap items-center gap-4 mt-4 pt-4 border-t border-gray-700/50">
                <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-400">{t('verification')}:</span>
                    <span className={`text-xs font-semibold px-2 py-1 rounded-full ${verificationStyles[article.verificationStatus]}`}>{t(article.verificationStatus.toLowerCase())}</span>
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-400">{t('sentiment')}:</span>
                    <span className={`text-xs font-semibold ${sentimentStyles[article.sentiment]}`}>{t(article.sentiment.toLowerCase())}</span>
                </div>
                <div className="flex-grow flex items-center gap-2">
                    <span className="text-xs text-gray-400">{t('impact')}:</span>
                    <div className="w-full bg-gray-700 rounded-full h-2 flex-grow">
                        <div className={`${impactColor} h-2 rounded-full`} style={{ width: `${article.impactScore}%` }}></div>
                    </div>
                     <span className="text-xs font-semibold">{article.impactScore}%</span>
                </div>
                 <button onClick={onReadAnalysis} className="text-sm text-purple-400 hover:underline font-semibold ml-auto">{t('show_ai_analysis')}</button>
            </div>
        </div>
    );
};

export default NewsCard;