import React from 'react';

interface DonutProps {
    title: string;
    data: { label: string; value: number; color: string }[];
}

const DistributionDonutWidget: React.FC<DonutProps> = ({ title, data }) => {
    const total = data.reduce((sum, item) => sum + item.value, 0);
    let cumulative = 0;

    return (
        <div className="bg-[#1c1e2f] border border-gray-700/50 rounded-lg p-4 h-full">
            <h3 className="font-semibold text-white mb-4">{title}</h3>
            <div className="flex items-center justify-center gap-6">
                <div className="relative w-28 h-28">
                    <svg viewBox="0 0 36 36" className="w-full h-full transform -rotate-90">
                        {data.map((item, index) => {
                            const dasharray = (item.value / total) * 100;
                            const dashoffset = cumulative;
                            cumulative += dasharray;
                            return (
                                <circle
                                    key={index}
                                    cx="18" cy="18" r="15.915"
                                    fill="transparent"
                                    stroke={item.color}
                                    strokeWidth="4"
                                    strokeDasharray={`${dasharray} ${100 - dasharray}`}
                                    strokeDashoffset={-dashoffset}
                                />
                            );
                        })}
                    </svg>
                </div>
                <div className="text-sm space-y-2">
                    {data.map((item, index) => (
                        <div key={index} className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }}></div>
                            <span>{item.label}</span>
                            <span className="font-bold text-gray-300">{item.value}%</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default DistributionDonutWidget;