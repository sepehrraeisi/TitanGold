import React from 'react';
import { useLanguage } from '../../context/LanguageContext.tsx';

const TradingChartWidget: React.FC = () => {
    const { t } = useLanguage();

    return (
        <div className="bg-[#1c1e2f] border border-gray-700/50 rounded-lg p-4">
            <div className="flex flex-wrap justify-between items-center mb-4">
                <h3 className="font-semibold text-white">{t('multi_dimensional_chart')}</h3>
                <div className="flex items-center gap-2 text-xs">
                    <button className="px-3 py-1 bg-gray-700/50 rounded-md hover:bg-gray-700">1H</button>
                    <button className="px-3 py-1 bg-gray-700/50 rounded-md hover:bg-gray-700">4H</button>
                    <button className="px-3 py-1 bg-gray-700/50 rounded-md hover:bg-gray-700">1D</button>
                    <button className="px-3 py-1 bg-purple-600/50 text-purple-300 rounded-md hover:bg-purple-600">{t('ai_analysis')}</button>
                </div>
            </div>
            {/* Simplified static representation of a trading chart */}
            <div className="h-96 w-full bg-[#0d0f19] rounded-md flex items-center justify-center">
                 <svg width="100%" height="100%" viewBox="0 0 500 250" preserveAspectRatio="none">
                    {/* Grid lines */}
                    {[1, 2, 3, 4].map(i => <line key={i} x1="0" y1={i * 50} x2="500" y2={i * 50} stroke="#2a2d42" strokeWidth="1" />)}
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(i => <line key={i} x1={i * 50} y1="0" x2={i * 50} y2="250" stroke="#2a2d42" strokeWidth="1" />)}
                    
                    {/* Candlesticks */}
                    <rect x="30" y="100" width="10" height="80" fill="#f43f5e" /> 
                    <line x1="35" y1="90" x2="35" y2="190" stroke="#f43f5e" strokeWidth="2" />
                    <rect x="70" y="80" width="10" height="60" fill="#10b981" />
                    <line x1="75" y1="70" x2="75" y2="150" stroke="#10b981" strokeWidth="2" />
                    <rect x="110" y="120" width="10" height="30" fill="#f43f5e" />
                    <line x1="115" y1="110" x2="115" y2="160" stroke="#f43f5e" strokeWidth="2" />
                    <rect x="150" y="60" width="10" height="90" fill="#10b981" />
                    <line x1="155" y1="50" x2="155" y2="160" stroke="#10b981" strokeWidth="2" />

                    {/* Volume Bars */}
                    <rect x="30" y="220" width="10" height="20" fill="#f43f5e" opacity="0.5" />
                    <rect x="70" y="210" width="10" height="30" fill="#10b981" opacity="0.5" />
                    <rect x="110" y="230" width="10" height="10" fill="#f43f5e" opacity="0.5" />
                    <rect x="150" y="200" width="10" height="40" fill="#10b981" opacity="0.5" />

                    {/* Price Line (example) */}
                    <polyline points="35,100 75,80 115,120 155,60 195,90 235,110 275,85 315,130 355,100 395,140 435,120 475,150" fill="none" stroke="#4f46e5" strokeWidth="2"/>

                </svg>
            </div>
        </div>
    );
};

export default TradingChartWidget;
