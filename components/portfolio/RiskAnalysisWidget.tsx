import React, { useMemo } from 'react';
import { useLanguage } from '../../context/LanguageContext.tsx';
import type { PortfolioRiskExposure } from '../../types.ts';

interface RiskAnalysisWidgetProps {
    exposures: PortfolioRiskExposure[];
}

const RiskAnalysisWidget: React.FC<RiskAnalysisWidgetProps> = ({ exposures }) => {
    const { t } = useLanguage();

    const geometry = useMemo(() => {
        if (exposures.length === 0) {
            return null;
        }

        const center = { x: 80, y: 80 };
        const maxRadius = 60;
        const stepCount = Math.min(exposures.length, 6);
        const angleStep = (Math.PI * 2) / stepCount;

        const coordinates = exposures.map((exposure, index) => {
            const angle = -Math.PI / 2 + angleStep * index;
            const radius = (exposure.score / 100) * maxRadius;
            const x = center.x + radius * Math.cos(angle);
            const y = center.y + radius * Math.sin(angle);
            const labelX = center.x + (maxRadius + 18) * Math.cos(angle);
            const labelY = center.y + (maxRadius + 18) * Math.sin(angle);
            return {
                id: exposure.id,
                metricKey: exposure.metricKey,
                point: { x, y },
                label: { x: labelX, y: labelY },
            };
        });

        const polygonPath = coordinates
            .map(item => `${item.point.x.toFixed(1)},${item.point.y.toFixed(1)}`)
            .join(' ');
        const gridLevels = [20, 40, 60, 80, 100].map(level =>
            Array.from({ length: stepCount }).map((_, index) => {
                const angle = -Math.PI / 2 + angleStep * index;
                const radius = (level / 100) * maxRadius;
                const x = center.x + radius * Math.cos(angle);
                const y = center.y + radius * Math.sin(angle);
                return `${x.toFixed(1)},${y.toFixed(1)}`;
            }),
        );

        return { coordinates, polygonPath, gridLevels, center };
    }, [exposures]);

    return (
        <div className="bg-[#1c1e2f] border border-gray-700/50 rounded-lg p-4">
            <h3 className="font-semibold text-white mb-4">{t('risk_analysis')}</h3>
            {exposures.length === 0 || !geometry ? (
                <div className="h-48 flex items-center justify-center text-sm text-gray-400">
                    {t('no_risk_exposure_data')}
                </div>
            ) : (
                <div className="h-60 flex items-center justify-center">
                    <svg viewBox="0 0 160 160" className="w-full h-full max-w-[260px] text-gray-400">
                        {geometry.gridLevels.map((level, levelIndex) => (
                            <polygon
                                key={`grid-${levelIndex}`}
                                points={level.join(' ')}
                                fill="none"
                                stroke="#374151"
                                strokeWidth="0.5"
                            />
                        ))}
                        {geometry.coordinates.map(coord => (
                            <line
                                key={`axis-${coord.id}`}
                                x1={geometry.center.x}
                                y1={geometry.center.y}
                                x2={coord.point.x.toFixed(1)}
                                y2={coord.point.y.toFixed(1)}
                                stroke="#374151"
                                strokeWidth="0.5"
                            />
                        ))}
                        <polygon
                            points={geometry.polygonPath}
                            fill="rgba(167, 139, 250, 0.32)"
                            stroke="#a78bfa"
                            strokeWidth="2"
                        />
                        {geometry.coordinates.map(coord => (
                            <text
                                key={`label-${coord.id}`}
                                x={coord.label.x}
                                y={coord.label.y}
                                fill="#9ca3af"
                                fontSize="10"
                                textAnchor="middle"
                            >
                                {t(coord.metricKey)}
                            </text>
                        ))}
                    </svg>
                </div>
            )}
        </div>
    );
};

export default RiskAnalysisWidget;
