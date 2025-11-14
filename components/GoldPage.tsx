import React, { useState, useEffect } from 'react';
import { useLanguage } from '../context/LanguageContext.tsx';
import * as api from '../services/api.ts';
import { GoldAsset, GoldPrediction, GoldNewsArticle } from '../types.ts';
import LiveGoldPriceWidget from './gold/LiveGoldPriceWidget.tsx';
import AIPredictionWidget from './gold/AIPredictionWidget.tsx';
import GoldNewsFeed from './gold/GoldNewsFeed.tsx';
import MarketDriversWidget from './gold/MarketDriversWidget.tsx';
import TelegramPublisher, { PublishableItem } from './gold/TelegramPublisher.tsx';

interface GoldPageData {
    assets: GoldAsset[];
    prediction: GoldPrediction;
    news: GoldNewsArticle[];
}

const GoldPage: React.FC = () => {
    const { t } = useLanguage();
    const [isLoading, setIsLoading] = useState(true);
    const [data, setData] = useState<GoldPageData | null>(null);
    const [publishQueue, setPublishQueue] = useState<PublishableItem[]>([]);

    useEffect(() => {
        const fetchData = async () => {
            setIsLoading(true);
            const goldData = await api.fetchGoldPageData();
            setData(goldData);
            setIsLoading(false);
        };
        fetchData();
    }, []);

    const handleAddToQueue = (item: PublishableItem) => {
        setPublishQueue(prev => [item, ...prev]);
    };

    const handleClearQueue = () => {
        setPublishQueue([]);
    };
    
    if (isLoading) {
        return <div className="text-center p-10 text-muted-foreground">{t('loading')}</div>;
    }

    if (!data) {
        return <div className="text-center p-10 text-negative">{t('error_occurred')}</div>
    }

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold text-foreground">{t('gold_page_title')}</h1>
                <p className="text-muted-foreground mt-1">{t('gold_page_desc')}</p>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-6">
                    <LiveGoldPriceWidget assets={data.assets} />
                    <AIPredictionWidget prediction={data.prediction} onPublish={handleAddToQueue} />
                    <GoldNewsFeed news={data.news} onPublish={handleAddToQueue} />
                </div>
                <div className="lg:col-span-1 space-y-6">
                    <MarketDriversWidget />
                    <TelegramPublisher queue={publishQueue} onClear={handleClearQueue} />
                </div>
            </div>
        </div>
    );
};

export default GoldPage;