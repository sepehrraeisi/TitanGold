
import React from 'react';

interface StatCardProps {
  label: string;
  value: string | number;
  isPositive?: boolean;
}

const StatCard: React.FC<StatCardProps> = ({ label, value, isPositive }) => {
  return (
    <div className="bg-[#1c1e2f] border border-gray-700/50 rounded-lg p-4">
      <p className="text-sm text-gray-400">{label}</p>
      <p className={`text-2xl font-bold mt-1 ${isPositive ? 'text-green-400' : 'text-white'}`}>{value}</p>
    </div>
  );
};

export default StatCard;
