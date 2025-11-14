import React from 'react';
import { useLanguage } from '../../context/LanguageContext.tsx';

const AssetDistributionWidget: React.FC = () => {
    const { t } = useLanguage();
    const data = [
        { name: 'BTC', color: '#f7931a' },
        { name: 'ETH', color: '#627eea' },
        { name: 'ADA', color: '#0033ad' },
        { name: 'DOT', color: '#e6007a' },
        { name: 'LINK', color: '#2a5ada' },
        { name: 'UNI', color: '#ff007a' },
        { name: 'AAVE', color: '#b6509e' },
        { name: 'MATIC', color: '#8247e5' },
    ];

    return (
        <div className="bg-[#1c1e2f] border border-gray-700/50 rounded-lg p-4 h-full">
            <h3 className="font-semibold text-white mb-4">{t('asset_distribution')}</h3>
            <div className="flex items-center justify-center h-full">
                <svg width="250" height="250" viewBox="0 0 50 50" className="w-full h-full max-w-[250px] max-h-[250px]">
                    <circle cx="25" cy="25" r="15.915" fill="transparent" stroke="#f7931a" strokeWidth="8" strokeDasharray="30, 70" strokeDashoffset="0"></circle>
                    <circle cx="25" cy="25" r="15.915" fill="transparent" stroke="#627eea" strokeWidth="8" strokeDasharray="25, 75" strokeDashoffset="-30"></circle>
                    <circle cx="25" cy="25" r="15.915" fill="transparent" stroke="#0033ad" strokeWidth="8" strokeDasharray="15, 85" strokeDashoffset="-55"></circle>
                    <circle cx="25" cy="25" r="15.915" fill="transparent" stroke="#e6007a" strokeWidth="8" strokeDasharray="10, 90" strokeDashoffset="-70"></circle>
                    <circle cx="25" cy="25" r="15.915" fill="transparent" stroke="#2a5ada" strokeWidth="8" strokeDasharray="8, 92" strokeDashoffset="-80"></circle>
                    <circle cx="25" cy="25" r="15.915" fill="transparent" stroke="#b6509e" strokeWidth="8" strokeDasharray="12, 88" strokeDashoffset="-88"></circle>
                </svg>
                 <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-xs">
                    {data.map(item => (
                        <div key={item.name} className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }}></div>
                            <span>{item.name}</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default AssetDistributionWidget;