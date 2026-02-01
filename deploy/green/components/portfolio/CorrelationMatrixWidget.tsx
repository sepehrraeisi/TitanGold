import React from 'react';
import { useLanguage } from '../../context/LanguageContext.tsx';
import type { PortfolioCorrelationMatrix } from '../../types.ts';

interface CorrelationMatrixWidgetProps {
    correlation: PortfolioCorrelationMatrix;
}

const CorrelationMatrixWidget: React.FC<CorrelationMatrixWidgetProps> = ({ correlation }) => {
    const { t } = useLanguage();
    const { assets, values } = correlation;

    const getStyle = (value: number) => {
        const intensity = Math.min(1, Math.abs(value));
        const baseOpacity = 0.2 + intensity * 0.6;
        if (value >= 0) {
            return {
                backgroundColor: `rgba(129, 140, 248, ${baseOpacity.toFixed(2)})`,
            };
        }
        return {
            backgroundColor: `rgba(248, 113, 113, ${baseOpacity.toFixed(2)})`,
        };
    };

    const safeMatrix = values && values.length === assets.length ? values : [];

    return (
        <div className="bg-[#1c1e2f] border border-gray-700/50 rounded-lg p-4">
            <h3 className="font-semibold text-white mb-4">{t('correlation_matrix')}</h3>
            {safeMatrix.length === 0 ? (
                <div className="h-48 flex items-center justify-center text-sm text-gray-400">
                    {t('no_correlation_data')}
                </div>
            ) : (
                <div className="grid grid-cols-[auto_repeat(var(--cols),minmax(0,1fr))] gap-1 text-xs text-center font-semibold"
                    style={{
                        // @ts-expect-error custom property for dynamic columns
                        '--cols': assets.length,
                    }}
                >
                    <div></div>
                    {assets.map(asset => (
                        <div key={`header-${asset}`} className="text-gray-400">
                            {asset}
                        </div>
                    ))}
                    {assets.map((rowAsset, rowIndex) => (
                        <React.Fragment key={`row-${rowAsset}`}>
                            <div className="text-gray-400 text-left self-center px-2">{rowAsset}</div>
                            {safeMatrix[rowIndex].map((value, colIndex) => (
                                <div
                                    key={`cell-${rowAsset}-${assets[colIndex]}`}
                                    className="w-full h-9 flex items-center justify-center rounded text-white"
                                    style={getStyle(value)}
                                >
                                    {value.toFixed(2)}
                                </div>
                            ))}
                        </React.Fragment>
                    ))}
                </div>
            )}
        </div>
    );
};

export default CorrelationMatrixWidget;
