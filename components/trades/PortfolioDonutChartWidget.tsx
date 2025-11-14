import React from 'react';
import { useLanguage } from '../../context/LanguageContext.tsx';

const PortfolioDonutChartWidget: React.FC = () => {
    const { t } = useLanguage();
    const data = [
        { name: 'BTC', value: 45.2, color: '#f7931a' },
        { name: 'ETH', value: 32.1, color: '#627eea' },
        { name: 'USDT', value: 22.7, color: '#26a17b' },
    ];
    
    return (
        <div className="bg-[#1c1e2f] border border-gray-700/50 rounded-lg p-4">
             <h3 className="font-semibold text-white mb-4">{t('portfolio_overview')}</h3>
             <div className="flex items-center justify-center gap-6">
                <div className="relative w-32 h-32">
                    <svg viewBox="0 0 36 36" className="w-full h-full">
                        <circle cx="18" cy="18" r="15.915" fill="none" stroke="#374151" strokeWidth="3"></circle>
                        <circle cx="18" cy="18" r="15.915" fill="none" stroke="#f7931a" strokeWidth="3" strokeDasharray="45.2, 100" strokeDashoffset="0"></circle>
                        <circle cx="18" cy="18" r="15.915" fill="none" stroke="#627eea" strokeWidth="3" strokeDasharray="32.1, 100" strokeDashoffset="-45.2"></circle>
                        <circle cx="18" cy="18" r="15.915" fill="none" stroke="#26a17b" strokeWidth="3" strokeDasharray="22.7, 100" strokeDashoffset="-77.3"></circle>
                    </svg>
                </div>
                <div className="text-sm space-y-2">
                    {data.map(item => (
                        <div key={item.name} className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }}></div>
                            <span>{item.name}</span>
                            <span className="font-bold text-gray-300">{item.value}%</span>
                        </div>
                    ))}
                </div>
             </div>
        </div>
    );
};

export default PortfolioDonutChartWidget;
