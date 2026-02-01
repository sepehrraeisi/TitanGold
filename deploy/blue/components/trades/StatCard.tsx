import React from 'react';

interface StatCardProps {
    label: string;
    value: string;
    subValue?: string;
}

const StatCard: React.FC<StatCardProps> = ({ label, value, subValue }) => {
    // Detect if value is positive/negative for color coding
    const isPositive = value.includes('+') || (value.startsWith('$') && !value.includes('-'));
    const isNegative = value.includes('-') && !value.startsWith('$');
    
    // Determine value color based on content
    let valueColor = 'text-white';
    if (isPositive && (value.includes('$') || value.includes('%'))) {
        valueColor = 'text-green-400';
    } else if (isNegative) {
        valueColor = 'text-red-400';
    }

    return (
        <div className="bg-gradient-to-br from-[#1c1e2f] to-[#1a1c2a] border border-gray-700/50 rounded-lg p-3 sm:p-4 hover:border-purple-500/50 hover:shadow-lg hover:shadow-purple-500/10 transition-all duration-300 group">
            <p className="text-xs text-gray-400 whitespace-nowrap mb-1.5 group-hover:text-gray-300 transition-colors">{label}</p>
            <p className={`text-lg sm:text-xl font-bold ${valueColor} mt-1 transition-colors`}>{value}</p>
            {subValue && (
                <p className="text-xs text-gray-500 mt-1 group-hover:text-gray-400 transition-colors">{subValue}</p>
            )}
        </div>
    );
};

export default StatCard;
