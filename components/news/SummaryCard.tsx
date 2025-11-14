import React from 'react';

interface SummaryCardProps {
    title: string;
    value: string | number;
}

const SummaryCard: React.FC<SummaryCardProps> = ({ title, value }) => (
    <div className="bg-[#1c1e2f] border border-gray-700/50 rounded-lg p-4">
        <p className="text-sm text-gray-400">{title}</p>
        <p className="text-2xl font-bold text-white mt-1">{value}</p>
    </div>
);

export default SummaryCard;