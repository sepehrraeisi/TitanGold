import React from 'react';
import { useLanguage } from '../../context/LanguageContext.tsx';

const PerformanceAnalysisWidget: React.FC = () => {
    const { t } = useLanguage();
    return (
        <div className="bg-[#1c1e2f] border border-gray-700/50 rounded-lg p-4">
             <h3 className="font-semibold text-white mb-4">{t('performance_analysis')}</h3>
             <div className="h-32 w-full bg-[#0d0f19] rounded-md flex items-center justify-center">
                 <svg width="100%" height="100%" viewBox="0 0 200 80" preserveAspectRatio="none">
                    <polyline points="10,60 30,40 50,50 70,30 90,45 110,25 130,40 150,35 170,20 190,30" fill="none" stroke="#818cf8" strokeWidth="2"/>
                     <path d="M10,60 30,40 50,50 70,30 90,45 110,25 130,40 150,35 170,20 190,30 L190,75 L10,75 Z" fill="url(#gradient)" />
                    <defs>
                        <linearGradient id="gradient" x1="0" x2="0" y1="0" y2="1">
                            <stop offset="0%" stopColor="#818cf8" stopOpacity="0.4"/>
                            <stop offset="100%" stopColor="#818cf8" stopOpacity="0"/>
                        </linearGradient>
                    </defs>
                 </svg>
             </div>
        </div>
    );
};

export default PerformanceAnalysisWidget;
