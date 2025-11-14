import React from 'react';
import { useLanguage } from '../../context/LanguageContext.tsx';

const PnLChartWidget: React.FC = () => {
    const { t } = useLanguage();
    
    return (
        <div className="bg-[#1c1e2f] border border-gray-700/50 rounded-lg p-4">
            <div className="flex justify-between items-center mb-4">
                <h3 className="font-semibold text-white">{t('advanced_pnl_chart')}</h3>
                <div className="flex items-center gap-1 text-xs">
                    <button className="px-3 py-1 bg-gray-700/50 rounded-md hover:bg-gray-700">{t('daily')}</button>
                    <button className="px-3 py-1 bg-purple-600/50 text-purple-300 rounded-md">{t('weekly')}</button>
                    <button className="px-3 py-1 bg-gray-700/50 rounded-md hover:bg-gray-700">{t('monthly')}</button>
                </div>
            </div>
            <div className="h-64 bg-gray-800/20 rounded-md flex items-center justify-center">
                 <svg width="100%" height="100%" viewBox="0 0 500 200" preserveAspectRatio="none">
                    {/* Main portfolio value line */}
                    <polyline points="20,150 50,140 80,120 110,130 140,110 170,90 200,80 230,70 260,60 290,50 320,40 350,30 380,20 410,30 440,25 470,15" fill="none" stroke="#818cf8" strokeWidth="2"/>
                     {/* Moving average line */}
                    <polyline points="20,145 50,135 80,125 110,120 140,115 170,105 200,95 230,85 260,75 290,65 320,55 350,45 380,35 410,30 440,28 470,22" fill="none" stroke="#a78bfa" strokeWidth="2" strokeDasharray="3,3"/>
                    <text x="50" y="15" fill="#818cf8" fontSize="12">{t('portfolio_value')}</text>
                    <text x="200" y="15" fill="#a78bfa" fontSize="12">{t('moving_average')}</text>
                </svg>
            </div>
        </div>
    );
};

export default PnLChartWidget;