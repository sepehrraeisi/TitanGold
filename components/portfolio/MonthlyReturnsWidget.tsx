import React from 'react';
import { useLanguage } from '../../context/LanguageContext.tsx';

const MonthlyReturnsWidget: React.FC = () => {
    const { t } = useLanguage();
    const returns = [
        { month: 'April', value: -3.99 },
        { month: 'May', value: 4.18 },
        { month: 'June', value: -3.07 },
        { month: 'July', value: 7.16 },
        { month: 'August', value: -3.92 },
        { month: 'September', value: 5.06 },
    ];
    
    return (
        <div className="bg-[#1c1e2f] border border-gray-700/50 rounded-lg p-4">
            <h3 className="font-semibold text-white mb-4">{t('monthly_returns')}</h3>
            <div className="space-y-2 text-sm">
                {returns.map(r => (
                    <div key={r.month} className="flex justify-between items-center">
                        <span className="text-gray-300">{r.month}</span>
                        <span className={`font-semibold ${r.value > 0 ? 'text-green-400' : 'text-red-400'}`}>
                            {r.value > 0 ? '+' : ''}{r.value.toFixed(2)}%
                        </span>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default MonthlyReturnsWidget;