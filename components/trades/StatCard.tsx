import React from 'react';

interface StatCardProps {
    label: string;
    value: string;
    subValue?: string;
}

const StatCard: React.FC<StatCardProps> = ({ label, value, subValue }) => {
    return (
        <div className="bg-[#1c1e2f] border border-gray-700/50 rounded-lg p-3">
            <p className="text-xs text-gray-400 whitespace-nowrap">{label}</p>
            <p className="text-lg font-bold text-white mt-1">{value}</p>
            {subValue && <p className="text-xs text-gray-500">{subValue}</p>}
        </div>
    );
};

export default StatCard;
