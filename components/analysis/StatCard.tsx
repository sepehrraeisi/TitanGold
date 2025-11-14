import React from 'react';
import { useLanguage } from '../../context/LanguageContext.tsx';

interface StatCardProps {
    label: string;
    value: string;
    subValue: string;
    change?: number;
}

const StatCard: React.FC<StatCardProps> = ({ label, value, subValue, change }) => {
    const { t } = useLanguage();
    const isPositive = change && change >= 0;

    const icon = isPositive ? (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
    ) : (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" /></svg>
    );

    return (
        <div className="bg-[#1c1e2f] border border-gray-700/50 rounded-lg p-4 flex items-start justify-between">
            <div>
                <p className="text-sm text-gray-400">{label}</p>
                <p className="text-2xl font-bold text-white mt-2">{value}</p>
                <p className="text-xs text-gray-500">{subValue}</p>
            </div>
            <div className="text-right">
                {icon}
                {change !== undefined && (
                    <p className={`text-sm font-semibold mt-2 ${isPositive ? 'text-green-400' : 'text-red-400'}`}>
                        {isPositive ? '+' : ''}{change.toFixed(1)}%
                    </p>
                )}
            </div>
        </div>
    );
};

export default StatCard;