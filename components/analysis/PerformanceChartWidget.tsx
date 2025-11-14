import React, { useState } from 'react';
import { useLanguage } from '../../context/LanguageContext.tsx';

const PerformanceChartWidget: React.FC = () => {
    const { t } = useLanguage();
    const [timeframe, setTimeframe] = useState('7d');
    const [chartType, setChartType] = useState('line');

    return (
        <div className="bg-[#1c1e2f] border border-gray-700/50 rounded-lg p-4 h-full">
            <div className="flex flex-wrap justify-between items-center mb-4 gap-2">
                <h3 className="font-semibold text-white">{t('portfolio_performance_chart')}</h3>
                <div className="flex items-center gap-1 text-xs">
                    <button onClick={() => setTimeframe('7d')} className={`px-3 py-1 rounded-md ${timeframe === '7d' ? 'bg-purple-600 text-white' : 'bg-gray-700/50 hover:bg-gray-700'}`}>{t('7_days')}</button>
                    {/* Other timeframe buttons can be added here */}
                </div>
                <div className="flex items-center gap-1 text-xs border border-gray-700 rounded-md p-0.5">
                    <button onClick={() => setChartType('line')} className={`px-2 py-0.5 rounded ${chartType === 'line' ? 'bg-gray-600' : ''}`}>{t('line')}</button>
                    <button onClick={() => setChartType('area')} className={`px-2 py-0.5 rounded ${chartType === 'area' ? 'bg-gray-600' : ''}`}>{t('area')}</button>
                    <button onClick={() => setChartType('candle')} className={`px-2 py-0.5 rounded ${chartType === 'candle' ? 'bg-gray-600' : ''}`}>{t('candle')}</button>
                </div>
            </div>
            <div className="h-80 bg-gray-800/20 rounded-md flex items-center justify-center">
                {/* Static SVG Chart Placeholder */}
                <svg width="100%" height="100%" viewBox="0 0 500 200" preserveAspectRatio="none">
                    <defs>
                        <linearGradient id="areaGradient" x1="0" x2="0" y1="0" y2="1">
                            <stop offset="0%" stopColor="#8b5cf6" stopOpacity="0.4"/>
                            <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0"/>
                        </linearGradient>
                    </defs>
                    <polyline points="20,180 50,150 100,160 150,120 200,130 250,90 300,100 350,60 400,70 450,40 480,50" fill={chartType === 'area' ? "url(#areaGradient)" : "none"} stroke="#a78bfa" strokeWidth="2"/>
                </svg>
            </div>
        </div>
    );
};

export default PerformanceChartWidget;