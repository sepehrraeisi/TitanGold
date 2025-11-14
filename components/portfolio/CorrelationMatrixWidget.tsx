import React from 'react';
import { useLanguage } from '../../context/LanguageContext.tsx';

const CorrelationMatrixWidget: React.FC = () => {
    const { t } = useLanguage();
    const assets = ['BTC', 'ETH', 'ADA', 'DOT', 'LINK'];
    
    // Dummy correlation data
    const matrix = [
        [1.0, 0.8, 0.6, 0.5, 0.7],
        [0.8, 1.0, 0.7, 0.6, 0.8],
        [0.6, 0.7, 1.0, 0.4, 0.5],
        [0.5, 0.6, 0.4, 1.0, 0.6],
        [0.7, 0.8, 0.5, 0.6, 1.0],
    ];

    const getColor = (value: number) => {
        const opacity = Math.abs(value);
        if (value === 1) return `bg-purple-500/80`;
        return `bg-purple-500/` + Math.floor(opacity * 60);
    };

    return (
        <div className="bg-[#1c1e2f] border border-gray-700/50 rounded-lg p-4">
            <h3 className="font-semibold text-white mb-4">{t('correlation_matrix')}</h3>
            <div className="grid grid-cols-6 gap-1 text-xs text-center font-semibold">
                {/* Header row */}
                <div></div>
                {assets.map(asset => <div key={asset} className="text-gray-400">{asset}</div>)}
                
                {/* Matrix rows */}
                {assets.map((rowAsset, rowIndex) => (
                    <React.Fragment key={rowAsset}>
                        <div className="text-gray-400 text-left self-center">{rowAsset}</div>
                        {matrix[rowIndex].map((value, colIndex) => (
                            <div key={colIndex} className={`w-full h-8 flex items-center justify-center rounded ${getColor(value)}`}>
                               {value.toFixed(1)}
                            </div>
                        ))}
                    </React.Fragment>
                ))}
            </div>
        </div>
    );
};

export default CorrelationMatrixWidget;