import React from 'react';

interface StatCardProps {
    label: string;
    value: string;
    change?: string;
    subValue?: string;
}

const StatCard: React.FC<StatCardProps> = ({ label, value, change, subValue }) => {
    const isPositive = change ? change.startsWith('+') : false;
    return (
        <div className="bg-[#1c1e2f] border border-gray-700/50 rounded-lg p-4">
            <p className="text-sm text-gray-400">{label}</p>
            <div className="flex justify-between items-baseline mt-2">
                <p className="text-2xl font-bold text-white">{value}</p>
                {change && <p className={`text-sm font-semibold ${isPositive ? 'text-green-400' : 'text-red-400'}`}>{change}</p>}
            </div>
             {subValue && <p className="text-xs text-gray-500 mt-1">{subValue}</p>}
        </div>
    );
};

export default StatCard;